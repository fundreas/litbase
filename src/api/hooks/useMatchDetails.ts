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
import { LIVE_POLL_MS } from '@/api/polling'
import { qk } from '@/api/queryKeys'
import { nowMs } from '@/lib/clock'
import {
  MATCH_EVENT,
  type MatchDetailsResponse,
  type MatchLineupPlayer as MatchLineupPlayerDto,
} from '@/api/types'

/**
 * How long a match that has not kicked off is held, and how often it is
 * re-read.
 *
 * The team sheets are the only thing that moves in that window, and Kickbase
 * publishes them roughly an hour before kick-off — so a few minutes is short
 * enough to catch them and long enough that flicking between the tabs costs
 * nothing.
 */
const UPCOMING_POLL_MS = 5 * 60_000

/**
 * How close to kick-off the slow poll speeds up.
 *
 * So a page already open at 20:29 is watching the clock closely by 20:30
 * rather than waiting out the rest of a five-minute tick — see the note on the
 * poll below.
 */
const KICKOFF_SOON_MS = 10 * 60_000

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
 * ## The poll, and why an upcoming match polls at all
 *
 *  - **Running** → stale at once, re-read at
 *    [the live rate](../polling.ts). This is what makes the score, the minute
 *    and the event feed move.
 *  - **Finished** → fetched once and held for the session. Nothing can change.
 *  - **Not kicked off** → re-read every {@link UPCOMING_POLL_MS}, or at the
 *    live rate once kick-off is within {@link KICKOFF_SOON_MS}.
 *
 * That last rule is not about the team sheets, though it does pick them up. It
 * is the **only thing that gets the page from *upcoming* to *live* on its
 * own.** `refetchInterval` is re-evaluated when the query refetches or when an
 * observer re-renders; a flat `false` before kick-off is therefore a dead end —
 * no timer, so nothing re-evaluates, so a page open at 20:29 was still saying
 * *18:30* at 20:45. With a slow poll running, each tick re-reads the clock,
 * notices the match has started and switches to the live interval.
 *
 * It unblocks the **fixture list** at the same time, which is the subtler half.
 * `useMatchdaysQuery` decides its own poll with a clock-based
 * `hasRunningFixture()`, re-evaluated on any observer re-render — and this
 * query's fetch *is* such a re-render, since the page reads both. So the first
 * kick-off of a matchday now starts everything: without it neither query had a
 * reason to look at the clock again, and the one that would notice was waiting
 * on the one that could not.
 *
 * `match` rather than a bare id, because every rule above is decided by the
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
        : UPCOMING_POLL_MS,
    /*
     * A **function**, not a number: this is what re-reads the clock. React
     * Query calls it after each fetch, so the slow pre-kick-off tick is what
     * discovers that the match has started and hands over to the live rate.
     */
    refetchInterval: () => pollInterval(match),
    select: mapMatchDetail,
    queryFn: () =>
      get<MatchDetailsResponse>(
        endpoints.matches.details(match?.matchId as string),
      ),
  })
}

/** How often to re-read the match, from where it stands right now. */
function pollInterval(match: MatchdayMatch | undefined): number | false {
  if (match === undefined) return false

  switch (fixtureState(match)) {
    case 'finished':
      return false
    case 'running':
      return LIVE_POLL_MS
    default: {
      // Close to kick-off, poll as if live: the switch-over should not have to
      // wait out a five-minute tick, and the team sheets land in this window.
      const untilKickoff = Date.parse(match.kickoff) - nowMs()
      return Number.isNaN(untilKickoff) || untilKickoff <= KICKOFF_SOON_MS
        ? LIVE_POLL_MS
        : UPCOMING_POLL_MS
    }
  }
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
