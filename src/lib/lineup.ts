import type { PositionKey } from '@/api/models'

/**
 * Kickbase lineup rules.
 *
 * ## Where these come from
 *
 * Kickbase's own help pages state the parts that matter but not the list
 * itself: a lineup is **11 players**, and "jede Formation benötigt mindestens
 * einen Torwart, drei Verteidiger, zwei Mittelfeldspieler und einen Stürmer"
 * — at least 1 GK, 3 DEF, 2 MID, 1 FWD — across **ten** available formations.
 *
 * Those constraints plus a maximum of five defenders leave exactly ten
 * combinations, and they match the formations the app is known to offer. So
 * the list below is derived rather than transcribed; it is worth spot-checking
 * against the app if a formation ever looks wrong.
 *
 * Everything here is pure so the rules can be reasoned about (and later
 * tested) without rendering anything.
 */

export interface Formation {
  def: number
  mid: number
  fwd: number
}

/** Always exactly one keeper. */
export const GOALKEEPER_COUNT = 1

export const LINEUP_SIZE = 11

/**
 * Points forfeited for every slot left empty at kick-off.
 *
 * Kickbase deducts 100 per unfilled place, so nine players costs 200 — a
 * bigger swing than most single-player decisions, which is why the lineup
 * warning quotes the figure rather than just the count.
 */
export const PENALTY_PER_EMPTY_SLOT = 100

/** Points lost with this many players fielded. */
export function emptySlotPenalty(fielded: number): number {
  return Math.max(LINEUP_SIZE - fielded, 0) * PENALTY_PER_EMPTY_SLOT
}

/** The ten allowed formations, ordered by defensive line then midfield. */
export const FORMATIONS: readonly Formation[] = [
  { def: 3, mid: 4, fwd: 3 },
  { def: 3, mid: 5, fwd: 2 },
  { def: 3, mid: 6, fwd: 1 },
  { def: 4, mid: 2, fwd: 4 },
  { def: 4, mid: 3, fwd: 3 },
  { def: 4, mid: 4, fwd: 2 },
  { def: 4, mid: 5, fwd: 1 },
  { def: 5, mid: 2, fwd: 3 },
  { def: 5, mid: 3, fwd: 2 },
  { def: 5, mid: 4, fwd: 1 },
]

export function formationLabel(formation: Formation): string {
  return `${String(formation.def)}-${String(formation.mid)}-${String(formation.fwd)}`
}

export type PositionCounts = Record<PositionKey, number>

export function countPositions(
  positions: readonly PositionKey[],
): PositionCounts {
  const counts: PositionCounts = { gk: 0, def: 0, mid: 0, fwd: 0 }
  for (const position of positions) counts[position] += 1
  return counts
}

/**
 * Formations that could still be reached from these counts — i.e. every
 * position is at or under the formation's allowance.
 *
 * This is what makes a *partial* lineup meaningful. Four defenders are fine
 * while the lineup is being built, because 4-4-2 and others can still absorb
 * them; a fifth is fine too (5-3-2); a sixth is not, because no formation
 * plays six.
 */
export function feasibleFormations(counts: PositionCounts): Formation[] {
  if (counts.gk > GOALKEEPER_COUNT) return []
  return FORMATIONS.filter(
    (formation) =>
      counts.def <= formation.def &&
      counts.mid <= formation.mid &&
      counts.fwd <= formation.fwd,
  )
}

export function isFeasible(counts: PositionCounts): boolean {
  return feasibleFormations(counts).length > 0
}

/**
 * The shape actually on the pitch, e.g. `2-1-0` while it is being assembled.
 *
 * Once eleven players are fielded this is guaranteed to be one of
 * {@link FORMATIONS}: the rules only admit counts that fit *some* formation,
 * and since every formation fields ten outfield players, a selection of ten
 * that fits one must equal it exactly.
 *
 * This is what the **user** sees. It is deliberately not what gets sent — the
 * API only accepts a real formation, so saving uses
 * {@link containerFormation}. Showing the effective shape means the pitch
 * never implies a formation the user has not actually built.
 */
export function effectiveFormation(counts: PositionCounts): Formation {
  return { def: counts.def, mid: counts.mid, fwd: counts.fwd }
}

/** What a slot with nobody in it is sent as. See {@link buildSlots}. */
export const EMPTY_SLOT = ''

/**
 * The formation to *declare* when saving.
 *
 * `POST /lineup` requires `type` to be one of the ten real formations — an
 * illegal string such as `5-3-1`, `2-1-0` or `""` is rejected — and `type`
 * decides which slot index means which position. So a partial lineup still has
 * to be posted inside a legal formation that can hold it, which is what
 * {@link feasibleFormations} computes.
 *
 * Of those, the one whose shape sits closest to the current selection is
 * chosen, by squared distance per position. Total slack is useless as a metric:
 * every formation fields ten outfield players, so `(def+mid+fwd) − selected` is
 * identical for all of them and would collapse to "first in list order".
 *
 * This is distinct from {@link effectiveFormation}, which is what the *user*
 * is shown.
 */
export function containerFormation(counts: PositionCounts): Formation {
  const candidates = feasibleFormations(counts)
  let best = candidates[0] ?? { def: 4, mid: 4, fwd: 2 }
  let bestDistance = Number.POSITIVE_INFINITY
  for (const formation of candidates) {
    const distance =
      (formation.def - counts.def) ** 2 +
      (formation.mid - counts.mid) ** 2 +
      (formation.fwd - counts.fwd) ** 2
    if (distance < bestDistance) {
      best = formation
      bestDistance = distance
    }
  }
  return best
}

/**
 * The eleven `players` entries to post, indexed by slot.
 *
 * `players` is **positional**: index *is* the slot number that comes back as
 * `lo`, and `type` defines the layout — slot 0 is the keeper, then `def`
 * defender slots, then `mid`, then `fwd`. All of this was established against
 * the live API:
 *
 *  - Fewer than eleven entries → `LineupNotEnoughPlayers`.
 *  - A gap at index *n* leaves slot *n* empty, wherever *n* is.
 *  - A player whose position does not match his slot is **silently dropped** —
 *    HTTP 200, but he simply is not in the lineup afterwards. This is why
 *    grouping by position is mandatory rather than conventional.
 *  - `""` reads as an empty slot (so do `null` and `"NULL"`); `"0"` and `"-1"`
 *    are rejected as invalid player ids.
 *
 * `formation` must be able to hold `lineup` — pass {@link containerFormation},
 * which guarantees it, so no player is ever silently truncated here.
 */
export function buildSlots<T extends { id: string; position: PositionKey }>(
  lineup: readonly T[],
  formation: Formation,
): string[] {
  const slots = new Array<string>(LINEUP_SIZE).fill(EMPTY_SLOT)

  const layout: Array<{ position: PositionKey; start: number; size: number }> =
    [
      { position: 'gk', start: 0, size: GOALKEEPER_COUNT },
      { position: 'def', start: 1, size: formation.def },
      { position: 'mid', start: 1 + formation.def, size: formation.mid },
      {
        position: 'fwd',
        start: 1 + formation.def + formation.mid,
        size: formation.fwd,
      },
    ]

  for (const { position, start, size } of layout) {
    const players = lineup
      .filter((player) => player.position === position)
      .slice(0, size)
    players.forEach((player, index) => {
      slots[start + index] = player.id
    })
  }

  return slots
}

/** Can one more player of this position join a lineup with these counts? */
export function canAddPosition(
  counts: PositionCounts,
  position: PositionKey,
): boolean {
  const total = counts.gk + counts.def + counts.mid + counts.fwd
  if (total >= LINEUP_SIZE) return false
  return isFeasible({ ...counts, [position]: counts[position] + 1 })
}

/**
 * Which of the players already in the lineup would, if removed, make room for
 * `incoming`?
 *
 * This is the set the removal dialog offers. It is genuinely narrower than
 * "everyone": dropping a forward does not help you field a sixth defender, so
 * offering the forward would be misleading.
 */
export function removalCandidates<
  T extends { id: string; position: PositionKey },
>(lineup: readonly T[], incoming: { position: PositionKey }): T[] {
  return lineup.filter((player) => {
    const remaining = lineup.filter((other) => other.id !== player.id)
    const counts = countPositions(remaining.map((other) => other.position))
    return canAddPosition(counts, incoming.position)
  })
}
