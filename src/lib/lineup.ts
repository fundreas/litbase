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

/**
 * The shape actually on the pitch, e.g. `2-1-0` while it is being assembled.
 *
 * Once eleven players are fielded this is guaranteed to be one of
 * {@link FORMATIONS}: the rules only admit counts that fit *some* formation,
 * and since every formation fields ten outfield players, a selection of ten
 * that fits one must equal it exactly. So the label sent to the API on save
 * is the effective shape, not a best guess at one.
 *
 * (An earlier version picked a "display formation" — the nearest legal
 * formation to a partial selection — and drew empty slots for the difference.
 * Showing the effective shape instead means the pitch never implies a
 * formation the user has not actually built.)
 */
export function effectiveFormation(counts: PositionCounts): Formation {
  return { def: counts.def, mid: counts.mid, fwd: counts.fwd }
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
