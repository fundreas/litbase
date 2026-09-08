import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useMemo } from 'react'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import { useLiveMatches } from '@/api/hooks/useLiveMatches'
import { useMatchdayFixtures } from '@/api/hooks/useMatchday'
import { useMatchdayPoints } from '@/api/hooks/useMatchdayPoints'
import { useMatchdaySquad } from '@/api/hooks/useMatchdaySquad'
import { teamSheetRole, useTeamSheets } from '@/api/hooks/useTeamSheets'
import {
  areFixturesSettled,
  canUseMatchdaySquad,
  duelPlayerStatus,
  fixtureState,
  toPosition,
  toTrend,
  type DuelPlayer,
  type DuelRoster,
  type DuelSide,
  type ManagerSquadMember,
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
 * The same squad, **mapped for the screen** — one manager's players as they
 * stand today.
 *
 * The [manager page](../../components/manager/ManagerSquadTab.tsx)'s Kader tab,
 * and the one caller that renders this payload rather than computing over it.
 * It reads the **same cache entry** {@link useManagerSquad} fills and maps it in
 * `select`, so a page showing the Kader after the Aufstellung issues no request
 * at all — the arrangement `useDuels`/`useMatchdayStandings` and
 * `useTeamDirectory`/`useCompetitionTable` already use.
 *
 * The `select` is a module-level function, not an inline arrow: React Query
 * memoises it on identity, and a fresh closure each render would re-map and
 * hand back new objects every time.
 */
export function useManagerSquadMembers(
  leagueId: string | undefined,
  userId: string | undefined,
): UseQueryResult<ManagerSquadMember[]> {
  return useQuery({
    queryKey: qk.managerSquad(leagueId ?? 'none', userId ?? 'none'),
    enabled: leagueId !== undefined && userId !== undefined,
    staleTime: 5 * 60_000,
    select: selectSquadMembers,
    queryFn: () =>
      get<ManagerSquadResponse>(
        endpoints.leagues.managerSquad(leagueId as string, userId as string),
      ),
  })
}

function selectSquadMembers(data: ManagerSquadResponse): ManagerSquadMember[] {
  return (data.it ?? []).map((player) => ({
    id: player.pi,
    lastName: player.pn,
    teamId: player.tid,
    position: toPosition(player.pos),
    marketValue: player.mv,
    marketValueTrend: toTrend(player.mvt),
    totalPoints: player.p,
    averagePoints: player.ap,
    status: player.st,
    image: player.pim,
    // 0 is a valid slot, so membership is the `undefined` test — see
    // `ManagerSquadMember.isFielded`.
    isFielded: player.lo !== undefined,
  }))
}

/** What {@link useManagerRoster} hands back — one manager's matchday. */
export interface ManagerRosterQuery {
  data?: DuelRoster
  isPending: boolean
  isError: boolean
  error: unknown
  /** The API has no squad for this matchday — see the field's note below. */
  isEmpty: boolean
  /** True while per-player points are still arriving; rows render without them. */
  isPointsPending: boolean
  refetch: () => void
}

/**
 * **One manager's team on one matchday** — the eleven they fielded, the rest of
 * the squad, and what each player scored.
 *
 * The unit of the [duel page](./useDuelRosters.ts), which asks for two of them,
 * and of the [manager page](../../pages/ManagerDetailPage.tsx), which asks for
 * one. It lives here rather than inside the duel hook because a duel is *two
 * of these*, not a thing of its own: everything that was tricky about a duel's
 * roster — which source to believe, when to poll, how the points are paid for —
 * is a fact about **a** manager's matchday, and the second copy of it was the
 * one that would have drifted.
 *
 * ## Where a roster comes from depends on whether the matchday is over
 *
 *  - **Finished** → [`useMatchdaySquad`](./useMatchdaySquad.ts), the matchday
 *    snapshot. `lp` is the eleven that was actually fielded, so a past matchday
 *    lists the right players instead of today's eleven with old points beside
 *    it.
 *  - **Live or upcoming** → {@link useManagerSquad} and its `lo`.
 *
 * The split is not hedging. Measured on a real payload: for a matchday that has
 * not kicked off, the snapshot's `lp` is **empty** while the squad plainly has
 * eleven players fielded (`lo` `0…10`). So `lp` fills at or after kick-off, and
 * reading it mid-matchday would show a partial eleven and put the rest on the
 * bench — a regression on the case these pages are used for most. `lo`,
 * meanwhile, is complete and authoritative while the matchday runs: Kickbase
 * locks it at the first kick-off. The test itself is
 * {@link canUseMatchdaySquad}, which is where "why not always?" is written
 * down.
 *
 * `useManagerSquad` is still read on a settled matchday, for one field: the
 * position of each player, which the snapshot does not reliably carry.
 *
 * ## What it costs
 *
 * Four shared cache entries — the matchday's fixtures, the club team sheets,
 * the live matches, and this manager's squad — plus the snapshot, plus
 * [`useMatchdayPoints`](./useMatchdayPoints.ts)'s fan-out for the players.
 * That fan-out is the expensive part and the hook it belongs to owns the rules
 * that keep it down; the one thing done here is handing over the snapshot's own
 * `p` as `livePoints`, which switches the per-player poll off entirely. A live
 * matchday therefore costs **one request per manager per tick** rather than one
 * per player.
 *
 * Per **manager**: two of these hooks side by side issue two fan-outs, and that
 * is the same set of requests one fan-out over both squads made, because a
 * player cannot be in two squads at once. The queries are keyed by player id,
 * so even a player who somehow appeared in both would be fetched once.
 */
export function useManagerRoster(
  leagueId: string | undefined,
  competitionId: string | undefined,
  day: number | undefined,
  side: DuelSide | undefined,
): ManagerRosterQuery {
  const squad = useManagerSquad(leagueId, side?.id)
  const fixtures = useMatchdayFixtures(competitionId, day)

  // Today's squad: the fallback source for a matchday still in progress, and in
  // every case the source of each player's position, which the snapshot payload
  // does not reliably carry.
  const positions = usePositions(squad.data)

  const isSettled = areFixturesSettled(fixtures.data)
  /**
   * Is any match of this matchday actually being played? That is what puts the
   * snapshot on the live poll — it carries the running per-player scores, so
   * the points cost **one request a tick, not fifteen**.
   */
  const isLive = [...(fixtures.data?.values() ?? [])].some(
    (fixture) => fixtureState(fixture) === 'running',
  )

  const snapshot = useMatchdaySquad(leagueId, side?.id, day, positions, {
    isLive,
  })

  /**
   * The live state of each match: the fresh score, the minute, the events. One
   * request per match rather than per player, polled only while a match is
   * actually running — see [`useLiveMatches`](./useLiveMatches.ts).
   */
  const liveByMatchId = useLiveMatches(fixtures.data?.values())

  /**
   * The clubs' own team sheets for the matches still to kick off — the other
   * half of the same payload, for the hour in which it is news. See
   * [`useTeamSheets`](./useTeamSheets.ts).
   */
  const sheetByTeamId = useTeamSheets(fixtures.data?.values())

  const today = fromManagerSquad(squad.data, positions)
  /*
   * The roster to render, from whichever source can be believed. The snapshot
   * wins whenever its lineup looks complete; today's squad is the fallback, and
   * the only source before a matchday kicks off.
   */
  const roster =
    snapshot.data !== undefined &&
    canUseMatchdaySquad(snapshot.data, today.fielded.length, isSettled)
      ? { fielded: snapshot.data.fielded, bench: snapshot.data.bench }
      : today

  // Taken from whichever source is in use, so on a settled matchday a player
  // sold since is still fetched and one bought since is not.
  //
  // Not memoised: the roster above is rebuilt every render by design, so a memo
  // keyed on it would never hit, and one keyed on the query data behind it
  // would be a dependency list that lies. `useQueries` compares by key, so a
  // fresh array of the same ids costs nothing.
  const subjects = [...roster.fielded, ...roster.bench].map((player) => ({
    id: player.id,
    teamId: player.teamId,
    // A player nobody owns any more has no position from the squad, and the
    // detail response is the only place left to get one. Without it the pitch
    // cannot place him and drops him — which is exactly how players sold since
    // the matchday went missing from the lineup view while appearing correctly
    // in the ranking.
    needsPosition: player.position === undefined,
    // The running score, already in hand from the snapshot above. Handing it
    // over switches this player's per-player poll off — the whole reason a live
    // matchday costs one request a tick rather than fifteen — and it is still
    // outranked by the settled score once the match is over.
    livePoints: player.livePoints,
  }))

  const points = useMatchdayPoints(leagueId, day, subjects, fixtures.data)

  // Built on every render, deliberately: `useQueries` inside the points hook
  // returns a fresh array each time, so the roster cannot be memoised on its
  // own input without inventing a surrogate key — and a signature-string keyed
  // memo is harder to trust than the thirty object allocations it would save.
  // A page using this re-renders on a once-a-minute poll and on a tab switch.
  const data = ((): DuelRoster | undefined => {
    const fixtureByTeamId = fixtures.data
    if (
      side === undefined ||
      fixtureByTeamId === undefined ||
      squad.data === undefined
    ) {
      return undefined
    }

    const toPlayer = (player: MatchdaySquadPlayer): DuelPlayer => {
      const fixture = fixtureByTeamId.get(player.teamId)
      const live =
        fixture === undefined ? undefined : liveByMatchId.get(fixture.matchId)
      return {
        id: player.id,
        name: player.name,
        teamId: player.teamId,
        // Today's squad first, then the player's own detail — which is the only
        // source for someone no manager owns now.
        position: player.position ?? points.positionByPlayerId.get(player.id),
        // The snapshot states membership of the lineup outright, so there is no
        // slot index to read `lo` from any more.
        lineupOrder: player.wasFielded ? 0 : undefined,
        status: duelPlayerStatus({
          lineupOrder: player.wasFielded ? 0 : undefined,
          fixture,
        }),
        points: points.byPlayerId.get(player.id),
        availability: player.availability,
        image: player.image,
        fixture,
        live,
        events: live?.eventsByPlayerId.get(player.id),
        sheet: teamSheetRole(sheetByTeamId, player.teamId, player.id),
        managerId: side.id,
      }
    }

    // Straight from whichever source's own split, in its own order — the `lo`
    // arithmetic and its goalkeeper trap live in one place, `fromManagerSquad`.
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
      totalPoints: side.matchdayPoints,
      activeMatches: countState('running'),
      openMatches: countState('upcoming'),
    }
  })()

  return {
    data,
    // Both sources are always in flight, and the roster falls back to today's
    // squad, so a page is ready as soon as *that* is — waiting for the snapshot
    // too would delay a live matchday for no gain.
    isPending: fixtures.isPending || squad.isPending,
    isError: fixtures.isError || squad.isError || snapshot.isError,
    error: fixtures.error ?? squad.error ?? snapshot.error,
    /**
     * Nothing to show for this matchday: the snapshot is empty (before the
     * league existed, or a day out of range) *and* today's squad cannot stand
     * in because nothing is fielded in it either. Distinct from an error, and
     * callers say so rather than drawing an empty team.
     */
    isEmpty: snapshot.data?.isEmpty === true && roster.fielded.length === 0,
    isPointsPending: points.isPending,
    refetch: () => {
      void snapshot.refetch()
      void squad.refetch()
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
