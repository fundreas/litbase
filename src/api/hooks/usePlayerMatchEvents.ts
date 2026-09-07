import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import type { TeamSummary } from '@/api/hooks/useCompetition'
import {
  liveScoreFor,
  type LiveMatch,
  type MatchdayFixture,
  type PlayerMatch,
} from '@/api/models'
import { qk } from '@/api/queryKeys'
import type {
  LiveEventTypesResponse,
  PlayerCenterEvent,
  PlayerCenterResponse,
} from '@/api/types'

/**
 * The catalogue only moves when Kickbase revises its scoring — `lcud` read a
 * month old when this was probed — so a day is still fresher than the data.
 */
const CATALOGUE_STALE_MS = 24 * 60 * 60_000

/**
 * A settled match's tally is still revised for a while after the whistle: the
 * same fixture read `239` during the matchday and `238` two days later. Short
 * enough to pick that up, long enough that reopening the dialog is free.
 */
const BREAKDOWN_STALE_MS = 5 * 60_000

/**
 * One fixture, from the subject player's side — everything the dialog's header
 * needs and the pair that addresses the breakdown.
 *
 * Deliberately **not** one of the app's fixture models. Four screens open this
 * dialog and each holds a different one: the player page has a `PlayerMatch`,
 * the duel and live pitches a `MatchdayFixture`, and the match lineup has no
 * fixture at all — only the two clubs off the match payload. They agree on
 * exactly these facts, so this is the shape they agree on rather than a
 * conversion every caller has to get right.
 *
 * `opponentName` is whatever the caller can resolve: a club name where a
 * directory is in hand, the three-letter symbol where only a fixture is.
 */
export interface BreakdownFixture {
  /** The matchday, which with the season addresses the breakdown. */
  day: number
  /** The fixture, for the `mi` check that guards against a wrong answer. */
  matchId: string
  isHome: boolean
  opponentName?: string
  opponentImage?: string
  /** Goals, already resolved to this player's side. */
  goalsFor?: number
  goalsAgainst?: number
  /** The API's own word on whether it was played to the end. */
  isFinished: boolean
  /** Kick-off, ISO 8601 — with `isFinished`, whether it has begun. */
  kickoff?: string
  /** The total to show until the breakdown's own arrives. */
  points?: number
}

/**
 * A {@link BreakdownFixture} out of a player page's match row.
 *
 * The one caller that needs a conversion, because `PlayerMatch` is the only
 * model here that names the opponent by id and leaves the lookup to a
 * directory.
 */
export function breakdownFixture(
  match: PlayerMatch,
  teams: Map<string, TeamSummary> | undefined,
): BreakdownFixture {
  return {
    day: match.day,
    matchId: match.matchId,
    isHome: match.isHome,
    opponentName: teams?.get(match.opponentId)?.name ?? match.opponentId,
    opponentImage: match.opponentImage,
    goalsFor: match.goalsFor,
    goalsAgainst: match.goalsAgainst,
    isFinished: match.isFinished,
    kickoff: match.kickoff,
    points: match.points,
  }
}

/**
 * A {@link BreakdownFixture} out of the fixture the live pages carry.
 *
 * `MatchdayFixture` already holds every field under a different name, and its
 * `opponentSymbol` is the best name those pages have — they resolve no club
 * directory, and three letters beside the crest is what their own rows show.
 */
export function breakdownFixtureFrom(
  fixture: MatchdayFixture,
  day: number,
  points: number | undefined,
  /**
   * The match as it stands, where the caller has it.
   *
   * The fixture's own goals come off the season list, which during a live
   * matchday is re-read once a minute — fine for most things and not for a
   * scoreline sitting on top of a page that refreshes its own every ten
   * seconds. Where a live source is in hand it wins, the same precedence
   * [`MatchStateBadge`](../../components/player/MatchStateBadge.tsx) uses.
   */
  live?: { match: LiveMatch | undefined; teamId: string },
): BreakdownFixture {
  const goals =
    live?.match === undefined
      ? { for: fixture.goalsFor, against: fixture.goalsAgainst }
      : liveScoreFor(live.match, live.teamId)

  return {
    day,
    matchId: fixture.matchId,
    isHome: fixture.isHome,
    opponentName: fixture.opponentSymbol,
    opponentImage: fixture.opponentImage,
    goalsFor: goals.for,
    goalsAgainst: goals.against,
    isFinished: fixture.isFinished,
    kickoff: fixture.kickoff,
    points,
  }
}

/** One scoring action, resolved and ready to draw. */
export interface PlayerMatchEvent {
  /** The API's own `ei` — unique within the match, and the row key. */
  id: string
  minute: number
  /** Points this action was worth. Never `0`: see the mapper. */
  points: number
  /** The catalogue's name, or a placeholder naming the code it could not resolve. */
  name: string
}

/** Why a player scored what he scored in one match. */
export interface PlayerMatchBreakdown {
  /**
   * The fixture the response answered about.
   *
   * **Checked by the caller**, not assumed: `dayNumber` and `seasonId` are the
   * only things that selected it, and a silently ignored parameter is a failure
   * mode this API has form for.
   */
  matchId?: string
  /**
   * The payload's own total, which the events sum to exactly.
   *
   * Absent for a player who accrued nothing — including one who came on and
   * did not touch the score, which is a real case and reads as an empty list.
   */
  total?: number
  /** Scoring actions, **earliest first**. */
  events: PlayerMatchEvent[]
  /**
   * How many reversals were netted out of the list — see the mapper. Drawn as
   * a footnote, because a breakdown that quietly hides rows should say so.
   */
  revisions: number
}

/**
 * **Names for every scoring event Kickbase knows** — 621 of them, ids `-17` to
 * `4765`.
 *
 * One request, cached for a day, and the only reason
 * [`/v4/live/eventtypes`](../../../docs/api/matches.md#get-v4liveeventtypes)
 * exists as far as this app is concerned: it is what turns `eti: 4249` on a
 * player's breakdown into *Goal conceded*. It is **not** the `ke` scale the
 * match feed uses — the two must not be crossed, see
 * [Codes](../../../docs/api/codes.md#the-other-event-scale).
 *
 * Returned as a `Map` rather than the array, because every consumer wants it by
 * id and 621 entries is not a list anybody scans.
 */
export function useEventTypeNames(
  enabled = true,
): UseQueryResult<Map<number, string>> {
  return useQuery({
    queryKey: qk.eventTypes(),
    enabled,
    staleTime: CATALOGUE_STALE_MS,
    select: (data: LiveEventTypesResponse) =>
      new Map((data.it ?? []).map((entry) => [entry.i, entry.ti])),
    queryFn: () => get<LiveEventTypesResponse>(endpoints.live.eventTypes),
  })
}

/**
 * **Every scoring action a player was credited with in one match**, and what
 * each was worth.
 *
 * `GET /v4/leagues/{id}/playercenter/{pid}?dayNumber={n}&seasonId={sid}` is the
 * only source of it. The same response the live pages read for the *total* —
 * see [`useMatchdayPoints`](./useMatchdayPoints.ts) — carries `events`, the
 * total broken down per action, and **the breakdown is complete**: on a settled
 * match its 131 entries summed to exactly the `238` the payload stated. So
 * "why did he score 238?" has an answer with no remainder row.
 *
 * ## `seasonId` reaches the whole archive
 *
 * Undocumented and verified: `?seasonId=34` alongside `dayNumber` serves that
 * season's fixture instead of the running one. Cross-checked against
 * `/performance`, which states an `mi` and a `p` per fixture — season 34,
 * matchday 1 answered `mi: 8310, p: 39` from both. Every season the player has
 * appeared in resolves, back to 2017/2018 in the squad probed.
 *
 * Omitted, the running season is served, which is what the live pages want and
 * why they pass no `seasonId` at all.
 *
 * Two requests together, and both are cheap: the breakdown, and the catalogue
 * that names it. The catalogue is one shared entry for the whole app.
 */
export function usePlayerMatchEvents(
  leagueId: string | undefined,
  playerId: string | undefined,
  /** The matchday, and the season it belongs to — omit for the running one. */
  { day, seasonId }: { day: number | undefined; seasonId?: string },
): {
  data?: PlayerMatchBreakdown
  isPending: boolean
  isError: boolean
  error: unknown
  refetch: () => void
} {
  const enabled =
    leagueId !== undefined && playerId !== undefined && day !== undefined

  const names = useEventTypeNames(enabled)

  const breakdown = useQuery({
    queryKey: qk.playerCenter(
      leagueId ?? 'none',
      playerId ?? 'none',
      day ?? 0,
      seasonId,
    ),
    enabled,
    staleTime: BREAKDOWN_STALE_MS,
    queryFn: () =>
      get<PlayerCenterResponse>(
        endpoints.leagues.playerCenter(leagueId as string, playerId as string),
        { params: { dayNumber: day, seasonId } },
      ),
  })

  return {
    data:
      breakdown.data === undefined
        ? undefined
        : toPlayerMatchBreakdown(breakdown.data, names.data),
    // The list cannot be drawn without both, so both count as pending. The
    // catalogue is usually already in hand by the second dialog.
    isPending: breakdown.isPending || names.isPending,
    isError: breakdown.isError || names.isError,
    error: breakdown.error ?? names.error,
    refetch: () => {
      void breakdown.refetch()
      void names.refetch()
    },
  }
}

/**
 * The payload turned into a list a reader can follow.
 *
 * Pure and exported so it can be run against a captured payload — there is one
 * in [`test-data/live-points`](../../../test-data/live-points) — without React
 * or the network. Three rules, and each of them removes rows:
 *
 *  1. **Reversals are netted out.** Kickbase re-classifies its own scoring by
 *     *appending a correction* rather than editing the original: the new entry
 *     repeats the `eti` with `p` negated and points `cei` at the entry it
 *     cancels. Read raw, a breakdown says "Ball intercepted +5" and "Ball
 *     intercepted −5" a line apart, which is Kickbase's revision history rather
 *     than an account of the match. Both members of a pair are dropped —
 *     **only when they negate exactly**, so the total is provably unchanged and
 *     a partial adjustment (never observed) would survive intact rather than
 *     being silently swallowed.
 *  2. **Zero-point entries go.** All eight in the probed match were the fixture's
 *     own structure — kick-off, the halves, added time, full time, and whether
 *     he started or sat on the bench. They are worth nothing to a score
 *     breakdown, and the row that opened this dialog already says how he played.
 *  3. **Earliest first.** The payload is ordered by `ei` descending, which is
 *     neither chronological nor anything else useful: minutes ran 1, 1, 1, 70,
 *     96 in the first five entries. A finished match read after the fact is a
 *     report, so it runs forwards; ties break on `ei` so the order is stable.
 *
 * A name that will not resolve falls back to the code rather than to
 * "unknown" — every one of the 121 scoring events in the probed match resolved,
 * so a miss means the catalogue is short and the number is the only lead.
 */
export function toPlayerMatchBreakdown(
  data: PlayerCenterResponse,
  names: Map<number, string> | undefined,
): PlayerMatchBreakdown {
  const all = data.events ?? []
  const byId = new Map(
    all.flatMap((event) => (event.ei === undefined ? [] : [[event.ei, event]])),
  ) as Map<string, PlayerCenterEvent>

  /** Both members of every exact reversal pair. */
  const reversed = new Set<string>()
  let revisions = 0

  for (const event of all) {
    if (event.cei === undefined || event.ei === undefined) continue
    const cancelled = byId.get(event.cei)
    // Not an exact negation: keep both and let the reader see it.
    if (cancelled === undefined) continue
    if ((event.p ?? 0) + (cancelled.p ?? 0) !== 0) continue
    reversed.add(event.ei)
    reversed.add(event.cei)
    revisions += 1
  }

  const events = all
    .filter((event) => (event.p ?? 0) !== 0)
    .filter((event) => event.ei === undefined || !reversed.has(event.ei))
    .map((event, index): PlayerMatchEvent => ({
      id: event.ei ?? `${String(event.eti)}-${String(index)}`,
      minute: event.mt ?? 0,
      points: event.p as number,
      name:
        event.eti === undefined
          ? 'Unbekannte Aktion'
          : (names?.get(event.eti) ?? `Aktion ${String(event.eti)}`),
    }))
    .sort((a, b) => a.minute - b.minute || Number(a.id) - Number(b.id) || 0)

  return {
    matchId: data.mi === undefined ? undefined : String(data.mi),
    total: data.p,
    events,
    revisions,
  }
}
