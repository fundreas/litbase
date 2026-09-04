import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useMemo } from 'react'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import { useMatchdayFixtures } from '@/api/hooks/useMatchday'
import { useMatchdayPoints } from '@/api/hooks/useMatchdayPoints'
import {
  byMatchdayPoints,
  duelPlayerStatus,
  fixtureState,
  toPosition,
  type DuelPlayer,
  type DuelRoster,
  type DuelSide,
} from '@/api/models'
import { qk } from '@/api/queryKeys'
import type { ManagerSquadResponse } from '@/api/types'

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
 * The points are the expensive part, and
 * [`useMatchdayPoints`](./useMatchdayPoints.ts) owns that: there is no bulk
 * source of per-player matchday points, so it fans out one request per player
 * under rules that keep the cost down. Both squads are handed to it as **one**
 * list, so the whole duel is a single fan-out.
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

  // Both squads as one list of subjects, so the whole duel is a single
  // fan-out rather than two.
  const subjects = useMemo(
    () =>
      [squadA.data, squadB.data].flatMap((squad) =>
        (squad?.it ?? []).map((player) => ({
          id: player.pi,
          teamId: player.tid,
        })),
      ),
    [squadA.data, squadB.data],
  )

  const points = useMatchdayPoints(leagueId, day, subjects, fixtures.data)
  const pointsByPlayerId = points.byPlayerId

  // Built on every render, deliberately: `useQueries` inside the points hook
  // returns a fresh array each time, so the rosters cannot be memoised on
  // their own input without inventing a surrogate key — and a signature-string
  // keyed memo is harder to trust than the thirty object allocations it would
  // save. This page re-renders on a once-a-minute poll and on a tab switch.
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
    isPointsPending: points.isPending,
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
    .sort(byMatchdayPoints)
}
