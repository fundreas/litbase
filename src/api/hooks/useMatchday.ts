import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import type { SeasonMatchday, SeasonSchedule, TeamFixture } from '@/api/models'
import { qk } from '@/api/queryKeys'
import type { MatchdaysResponse } from '@/api/types'

export interface CurrentMatchday {
  /** Matchday number, as the API reports it. */
  day: number
  /** Team id → that team's fixture this matchday. */
  fixtureByTeamId: Map<string, TeamFixture>
}

/** Fixture status code for a match that has been played to the end. */
const FIXTURE_FINISHED = 2

const HOUR = 60 * 60_000

/**
 * The season's fixture list — one request, two views.
 *
 * `/v4/competitions/{id}/matchdays` returns the whole season plus a top-level
 * `day` naming the current matchday. It is the *whole* season in one payload
 * and only shifts weekly, so it is cached for an hour and both hooks below
 * read the same cache entry through `select` rather than fetching twice.
 */
function useMatchdaysQuery<T>(
  competitionId: string | undefined,
  select: (data: MatchdaysResponse) => T,
): UseQueryResult<T> {
  return useQuery({
    queryKey: qk.competitionMatchdays(competitionId ?? 'none'),
    enabled: competitionId !== undefined,
    staleTime: HOUR,
    select,
    queryFn: () =>
      get<MatchdaysResponse>(
        endpoints.competitions.matchdays(competitionId as string),
      ),
  })
}

/*
 * The selectors are module-level constants, not inline arrows. React Query
 * memoises `select` on the function's identity, so an arrow created during
 * render would re-map on every render and hand consumers a brand-new Map each
 * time — quietly breaking every `useMemo` downstream that depends on it.
 */

function selectCurrentMatchday(data: MatchdaysResponse): CurrentMatchday {
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

  return { day: data.day, fixtureByTeamId }
}

function selectSeasonSchedule(data: MatchdaysResponse): SeasonSchedule {
  const matchdays = (data.it ?? [])
    .map((entry) => {
      const kickoffs = (entry.it ?? [])
        .map((fixture) => fixture.dt)
        .sort((a, b) => a.localeCompare(b))
      const start = kickoffs.at(0)
      const end = kickoffs.at(-1)
      if (start === undefined || end === undefined) return undefined
      return {
        day: entry.day,
        start,
        end,
        isFinished: (entry.it ?? []).every(
          (fixture) => fixture.st === FIXTURE_FINISHED,
        ),
      } satisfies SeasonMatchday
    })
    .filter((entry): entry is SeasonMatchday => entry !== undefined)
    .sort((a, b) => a.day - b.day)

  return { currentDay: data.day, matchdays }
}

/**
 * The current matchday's fixtures, indexed by team.
 *
 * Within one matchday each team appears exactly once (verified: 18 teams
 * across 9 fixtures, no repeats), so it inverts cleanly into a team → fixture
 * lookup — which is what lets any player be annotated with their next opponent
 * from nothing but their `tid`.
 *
 * `t1` is the home team and `t2` the away team; both sides of every fixture
 * are inserted, each from its own perspective.
 */
export function useCurrentMatchday(
  competitionId: string | undefined,
): UseQueryResult<CurrentMatchday> {
  return useMatchdaysQuery(competitionId, selectCurrentMatchday)
}

/**
 * Every matchday of the season, with when it runs and whether it is over.
 *
 * A matchday spans a weekend, so both the earliest and the latest kick-off are
 * kept: the first is what "has it started?" is measured against, the pair is
 * what a picker renders as a date range. Matchdays without fixtures — which
 * the API has not been seen to return, but the shape allows — are dropped
 * rather than given a bogus date.
 *
 * `currentDay` is the competition's own `day`, and it is the *upcoming*
 * matchday once the previous one has been played. That makes it the right
 * default for a picker, and it is deliberately not the `day` the ranking
 * endpoint reports, which is the last **scored** matchday instead.
 */
export function useSeasonSchedule(
  competitionId: string | undefined,
): UseQueryResult<SeasonSchedule> {
  return useMatchdaysQuery(competitionId, selectSeasonSchedule)
}
