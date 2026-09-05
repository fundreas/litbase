import { useQueries } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import { fixtureState, type TeamSheetRole } from '@/api/models'
import { qk } from '@/api/queryKeys'
import type { MatchDetailsResponse } from '@/api/types'
import { nowMs } from '@/lib/clock'

/**
 * How long before kick-off a match's team sheet is worth asking for.
 *
 * Kickbase publishes them roughly an hour ahead — the same observation
 * [`useMatchDetails`](./useMatchDetails.ts) polls on — so two hours catches
 * them comfortably while keeping the fan-out to the matches that are actually
 * about to start. On a Saturday afternoon that is the 15:30 block and nothing
 * else; the 18:30 match joins at 16:30, on its own.
 */
const SHEET_WINDOW_MS = 2 * 60 * 60_000

/**
 * How often a match inside that window is re-read.
 *
 * The sheet is the only thing that can change before kick-off, and it appears
 * once. Five minutes is the same tick `useMatchDetails` uses for an upcoming
 * match, which matters because both hooks share the cache entry: two observers
 * asking the same question at the same rate is one request.
 */
const SHEET_POLL_MS = 5 * 60_000

/** One club's team sheet for a match, as player ids. */
interface TeamSheet {
  starters: Set<string>
  substitutes: Set<string>
}

/** Official team sheets for a matchday, keyed by **club** id. */
export type TeamSheets = Map<string, TeamSheet>

/**
 * The **official team sheets** of every match that is about to kick off.
 *
 * The other half of [`useLiveMatches`](./useLiveMatches.ts), which reads the
 * identical payload for every match that *has* kicked off and throws the
 * lineups away. This one takes only the matches still to come, and only the
 * lineups. Between them they cover a matchday without ever asking for the same
 * match twice: the two windows are disjoint by construction, since a match is
 * either upcoming or it is not.
 *
 * ## Why only upcoming matches
 *
 * Because that is the only window in which a team sheet is *news*. Once a match
 * is running, who is on the pitch is answered better by the points that are
 * arriving and by the substitutions in the feed; once it is over, by the score.
 * The hour before kick-off is the one hour in which "your striker is not in the
 * squad" is both unknowable from anything else on screen and still actionable —
 * Kickbase locks the lineup at the first kick-off of the matchday, so for later
 * matches it is at least worth knowing what is coming.
 *
 * ## Why the window at all
 *
 * A Bundesliga matchday is nine matches. Fetching all nine from Friday morning
 * to catch a sheet that appears on Sunday afternoon is nine requests a tick for
 * two days to learn nothing. {@link SHEET_WINDOW_MS} is the observed publishing
 * time with room either side.
 *
 * A window decided from the clock has to be **told when the clock moves**,
 * which is the dead end [`useMatchDetails`](./useMatchDetails.ts) documents:
 * React Query re-reads its options when a query refetches or an observer
 * re-renders, so "nothing to fetch yet" is a state nothing gets out of on its
 * own. Before the matchday's first kick-off there is no other poll running on
 * these pages either — the fixture list only starts one ten minutes out. Hence
 * {@link useHeartbeat}: while a match is still waiting outside the window,
 * something re-reads the clock every few minutes. It costs no requests, which
 * is the whole reason it can be that simple.
 *
 * ## `il` is the gate, and it is the one uncertain thing here
 *
 * A sheet is used **only when the payload says it is official** (`il`) — see
 * {@link hasOfficialSheets}, which is the single place that decision is made.
 * The field is documented as **?** in
 * [the API notes](../../docs/api/matches.md): it reads `false` on a match played
 * weeks ago, so it behaves more like a flag raised around kick-off than a
 * durable fact. Raised around kick-off is exactly what this needs, but it has
 * not been watched live.
 *
 * The failure mode was chosen deliberately. If `il` never turns true, no marks
 * appear and the pages read as they did before — the app says nothing rather
 * than something wrong. Gating on "the sheet arrays are populated" instead
 * would be the other way round: if Kickbase serves a *predicted* lineup before
 * the official one, every prediction would be drawn as a fact.
 */
export function useTeamSheets(
  matches:
    | Iterable<{ matchId: string; kickoff: string; isFinished: boolean }>
    | undefined,
): TeamSheets {
  const at = nowMs()

  /*
   * Deduplicated by match id — a team-keyed fixture map holds every match
   * twice — and narrowed to the ones inside the window.
   */
  const wanted = new Set<string>()
  /** A match still to come that the window has not reached — see below. */
  let isWaiting = false

  for (const match of matches ?? []) {
    if (fixtureState(match, at) !== 'upcoming') continue
    const untilKickoff = Date.parse(match.kickoff) - at
    if (Number.isNaN(untilKickoff)) continue
    if (untilKickoff > SHEET_WINDOW_MS) {
      isWaiting = true
      continue
    }
    wanted.add(match.matchId)
  }

  useHeartbeat(isWaiting)

  // The payload does **not** carry its own `mi`, but nothing here needs it:
  // every sheet is keyed by the club id the response states itself.
  const asked = [...wanted]

  const queries = useQueries({
    queries: asked.map((matchId) => ({
      queryKey: qk.matchDetails(matchId),
      staleTime: SHEET_POLL_MS,
      refetchInterval: SHEET_POLL_MS,
      queryFn: () =>
        get<MatchDetailsResponse>(endpoints.matches.details(matchId)),
    })),
  })

  // Rebuilt per render, as everywhere `useQueries` is used here: it hands back
  // a fresh array each time, so a memo would need a surrogate key harder to
  // trust than the two entries per match it saves.
  const byTeamId: TeamSheets = new Map()

  for (const query of queries) {
    const data = query.data
    if (data === undefined || !hasOfficialSheets(data)) continue

    byTeamId.set(data.t1, toSheet(data.t1lp, data.t1nlp))
    byTeamId.set(data.t2, toSheet(data.t2lp, data.t2nlp))
  }

  return byTeamId
}

/**
 * Re-render every {@link SHEET_POLL_MS} while `active`, and not at all
 * otherwise.
 *
 * The one thing {@link useTeamSheets} needs that a query cannot give it: a
 * reason to look at the clock again while it is asking for nothing. Five
 * minutes of lateness against a two-hour window is not worth a timer aimed at
 * the exact instant, and an interval that only runs while something is actually
 * waiting stops of its own accord once every match of the matchday is either
 * inside the window or already under way.
 */
function useHeartbeat(active: boolean): void {
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => {
      setTick((tick) => tick + 1)
    }, SHEET_POLL_MS)
    return () => {
      clearInterval(id)
    }
  }, [active])
}

/**
 * Does this payload carry team sheets that can be presented as **fact**?
 *
 * `il` plus something to show for it: a raised flag over empty arrays is not a
 * team sheet, and would quietly turn every player of that club into "not in the
 * squad". Both sides are required, because the flag is match-level and one
 * club's sheet arriving without the other's has never been observed — if it
 * ever does, one missing side would be read as eleven players dropped.
 */
function hasOfficialSheets(data: MatchDetailsResponse): boolean {
  return (
    data.il === true &&
    (data.t1lp?.length ?? 0) > 0 &&
    (data.t2lp?.length ?? 0) > 0
  )
}

function toSheet(
  starters: MatchDetailsResponse['t1lp'],
  substitutes: MatchDetailsResponse['t1nlp'],
): TeamSheet {
  // `i` is a **number** on this payload and a string everywhere else in the
  // API — the same trap `useMatchDetails` documents, and the ids here are
  // looked up against squad players, so getting it wrong would match nothing.
  const ids = (players: MatchDetailsResponse['t1lp']) =>
    new Set((players ?? []).map((player) => String(player.i)))

  return { starters: ids(starters), substitutes: ids(substitutes) }
}

/**
 * What his club named a player as, or `undefined` when it has not named a team.
 *
 * **`out` is a real answer, not a missing one.** A club whose sheet is out and
 * which lists this player nowhere has left him out of the eighteen — that is
 * the finding, and it is the one worth a mark. "Nothing is known" is the club
 * having no sheet yet, which is `undefined` and shows nothing at all.
 */
export function teamSheetRole(
  sheets: TeamSheets,
  teamId: string | undefined,
  playerId: string,
): TeamSheetRole | undefined {
  if (teamId === undefined) return undefined
  const sheet = sheets.get(teamId)
  if (sheet === undefined) return undefined
  if (sheet.starters.has(playerId)) return 'starting'
  return sheet.substitutes.has(playerId) ? 'bench' : 'out'
}
