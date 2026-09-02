import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import type { DuelResult, LeagueRanking, RankedManager } from '@/api/models'
import { qk } from '@/api/queryKeys'
import type { RankingResponse } from '@/api/types'

/**
 * Standings for a league.
 *
 * Two things the raw payload gets wrong for display purposes:
 *
 *  1. **It is not sorted.** `us` arrives in some internal order — a real
 *     response led with the manager sitting 6th — so the placement fields, not
 *     the array order, decide the ranking.
 *  2. **Which placement applies depends on the mode.** In a duel ("Duell")
 *     league the table is head-to-head: `hhpl` is the position and `hhsp` the
 *     running points. A normal league uses `spl` and `sp`.
 *
 * Duel mode is detected from the data rather than from a flag: `hhpl` is
 * present only in duel leagues, while `gpm` on this response distinguishes
 * classic/arena/etc. and says nothing about duels.
 */
function mapRanking(data: RankingResponse): LeagueRanking {
  const users = data.us ?? []
  const isDuelMode = users.some((user) => user.hhpl !== undefined)

  const managers: RankedManager[] = users.map((user) => ({
    id: user.i,
    name: user.n,
    image: user.uim,
    seasonPoints: user.sp,
    seasonPlacement: user.spl,
    matchdayPoints: user.mdp,
    matchdayPlacement: user.mdpl,
    teamValue: user.tv,
    placementChange: user.ppc ?? 0,
    pointsPerMatchday: user.lp ?? [],
    isAdmin: user.adm ?? false,
    duelPlacement: user.hhpl,
    duelPoints: user.hhsp,
    duelMatchdayPoints: user.hhmp,
    duelOpponentId: user.hhoui,
  }))

  const placementOf = (manager: RankedManager) =>
    isDuelMode
      ? (manager.duelPlacement ?? Number.MAX_SAFE_INTEGER)
      : manager.seasonPlacement

  managers.sort((a, b) => {
    const byPlacement = placementOf(a) - placementOf(b)
    if (byPlacement !== 0) return byPlacement
    // Equal placements are possible; break the tie on the points that decide
    // the table so the order is at least stable and meaningful.
    return isDuelMode
      ? (b.duelPoints ?? 0) - (a.duelPoints ?? 0)
      : b.seasonPoints - a.seasonPoints
  })

  return { isDuelMode, managers }
}

export function useRanking(
  leagueId: string | undefined,
): UseQueryResult<LeagueRanking> {
  return useQuery({
    queryKey: qk.ranking(leagueId ?? 'none'),
    enabled: leagueId !== undefined,
    queryFn: async () =>
      mapRanking(
        await get<RankingResponse>(
          endpoints.leagues.ranking(leagueId as string),
        ),
      ),
  })
}

/**
 * How a manager's current duel stands.
 *
 * Resolved by **comparing matchday points with the opponent** named in
 * `hhoui`, rather than by reading `hhmp` against an assumed scoring scale.
 * Both managers are in the same payload, so the comparison is ground truth
 * from data the API actually states; a 3/1/0 reading of `hhmp` would be an
 * inference about how Kickbase awards duel points, and a league that scored
 * them differently would silently mislabel every row.
 *
 * Returns `undefined` when there is no duel to judge — no opponent named, or
 * the opponent is not in this ranking.
 */
export function duelResultOf(
  manager: RankedManager,
  byId: Map<string, RankedManager>,
): DuelResult | undefined {
  if (manager.duelOpponentId === undefined) return undefined
  const opponent = byId.get(manager.duelOpponentId)
  if (opponent === undefined) return undefined

  if (manager.matchdayPoints > opponent.matchdayPoints) return 'won'
  if (manager.matchdayPoints < opponent.matchdayPoints) return 'lost'
  return 'drawn'
}
