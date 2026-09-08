import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useCallback } from 'react'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import { toRankedManager } from '@/api/hooks/useRanking'
import {
  duelIdOf,
  duelSideOf,
  type Duel,
  type DuelSide,
  type MatchdayDuels,
  type MatchdayStandings,
} from '@/api/models'
import { LIVE_POLL_MS } from '@/api/polling'
import { qk } from '@/api/queryKeys'
import type { RankingResponse, RankingUser } from '@/api/types'

/** How often the standings are re-read while a matchday is being played. */

/** A settled matchday cannot change, so it is held for a while. */
const SETTLED_STALE_MS = 5 * 60_000

/**
 * Through the domain model rather than straight off the wire: the fields a side
 * needs are the fields {@link toRankedManager} already names, and
 * {@link duelSideOf} is the one place they are picked — so the
 * [manager page](../../pages/ManagerDetailPage.tsx), which builds a side from a
 * manager it already holds, cannot end up with a different notion of one.
 */
function toSide(user: RankingUser): DuelSide {
  return duelSideOf(toRankedManager(user))
}

/** The placement a duel league is actually ranked by. */
function tablePosition(side: DuelSide): number {
  return side.duelPlacement ?? side.seasonPlacement
}

/**
 * Pair the managers up from the opponent each one names.
 *
 * `hhoui` is mutual — verified across a live league, where every manager's
 * opponent named them back and ten managers resolved to exactly five duels —
 * but the pairing is still built defensively: a manager is only consumed once,
 * and one whose opponent is missing from the payload (or absent altogether)
 * ends up in `byes` rather than in a half-empty duel or silently dropped.
 */
function mapDuels(data: RankingResponse, day: number): MatchdayDuels {
  const users = data.us ?? []
  const isDuelMode = users.some((user) => user.hhpl !== undefined)
  const byId = new Map(users.map((user) => [user.i, user]))

  const paired = new Set<string>()
  const duels: Duel[] = []
  const byes: DuelSide[] = []

  for (const user of users) {
    if (paired.has(user.i)) continue

    const opponent = user.hhoui === undefined ? undefined : byId.get(user.hhoui)

    if (opponent === undefined || opponent.i === user.i) {
      paired.add(user.i)
      byes.push(toSide(user))
      continue
    }

    paired.add(user.i)
    paired.add(opponent.i)

    // Sides are ordered by the table, so the better-placed manager is always
    // on the left. The id comes from `duelIdOf`, which sorts the pair so the
    // string is the same no matter which of the two the loop reached first.
    const sides: [DuelSide, DuelSide] = [toSide(user), toSide(opponent)]
    sides.sort((a, b) => tablePosition(a) - tablePosition(b))

    duels.push({ id: duelIdOf(user.i, opponent.i), sides })
  }

  duels.sort((a, b) => tablePosition(a.sides[0]) - tablePosition(b.sides[0]))
  byes.sort((a, b) => tablePosition(a) - tablePosition(b))

  return { day, isDuelMode, duels, byes }
}

/**
 * Every manager, ranked by what they scored **on this matchday**.
 *
 * The same `us` array the pairings are built from, mapped with
 * [`toRankedManager`](./useRanking.ts) and sorted on `mdp` instead of on the
 * table — so the season fields still say where the manager stands overall
 * while the headline figure is the day's.
 *
 * `mdpl` is Kickbase's own placement for the matchday and is preferred where
 * it is set, so shared places are shared rather than silently broken by the
 * sort. It reads `0` for a matchday nobody has scored in yet, which is why the
 * [tab that renders this](../../components/ranking/ManagerRankingTab.tsx) falls
 * back to the row's index.
 */
function mapStandings(data: RankingResponse, day: number): MatchdayStandings {
  const users = data.us ?? []
  const managers = users.map(toRankedManager)

  managers.sort(
    (a, b) =>
      b.matchdayPoints - a.matchdayPoints || a.name.localeCompare(b.name),
  )

  return {
    day,
    isDuelMode: users.some((user) => user.hhpl !== undefined),
    managers,
  }
}

/**
 * **One matchday of the standings, cached raw and read two ways.**
 *
 * There is no duel endpoint — `/v4/leagues/{id}/ranking?dayNumber={day}` is
 * the whole source. It returns the standings payload with `hhoui` set to that
 * matchday's opponent and `mdp` to that matchday's points, live while it runs.
 * Every other candidate path (`/duels`, `/ranking/{day}`, `/matchdays/{day}`,
 * `/battles`, `/h2h`) answers 404.
 *
 * The [duels page](../../pages/DuelsPage.tsx) wants that payload as pairings on
 * one tab and as a matchday ranking on the other, so the **response** is what
 * sits in the cache and each hook maps it in `select` — the same arrangement
 * `useSeasonSchedule` and `useCurrentMatchday` use, and the reason switching
 * tabs issues no request at all.
 *
 * `isLive` turns on the live poll. It is the caller's to decide because only
 * the caller knows the clock: the endpoint reports nothing about whether the
 * matchday is under way, so that comes from the competition's fixtures.
 *
 * The day is **not** clamped here — out-of-range values answer 200 with the
 * per-matchday fields stripped, so `day` must already be a real matchday.
 */
function useRankingDayQuery<T>(
  leagueId: string | undefined,
  day: number | undefined,
  isLive: boolean,
  select: (data: RankingResponse) => T,
): UseQueryResult<T> {
  return useQuery({
    queryKey: qk.rankingDay(leagueId ?? 'none', day ?? 0),
    enabled: leagueId !== undefined && day !== undefined,
    staleTime: isLive ? 0 : SETTLED_STALE_MS,
    refetchInterval: isLive ? LIVE_POLL_MS : false,
    select,
    queryFn: () =>
      get<RankingResponse>(endpoints.leagues.ranking(leagueId as string), {
        params: { dayNumber: day },
      }),
  })
}

/**
 * The duel pairings of one matchday, with each manager's points for it.
 *
 * See {@link useRankingDayQuery} for where the data comes from. The selector is
 * memoised on the matchday rather than written inline: React Query memoises
 * `select` on the function's identity, and a fresh arrow each render would
 * re-map and hand back new objects every time — which the duels page holds
 * across renders and fans out over.
 */
export function useDuels(
  leagueId: string | undefined,
  day: number | undefined,
  { isLive = false }: { isLive?: boolean } = {},
): UseQueryResult<MatchdayDuels> {
  const select = useCallback(
    (data: RankingResponse) => mapDuels(data, day as number),
    [day],
  )
  return useRankingDayQuery(leagueId, day, isLive, select)
}

/**
 * The same matchday as a **ranking of managers** — see {@link mapStandings}.
 *
 * Reads the entry `useDuels` filled, so the duels page's Rangliste costs
 * nothing beyond the request its Duelle tab already made.
 */
export function useMatchdayStandings(
  leagueId: string | undefined,
  day: number | undefined,
  { isLive = false }: { isLive?: boolean } = {},
): UseQueryResult<MatchdayStandings> {
  const select = useCallback(
    (data: RankingResponse) => mapStandings(data, day as number),
    [day],
  )
  return useRankingDayQuery(leagueId, day, isLive, select)
}
