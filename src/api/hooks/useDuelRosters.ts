import {
  useQueries,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query'
import { useMemo } from 'react'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import { useMatchdayFixtures } from '@/api/hooks/useMatchday'
import {
  duelPlayerStatus,
  fixtureState,
  toPosition,
  type DuelPlayer,
  type DuelRoster,
  type DuelSide,
} from '@/api/models'
import { qk } from '@/api/queryKeys'
import type { ManagerSquadResponse, PlayerDetailResponse } from '@/api/types'

/** How often a player is re-read while their match is actually being played. */
const LIVE_POLL_MS = 60_000

/** One manager's players, fielded or not. Works for *any* manager. */
export function useManagerSquad(
  leagueId: string | undefined,
  userId: string | undefined,
): UseQueryResult<ManagerSquadResponse> {
  return useQuery({
    queryKey: qk.managerSquad(leagueId ?? 'none', userId ?? 'none'),
    enabled: leagueId !== undefined && userId !== undefined,
    staleTime: 5 * 60_000,
    queryFn: () =>
      get<ManagerSquadResponse>(
        endpoints.leagues.managerSquad(leagueId as string, userId as string),
      ),
  })
}

/**
 * Both managers' teams for one matchday, with each player's points and state.
 *
 * This is the most expensive thing the app does, and the reason is that
 * **there is no bulk source of per-player matchday points**. `ph` on the
 * player-detail endpoint is the only one, so the points are fanned out one
 * request per player. Three things keep that honest:
 *
 *  1. **Only players who can have points are fetched.** A player whose club
 *     has not kicked off yet is skipped entirely — there is nothing to read.
 *  2. **A settled player is fetched once.** Their match is over, their points
 *     cannot change, so the query never goes stale for the rest of the
 *     session.
 *  3. **Only players actually on the pitch are polled.** The minute-poll is
 *     attached per player, not to the page, so a matchday with one late match
 *     running costs one request a minute rather than twenty-two.
 *
 * Both squads and the fixtures come from three further queries, all shared
 * with the rest of the app — the fixture list is the same cache entry the
 * squad page and the duel picker already use.
 */
export function useDuelRosters(
  leagueId: string | undefined,
  competitionId: string | undefined,
  day: number | undefined,
  sides: [DuelSide, DuelSide] | undefined,
): {
  data?: [DuelRoster, DuelRoster]
  isPending: boolean
  isError: boolean
  error: unknown
  /** True while per-player points are still arriving; rows render without them. */
  isPointsPending: boolean
  refetch: () => void
} {
  const squadA = useManagerSquad(leagueId, sides?.[0].id)
  const squadB = useManagerSquad(leagueId, sides?.[1].id)
  const fixtures = useMatchdayFixtures(competitionId, day)

  // Which players need a points request, and which of those are live. Both
  // squads are flattened into one list so the fan-out is a single `useQueries`
  // — one hook call whose length may change between renders, which is exactly
  // what `useQueries` exists for.
  const wanted = useMemo(() => {
    const byTeam = fixtures.data
    if (byTeam === undefined) return []

    return [squadA.data, squadB.data].flatMap((squad) =>
      (squad?.it ?? []).map((player) => {
        const fixture = byTeam.get(player.tid)
        const state = fixture === undefined ? undefined : fixtureState(fixture)
        return {
          id: player.pi,
          // Nothing to read before kick-off: the matchday has no points yet.
          needed: state === 'running' || state === 'finished',
          isLive: state === 'running',
        }
      }),
    )
  }, [squadA.data, squadB.data, fixtures.data])

  const pointsQueries = useQueries({
    queries: wanted.map(({ id, needed, isLive }) => ({
      queryKey: qk.playerDetail(leagueId ?? 'none', id),
      enabled: leagueId !== undefined && needed,
      // A finished match is final for the session; a running one is polled.
      staleTime: isLive ? 0 : Infinity,
      refetchInterval: isLive ? LIVE_POLL_MS : (false as const),
      queryFn: () =>
        get<PlayerDetailResponse>(
          endpoints.leagues.player(leagueId as string, id),
        ),
    })),
  })

  // Built on every render, deliberately. `useQueries` returns a fresh array
  // each time, so this cannot be memoised on its own input without inventing a
  // surrogate key for it — and a signature string keyed memo is harder to
  // trust than the thirty map entries it would save. The same goes for the
  // rosters below. Neither is on a hot path: this page re-renders on a
  // once-a-minute poll and on a tab switch.
  const pointsByPlayerId = new Map<string, number>()
  for (const query of pointsQueries) {
    const detail = query.data
    if (detail === undefined || day === undefined) continue
    // `ph` is dense from matchday 1, so the index is the matchday minus one.
    // A matchday not played yet is simply past the end of the array, and a
    // player who missed one carries `hp: false` with no `p` — which must stay
    // `undefined` rather than becoming `0`.
    const entry = detail.ph?.[day - 1]
    if (entry?.hp === true && entry.p !== undefined) {
      pointsByPlayerId.set(detail.i, entry.p)
    }
  }

  const data = ((): [DuelRoster, DuelRoster] | undefined => {
    const fixtureByTeamId = fixtures.data
    if (
      sides === undefined ||
      squadA.data === undefined ||
      squadB.data === undefined ||
      fixtureByTeamId === undefined
    ) {
      return undefined
    }

    const build = (squad: ManagerSquadResponse, side: DuelSide): DuelRoster => {
      const players: DuelPlayer[] = squad.it.map((player) => {
        const fixture = fixtureByTeamId.get(player.tid)
        return {
          id: player.pi,
          name: player.pn,
          teamId: player.tid,
          position: toPosition(player.pos),
          lineupOrder: player.lo,
          status: duelPlayerStatus({ lineupOrder: player.lo, fixture }),
          points: pointsByPlayerId.get(player.pi),
          availability: player.st,
          image: player.pim,
          fixture,
          managerId: side.id,
        }
      })

      // `lo` is 0-based and `0` is the goalkeeper, so membership is tested
      // against `undefined` — `lineupOrder > 0` would silently bench the
      // keeper, the same trap the squad page documents.
      const lineup = players
        .filter((player) => player.lineupOrder !== undefined)
        .sort((a, b) => (a.lineupOrder ?? 0) - (b.lineupOrder ?? 0))
      const bench = players.filter((player) => player.lineupOrder === undefined)

      const countState = (state: 'running' | 'upcoming') =>
        lineup.filter(
          (player) =>
            player.fixture !== undefined &&
            fixtureState(player.fixture) === state,
        ).length

      return {
        manager: side,
        lineup,
        bench,
        // Kickbase's own figure, not the sum of the rows above: the rows may
        // still be loading, and the standings are the authority either way.
        totalPoints: side.matchdayPoints,
        activeMatches: countState('running'),
        openMatches: countState('upcoming'),
      }
    }

    return [build(squadA.data, sides[0]), build(squadB.data, sides[1])]
  })()

  return {
    data,
    isPending: squadA.isPending || squadB.isPending || fixtures.isPending,
    isError: squadA.isError || squadB.isError || fixtures.isError,
    error: squadA.error ?? squadB.error ?? fixtures.error,
    isPointsPending: pointsQueries.some((query) => query.isFetching),
    refetch: () => {
      void squadA.refetch()
      void squadB.refetch()
      void fixtures.refetch()
    },
  }
}

/**
 * Every player from both sides in one list, best first.
 *
 * Bench players are **included**: they scored what they scored, it just did
 * not count, and leaving them out would make the list disagree with the lineup
 * tab about who exists. Their rows say "Bank", so nothing is misread as having
 * counted. Players with no points yet sort last rather than as zero — not
 * knowing is not the same as nothing.
 */
export function rankDuelPlayers(
  rosters: [DuelRoster, DuelRoster],
): DuelPlayer[] {
  return rosters
    .flatMap((roster) => [...roster.lineup, ...roster.bench])
    .sort((a, b) => {
      if (a.points === undefined && b.points === undefined) {
        return a.name.localeCompare(b.name)
      }
      if (a.points === undefined) return 1
      if (b.points === undefined) return -1
      return b.points - a.points || a.name.localeCompare(b.name)
    })
}
