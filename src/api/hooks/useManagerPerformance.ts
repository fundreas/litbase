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
 * A matchday's points settle when it ends and the rest never move. Five
 * minutes, the same as the squad: fresh enough that stepping onto the Details
 * tab after a matchday shows it, without re-asking on every tab change.
 */
const STALE_MS = 5 * 60_000

/**
 * Only the **played** matchdays survive. The running season lists every
 * matchday to the end of the schedule, `mdp` absent on the ones still to
 * come — and a list of future matchdays scoring nothing was exactly what the
 * Details tab used to show, from the wrong field.
 *
 * `pl` is `0` for every manager of a season still running, the leader
 * included, and 1-based once a season is settled — so `0` is "no placement
 * yet", never a placement.
 */
function toSeason(season: ManagerPerformanceSeason): ManagerSeason {
  return {
    id: season.sid,
    label: season.sn,
    placement: season.pl > 0 ? season.pl : undefined,
    totalPoints: season.tp,
    averagePoints: season.ap,
    matchdayWins: season.mdw,
    matchdays: season.it
      .filter((matchday) => matchday.mdp !== undefined)
      .map((matchday) => ({
        day: matchday.day,
        points: matchday.mdp as number,
        isMatchdayWin: matchday.tw,
      })),
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
    // Oldest first, so the season under way is the last one.
    current: seasons.at(-1),
  }
}

/**
 * **One manager's every season in the league, matchday by matchday.**
 *
 * The per-matchday points behind the manager page's
 * [Details tab](../../components/manager/ManagerDetailsTab.tsx). The standings
 * cannot supply them — their `lp` is the fielded eleven, not a score history —
 * and `/managers/{id}/performance` is the one endpoint that carries a
 * manager's matchdays at all. One request, gated to the tab that draws it.
 */
export function useManagerPerformance(
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
