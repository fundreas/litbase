import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useMemo } from 'react'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import { useMatchdayFixtures } from '@/api/hooks/useMatchday'
import { useMatchdayPoints } from '@/api/hooks/useMatchdayPoints'
import { useMatchdaySquad } from '@/api/hooks/useMatchdaySquad'
import {
  areFixturesSettled,
  byMatchdayPoints,
  canUseMatchdaySquad,
  duelPlayerStatus,
  fixtureState,
  toPosition,
  type DuelPlayer,
  type DuelRoster,
  type DuelSide,
  type MatchdaySquad,
  type MatchdaySquadPlayer,
  type PositionKey,
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
 * Both managers' teams **as they stood on that matchday**, with each player's
 * points and state.
 *
 * **Where a roster comes from depends on whether the matchday is over.**
 *
 *  - **Finished** → [`useMatchdaySquad`](./useMatchdaySquad.ts), the matchday
 *    snapshot. `lp` is the eleven that was actually fielded, so a past
 *    matchday finally lists the right players instead of today's eleven with
 *    old points beside it. That was this page's one real compromise.
 *  - **Live or upcoming** → `useManagerSquad` and its `lo`, exactly as before.
 *
 * The split is not hedging. Measured on a real payload: for a matchday that
 * has not kicked off, the snapshot's `lp` is **empty** while the squad plainly
 * has eleven players fielded (`lo` `0…10`). So `lp` fills at or after
 * kick-off, and reading it mid-matchday would show a partial eleven and put
 * the rest on the bench — a regression on the case the page is used for most.
 * `lo`, meanwhile, is complete and authoritative while the matchday runs:
 * Kickbase locks it at the first kick-off.
 *
 * What would collapse the two branches into one is knowing whether `lp` fills
 * with **all eleven** at the matchday's start or only per match as each kicks
 * off — one probe during a running matchday, noted in
 * [duel detail](../../docs/pages/duel-detail.md#the-squad-it-shows-is-the-matchdays).
 *
 * The points are still the expensive part, and
 * [`useMatchdayPoints`](./useMatchdayPoints.ts) owns that: there is no bulk
 * source of per-player matchday points, so it fans out one request per player
 * under rules that keep the cost down. Both rosters are handed to it as
 * **one** list, so the whole duel is a single fan-out — and the list is now
 * the snapshot's, so a player sold since is still fetched and one bought since
 * is not.
 *
 * `useManagerSquad` is still read, for one field: the position of each player,
 * which the snapshot does not reliably carry.
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
  /** The API has no squad for this matchday — see the field's note below. */
  isEmpty: boolean
  /** True while per-player points are still arriving; rows render without them. */
  isPointsPending: boolean
  refetch: () => void
} {
  const squadA = useManagerSquad(leagueId, sides?.[0].id)
  const squadB = useManagerSquad(leagueId, sides?.[1].id)
  const fixtures = useMatchdayFixtures(competitionId, day)

  // Today's squads: the fallback source for a matchday still in progress, and
  // in every case the source of each player's position, which the snapshot
  // payload does not reliably carry.
  const positionsA = usePositions(squadA.data)
  const positionsB = usePositions(squadB.data)

  const snapshotA = useMatchdaySquad(leagueId, sides?.[0].id, day, positionsA)
  const snapshotB = useMatchdaySquad(leagueId, sides?.[1].id, day, positionsB)

  const isSettled = areFixturesSettled(fixtures.data)

  /**
   * The roster to render, from whichever source can be believed.
   *
   * The snapshot wins whenever its lineup looks complete — see
   * `canUseMatchdaySquad`, which is where the "why not always?" is written
   * down. Today's squad is the fallback, and the only source before a matchday
   * kicks off.
   */
  const rosterOf = (
    snapshot: MatchdaySquad | undefined,
    squad: ManagerSquadResponse | undefined,
    positions: Map<string, PositionKey>,
  ): { fielded: MatchdaySquadPlayer[]; bench: MatchdaySquadPlayer[] } => {
    const today = fromManagerSquad(squad, positions)
    if (
      snapshot !== undefined &&
      canUseMatchdaySquad(snapshot, today.fielded.length, isSettled)
    ) {
      return { fielded: snapshot.fielded, bench: snapshot.bench }
    }
    return today
  }

  const rosterA = rosterOf(snapshotA.data, squadA.data, positionsA)
  const rosterB = rosterOf(snapshotB.data, squadB.data, positionsB)

  // Both rosters as one list of subjects, so the whole duel is a single
  // fan-out rather than two. Taken from whichever source is in use, so on a
  // settled matchday a player sold since is still fetched and one bought since
  // is not.
  //
  // Not memoised: the rosters above are rebuilt every render by design, so a
  // memo keyed on them would never hit, and one keyed on the query data behind
  // them would be a dependency list that lies. `useQueries` compares by key,
  // so a fresh array of the same ids costs nothing.
  const subjects = [rosterA, rosterB].flatMap((roster) =>
    [...roster.fielded, ...roster.bench].map((player) => ({
      id: player.id,
      teamId: player.teamId,
      // A player nobody owns any more has no position from either squad, and
      // the detail response is the only place left to get one. Without it the
      // pitch cannot place him and drops him — which is exactly how players
      // sold since the matchday went missing from the lineup view while
      // appearing correctly in the ranking.
      needsPosition: player.position === undefined,
    })),
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
      fixtureByTeamId === undefined ||
      squadA.data === undefined ||
      squadB.data === undefined
    ) {
      return undefined
    }

    const build = (
      roster: { fielded: MatchdaySquadPlayer[]; bench: MatchdaySquadPlayer[] },
      side: DuelSide,
    ): DuelRoster => {
      const toPlayer = (player: MatchdaySquadPlayer): DuelPlayer => {
        const fixture = fixtureByTeamId.get(player.teamId)
        return {
          id: player.id,
          name: player.name,
          teamId: player.teamId,
          // Today's squad first, then the player's own detail — which is the
          // only source for someone no manager owns now.
          position: player.position ?? points.positionByPlayerId.get(player.id),
          // The snapshot states membership of the lineup outright, so there is
          // no slot index to read `lo` from any more. `lineupOrder` carries
          // the payload's own ordering, which is what keeps the keeper first.
          lineupOrder: player.wasFielded ? 0 : undefined,
          status: duelPlayerStatus({
            lineupOrder: player.wasFielded ? 0 : undefined,
            fixture,
          }),
          points: pointsByPlayerId.get(player.id),
          availability: player.availability,
          image: player.image,
          fixture,
          managerId: side.id,
        }
      }

      // Straight from whichever source's own split, in its own order — the
      // `lo` arithmetic and its goalkeeper trap now live in one place,
      // `fromManagerSquad`.
      const lineup = roster.fielded.map(toPlayer)
      const bench = roster.bench.map(toPlayer)

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
        // Now that the rows are the real ones, the two *should* agree up to
        // the empty-slot penalty — a cross-check worth adding one day.
        totalPoints: side.matchdayPoints,
        activeMatches: countState('running'),
        openMatches: countState('upcoming'),
      }
    }

    return [build(rosterA, sides[0]), build(rosterB, sides[1])]
  })()

  return {
    data,
    // Both sources are always in flight, and the roster falls back to today's
    // squad, so the page is ready as soon as *that* is — waiting for the
    // snapshot too would delay a live duel for no gain.
    isPending: fixtures.isPending || squadA.isPending || squadB.isPending,
    isError:
      fixtures.isError ||
      squadA.isError ||
      squadB.isError ||
      snapshotA.isError ||
      snapshotB.isError,
    error:
      fixtures.error ??
      squadA.error ??
      squadB.error ??
      snapshotA.error ??
      snapshotB.error,
    /**
     * Neither manager has anything to show for this matchday: the snapshot is
     * empty (before the league existed, or a day out of range) *and* today's
     * squads cannot stand in because nothing is fielded in them either.
     * Distinct from an error, and the page says so rather than drawing two
     * empty teams.
     */
    isEmpty:
      snapshotA.data?.isEmpty === true &&
      snapshotB.data?.isEmpty === true &&
      rosterA.fielded.length === 0 &&
      rosterB.fielded.length === 0,
    isPointsPending: points.isPending,
    refetch: () => {
      void snapshotA.refetch()
      void snapshotB.refetch()
      void squadA.refetch()
      void squadB.refetch()
      void fixtures.refetch()
    },
  }
}

/**
 * A manager's squad **as it stands now**, in the shape the snapshot uses.
 *
 * The source for a matchday still in progress, where `lo` is the complete and
 * authoritative lineup and the snapshot's `lp` is not yet filled.
 *
 * `lo` is 0-based and `0` is the goalkeeper, so membership is tested against
 * `undefined`. `lo > 0` would silently bench the keeper — the trap the squad
 * page documents at length, and the reason this lives in exactly one function.
 */
function fromManagerSquad(
  squad: ManagerSquadResponse | undefined,
  positions: Map<string, PositionKey>,
): { fielded: MatchdaySquadPlayer[]; bench: MatchdaySquadPlayer[] } {
  const players = (squad?.it ?? []).map((player) => ({
    id: player.pi,
    name: player.pn,
    teamId: player.tid,
    position: positions.get(player.pi) ?? toPosition(player.pos),
    availability: player.st,
    image: player.pim,
    wasFielded: player.lo !== undefined,
    lineupOrder: player.lo,
  }))

  return {
    fielded: players
      .filter((player) => player.wasFielded)
      .sort((a, b) => (a.lineupOrder ?? 0) - (b.lineupOrder ?? 0)),
    bench: players.filter((player) => !player.wasFielded),
  }
}

/**
 * Position per player id, from the squad a manager holds **today**.
 *
 * The one thing the matchday snapshot does not reliably carry. Memoised on the
 * squad so it is stable between renders, since it feeds a `select`.
 */
function usePositions(
  squad: ManagerSquadResponse | undefined,
): Map<string, PositionKey> {
  return useMemo(() => {
    const byId = new Map<string, PositionKey>()
    for (const player of squad?.it ?? []) {
      byId.set(player.pi, toPosition(player.pos))
    }
    return byId
  }, [squad])
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
