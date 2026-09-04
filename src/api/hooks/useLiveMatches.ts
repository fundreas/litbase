import { useQueries } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import {
  fixtureState,
  toEventTallies,
  type LiveMatch,
  type MatchdayFixture,
} from '@/api/models'
import { qk } from '@/api/queryKeys'
import type { MatchDetailsResponse } from '@/api/types'

/** How often a match is re-read while it is being played. */
const LIVE_POLL_MS = 60_000

/**
 * The **live state of every match of a matchday**: the score, the minute, and
 * who did what.
 *
 * `GET /v4/matches/{matchId}/details` is the only source of any of it. Before
 * this, a score came from `/competitions/{id}/matchdays` — a payload cached for
 * an hour, because it is the whole season — so a running match's score could
 * be an hour stale behind a pulsing "live" dot. The minute and the events had
 * no source at all.
 *
 * **One request per match, not per player.** Nine covers a Bundesliga matchday
 * where the points fan-out needs twenty-two, and this is the cheap half of a
 * live page. Two rules keep it that way:
 *
 *  1. **A match that has not kicked off is not fetched.** There is nothing in
 *     it: no score, no minute, no events.
 *  2. **A finished match is fetched once** and then held for the session —
 *     `staleTime: Infinity`, no poll. Its result cannot change.
 *
 * Only running matches are polled, so a matchday with one late kick-off costs
 * one request a minute rather than nine.
 *
 * The events carry the **same `ke` codes** as `k` on the performance endpoint
 * (verified against a finished match: five `1`s and one `2` in a 5:1 game, four
 * `4`s for its yellow cards, ten `8`s for the substitutions), which is why they
 * go straight through `toEventTallies()` and come out as the glyphs the player
 * page already draws. Match-level events — kick-off, half-time, the whistle —
 * carry `pi: "0"` and are dropped.
 */
export function useLiveMatches(
  fixtureByTeamId: Map<string, MatchdayFixture> | undefined,
): Map<string, LiveMatch> {
  /*
   * A matchday's fixtures arrive keyed by *team*, so each match is in there
   * twice — once from each side. Deduplicated by match id, and reduced to the
   * two things that decide whether to ask: has it started, and is it over.
   */
  const wanted = new Map<string, { isRunning: boolean }>()
  for (const fixture of fixtureByTeamId?.values() ?? []) {
    const state = fixtureState(fixture)
    if (state === 'upcoming') continue
    wanted.set(fixture.matchId, { isRunning: state === 'running' })
  }

  // Insertion order is fixed by the loop above, and `useQueries` answers in
  // the order it was asked, which is what lets a result be zipped back to its
  // match id below — the payload does **not** carry its own `mi`.
  const asked = [...wanted]

  const queries = useQueries({
    queries: asked.map(([matchId, { isRunning }]) => ({
      queryKey: qk.matchDetails(matchId),
      staleTime: isRunning ? 0 : Infinity,
      refetchInterval: isRunning ? LIVE_POLL_MS : (false as const),
      queryFn: () =>
        get<MatchDetailsResponse>(endpoints.matches.details(matchId)),
    })),
  })

  // Rebuilt per render, as everywhere `useQueries` is used here: it hands back
  // a fresh array each time, so a memo would need a surrogate key harder to
  // trust than the nine entries it saves.
  const byMatchId = new Map<string, LiveMatch>()

  for (const [index, query] of queries.entries()) {
    const data = query.data
    const matchId = asked[index]?.[0]
    if (data === undefined || matchId === undefined) continue

    const events = (data.events ?? [])
      // `pi: "0"` is the match itself — kick-off, half-time, the final
      // whistle. Real players have real ids.
      .filter((event) => event.pi !== '0' && event.pi !== undefined)
      .map((event) => ({
        playerId: event.pi as string,
        playerName: event.pn,
        teamId: event.tid,
        kind: event.ke,
        minute: event.mt,
      }))

    const tallies = new Map<string, number[]>()
    for (const event of events) {
      const codes = tallies.get(event.playerId) ?? []
      codes.push(event.kind)
      tallies.set(event.playerId, codes)
    }

    byMatchId.set(matchId, {
      matchId,
      minute: data.mt,
      isFinished: data.mst === MATCH_FINISHED,
      goalsHome: data.t1g,
      goalsAway: data.t2g,
      homeTeamId: data.t1,
      events,
      eventsByPlayerId: new Map(
        [...tallies].map(([playerId, codes]) => [
          playerId,
          toEventTallies(codes),
        ]),
      ),
    })
  }

  return byMatchId
}

/** `mst` on the match payload: 2 is played to the end, as `st` is elsewhere. */
const MATCH_FINISHED = 2
