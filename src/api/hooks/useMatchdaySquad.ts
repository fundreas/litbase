import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import {
  toPosition,
  type MatchdayLineups,
  type MatchdaySquad,
  type PositionKey,
} from '@/api/models'
import { qk } from '@/api/queryKeys'
import type { TeamcenterPlayer, TeamcenterResponse } from '@/api/types'

/** A settled matchday cannot change; a running one is re-read on focus. */
const SETTLED_STALE_MS = 5 * 60_000

function mapPlayer(
  player: TeamcenterPlayer,
  wasFielded: boolean,
  positionByPlayerId: Map<string, PositionKey>,
) {
  return {
    id: player.i,
    name: player.n,
    teamId: String(player.tid),
    // `pos` is present on some team-center payloads and absent from others, so
    // the squad the caller already holds is the fallback. Neither may know a
    // player who has since been transferred away — hence optional, rather than
    // a `toPosition()` default that would place a stranger in midfield on the
    // pitch and look like fact.
    position:
      player.pos === undefined
        ? positionByPlayerId.get(player.i)
        : toPosition(player.pos),
    availability: player.st ?? 0,
    image: player.pim,
    wasFielded,
  }
}

/**
 * The pure mapping, exported so it can be exercised without React or the
 * network — the wire shape here is only partly verified, so being able to run
 * it against a payload matters more than usual.
 */
export function mapMatchdaySquad(
  data: TeamcenterResponse,
  day: number,
  positionByPlayerId: Map<string, PositionKey>,
): MatchdaySquad {
  const fielded = (data.lp ?? []).map((player) =>
    mapPlayer(player, true, positionByPlayerId),
  )
  const bench = (data.nlp ?? []).map((player) =>
    mapPlayer(player, false, positionByPlayerId),
  )

  return {
    day,
    managerName: data.n,
    fielded,
    bench,
    // Both lists empty is the API's answer for a matchday it has nothing for:
    // out of range, or before the league existed. It is not an error and must
    // not be read as "this manager fielded nobody".
    isEmpty: fielded.length === 0 && bench.length === 0,
  }
}

/**
 * One manager's squad **as it stood on one matchday** — the real snapshot.
 *
 * `GET /v4/leagues/{id}/users/{uid}/teamcenter?dayNumber={n}`, which is the
 * API's only historical source and works for **any** manager in the league.
 * `lp` is the eleven that was fielded, `nlp` the rest. See
 * [duel detail](../../docs/pages/duel-detail.md#the-squad-it-shows-is-the-matchdays) for how
 * this was found and what it replaced.
 *
 * **Points do not come from here.** They stay with
 * [`useMatchdayPoints`](./useMatchdayPoints.ts) and `ph[day - 1]`, which is
 * proven and matchday-indexed. A `p` field on these entries is a candidate to
 * switch to — it would collapse the per-player fan-out to a single request —
 * but it has not been observed on a played matchday yet, and guessing at it
 * would mean showing points that might be a different matchday's.
 *
 * `positionByPlayerId` back-fills the one field the payload does not reliably
 * carry. Pass the squad you already hold (the signed-in manager's `useSquad`,
 * or the opponent's `useManagerSquad`); a player who has since been
 * transferred away may be in neither, and then his position stays `undefined`
 * rather than being invented.
 */
export function useMatchdaySquad(
  leagueId: string | undefined,
  userId: string | undefined,
  day: number | undefined,
  positionByPlayerId: Map<string, PositionKey>,
): UseQueryResult<MatchdaySquad> {
  return useQuery({
    queryKey: qk.matchdaySquad(leagueId ?? 'none', userId ?? 'none', day ?? 0),
    enabled:
      leagueId !== undefined && userId !== undefined && day !== undefined,
    staleTime: SETTLED_STALE_MS,
    // Positions are a render-time back-fill, not part of what is cached: they
    // arrive from a different query and must not re-key this one. `select`
    // re-runs when either input changes, which is exactly the behaviour
    // wanted, and the map is rebuilt by its owner on every render anyway.
    select: (data: TeamcenterResponse) =>
      mapMatchdaySquad(data, day as number, positionByPlayerId),
    queryFn: () => fetchTeamcenter(leagueId as string, userId as string, day),
  })
}

/**
 * One request, shared by both hooks in this file, so the two `select`s below
 * cannot drift on the path or the parameter name. `dayNumber` is **required**
 * here — omitted, the endpoint answers 200 with everything empty.
 */
function fetchTeamcenter(
  leagueId: string,
  userId: string,
  day: number | undefined,
): Promise<TeamcenterResponse> {
  return get<TeamcenterResponse>(
    endpoints.leagues.managerTeamcenter(leagueId, userId),
    { params: { dayNumber: day } },
  )
}

/**
 * **Who fielded whom, across the whole league, on one matchday.**
 *
 * The same request as {@link useMatchdaySquad} and the same cache entry — this
 * reads a different part of the payload. Alongside the addressed manager's own
 * `lp`/`nlp`, the response carries **`us`: every member of the league with the
 * players *they* had in their lineup that matchday**. One request answers
 * ownership for all of them.
 *
 * That is the field the [match lineup](../../docs/pages/match-detail.md#ownership-is-the-point)
 * needs, and it replaced a genuinely wrong answer. Ownership was read from
 * `oui` on the player detail, which is **who owns him today** — so a past
 * matchday badged every transferred player with his new manager and quietly
 * rewrote history. `us` is the matchday's own truth.
 *
 * `userId` only addresses the request; `us` is league-wide whoever is named. The
 * signed-in user is the natural choice, and it is the entry the squad page's
 * live view already fills for the current matchday, so that case is free.
 *
 * **It is fielded players only.** There is no per-manager bench in `us` (`lp`
 * and `lpi`, no `nlp`), so a player somebody owned and left out gets no badge.
 * For a matchday view that is the more useful half anyway — the question is who
 * *played* him — and the alternative is one request per manager in the league.
 *
 * **Empty before kick-off**, measured: `lp` fills at or after the first kick-off
 * of the matchday, so `isEmpty` is the caller's signal to fall back to today's
 * ownership — which for a match that has not been played is the right answer in
 * any case.
 */
export function useMatchdayLineups(
  leagueId: string | undefined,
  userId: string | undefined,
  day: number | undefined,
): UseQueryResult<MatchdayLineups> {
  return useQuery({
    queryKey: qk.matchdaySquad(leagueId ?? 'none', userId ?? 'none', day ?? 0),
    enabled:
      leagueId !== undefined && userId !== undefined && day !== undefined,
    staleTime: SETTLED_STALE_MS,
    select: selectMatchdayLineups,
    queryFn: () => fetchTeamcenter(leagueId as string, userId as string, day),
  })
}

/*
 * A module-level constant, unlike `useMatchdaySquad`'s: nothing is closed over,
 * so React Query's `select` memo holds and the maps below are rebuilt only when
 * the payload actually changes.
 */
function selectMatchdayLineups(data: TeamcenterResponse): MatchdayLineups {
  const managerIdByPlayerId = new Map<string, string>()
  const nameByManagerId = new Map<string, string>()

  for (const manager of data.us ?? []) {
    nameByManagerId.set(manager.i, manager.unm)
    for (const player of manager.lp ?? []) {
      managerIdByPlayerId.set(player.i, manager.i)
    }
  }

  return {
    managerIdByPlayerId,
    nameByManagerId,
    // No lineups anywhere: before the first kick-off, or a matchday the API has
    // nothing for. Not "nobody fielded anybody".
    isEmpty: managerIdByPlayerId.size === 0,
  }
}
