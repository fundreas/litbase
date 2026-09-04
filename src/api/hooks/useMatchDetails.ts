import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import {
  fixtureState,
  toEventTallies,
  toPosition,
  toTimelineKind,
  type MatchDetail,
  type MatchdayMatch,
  type MatchEventTally,
  type MatchLineup,
  type MatchPlayer,
  type MatchTeam,
  type MatchTimelineEvent,
} from '@/api/models'
import { qk } from '@/api/queryKeys'
import {
  MATCH_EVENT,
  type MatchDetailsResponse,
  type MatchLineupPlayer as MatchLineupPlayerDto,
} from '@/api/types'

/** How often the match is re-read while it is being played. */
const LIVE_POLL_MS = 60_000

/**
 * How long a match that has not kicked off is held.
 *
 * The team sheets are the only thing that moves in that window, and Kickbase
 * publishes them roughly an hour before kick-off — so a few minutes is short
 * enough to catch them and long enough that flicking between the timeline and
 * the lineup costs nothing.
 */
const UPCOMING_STALE_MS = 5 * 60_000

/** `mst` on the match payload: 2 is played to the end, as `st` is elsewhere. */
const MATCH_FINISHED = 2

/**
 * One match in full: the score, the minute, both team sheets, and the whole
 * event feed.
 *
 * **The same cache entry [`useLiveMatches`](./useLiveMatches.ts) fills**, keyed
 * `qk.matchDetails(matchId)` and holding the raw response, so opening a match
 * from the [matchday list](../../pages/MatchdayPage.tsx) issues no request at
 * all — the list already fetched it. That is the whole reason this maps through
 * `select` rather than in its `queryFn`: two readings of one payload, one
 * network cost, exactly as the season fixture list is treated.
 *
 * The polling rules are the list's, plus one the list does not need:
 *
 *  - **Running** → stale at once, polled once a minute.
 *  - **Finished** → fetched once and held for the session. Nothing can change.
 *  - **Not kicked off** → fetched, and held for {@link UPCOMING_STALE_MS}.
 *    `useLiveMatches` skips these entirely because there is no score in them;
 *    this page wants them anyway, for the team sheets.
 *
 * `match` rather than a bare id, because everything above is decided by the
 * *fixture list's* state (`st` plus the clock) rather than by `mst` on the
 * response — which is what keeps
 * [the live development profile](../../dev/simulation.ts) in charge of what
 * counts as running.
 */
export function useMatchDetails(
  match: MatchdayMatch | undefined,
): UseQueryResult<MatchDetail> {
  const state = match === undefined ? undefined : fixtureState(match)
  const isRunning = state === 'running'

  return useQuery({
    queryKey: qk.matchDetails(match?.matchId ?? 'none'),
    enabled: match !== undefined,
    staleTime: isRunning
      ? 0
      : state === 'finished'
        ? Infinity
        : UPCOMING_STALE_MS,
    refetchInterval: isRunning ? LIVE_POLL_MS : false,
    select: mapMatchDetail,
    queryFn: () =>
      get<MatchDetailsResponse>(
        endpoints.matches.details(match?.matchId as string),
      ),
  })
}

/*
 * A module-level constant, not an inline arrow: React Query memoises `select`
 * on the function's identity, and a fresh arrow per render would re-map the
 * payload — and hand out new `Map`s — on every one of them.
 */
function mapMatchDetail(data: MatchDetailsResponse): MatchDetail {
  const home: MatchTeam = {
    id: data.t1,
    name: data.t1n,
    symbol: data.t1sy ?? data.t1,
    image: data.t1im,
  }
  const away: MatchTeam = {
    id: data.t2,
    name: data.t2n,
    symbol: data.t2sy ?? data.t2,
    image: data.t2im,
  }

  /*
   * Player events only. `pi: "0"` is the match itself — kick-off, half-time,
   * the final whistle — on a code scale that has not been identified, so those
   * entries are dropped here and the three moments are derived from the match's
   * state instead. See `matchTimeline()` in `models.ts`.
   */
  const events: MatchTimelineEvent[] = []
  for (const item of data.events ?? []) {
    if (item.pi === undefined || item.pi === '0') continue
    const kind = toTimelineKind(item.ke)
    if (kind === undefined) continue
    events.push({
      kind,
      minute: item.mt,
      teamId: item.tid,
      playerId: item.pi,
      playerName: item.pn,
      // `rev.pi` is `"0"` even when `rev.pn` names somebody, so only the name
      // is usable: the assist behind a goal, the player coming off in a swap.
      relatedName: item.rev?.pn,
      swap:
        kind !== 'substitution'
          ? undefined
          : item.ke === MATCH_EVENT.SUBSTITUTED_IN
            ? 'in'
            : 'off',
    })
  }

  /*
   * Per-player tallies, built from the same feed so a portrait's badges and the
   * timeline can never disagree about what a player did. Substitutions are in
   * `events` and deliberately absent from these — `toEventTallies` drops them,
   * because on a player they say where he was rather than what he did.
   */
  const codesByPlayerId = new Map<string, number[]>()
  for (const item of data.events ?? []) {
    if (item.pi === undefined || item.pi === '0') continue
    const codes = codesByPlayerId.get(item.pi) ?? []
    codes.push(item.ke)
    codesByPlayerId.set(item.pi, codes)
  }

  const eventsByPlayerId = new Map<string, MatchEventTally[]>()
  for (const [playerId, codes] of codesByPlayerId) {
    eventsByPlayerId.set(playerId, toEventTallies(codes))
  }

  return {
    home,
    away,
    goalsHome: data.t1g,
    goalsAway: data.t2g,
    minute: data.mt,
    isFinished: data.mst === MATCH_FINISHED,
    kickoff: data.md,
    isLineupOfficial: data.il ?? false,
    // `ts1`/`ts2`, the formation strings, are deliberately not mapped — see
    // `MatchLineup`.
    home11: toLineup(home, data.t1lp, data.t1nlp),
    away11: toLineup(away, data.t2lp, data.t2nlp),
    events,
    eventsByPlayerId,
  }
}

function toLineup(
  team: MatchTeam,
  starters: MatchLineupPlayerDto[] | undefined,
  substitutes: MatchLineupPlayerDto[] | undefined,
): MatchLineup {
  const toPlayer = (player: MatchLineupPlayerDto): MatchPlayer => ({
    // `i` is a **number** here and a string everywhere else in the API, which
    // matters: it is the key every other lookup on this page is done by.
    id: String(player.i),
    name: player.n,
    teamId: team.id,
    position: player.pos === undefined ? undefined : toPosition(player.pos),
    image: player.pim,
  })

  return {
    team,
    starters: (starters ?? []).map(toPlayer),
    substitutes: (substitutes ?? []).map(toPlayer),
  }
}
