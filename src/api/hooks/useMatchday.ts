import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useCallback } from 'react'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import type {
  MatchdayFixture,
  MatchdayMatch,
  SeasonMatchday,
  SeasonSchedule,
  TeamFixture,
  TeamSeasonFixture,
} from '@/api/models'
import { MATCHDAY_STATE_POLL_MS } from '@/api/polling'
import { qk } from '@/api/queryKeys'
import type { FixtureItem, MatchdaysResponse } from '@/api/types'
import { simulateMatchdays } from '@/dev/simulation'
import { nowMs } from '@/lib/clock'

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
 * How soon before a kick-off the list starts watching the clock.
 *
 * Small but load-bearing: see {@link isMatchdayLive}.
 */
const KICKOFF_SOON_MS = 10 * 60_000

/**
 * Is the **current** matchday live, or about to be?
 *
 * "Running" is kick-off having passed without the API reporting the match
 * finished — the same reading as {@link fixtureState}, and it goes through
 * `nowMs()` so the [development profile's clock](../../dev/simulation.ts) moves
 * it too.
 *
 * **The "about to be" half is what makes the poll self-starting.** This decides
 * both `staleTime` and `refetchInterval` below, and React Query only
 * re-evaluates those when the query refetches or an observer re-renders. So
 * "nothing is running yet" used to mean no interval, which meant nothing
 * re-read the clock, which meant the first kick-off of a matchday was never
 * noticed by a page that had been sitting open since before it — the list kept
 * showing `–:–` and the match page kept showing a kick-off time. Watching the
 * ten minutes before a kick-off costs one request a minute and closes that
 * loop; from the first whistle the running branch keeps it open.
 *
 * Only the current matchday is examined. A season's other 33 are either over or
 * not started, and scanning them would make a page's polling depend on fixtures
 * nobody is looking at.
 */
function isMatchdayLive(data: MatchdaysResponse | undefined): boolean {
  if (data === undefined) return false
  const matchday = (data.it ?? []).find((entry) => entry.day === data.day)
  const now = nowMs()

  return (matchday?.it ?? []).some((fixture) => {
    if (fixture.st === FIXTURE_FINISHED) return false
    const kickoff = Date.parse(fixture.dt)
    return !Number.isNaN(kickoff) && now >= kickoff - KICKOFF_SOON_MS
  })
}

/**
 * The season's fixture list — one request, two views.
 *
 * `/v4/competitions/{id}/matchdays` returns the whole season plus a top-level
 * `day` naming the current matchday. It is the *whole* season in one payload
 * and only shifts weekly, so it is cached for an hour and both hooks below
 * read the same cache entry through `select` rather than fetching twice.
 *
 * **This payload is where "when are we?" comes from** — the current matchday,
 * every kick-off, and whether each match is over. That makes it the one place
 * the [live development profile](../../dev/simulation.ts) has to touch to put
 * the app inside a matchday, so `simulateMatchdays` wraps the response here,
 * before mapping and before the cache: every consumer then sees one consistent
 * answer. It returns its input unchanged unless `npm run dev:live` is running.
 */
function useMatchdaysQuery<T>(
  competitionId: string | undefined,
  select: (data: MatchdaysResponse) => T,
): UseQueryResult<T> {
  return useQuery({
    queryKey: qk.competitionMatchdays(competitionId ?? 'none'),
    enabled: competitionId !== undefined,
    /*
     * An hour is right for a season's fixture list and wrong the moment a
     * match kicks off: `st` flips to finished in here, and everything that
     * asks "is this matchday over?" reads it. So from shortly before the
     * current matchday's first kick-off until its last final whistle the entry
     * goes stale at once and polls, and the rest of the week it is left alone.
     *
     * The "shortly before" is not padding — it is what lets the poll start
     * itself, and `isMatchdayLive` carries the reasoning.
     *
     * The live *score* deliberately does **not** come from here any more —
     * see [`useLiveMatches`](./useLiveMatches.ts). This is about the states.
     */
    staleTime: (query) => (isMatchdayLive(query.state.data) ? 0 : HOUR),
    refetchInterval: (query) =>
      isMatchdayLive(query.state.data) ? MATCHDAY_STATE_POLL_MS : false,
    select,
    queryFn: async () => {
      const data = await get<MatchdaysResponse>(
        endpoints.competitions.matchdays(competitionId as string),
      )
      // `import.meta.env.DEV` directly, rather than `env.isDev` — a literal is
      // what lets the bundler fold this branch away and drop the dev module
      // from the build entirely, instead of shipping it switched off.
      return import.meta.env.DEV ? simulateMatchdays(data) : data
    },
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
 * One fixture as a **match**, with home and away left where they are.
 *
 * The team-indexed selectors above answer "what is this club doing"; this
 * answers "who plays whom", which is what a fixture list and a match page both
 * want. Same payload, one more reading of it.
 */
function toMatchdayMatch(fixture: FixtureItem): MatchdayMatch {
  return {
    matchId: fixture.mi,
    day: fixture.day,
    kickoff: fixture.dt,
    isFinished: fixture.st === FIXTURE_FINISHED,
    home: {
      id: fixture.t1,
      symbol: fixture.t1sy ?? fixture.t1,
      image: fixture.t1im,
    },
    away: {
      id: fixture.t2,
      symbol: fixture.t2sy ?? fixture.t2,
      image: fixture.t2im,
    },
    goalsHome: fixture.t1g,
    goalsAway: fixture.t2g,
  }
}

/** Kick-off first, then the home club, so the list order never wobbles. */
function byKickoff(a: MatchdayMatch, b: MatchdayMatch): number {
  return (
    a.kickoff.localeCompare(b.kickoff) ||
    a.home.symbol.localeCompare(b.home.symbol)
  )
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

/**
 * One specific matchday's fixtures, indexed by team.
 *
 * Like {@link useCurrentMatchday} but for any matchday, and carrying the
 * result and finished flag as well — which is what lets a player's row say
 * whether their match is open, running or over.
 *
 * The selector cannot be a module constant here because it closes over `day`,
 * so it is memoised on `day` instead. That keeps React Query's `select` memo
 * intact: it re-maps when the matchday changes and not on every render.
 *
 * Reads the same cache entry as the other two hooks — one request serves the
 * squad page, the duel picker and this.
 */
export function useMatchdayFixtures(
  competitionId: string | undefined,
  day: number | undefined,
): UseQueryResult<Map<string, MatchdayFixture>> {
  const select = useCallback(
    (data: MatchdaysResponse) => {
      const matchday = (data.it ?? []).find((entry) => entry.day === day)
      const byTeamId = new Map<string, MatchdayFixture>()

      for (const fixture of matchday?.it ?? []) {
        const isFinished = fixture.st === FIXTURE_FINISHED
        byTeamId.set(fixture.t1, {
          matchId: fixture.mi,
          kickoff: fixture.dt,
          isHome: true,
          opponentId: fixture.t2,
          opponentSymbol: fixture.t2sy ?? fixture.t2,
          opponentImage: fixture.t2im,
          isFinished,
          goalsFor: fixture.t1g,
          goalsAgainst: fixture.t2g,
        })
        byTeamId.set(fixture.t2, {
          matchId: fixture.mi,
          kickoff: fixture.dt,
          isHome: false,
          opponentId: fixture.t1,
          opponentSymbol: fixture.t1sy ?? fixture.t1,
          opponentImage: fixture.t1im,
          isFinished,
          goalsFor: fixture.t2g,
          goalsAgainst: fixture.t1g,
        })
      }

      return byTeamId
    },
    [day],
  )

  return useMatchdaysQuery(competitionId, select)
}

/**
 * Every match of one matchday, kick-off first.
 *
 * The [matchday page](../../../docs/pages/matchday.md)'s list. Reads the same
 * cache entry as everything else in this file, so a page that shows the
 * fixtures *and* annotates players with them pays for one request.
 *
 * Memoised on `day` for the reason spelled out above the module-level
 * selectors: React Query memoises `select` on the function's identity, so an
 * inline arrow would re-map on every render and hand back a fresh array each
 * time.
 */
export function useMatchdayMatches(
  competitionId: string | undefined,
  day: number | undefined,
): UseQueryResult<MatchdayMatch[]> {
  const select = useCallback(
    (data: MatchdaysResponse) => {
      const matchday = (data.it ?? []).find((entry) => entry.day === day)
      return (matchday?.it ?? []).map(toMatchdayMatch).sort(byKickoff)
    },
    [day],
  )

  return useMatchdaysQuery(competitionId, select)
}

/**
 * **One club's whole season**, ascending by matchday.
 *
 * The fourth reading of the same cached payload, and the one the
 * [team page](../../../docs/pages/team.md) is built on: everything it derives
 * about a club — the form, the record, the home/away split, the streak, the
 * fixture ticker — comes out of this one list, so the Übersicht costs no
 * request of its own beyond what the squad and matchday pages have already
 * fetched.
 *
 * The season's 34 matchdays are scanned rather than indexed, because a club's
 * fixtures are spread across all of them and there is no key that gathers them.
 * That is 34 iterations over ~9 fixtures each on a payload that changes once a
 * week, memoised on the team id by `select`.
 *
 * A club with no fixture on some matchday — a rescheduled game, or a competition
 * with an odd number of teams — simply has no entry for it. The list is the
 * club's fixtures, not one slot per matchday, so nothing downstream may assume
 * `fixtures[n].day === n + 1`.
 */
export function useTeamSeason(
  competitionId: string | undefined,
  teamId: string | undefined,
): UseQueryResult<TeamSeasonFixture[]> {
  const select = useCallback(
    (data: MatchdaysResponse) => {
      const season: TeamSeasonFixture[] = []
      if (teamId === undefined) return season

      for (const matchday of data.it ?? []) {
        for (const fixture of matchday.it ?? []) {
          const isHome = fixture.t1 === teamId
          if (!isHome && fixture.t2 !== teamId) continue

          season.push({
            day: fixture.day,
            matchId: fixture.mi,
            kickoff: fixture.dt,
            isHome,
            opponentId: isHome ? fixture.t2 : fixture.t1,
            opponentSymbol:
              (isHome ? fixture.t2sy : fixture.t1sy) ??
              (isHome ? fixture.t2 : fixture.t1),
            opponentImage: isHome ? fixture.t2im : fixture.t1im,
            isFinished: fixture.st === FIXTURE_FINISHED,
            goalsFor: isHome ? fixture.t1g : fixture.t2g,
            goalsAgainst: isHome ? fixture.t2g : fixture.t1g,
          })
        }
      }

      return season.sort((a, b) => a.day - b.day)
    },
    [teamId],
  )

  return useMatchdaysQuery(competitionId, select)
}

/**
 * One match, found by id **anywhere in the season**.
 *
 * What the [match detail page](../../../docs/pages/match-detail.md) resolves
 * its URL with: the route carries a match id and nothing else, and this is
 * what turns that into a matchday number — which everything else on the page
 * then needs, since points, fixtures and the standings are all matchday-scoped.
 *
 * `undefined` data with a settled query means the id is not in the fixture
 * list, which is a 404 for that page rather than an error.
 */
export function useSeasonMatch(
  competitionId: string | undefined,
  matchId: string | undefined,
): UseQueryResult<MatchdayMatch | undefined> {
  const select = useCallback(
    (data: MatchdaysResponse) => {
      for (const matchday of data.it ?? []) {
        const fixture = (matchday.it ?? []).find(
          (entry) => entry.mi === matchId,
        )
        if (fixture !== undefined) return toMatchdayMatch(fixture)
      }
      return undefined
    },
    [matchId],
  )

  return useMatchdaysQuery(competitionId, select)
}
