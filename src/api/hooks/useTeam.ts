import {
  useQueries,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import { matchdayEntry } from '@/api/hooks/useMatchdayPoints'
import { useRanking } from '@/api/hooks/useRanking'
import {
  toPosition,
  toStartProbability,
  toTrend,
  type TeamProfile,
  type TeamSquadOwner,
  type TeamSquadPlayer,
} from '@/api/models'
import { qk } from '@/api/queryKeys'
import type {
  PlayerDetailResponse,
  TeamProfilePlayer,
  TeamProfileResponse,
} from '@/api/types'

/**
 * Market values move once a night and Ligainsider revises a lineup probability
 * a few times a week, so half an hour is fresher than anything on the payload —
 * the same figure the squad page and the player detail use.
 */
const STALE_MS = 30 * 60_000

/**
 * **A club's entire squad, in one request.**
 *
 * `GET /v4/leagues/{leagueId}/teams/{teamId}/teamprofile` carries every player
 * with his market value, his seven-day change, his lineup-probability tier, his
 * availability, and — because the spelling is league-scoped — **the manager who
 * owns him**. Plus the club's own placement, record and total market value, and
 * the projected-XI poster.
 *
 * ## What this replaced, and why
 *
 * Until 2026-09-05 the club page built its roster from
 * `/v4/competitions/{id}/players`, filtered by `tid`, and then fanned out one
 * request per player for the market value and the owner. Both halves were
 * wrong:
 *
 *  - **The filter matched nothing for seventeen clubs out of eighteen.** That
 *    endpoint is not "every player in a competition" despite its name and its
 *    published documentation. Probed live, it returned **25 players across
 *    exactly two clubs, all sharing one `mi`** — it is *one fixture's* players.
 *    So the Kader rendered empty for every club not in that fixture, which is
 *    how it was found.
 *  - **The fan-out was twenty-six requests for what one answers.** Nothing but
 *    the 24-hour change (`tfhmvt`) still needs a per-player response, and that
 *    one column is not worth twenty-six requests — the profile's seven-day
 *    `sdmvt` is served here, and the
 *    [Kader](../../components/team/TeamSquadTab.tsx) labels it as the week it
 *    is.
 *
 * The neighbouring spellings all 404 (`/teams`, `/teams/{tid}`,
 * `/teams/{tid}/players`, `/teams/{tid}/squad`), which is why an earlier round
 * of probing concluded no per-club endpoint existed. Only `teamprofile`
 * resolves — see {@link endpoints.leagues.teamProfile}.
 *
 * ## Names and faces for the owners
 *
 * The payload names the owning manager (`onm`) but carries no avatar, so the
 * standings supply the picture. That is one cached request the ranking page has
 * usually made already, and it is the same source every other ownership badge
 * in the app resolves a face from — so a manager looks the same here as on a
 * match lineup.
 *
 * A manager the standings do not list still gets a badge, using `onm` for the
 * name and falling back to initials. The profile is the authority on *who owns
 * whom*; the standings are only a face lookup, and a slow one must not make a
 * player look unowned.
 */
export function useTeamProfile(
  leagueId: string | undefined,
  teamId: string | undefined,
  /** The signed-in manager, whose own players are marked. */
  viewerId: string | undefined,
): UseQueryResult<TeamProfile> {
  const ranking = useRanking(leagueId)

  const managerById = new Map(
    (ranking.data?.managers ?? []).map((manager) => [manager.id, manager]),
  )

  return useQuery({
    queryKey: qk.teamProfile(leagueId ?? 'none', teamId ?? 'none'),
    enabled: leagueId !== undefined && teamId !== undefined,
    staleTime: STALE_MS,
    /*
     * `select` rather than mapping in `queryFn`, so the cache holds the wire
     * DTO — the rule the competition table had to learn the hard way, see
     * [API layer](../../../docs/api-layer.md#query-keys). It is load-bearing
     * here for a second reason too: the mapping closes over the standings and
     * the viewer, and both arrive *after* this response does. Mapping in
     * `queryFn` would freeze the owners' faces as whatever was known at fetch
     * time, and a page opened cold would show nameless badges for ever.
     */
    select: (data: TeamProfileResponse): TeamProfile => ({
      teamId: data.tid,
      teamName: data.tn,
      teamImage: data.tim,
      placement: data.pl,
      teamValue: data.tv ?? 0,
      wins: data.tw ?? 0,
      draws: data.td ?? 0,
      losses: data.tl ?? 0,
      players: (data.it ?? []).map((player) =>
        toSquadPlayer(player, managerById, viewerId),
      ),
      poster:
        data.plpim === undefined
          ? undefined
          : {
              image: data.plpim,
              sourceLogo: data.plpurl,
              updatedAt: data.ts,
            },
    }),
    queryFn: () =>
      get<TeamProfileResponse>(
        endpoints.leagues.teamProfile(leagueId as string, teamId as string),
      ),
  })
}

function toSquadPlayer(
  player: TeamProfilePlayer,
  managerById: Map<string, { id: string; name: string; image?: string }>,
  viewerId: string | undefined,
): TeamSquadPlayer {
  return {
    id: player.i,
    name: player.n,
    position: toPosition(player.pos),
    image: player.pim,
    marketValue: player.mv ?? 0,
    marketValueTrend: toTrend(player.mvt),
    marketValueChangeWeek: weekChange(player),
    averagePoints: player.ap ?? 0,
    availability: player.st,
    startProbability: toStartProbability(player.prob),
    owner: toOwner(player, managerById, viewerId),
  }
}

/**
 * The seven-day change, unless the player had no value a week ago.
 *
 * Kickbase prices a new arrival up from zero, so `sdmvt` for one is his whole
 * market value rather than a week's movement — and a row reading `+15,0 Mio.`
 * beside a `15,0 Mio.` valuation is not a hot player, it is a player who did
 * not exist here on Monday. The equality is exact, not a heuristic: the change
 * can only equal the value when the value seven days ago was zero.
 *
 * `mv > 0` guards the other direction, where both are zero and nothing has
 * happened at all.
 */
function weekChange(player: TeamProfilePlayer): number | undefined {
  const value = player.mv ?? 0
  const change = player.sdmvt ?? 0
  if (value > 0 && change === value) return undefined
  return change
}

/**
 * The owning manager, or `undefined` for a free agent.
 *
 * **`oui` is a number here and absent when nobody owns the player** — two
 * differences from the player-detail payload, where it is a string and the
 * *string* `"0"` stands in for "unowned". So this deliberately does not go
 * through `toOwnerId`: that function exists to strip the `"0"` placeholder, and
 * applied to a number it would either reject every owner or let a `0` through
 * as a real id. Absence is the whole test here.
 */
function toOwner(
  player: TeamProfilePlayer,
  managerById: Map<string, { id: string; name: string; image?: string }>,
  viewerId: string | undefined,
): TeamSquadOwner | undefined {
  if (player.oui === undefined) return undefined

  const id = String(player.oui)
  const manager = managerById.get(id)

  return {
    id,
    // The payload's own name first — it is on the same response as the
    // ownership itself, so it can never disagree with it. The standings are
    // consulted for the face, and for the name only if `onm` is missing.
    name: player.onm ?? manager?.name ?? 'Unbekannt',
    image: manager?.image,
    isViewer: id === viewerId,
    // Always `currentOwner`: a roster reads who owns the player *today* and
    // asserts nothing about any matchday's lineup. `ownerLabel` words exactly
    // this claim as "Gehört X".
    source: 'currentOwner',
    wasFielded: false,
  }
}

/* -------------------------------------------------------------------------- */
/* Points per matchday                                                        */
/* -------------------------------------------------------------------------- */

/** What a club's players scored, per matchday. */
export interface TeamMatchdayPoints {
  /**
   * Matchday → the club's total.
   *
   * A matchday nobody scored in is **absent** rather than `0`: before a club
   * kicks off it has not scored nothing, it has not played.
   */
  byDay: Map<number, number>
  isPending: boolean
}

/**
 * **What the club's players scored on each matchday of the season.**
 *
 * The one thing on the club page that still costs a request per player, and the
 * only way to get it: `ph` on `/v4/leagues/{id}/players/{pid}` is the sole
 * source of a per-player, per-matchday score, and there is no bulk spelling of
 * it — see [`useMatchdayPoints`](./useMatchdayPoints.ts), which pays the same
 * toll for a single matchday.
 *
 * What makes it worth paying *once* is that each response is a whole season:
 * twenty-six requests yield the club's total for all 34 matchdays rather than
 * for one. It is the [Spiele](../../components/team/TeamMatchesTab.tsx) tab's
 * right-hand column, and `enabled` keeps every other tab off it.
 *
 * Nothing polls. A settled matchday's points cannot change, and the running
 * one belongs to the [Live tab](../../components/team/TeamLiveTab.tsx), which
 * goes through the match lineup like every other live view in the app.
 *
 * The cache entries are the usual `qk.playerDetail` ones, so a club whose
 * players have been opened this session is already part-fetched.
 */
export function useTeamMatchdayPoints(
  leagueId: string | undefined,
  players: readonly TeamSquadPlayer[] | undefined,
  enabled: boolean,
): TeamMatchdayPoints {
  const roster = players ?? []

  const queries = useQueries({
    queries: roster.map((player) => ({
      queryKey: qk.playerDetail(leagueId ?? 'none', player.id),
      enabled: enabled && leagueId !== undefined,
      staleTime: STALE_MS,
      queryFn: () =>
        get<PlayerDetailResponse>(
          endpoints.leagues.player(leagueId as string, player.id),
        ),
    })),
  })

  /*
   * Rebuilt per render rather than memoised: `useQueries` hands back a fresh
   * array every time, so a memo would need a surrogate key harder to trust than
   * the arithmetic it saves. The same trade-off as everywhere else `useQueries`
   * is used in this codebase.
   */
  const byDay = new Map<number, number>()
  for (const query of queries) {
    if (query.data !== undefined) addSeasonPoints(byDay, query.data)
  }

  return {
    byDay,
    isPending: enabled && queries.some((query) => query.isPending),
  }
}

/**
 * Fold one player's whole season into the club's per-matchday totals.
 *
 * `ph` is **newest first** and indexed off the payload's own `day`, which is
 * the trap [`matchdayEntry`](./useMatchdayPoints.ts) exists to hold in one
 * place — so the days are walked through that function rather than by reading
 * the array directly. Getting it off by one here would be invisible: every
 * matchday would still have a plausible total, just the wrong one.
 *
 * A matchday a player missed carries `hp: false` and no `p`, and contributes
 * nothing rather than a zero.
 */
function addSeasonPoints(
  totals: Map<number, number>,
  detail: PlayerDetailResponse,
): void {
  const latest = detail.day ?? detail.ph?.length
  if (latest === undefined) return

  for (let day = 1; day <= latest; day += 1) {
    const entry = matchdayEntry(detail, day)
    if (entry?.hp !== true || entry.p === undefined) continue
    totals.set(day, (totals.get(day) ?? 0) + entry.p)
  }
}
