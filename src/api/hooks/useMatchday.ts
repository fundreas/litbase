import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import type { TeamFixture } from '@/api/models'
import { qk } from '@/api/queryKeys'
import type { MatchdaysResponse } from '@/api/types'

export interface CurrentMatchday {
  /** Matchday number, as the API reports it. */
  day: number
  /** Team id → that team's fixture this matchday. */
  fixtureByTeamId: Map<string, TeamFixture>
}

/**
 * The current matchday's fixtures, indexed by team.
 *
 * `/v4/competitions/{id}/matchdays` returns the whole season plus a top-level
 * `day` naming the current matchday. Within one matchday each team appears
 * exactly once (verified: 18 teams across 9 fixtures, no repeats), so it
 * inverts cleanly into a team → fixture lookup — which is what lets any player
 * be annotated with their next opponent from nothing but their `tid`.
 *
 * `t1` is the home team and `t2` the away team; both sides of every fixture
 * are inserted, each from its own perspective.
 *
 * The whole season is one payload and only shifts weekly, so it is cached for
 * an hour.
 */
export function useCurrentMatchday(
  competitionId: string | undefined,
): UseQueryResult<CurrentMatchday> {
  return useQuery({
    queryKey: qk.competitionMatchdays(competitionId ?? 'none'),
    enabled: competitionId !== undefined,
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const data = await get<MatchdaysResponse>(
        endpoints.competitions.matchdays(competitionId as string),
      )

      const matchday = (data.it ?? []).find((entry) => entry.day === data.day)
      const fixtureByTeamId = new Map<string, TeamFixture>()

      for (const fixture of matchday?.it ?? []) {
        fixtureByTeamId.set(fixture.t1, {
          matchId: fixture.mi,
          kickoff: fixture.dt,
          isHome: true,
          opponentId: fixture.t2,
          opponentSymbol: fixture.t2sy ?? fixture.t2,
          opponentImage: fixture.t2im,
        })
        fixtureByTeamId.set(fixture.t2, {
          matchId: fixture.mi,
          kickoff: fixture.dt,
          isHome: false,
          opponentId: fixture.t1,
          opponentSymbol: fixture.t1sy ?? fixture.t1,
          opponentImage: fixture.t1im,
        })
      }

      return { day: data.day, fixtureByTeamId } satisfies CurrentMatchday
    },
  })
}
