import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import type { ManagerHistory, ManagerSeason } from '@/api/models'
import { qk } from '@/api/queryKeys'
import type {
  ManagerPerformanceResponse,
  ManagerPerformanceSeason,
} from '@/api/types'

/**
 * A title is won once a season, so the history barely moves. Held for an hour
 * — long enough that the standings, the duels and the matchday ranking all
 * read the same cache entry per manager rather than each asking again.
 */
const STALE_MS = 60 * 60_000

/**
 * `pl` is `0` for every manager of a season still running, the leader
 * included, and 1-based once a season is settled — so `0` is "no placement
 * yet", never a placement, and the running season can never count as a title.
 */
function toSeason(season: ManagerPerformanceSeason): ManagerSeason {
  return {
    id: season.sid,
    label: season.sn,
    placement: season.pl > 0 ? season.pl : undefined,
    totalPoints: season.tp,
    averagePoints: season.ap,
    matchdayWins: season.mdw,
  }
}

export function toManagerHistory(
  data: ManagerPerformanceResponse,
): ManagerHistory {
  const seasons = (data.it ?? []).map(toSeason)
  return {
    id: data.u,
    name: data.unm,
    seasons,
    titles: seasons.filter((season) => season.placement === 1).length,
  }
}

/**
 * **One manager's every season in the league**, and how many of them they won.
 *
 * `/managers/{id}/performance` is the only endpoint that reaches past the
 * current season, which makes it the only route to a title count for an
 * arbitrary manager — the achievements endpoint knows the viewer's *Meister*
 * count outright, but takes no manager id. One request per manager, once an
 * hour, shared by every avatar that shows the stars.
 */
export function useManagerHistory(
  leagueId: string | undefined,
  managerId: string | undefined,
): UseQueryResult<ManagerHistory> {
  return useQuery({
    queryKey: qk.managerPerformance(leagueId ?? 'none', managerId ?? 'none'),
    enabled: leagueId !== undefined && managerId !== undefined,
    staleTime: STALE_MS,
    queryFn: async () =>
      toManagerHistory(
        await get<ManagerPerformanceResponse>(
          endpoints.leagues.managerPerformance(
            leagueId as string,
            managerId as string,
          ),
        ),
      ),
  })
}
