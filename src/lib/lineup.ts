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

const FALLBACK_FORMATION: Formation = { def: 4, mid: 4, fwd: 2 }

/**
 * The formation to draw the pitch with: of the ones still reachable, the one
 * whose *shape* is closest to what is already selected.
 *
 * Note that total slack is useless as a metric here — every formation fields
 * ten outfield players, so `(def+mid+fwd) - selected` is identical for all of
 * them and would silently reduce to "first in list order". Squared distance
 * per position is what actually discriminates: a 4-4-2 selection scores 0
 * against 4-4-2 and worse against everything else.
 *
 * Ties break toward the earlier entry in {@link FORMATIONS}, so an empty
 * lineup settles on 3-4-3 instead of flickering as players are added.
 */
export function displayFormation(counts: PositionCounts): Formation {
  const candidates = feasibleFormations(counts)
  if (candidates.length === 0) return FALLBACK_FORMATION

  let best = candidates[0] ?? FALLBACK_FORMATION
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
