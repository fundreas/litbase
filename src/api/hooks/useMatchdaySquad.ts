import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import { toPosition, type MatchdaySquad, type PositionKey } from '@/api/models'
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
    queryFn: () =>
      get<TeamcenterResponse>(
        endpoints.leagues.managerTeamcenter(
          leagueId as string,
          userId as string,
        ),
        { params: { dayNumber: day } },
      ),
  })
}
