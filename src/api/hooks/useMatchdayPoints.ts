import { useQueries } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import {
  fixtureState,
  toOwnerId,
  toPosition,
  type MatchdayFixture,
  type PositionKey,
} from '@/api/models'
import { qk } from '@/api/queryKeys'
import type { PlayerDetailResponse } from '@/api/types'

/** How often a player is re-read while their match is actually being played. */
const LIVE_POLL_MS = 60_000

/** The little a caller has to know about a player to ask for their points. */
export interface PointsSubject {
  id: string
  /** Which club they play for — how their fixture is found. */
  teamId: string
  /**
   * Fetch this player even if his match cannot have produced points yet,
   * because the caller does not know his **position** and the response
   * carries it.
   *
   * The case is a player transferred away since the matchday: he is in that
   * matchday's snapshot but in nobody's current squad, so nothing else on the
   * page can say what he plays — and a pitch that cannot place him would
   * simply drop him, which is how sold players went missing from the duel
   * lineup while showing up correctly in the ranking.
   */
  needsPosition?: boolean
  /**
   * Fetch this player even before his match can have produced points, because
   * the caller wants **who owns him**.
   *
   * The [match lineup](./useMatchLineup.ts) sets this on every player of a
   * fixture: the ownership badges are the point of that view, and they are
   * worth seeing the evening before as much as during the match. Nothing else
   * needs it — a squad's players are owned by definition.
   */
  needsOwner?: boolean
}

export interface MatchdayPoints {
  /**
   * Position per player id, for every player whose detail was fetched.
   *
   * A by-product worth having: the response is already on the wire for the
   * points, and it is the only source of a position for a player no current
   * squad contains. Callers merge it under whatever their own squad knows.
   */
  positionByPlayerId: Map<string, PositionKey>
  /**
   * Owning manager's id per player, for every player whose detail was fetched.
   *
   * The other by-product of the same response (`oui`). A player absent from
   * the map is either unfetched or unowned — `toOwnerId` collapses the API's
   * `"0"` placeholder to absent, so a free agent never appears here with an id
   * that matches no manager.
   */
  ownerIdByPlayerId: Map<string, string>
  /**
   * Points per player id, for the players who have a figure.
   *
   * A player missing from the map has **no known score** — the request is
   * still in flight, their match has not kicked off, or they did not feature
   * at all. Deliberately not defaulted to `0`, which would claim they played
   * and scored nothing.
   */
  byPlayerId: Map<string, number>
  /** True while any per-player request is in flight; rows render without them. */
  isPending: boolean
}

/**
 * Every player's points for one matchday, fanned out one request per player.
 *
 * This is the most expensive thing the app does, and the reason is that
 * **there is no bulk source of per-player matchday points**. `ph` on
 * `/v4/leagues/{id}/players/{pid}` is the only one — `/leagues/{id}/players`,
 * `?ids=` and every other shape answer 404. Three rules keep that honest:
 *
 *  1. **Only players who can have points are fetched.** A player whose club
 *     has not kicked off yet is skipped entirely — there is nothing to read,
 *     so an upcoming matchday issues **zero** requests.
 *  2. **A settled player is fetched once.** Their match is over, their points
 *     cannot change, so the query never goes stale for the rest of the
 *     session.
 *  3. **Only players actually on the pitch are polled.** The minute-poll is
 *     attached per player, not to the page, so a matchday with one late match
 *     running costs one request a minute rather than twenty-two.
 *
 * The cache key is `qk.playerDetail(leagueId, playerId)` with **no matchday**
 * in it: one response carries every matchday's points, so all matchdays share
 * the entry and stepping through a season re-reads nothing. It is the same
 * entry [`useStartProbabilities`](./useStartProbabilities.ts) reads, so a page
 * showing both pays for the player once.
 *
 * Shared by the [duel detail](./useDuelRosters.ts) page, which asks for both
 * managers' players at once, the squad page's live view, which asks for its
 * own, and the [match lineup](./useMatchLineup.ts), which asks for everyone in
 * a fixture — twenty-two players plus the benches, and the one caller that
 * wants a request even before kick-off, for the ownership badges.
 */
export function useMatchdayPoints(
  leagueId: string | undefined,
  day: number | undefined,
  players: readonly PointsSubject[],
  fixtureByTeamId: Map<string, MatchdayFixture> | undefined,
): MatchdayPoints {
  // Which players need a request, and which of those are live. Built as one
  // flat list so the fan-out is a single `useQueries` — one hook call whose
  // length may change between renders, which is exactly what it exists for.
  const wanted =
    fixtureByTeamId === undefined
      ? []
      : players.map((player) => {
          const fixture = fixtureByTeamId.get(player.teamId)
          const state =
            fixture === undefined ? undefined : fixtureState(fixture)
          const canHavePoints = state === 'running' || state === 'finished'
          return {
            id: player.id,
            // Nothing to read before kick-off: the matchday has no points yet.
            // The exceptions are the two other things this response carries —
            // a position and an owner — neither of which depends on any match
            // having started.
            needed:
              canHavePoints ||
              player.needsPosition === true ||
              player.needsOwner === true,
            isLive: state === 'running',
          }
        })

  const queries = useQueries({
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
  // surrogate key for it — and a signature-string keyed memo is harder to
  // trust than the thirty map writes it would save. Nothing here is on a hot
  // path: a page using this re-renders on a once-a-minute poll and on a tab
  // switch.
  const byPlayerId = new Map<string, number>()
  const positionByPlayerId = new Map<string, PositionKey>()
  const ownerIdByPlayerId = new Map<string, string>()

  for (const query of queries) {
    const detail = query.data
    if (detail === undefined) continue
    if (detail.pos !== undefined) {
      positionByPlayerId.set(detail.i, toPosition(detail.pos))
    }
    const ownerId = toOwnerId(detail.oui)
    if (ownerId !== undefined) ownerIdByPlayerId.set(detail.i, ownerId)
    if (day === undefined) continue
    // `ph` is dense from matchday 1, so the index is the matchday minus one.
    // A matchday not played yet is simply past the end of the array, and a
    // player who missed one carries `hp: false` with no `p` — which must stay
    // absent from the map rather than becoming `0`.
    const entry = detail.ph?.[day - 1]
    if (entry?.hp === true && entry.p !== undefined) {
      byPlayerId.set(detail.i, entry.p)
    }
  }

  return {
    byPlayerId,
    positionByPlayerId,
    ownerIdByPlayerId,
    isPending: queries.some((query) => query.isFetching),
  }
}
