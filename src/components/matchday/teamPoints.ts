import type { MatchLineup } from '@/api/models'

/**
 * What a club's players scored in this match, or `undefined` when not one of
 * them has a figure yet.
 *
 * **Substitutes included**: a player who came on and scored did so for this
 * club, and one who never left the bench contributes nothing because his points
 * are `undefined` rather than `0`. So the figure climbs as the per-player
 * fan-out lands and settles at the club's real Kickbase yield for the match —
 * the number that says *where in this fixture the points were*, which the score
 * cannot.
 *
 * `undefined` rather than `0` for the same reason `MatchPlayer.points` is
 * optional: before kick-off nobody has scored *nothing*, they have scored *not
 * yet*, and a total reading `0` over a team about to play would be a claim.
 *
 * Shared by the [pitch](./MatchLineupTab.tsx)'s corner labels and the
 * [ranking](./MatchRankingTab.tsx)'s per-club headings, so the two cannot
 * disagree about the same club in the same match.
 */
export function teamPoints(lineup: MatchLineup): number | undefined {
  let total: number | undefined

  for (const player of [...lineup.starters, ...lineup.substitutes]) {
    if (player.points === undefined) continue
    total = (total ?? 0) + player.points
  }

  return total
}
