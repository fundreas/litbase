import {
  useQueries,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import {
  toPosition,
  type MatchdayLineups,
  type MatchdayOwnership,
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
 * **Who had whom, across the whole league, on one matchday** — one request per
 * manager.
 *
 * ## Why this is a fan-out and not one request
 *
 * The same payload carries `us`, which *looks* like the answer for free: every
 * member of the league with the players in their lineup. It was used for
 * exactly one round and it is **wrong** — `us` ignores `dayNumber` and reports
 * the lineups as they stand **now**, so a past matchday showed today's elevens.
 * That is the same class of mistake as reading `oui` before it: a plausible
 * field that quietly answers a different question.
 *
 * What *is* verified to honour `dayNumber` is the addressed manager's own
 * `lp`/`nlp` — the pair {@link useMatchdaySquad} maps, checked against a league
 * with played matchdays. So the only honest way to ownership for a matchday is
 * to ask that question once per manager.
 *
 * ## What it costs
 *
 * One request per manager in the league — ten to twenty. Three things make that
 * acceptable:
 *
 *  - It is the **same cache entry** `useMatchdaySquad` uses,
 *    `qk.matchdaySquad(leagueId, managerId, day)`, so a manager already looked
 *    at on the duel page this session is free, and so is the signed-in user on
 *    the current matchday.
 *  - A matchday's rosters are **history**; nothing polls, and a settled entry
 *    is re-read only on focus after five minutes.
 *  - It is mounted by one tab of one page, not by the page.
 *
 * ## Fielded and merely owned are both reported
 *
 * `lp` is the eleven that was fielded and `nlp` the rest of that matchday's
 * squad, so both are recorded with a `wasFielded` flag. A player somebody owned
 * and left out is worth a badge — it answers "why did he score me nothing" —
 * and it is why this reaches for the pair rather than the lineup alone.
 *
 * Before kick-off `lp` is empty and `nlp` holds the whole squad (measured), so
 * even an upcoming matchday answers ownership correctly; only a matchday the
 * API has nothing for at all comes back {@link MatchdayLineups.isEmpty}.
 */
export function useMatchdayLineups(
  leagueId: string | undefined,
  day: number | undefined,
  managerIds: readonly string[],
): MatchdayLineups {
  const enabled = leagueId !== undefined && day !== undefined

  // `useQueries` answers in the order it was asked, which is what lets each
  // result be zipped back to its manager below.
  const queries = useQueries({
    queries: managerIds.map((managerId) => ({
      queryKey: qk.matchdaySquad(leagueId ?? 'none', managerId, day ?? 0),
      enabled,
      staleTime: SETTLED_STALE_MS,
      queryFn: () => fetchTeamcenter(leagueId as string, managerId, day),
    })),
  })

  // Rebuilt per render, as everywhere `useQueries` is used in this codebase: it
  // hands back a fresh array each time, so a memo would need a surrogate key
  // harder to trust than the twenty map writes it saves.
  const byPlayerId = new Map<string, MatchdayOwnership>()

  for (const [index, query] of queries.entries()) {
    const data = query.data
    const managerId = managerIds[index]
    if (data === undefined || managerId === undefined) continue

    for (const player of data.lp ?? []) {
      byPlayerId.set(player.i, { managerId, wasFielded: true })
    }
    for (const player of data.nlp ?? []) {
      // `lp` wins: a player cannot be both, and if the API ever listed one
      // twice the lineup is the more specific claim.
      if (!byPlayerId.has(player.i)) {
        byPlayerId.set(player.i, { managerId, wasFielded: false })
      }
    }
  }

  return {
    byPlayerId,
    // Not one manager's squad came back with anything: a matchday out of range,
    // or one from before the league existed. **Not** "nobody owned anybody" —
    // the caller has to fall back rather than drop every badge.
    isEmpty: byPlayerId.size === 0,
    isPending: queries.some((query) => query.isPending),
  }
}
