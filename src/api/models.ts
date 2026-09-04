/**
 * Readable domain models.
 *
 * The query hooks map the abbreviated wire DTOs from `types.ts` into these, so
 * components only ever see spelled-out names. When you add an endpoint, add its
 * model here and map it in the hook — don't leak raw keys into the UI.
 *
 * The four predicates that ask *what time is it* — {@link matchdayState},
 * {@link liveMatchday}, {@link fixtureState} and {@link duelPlayerStatus} —
 * read [`nowMs()`](../lib/clock.ts) rather than `Date.now()`, and each still
 * takes `now` as a parameter. That is what lets the
 * [live development profile](../dev/simulation.ts) put the whole app inside a
 * matchday, and what will let tests pin it there without mocking globals.
 */

import {
  GAME_PLAY_MODE,
  MARKET_VALUE_TREND,
  MATCH_EVENT,
  PLAYER_AVAILABILITY,
  PLAYER_POSITION,
} from '@/api/types'
import { nowMs } from '@/lib/clock'

export type MarketValueTrend = 'up' | 'down' | 'flat'

export function toTrend(value: number | undefined): MarketValueTrend {
  switch (value) {
    case MARKET_VALUE_TREND.UP:
      return 'up'
    case MARKET_VALUE_TREND.DOWN:
      return 'down'
    default:
      return 'flat'
  }
}

export type PositionKey = 'gk' | 'def' | 'mid' | 'fwd'

const POSITION_BY_CODE: Record<number, PositionKey> = {
  [PLAYER_POSITION.GOALKEEPER]: 'gk',
  [PLAYER_POSITION.DEFENDER]: 'def',
  [PLAYER_POSITION.MIDFIELDER]: 'mid',
  [PLAYER_POSITION.FORWARD]: 'fwd',
}

export const POSITION_LABEL: Record<PositionKey, string> = {
  gk: 'TW',
  def: 'ABW',
  mid: 'MF',
  fwd: 'ANG',
}

/** Spelled-out position names, for tooltips and screen readers. */
export const POSITION_NAME: Record<PositionKey, string> = {
  gk: 'Torwart',
  def: 'Verteidiger',
  mid: 'Mittelfeldspieler',
  fwd: 'Stürmer',
}

export function toPosition(code: number): PositionKey {
  return POSITION_BY_CODE[code] ?? 'mid'
}

/* -------------------------------------------------------------------------- */

/** A league the signed-in user belongs to. */
export interface League {
  id: string
  name: string
  competitionId: string
  /** CDN-relative image path, if the league has one. */
  image?: string
  budget: number
  teamValue: number
  placement?: number
  unreadCount: number
}

/**
 * One team's fixture in a given matchday, seen from that team's perspective —
 * so `isHome` and `opponent*` are already resolved and no component has to
 * work out which of `t1`/`t2` it is looking at.
 */
export interface TeamFixture {
  matchId: string
  /** Kick-off, ISO 8601. */
  kickoff: string
  /** True when this team is `t1`. */
  isHome: boolean
  opponentId: string
  /** Short symbol, e.g. `"FCB"`. Falls back to the id when absent. */
  opponentSymbol: string
  /** Opponent crest, CDN-relative. */
  opponentImage?: string
}

/**
 * One matchday of the season, reduced to what a picker needs: when it runs and
 * whether it is done.
 *
 * `isFinished` comes from the fixtures (`st === 2` on every one of them) and so
 * refreshes with the query. Whether it has *started* deliberately does not live
 * here — it is a comparison against the clock, and the matchday list is cached
 * for an hour, so a stored flag would go stale mid-cache. Use
 * {@link matchdayState} instead.
 */
export interface SeasonMatchday {
  day: number
  /** Earliest kick-off of the matchday, ISO 8601. */
  start: string
  /** Latest kick-off of the matchday, ISO 8601. */
  end: string
  /** Every fixture reports finished. */
  isFinished: boolean
}

/** The season's matchdays plus the one the competition considers current. */
export interface SeasonSchedule {
  /**
   * The competition's current matchday — the upcoming one once the previous
   * has been played, which is what a matchday picker should default to.
   */
  currentDay: number
  /** Every matchday, ascending. */
  matchdays: SeasonMatchday[]
}

export type MatchdayState = 'upcoming' | 'live' | 'finished'

/**
 * Where a matchday stands right now.
 *
 * "Started" is the first kick-off having passed, not a flag from the API:
 * fixtures carry `st` but only `0` (upcoming) and `2` (finished) have been
 * observed, so a matchday in progress is not distinguishable from `st` alone.
 */
export function matchdayState(
  matchday: SeasonMatchday,
  now: number = nowMs(),
): MatchdayState {
  if (matchday.isFinished) return 'finished'
  const start = Date.parse(matchday.start)
  if (!Number.isNaN(start) && now >= start) return 'live'
  return 'upcoming'
}

/**
 * The competition's current matchday, but **only while it is being played**.
 *
 * "Being played" is `matchdayState` reading `live`: the first kick-off has
 * passed and not every fixture reports finished — which is exactly the window
 * in which a live view of one's own team has anything to show. Outside it this
 * returns `undefined`, and the squad page's Live tab does not exist.
 *
 * The current day is the competition's own `day`, which becomes the *next*
 * matchday as soon as the previous one is over. So between matchdays the
 * upcoming day is what gets tested, it is not live, and there is nothing to
 * show — correct, and the reason no search over the season is needed here.
 */
export function liveMatchday(
  schedule: SeasonSchedule | undefined,
  now: number = nowMs(),
): SeasonMatchday | undefined {
  const current = schedule?.matchdays.find(
    (entry) => entry.day === schedule.currentDay,
  )
  if (current === undefined) return undefined
  return matchdayState(current, now) === 'live' ? current : undefined
}

/**
 * A team's fixture on a specific matchday, with enough state to say whether it
 * is over. {@link TeamFixture} plus the result, for views that care about a
 * past or running matchday rather than the next one.
 */
export interface MatchdayFixture extends TeamFixture {
  /** The API reports the match played to the end. */
  isFinished: boolean
  /** Goals, once they exist. */
  goalsFor?: number
  goalsAgainst?: number
}

export type FixtureState = 'upcoming' | 'running' | 'finished'

/**
 * Where a single match stands.
 *
 * `isFinished` is the API's own word (`st === 2`); "running" is inferred from
 * the clock, because no observed status code distinguishes a match in progress
 * from one that has not kicked off — only `0` and `2` have ever been seen.
 */
export function fixtureState(
  // Structural rather than `MatchdayFixture`, so a `PlayerMatch` — which
  // carries the same two fields and asks the same question — can use it
  // without a near-identical copy of the four lines below.
  fixture: { isFinished: boolean; kickoff: string },
  now: number = nowMs(),
): FixtureState {
  if (fixture.isFinished) return 'finished'
  const kickoff = Date.parse(fixture.kickoff)
  if (!Number.isNaN(kickoff) && now >= kickoff) return 'running'
  return 'upcoming'
}

/** A competition the app can filter leagues by. */
export interface Competition {
  id: string
  name: string
  /** CDN-relative icon path. */
  image?: string
}

/**
 * A league the user could join, normalised from either
 * `/v4/leagues/recommended` or `/v4/leagues/list` — the two endpoints return
 * different shapes, and this is where that difference stops.
 *
 * `competitionName` arrives directly from `recommended`; for `list` results
 * only `competitionId` is present and the name has to be resolved against
 * {@link Competition} data.
 */
export interface JoinableLeague {
  id: string
  name: string
  /** CDN-relative league image. */
  image?: string
  competitionId?: string
  competitionName?: string
  /** CDN-relative competition icon — `list` results only. */
  competitionImage?: string
  /** Current manager count. */
  managerCount?: number
  /** Manager cap — `list` results only. */
  managerLimit?: number
  /** Verified/featured league. */
  isFeatured: boolean
  /** Game mode — `list` results only. */
  gameMode?: number
  /** Member avatars — `recommended` results only. */
  memberImages: string[]
}

/** Filters accepted by `/v4/leagues/list`. All optional, all combinable. */
export interface JoinableLeagueFilters {
  query?: string
  competitionId?: string
  gameMode?: number
}

export const GAME_MODE_LABEL: Record<number, string> = {
  [GAME_PLAY_MODE.CLASSIC]: 'Klassisch',
  [GAME_PLAY_MODE.BEGINNER]: 'Anfänger',
  [GAME_PLAY_MODE.HIGH_MANAGEMENT]: 'High-Management',
  [GAME_PLAY_MODE.ARENA]: 'Arena',
}

/** Filter chips, in the order they are offered. */
export const GAME_MODE_OPTIONS = [
  GAME_PLAY_MODE.CLASSIC,
  GAME_PLAY_MODE.ARENA,
  GAME_PLAY_MODE.HIGH_MANAGEMENT,
  GAME_PLAY_MODE.BEGINNER,
] as const

/** The signed-in manager's standing inside one league. */
export interface LeagueManager {
  leagueName: string
  competitionId: string
  budget: number
  squadSize: number
  unreadCount: number
  isAdmin: boolean
}

export interface LeagueDetails {
  id: string
  name: string
  competitionId: string
  competitionName: string
  createdAt: string
  memberCount: number
  members: Array<{ id: string; image?: string }>
}

export interface RankedManager {
  id: string
  name: string
  image?: string
  seasonPoints: number
  seasonPlacement: number
  matchdayPoints: number
  matchdayPlacement: number
  teamValue: number
  /** Placement change since the previous matchday. */
  placementChange: number
  pointsPerMatchday: Array<number | null>
  isAdmin: boolean

  /** Duel table position (`hhpl`). Only set in duel leagues. */
  duelPlacement?: number
  /** Duel points for the season (`hhsp`). */
  duelPoints?: number
  /** Duel points from this matchday (`hhmp`). */
  duelMatchdayPoints?: number
  /** The manager faced in the current duel (`hhoui`). */
  duelOpponentId?: string
}

/** How a manager's current duel is going. */
export type DuelResult = 'won' | 'drawn' | 'lost'

/**
 * A league's standings, plus how to read them.
 *
 * Duel ("Duell") leagues are ranked by head-to-head results rather than raw
 * points, so which number is the headline depends on the mode.
 */
export interface LeagueRanking {
  /** True when the league is played as duels. */
  isDuelMode: boolean
  /** Managers, **sorted by the placement that applies to this mode**. */
  managers: RankedManager[]
}

/* -------------------------------------------------------------------------- */
/* Duels                                                                      */
/* -------------------------------------------------------------------------- */

/** One manager as they appear in a duel. */
export interface DuelSide {
  id: string
  name: string
  image?: string
  /**
   * Points scored on the duel's matchday — live while it is being played, `0`
   * before it kicks off.
   */
  matchdayPoints: number
  /** Position in the league's duel table (`hhpl`). */
  duelPlacement?: number
  /** Running duel-point total (`hhsp`). */
  duelPoints?: number
  /** Position in the Kickbase points table (`spl`). */
  seasonPlacement: number
  /** Duel points from this matchday — 3 for a win, 0 for a loss. */
  duelMatchdayPoints?: number
}

/** Two managers drawn against each other on one matchday. */
export interface Duel {
  /**
   * Both manager ids, sorted and joined with `-` — stable across re-fetches,
   * and used verbatim as the detail route's path segment.
   */
  id: string
  sides: [DuelSide, DuelSide]
}

/** Every duel of one matchday. */
export interface MatchdayDuels {
  /** The matchday the pairings belong to. */
  day: number
  /** False when the league does not play duels at all. */
  isDuelMode: boolean
  /** Sorted by the better-placed of the two managers. */
  duels: Duel[]
  /**
   * Managers left without an opponent — an odd league, or an opponent the
   * response does not contain. Normally empty.
   */
  byes: DuelSide[]
}

/**
 * Which side is ahead, or `undefined` for level.
 *
 * Decided on the matchday points both managers actually scored, the same way
 * {@link duelResultOf} does it, rather than on `hhmp` — see
 * [Ranking](../../docs/pages/ranking.md#duel-outcome). Before kick-off both
 * are `0` and this returns `undefined`, so callers must gate on the matchday
 * having started before reading "level" as a draw.
 */
export function duelLeader(duel: Duel): DuelSide | undefined {
  const [a, b] = duel.sides
  if (a.matchdayPoints > b.matchdayPoints) return a
  if (b.matchdayPoints > a.matchdayPoints) return b
  return undefined
}

/* -------------------------------------------------------------------------- */
/* One matchday's rosters — duel detail, and the squad's live view             */
/* -------------------------------------------------------------------------- */

/**
 * What a player is doing on the duel's matchday.
 *
 * `bench` is about the *manager's* choice; the other four are about the
 * player's real-world match. Kept as one union because that is how the row
 * reads to a user — one word saying whether this player can still score.
 */
export type DuelPlayerStatus =
  'bench' | 'open' | 'playing' | 'substituted' | 'finished'

export const DUEL_PLAYER_STATUS_LABEL: Record<DuelPlayerStatus, string> = {
  bench: 'Bank',
  open: 'Offen',
  playing: 'Läuft',
  substituted: 'Ausgewechselt',
  finished: 'Beendet',
}

/**
 * One player on one matchday: who they are, what their match is doing, what
 * they scored.
 *
 * Named for the duel page it was written for, and **also what the squad
 * page's live view renders** — a manager's own team on the running matchday is
 * one side of a duel with the opponent left out, right down to the bench rows
 * and the unknown-versus-zero distinction on `points`. Rather than a
 * near-identical second model, that view builds these from its own squad; the
 * only field it has no use for is `managerId`, which is why that one is
 * optional.
 */
export interface DuelPlayer {
  id: string
  name: string
  teamId: string
  /**
   * `undefined` when nothing on hand knows it.
   *
   * Optional since the matchday snapshot became the source of who was in a
   * squad: that payload does not reliably carry `pos`, and a player
   * transferred away since is in no current squad either. A row renders `–`
   * for the label; the pitch cannot place him and says how many it left out,
   * which is the honest option — `toPosition()`'s midfield default would put
   * a stranger in the middle of the park and look deliberate.
   */
  position?: PositionKey
  /** Lineup slot (0-based), or `undefined` when benched. */
  lineupOrder?: number
  status: DuelPlayerStatus
  /**
   * Points for the duel's matchday.
   *
   * `undefined` means *not known* — the request is still in flight, or the
   * matchday has not been played. It is deliberately not `0`, which would
   * claim the player featured and scored nothing.
   */
  points?: number
  /** 0 = fit; anything else is injured / suspended / away. */
  availability: number
  image?: string
  /** The player's club fixture that matchday. */
  fixture?: MatchdayFixture
  /**
   * That match as it stands right now — score, minute, events.
   *
   * `undefined` before kick-off (there is nothing to fetch) and while the
   * request is in flight. Rows fall back to the fixture's own goals, which are
   * correct for a settled matchday and stale for a running one.
   */
  live?: LiveMatch
  /** What this player did in that match, one tally per kind. */
  events?: MatchEventTally[]
  /**
   * Which side of the duel they belong to.
   *
   * Absent when there are no sides to tell apart — the live view of one's own
   * squad, where every row belongs to the same manager.
   */
  managerId?: string
}

/* -------------------------------------------------------------------------- */
/* One match, live                                                            */
/* -------------------------------------------------------------------------- */

/** Something that happened in a match, attributed to a player. */
export interface LiveMatchEvent {
  playerId: string
  playerName?: string
  teamId?: string
  /** Event code, on the {@link MATCH_EVENT} scale. */
  kind: number
  /** Minute it happened. */
  minute: number
}

/**
 * Where one match stands right now, from
 * `/v4/matches/{matchId}/details`.
 *
 * The score here is the **only fresh one**: the fixture list carries goals too
 * but is cached for an hour, being the whole season, so a page watching a
 * match cannot use it. This also brings the two things nothing else had — the
 * minute, and the events.
 */
export interface LiveMatch {
  matchId: string
  /** The minute, past 90 in stoppage time. */
  minute: number
  /** The API reports it played to the end (`mst === 2`). */
  isFinished: boolean
  goalsHome?: number
  goalsAway?: number
  /** Which side is home, so a score can be read from either team's view. */
  homeTeamId?: string
  /** Everything attributable to a player, newest first. */
  events: LiveMatchEvent[]
  /** Those events per player, collapsed to one tally per kind. */
  eventsByPlayerId: Map<string, MatchEventTally[]>
}

/**
 * The score as **this** team's players would read it: theirs first.
 *
 * The payload is home-and-away; a row belongs to one club, and "2:1" has to
 * mean that club is winning or the colour of the row lies.
 */
export function liveScoreFor(
  live: LiveMatch,
  teamId: string,
): { for?: number; against?: number } {
  const isHome = live.homeTeamId === teamId
  return isHome
    ? { for: live.goalsHome, against: live.goalsAway }
    : { for: live.goalsAway, against: live.goalsHome }
}

/* -------------------------------------------------------------------------- */
/* A matchday's fixtures, and one match in full                               */
/* -------------------------------------------------------------------------- */

/** One club, as a fixture names it. */
export interface MatchTeam {
  id: string
  /** Full club name, when the payload carries one. */
  name?: string
  /** Short symbol, e.g. `"FCB"`. Falls back to the id. */
  symbol: string
  /** Crest, CDN-relative. */
  image?: string
}

/**
 * One match of a matchday, **as a match** rather than from a team's side.
 *
 * {@link MatchdayFixture} answers "what is this player's club doing", which is
 * why it is keyed by team and resolves an `opponent`. A fixture *list* answers
 * "who plays whom", so here home and away stay where they are and neither side
 * is privileged. Both are selected out of the same season payload — see
 * [`useMatchday`](./hooks/useMatchday.ts).
 *
 * It carries the two fields {@link fixtureState} needs, so a match's state is
 * read the same way a player's fixture is.
 */
export interface MatchdayMatch {
  matchId: string
  day: number
  /** Kick-off, ISO 8601. */
  kickoff: string
  /** The API reports the match played to the end (`st === 2`). */
  isFinished: boolean
  home: MatchTeam
  away: MatchTeam
  /** Goals, once they exist. */
  goalsHome?: number
  goalsAway?: number
}

/**
 * One player in a match's **real-world** lineup, plus everything the app can
 * find out about him.
 *
 * The first four fields are all `/matches/{id}/details` carries — it has no
 * points and no notion of a Kickbase league. The rest is layered on from the
 * per-player fan-out and the league standings: see
 * [`useMatchLineup`](./hooks/useMatchLineup.ts).
 */
export interface MatchPlayer {
  id: string
  /** Last name, as the match payload spells it. */
  name: string
  teamId: string
  /**
   * `undefined` when the match payload omits `pos` and the player's own detail
   * has not arrived. The pitch cannot place him and says how many it left out
   * rather than defaulting him into midfield.
   */
  position?: PositionKey
  image?: string
  /**
   * Kickbase points for this matchday.
   *
   * `undefined` means *not known* — before kick-off there is nothing to read,
   * and during the match the request may still be in flight. Deliberately not
   * `0`, which would claim he played and scored nothing.
   */
  points?: number
  /** The league manager who owns him, when anybody does. */
  owner?: MatchPlayerOwner
  /** What he did in this match, one tally per kind. */
  events?: MatchEventTally[]
  /** Whether he was swapped, from the match's own event feed. */
  role?: 'substitutedIn' | 'substitutedOff' | 'substitutedInAndOff'
}

/** Nobody owns the player. The API sends the string, not an absent field. */
const NO_OWNER = '0'

/**
 * The wire's `oui`, narrowed to an owning manager's id.
 *
 * Unowned players carry the *string* `"0"` rather than an absent field, which
 * is a trap worth having in exactly one place: read naively it is a truthy id
 * that matches no manager, so every free agent would show as owned by a
 * manager the app cannot find.
 */
export function toOwnerId(oui: string | undefined): string | undefined {
  return oui === undefined || oui === NO_OWNER ? undefined : oui
}

/**
 * Where an ownership badge's claim comes from — and therefore what it means.
 *
 *  - **`matchdayLineup`** — the manager had this player *in his lineup on this
 *    matchday*, from the snapshot's league-wide `us`. The historical truth, and
 *    the only correct answer for a matchday that has been played.
 *  - **`currentOwner`** — the manager owns him *now*, from `oui` on the player
 *    detail. Used only when there is no lineup yet, where it is also the right
 *    answer: nobody has fielded anybody, and today's owner is who will.
 *
 * The distinction is not cosmetic. Reading `oui` for a past matchday badges
 * every player transferred since with his **new** manager, which silently
 * rewrites who scored those points.
 */
export type OwnerSource = 'matchdayLineup' | 'currentOwner'

/** A manager in the viewer's league, against a player in this match. */
export interface MatchPlayerOwner {
  id: string
  name: string
  image?: string
  /** True when the signed-in user is the manager. */
  isViewer: boolean
  /** What the badge is actually asserting — see {@link OwnerSource}. */
  source: OwnerSource
}

/**
 * Every league member's lineup for one matchday, as one lookup.
 *
 * From `us` on the matchday snapshot — see
 * [`useMatchdayLineups`](./hooks/useMatchdaySquad.ts). Fielded players only:
 * there is no bench per manager in that field.
 */
export interface MatchdayLineups {
  /** Player id → the manager who fielded him that matchday. */
  managerIdByPlayerId: Map<string, string>
  /** Manager id → display name, as the snapshot spells it (`unm`). */
  nameByManagerId: Map<string, string>
  /**
   * No manager has a lineup in the payload at all.
   *
   * Before the matchday's first kick-off, or a matchday the API has nothing
   * for. **Not** "nobody fielded anybody" — the caller has to tell those apart
   * and fall back rather than drop every badge.
   */
  isEmpty: boolean
}

/**
 * One club's team sheet for a match.
 *
 * **No formation.** The payload has one (`ts1`/`ts2`, e.g. `"4-2-3-1"`) and it
 * was drawn in the pitch's corner labels for exactly as long as it took to see
 * that a dashed run of digits at 10px reads as a date. The corner carries the
 * team's points total instead, which nothing else on the screen added up. The
 * wire field stays documented in `types.ts` if it is ever wanted again.
 */
export interface MatchLineup {
  team: MatchTeam
  /** The starting eleven, in the order the payload lists it. */
  starters: MatchPlayer[]
  /** The rest of the match-day squad. */
  substitutes: MatchPlayer[]
}

/**
 * One match in full, from `/v4/matches/{matchId}/details`.
 *
 * The richer sibling of {@link LiveMatch}, which reduces the same payload to
 * what a *player row* needs. Both map the one cached response, so opening a
 * match from a matchday list costs no request — see
 * [`useMatchDetails`](./hooks/useMatchDetails.ts).
 *
 * **No `matchId`.** The response does not echo the id it was asked for, and
 * inventing one here would mean either a lie or a per-match `select`. Every
 * caller already holds the {@link MatchdayMatch} it navigated by, which is
 * where the id, the matchday and the authoritative state all come from.
 */
export interface MatchDetail {
  home: MatchTeam
  away: MatchTeam
  goalsHome?: number
  goalsAway?: number
  /** The minute, past 90 in stoppage time. */
  minute: number
  /** The API reports it played to the end (`mst === 2`). */
  isFinished: boolean
  /** Kick-off, ISO 8601, when the payload names one. */
  kickoff?: string
  /**
   * Kickbase says the team sheets are **official** rather than predicted
   * (`il`). Observed `false` on a match played weeks ago, so it is closer to a
   * flag set around kick-off than to a durable fact — the lineups are rendered
   * either way and this only qualifies them.
   */
  isLineupOfficial: boolean
  home11: MatchLineup
  away11: MatchLineup
  /** Everything that happened, newest first. */
  events: MatchTimelineEvent[]
  /** Those events per player, collapsed to one tally per kind. */
  eventsByPlayerId: Map<string, MatchEventTally[]>
}

/* --- The timeline --------------------------------------------------------- */

/**
 * What a timeline entry can be.
 *
 * {@link MatchEventKind} plus `substitution`, which the badge scale
 * deliberately leaves out: on a player's row a swap says where he was rather
 * than what he did, but on a *match* timeline it is one of the events the
 * viewer came for.
 *
 * The two wire codes for a swap (`SUBSTITUTED_IN` and `SUBSTITUTED_OFF`) both
 * collapse to this one kind. A real feed was observed to carry only the
 * incoming one, with the outgoing player folded in as `rev` — see
 * {@link MatchTimelineEvent.relatedName}.
 */
export type TimelineEventKind = MatchEventKind | 'substitution'

/** Spelled-out name for a timeline entry's kind. */
export function timelineEventLabel(kind: TimelineEventKind): string {
  return kind === 'substitution' ? 'Wechsel' : MATCH_EVENT_LABEL[kind]
}

/**
 * The wire's `ke`, narrowed for a timeline.
 *
 * A code that maps to nothing degrades to `undefined` and the entry is dropped:
 * Kickbase can add an event kind, and a match timeline is not the place to find
 * out about it via an unlabelled marker.
 */
export function toTimelineKind(code: number): TimelineEventKind | undefined {
  if (
    code === MATCH_EVENT.SUBSTITUTED_IN ||
    code === MATCH_EVENT.SUBSTITUTED_OFF
  ) {
    return 'substitution'
  }
  return toMatchEventKind(code)
}

/** Something that happened in a match, as a timeline reads it. */
export interface MatchTimelineEvent {
  kind: TimelineEventKind
  /** Minute it happened, as the API counts it. */
  minute: number
  /** `undefined` when the feed names no club — it has not been seen. */
  teamId?: string
  playerId?: string
  playerName?: string
  /**
   * The **other** player the feed folds into the entry: the assist on a goal,
   * the player coming off in a substitution.
   *
   * A name and nothing else, on purpose — the nested `rev` entry carries
   * `pi: "0"` even when `pn` names somebody, so the related player cannot be
   * identified by id and cannot be linked to.
   */
  relatedName?: string
  /**
   * For a substitution, which way it went — `undefined` for every other kind.
   *
   * Both wire codes collapse to the `substitution` kind, but the direction is
   * worth keeping: it is an arrow on the timeline row and it is how the
   * [match lineup](./hooks/useMatchLineup.ts) works out who came on.
   *
   * A real feed was observed to carry only `SUBSTITUTED_IN` — ten of them for
   * a match's ten substitutions, none of the outgoing code — so `off` is
   * declared and may never appear. The player going the other way is named in
   * {@link relatedName}.
   */
  swap?: 'in' | 'off'
}

/**
 * The three structural moments of a match.
 *
 * **Derived from the match's state, not read from the feed.** The feed does
 * carry match-level entries — they are the ones with `pi: "0"` — but their `ke`
 * codes are not on the player scale and have not been identified, so believing
 * a guess would put a mislabelled marker in the middle of a real timeline.
 * Kick-off, half-time and the final whistle are all implied by data the app
 * already trusts (the kick-off time, the minute, `st`), which is why they are
 * computed here instead. See
 * [Match detail](../../docs/pages/match-detail.md#the-structural-markers).
 */
export type TimelineMarker = 'kickoff' | 'halfTime' | 'fullTime'

export const TIMELINE_MARKER_LABEL: Record<TimelineMarker, string> = {
  kickoff: 'Anpfiff',
  halfTime: 'Halbzeit',
  fullTime: 'Abpfiff',
}

/** One row of a match timeline: an event, or one of the three whistles. */
export type MatchTimelineItem =
  | { kind: 'event'; id: string; event: MatchTimelineEvent }
  | { kind: 'marker'; id: string; marker: TimelineMarker }

/** The minute the first half is taken to end at. */
const HALF_TIME_MINUTE = 45

/**
 * The match's events with the whistles woven in, **newest first**.
 *
 * Newest first because the timeline's live case is the one that matters: what
 * just happened belongs where the eye lands, not at the end of a list that
 * grows downwards for two hours. So the final whistle heads the list once it
 * has blown and the kick-off closes it.
 *
 * Half-time goes in between the last event of the first half and the first of
 * the second — it is a divider derived from the minutes, and it appears only
 * once the match has actually reached it.
 *
 * `state` is passed in rather than read off `detail` because the two can
 * legitimately disagree: `mst` on the match payload is what the *server* says,
 * while the fixture list's `st` is what the app (and
 * [the live development profile](../dev/simulation.ts)) treats as the truth
 * about a matchday.
 */
export function matchTimeline(
  detail: MatchDetail,
  state: FixtureState,
): MatchTimelineItem[] {
  if (state === 'upcoming') return []

  const items: MatchTimelineItem[] = []
  if (state === 'finished') {
    items.push({ kind: 'marker', id: 'fullTime', marker: 'fullTime' })
  }

  // Descending by minute, with the feed's own order breaking ties — two goals
  // in the same minute should stay in the order Kickbase reported them.
  const ordered = detail.events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => b.event.minute - a.event.minute || a.index - b.index)

  const reachedHalfTime =
    state === 'finished' || detail.minute > HALF_TIME_MINUTE
  let halfTimeDone = !reachedHalfTime

  for (const { event, index } of ordered) {
    if (!halfTimeDone && event.minute <= HALF_TIME_MINUTE) {
      items.push({ kind: 'marker', id: 'halfTime', marker: 'halfTime' })
      halfTimeDone = true
    }
    items.push({
      kind: 'event',
      id: `${String(index)}:${event.playerId ?? ''}`,
      event,
    })
  }

  // A second half under way in which nothing has happened yet: the divider
  // still belongs, above the kick-off and below the first-half events.
  if (!halfTimeDone) {
    items.push({ kind: 'marker', id: 'halfTime', marker: 'halfTime' })
  }

  items.push({ kind: 'marker', id: 'kickoff', marker: 'kickoff' })
  return items
}

/**
 * Which side of the match an event belongs to, or `undefined` when the feed
 * names no club.
 */
export function eventSide(
  event: MatchTimelineEvent,
  detail: MatchDetail,
): 'home' | 'away' | undefined {
  if (event.teamId === undefined) return undefined
  if (event.teamId === detail.home.id) return 'home'
  if (event.teamId === detail.away.id) return 'away'
  return undefined
}

/** One player in a {@link MatchdaySquad}. */
export interface MatchdaySquadPlayer {
  id: string
  name: string
  teamId: string
  /**
   * `undefined` when neither the snapshot nor the caller's squad knows it —
   * which in practice means a player transferred away since that matchday.
   * Deliberately not defaulted: inventing a position would place a stranger
   * in midfield on the pitch and look like a fact.
   */
  position?: PositionKey
  /** 0 = fit; anything else is injured / suspended / away. */
  availability: number
  image?: string
  /** In the lineup that matchday, as the snapshot's `lp`/`nlp` split says. */
  wasFielded: boolean
}

/**
 * One manager's squad **as it stood on one matchday**.
 *
 * The historical truth, from `users/{uid}/teamcenter?dayNumber=` — not today's
 * squad with an old matchday's points beside it, which is what every view had
 * to settle for before that endpoint was found.
 */
export interface MatchdaySquad {
  day: number
  /** The manager's display name, as the snapshot reports it. */
  managerName?: string
  /** The eleven that was fielded, in the order the payload lists them. */
  fielded: MatchdaySquadPlayer[]
  /** Everyone else in the squad that matchday. */
  bench: MatchdaySquadPlayer[]
  /**
   * The API had nothing for this matchday — out of range, or before the league
   * existed. **Not** "fielded nobody": it answers 200 with empty lists, so a
   * caller has to tell the two apart and fall back rather than render a blank
   * team as fact.
   */
  isEmpty: boolean
}

/**
 * Is the matchday snapshot usable, or does the caller have to fall back to
 * today's squad and its `lo`?
 *
 * The snapshot is the only source that knows a squad *as it stood*, so the
 * answer should be "always". It is not, for one measured reason: **`lp` is
 * empty until the matchday starts.** Probed six hours before kick-off, the
 * snapshot returned `lp: []` with all fifteen players in `nlp`, while `/squad`
 * plainly had eleven fielded with `lo` `0…10`. So it fills at or after the
 * first kick-off.
 *
 * An earlier version of this gated on the matchday being **finished**, which
 * was safe and too crude by half: a live matchday fell back to today's squad,
 * and so did every matchday under `dev:live`, since the simulation marks the
 * replayed one unfinished on purpose. The data was there and the app refused
 * it.
 *
 * So the test is completeness, not the clock:
 *
 *  - **No lineup at all** → fall back. This is the pre-kick-off case, and also
 *    a matchday before the league existed.
 *  - **Matchday settled** → trust it, whatever the count. A manager who
 *    fielded nine that day really did field nine, and `lo` cannot tell you
 *    that any more.
 *  - **Matchday running** → trust it only once it holds at least as many
 *    players as are fielded today. If `lp` turns out to fill per match rather
 *    than all at once, this is what stops a half-filled lineup being drawn as
 *    the whole team, with the rest wrongly on the bench and an empty-slot
 *    penalty to match.
 *
 * `todaysFieldedCount` is the count from the manager's current squad — the
 * lineup Kickbase locked at kick-off, and therefore the number the snapshot
 * has to reach before it can be believed mid-matchday.
 */
export function canUseMatchdaySquad(
  snapshot: MatchdaySquad | undefined,
  todaysFieldedCount: number,
  isSettled: boolean,
): boolean {
  if (snapshot === undefined || snapshot.isEmpty) return false
  if (snapshot.fielded.length === 0) return false
  if (isSettled) return true
  return snapshot.fielded.length >= todaysFieldedCount
}

/**
 * Has every match of a matchday been played to the end?
 *
 * The API's own `st === 2` on all of them, which is what
 * {@link SeasonMatchday.isFinished} means too — deliberately not a clock
 * comparison, so a simulated clock cannot make a matchday look settled when it
 * is not.
 */
export function areFixturesSettled(
  fixtureByTeamId: Map<string, MatchdayFixture> | undefined,
): boolean {
  if (fixtureByTeamId === undefined || fixtureByTeamId.size === 0) return false
  return [...fixtureByTeamId.values()].every((fixture) => fixture.isFinished)
}

/**
 * What to put in a player's one figure slot — the plate under a portrait, or
 * the number at the end of a row.
 *
 * `points` was the only case for a long time, and `–` stood in for all the
 * others. That dash is the least informative thing that could go there: on a
 * Friday evening most of a lineup has not kicked off, so a pitch of eleven
 * dashes said nothing at all.
 */
export type PlayerFigure =
  | { kind: 'points'; points: number }
  | { kind: 'bench' }
  | { kind: 'kickoff'; kickoff: string }
  | { kind: 'unknown' }

/**
 * Which of the four applies, in priority order.
 *
 *  1. **Points, whenever they are known.** Even for a benched player: they are
 *     the most informative thing available, and a bench that outscored the
 *     eleven is the whole reason benches are on screen.
 *  2. **`bench` otherwise.** For a player who did not play, a kick-off time
 *     would be actively misleading — his match starting changes nothing,
 *     because his points will never count.
 *  3. **The kick-off**, for a fielded player whose match is still to come.
 *     "18:30" answers the question the dash left hanging.
 *  4. **`unknown`** only when there is genuinely nothing to say: no fixture
 *     that matchday, or a match under way whose points have not arrived.
 *
 * The decision lives here and the wording lives in the components, so the two
 * pitches and the two lists cannot drift apart on the rule while differing on
 * the styling, which they must.
 */
export function playerFigure(
  player: Pick<DuelPlayer, 'points' | 'status' | 'fixture'>,
  now: number = nowMs(),
): PlayerFigure {
  if (player.points !== undefined) {
    return { kind: 'points', points: player.points }
  }
  if (player.status === 'bench') return { kind: 'bench' }
  if (
    player.fixture !== undefined &&
    fixtureState(player.fixture, now) === 'upcoming'
  ) {
    return { kind: 'kickoff', kickoff: player.fixture.kickoff }
  }
  return { kind: 'unknown' }
}

/**
 * Sort comparator: **best first**, and a player with no points yet sorts
 * **last** rather than as zero — not knowing is not the same as nothing.
 *
 * Ties, including the tie between two unknowns, fall back to the name so the
 * order is stable while points arrive one request at a time.
 */
export function byMatchdayPoints(a: DuelPlayer, b: DuelPlayer): number {
  if (a.points === undefined && b.points === undefined) {
    return a.name.localeCompare(b.name)
  }
  if (a.points === undefined) return 1
  if (b.points === undefined) return -1
  return b.points - a.points || a.name.localeCompare(b.name)
}

/** One manager's team as it stands in a duel. */
export interface DuelRoster {
  manager: DuelSide
  /** Fielded players, in lineup-slot order. */
  lineup: DuelPlayer[]
  /** Everyone else. */
  bench: DuelPlayer[]
  /**
   * Kickbase's own total for the matchday — **not** the sum of the rows.
   *
   * The two can differ: the totals come straight from the standings, while the
   * rows are assembled from separate requests that may still be loading. The
   * authoritative figure is the one shown.
   */
  totalPoints: number
  /** Fielded players whose match is under way. */
  activeMatches: number
  /** Fielded players whose match has not kicked off. */
  openMatches: number
}

/**
 * What a fielded player's row should say.
 *
 * **`substituted` is never returned yet.** Nothing in any observed payload
 * distinguishes a player taken off from one still on the pitch: the manager
 * squad carries only availability (`st`: 0 fit, 2 out), and the live per-player
 * fields are absent outside a running matchday. It is in the union, labelled
 * and styled, so that wiring it up when the field is identified during a live
 * matchday is a change to this one function — see
 * [docs/pages/duel-detail.md](../../docs/pages/duel-detail.md#unverified-ausgewechselt).
 */
export function duelPlayerStatus(
  player: { lineupOrder?: number; fixture?: MatchdayFixture },
  now: number = nowMs(),
): DuelPlayerStatus {
  if (player.lineupOrder === undefined) return 'bench'
  if (player.fixture === undefined) return 'open'

  switch (fixtureState(player.fixture, now)) {
    case 'finished':
      return 'finished'
    case 'running':
      return 'playing'
    default:
      return 'open'
  }
}

/* -------------------------------------------------------------------------- */
/* Lineup probability                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Ligainsider's Startelf-Wahrscheinlichkeit, as the wire's `prob` — **1..5,
 * and lower is more likely.** The scale runs the intuitive way round only if
 * you read it as a ranking rather than a score, which is why it is narrowed to
 * a union here instead of being passed around as a bare number.
 *
 * The tiers were verified against the badges Ligainsider draws inside the
 * team poster (`plpim`), not guessed from the ordering — see
 * [docs/pages/squad.md](../../docs/pages/squad.md#lineup-probability-prob).
 */
export type StartProbability = 1 | 2 | 3 | 4 | 5

/**
 * Everything a tier needs to render, in one place.
 *
 * `label` is the tooltip and the legend's heading; `description` is the line
 * under it in the legend, and exists because the labels alone do not say where
 * the boundaries sit — "fraglich" and "unrealistisch" are not self-evidently
 * different until someone spells out that one might still start.
 */
export const START_PROBABILITY: Record<
  StartProbability,
  { label: string; description: string }
> = {
  1: {
    label: 'Sicher dabei',
    description: 'Steht so gut wie sicher in der Startelf.',
  },
  2: {
    label: 'Wahrscheinlich',
    description: 'Startet voraussichtlich, garantiert ist es nicht.',
  },
  3: {
    label: 'Fraglich',
    description: 'Kann starten oder auf der Bank bleiben — offen.',
  },
  4: {
    label: 'Unrealistisch',
    description: 'Ein Startelf-Einsatz wäre eine Überraschung.',
  },
  5: {
    label: 'Ausgeschlossen',
    description: 'Fällt aus oder sitzt sicher auf der Bank.',
  },
}

/** The tiers in order, for anything that renders all five. */
export const START_PROBABILITY_TIERS: StartProbability[] = [1, 2, 3, 4, 5]

/**
 * Narrow the wire's `prob` to a tier.
 *
 * An unknown value degrades to `undefined` — "no assessment" — rather than
 * throwing or rendering a sixth, unstyled badge. Ligainsider could add a tier
 * and a squad page is not the place to find out.
 */
export function toStartProbability(
  prob: number | undefined,
): StartProbability | undefined {
  if (prob === undefined) return undefined
  return prob >= 1 && prob <= 5 && Number.isInteger(prob)
    ? (prob as StartProbability)
    : undefined
}

export interface SquadMember {
  id: string
  firstName?: string
  lastName: string
  teamId: string
  position: PositionKey
  marketValue: number
  marketValueTrend: MarketValueTrend
  /** Profit/loss versus purchase price, in €. */
  profitLoss: number
  /**
   * Change over the last 24 hours, in €, signed.
   *
   * `undefined` when the squad payload omits `tfhmvt` — it is not a documented
   * field on that endpoint, so absence is treated as "unknown" rather than as
   * a flat 0.
   */
  marketValueChangeDay?: number
  totalPoints: number
  averagePoints: number
  /** 0 means available; anything else is injured / suspended / away. */
  status: number
  /** Lineup-probability tier, or `undefined` when unassessed. */
  startProbability?: StartProbability
  image?: string
  offerCount: number
  /**
   * Lineup slot (`lo` on the wire), **0-based**, or `undefined` when the
   * player is not fielded.
   *
   * Confirmed against real squad payloads: a fielded eleven carries `lo`
   * `0…10` and benched players carry no `lo` at all. Slot `0` is the
   * goalkeeper, then defenders, midfielders and forwards in order — so the
   * slot index alone encodes the formation:
   *
   * ```
   * lo:  0   1  2  3  4   5  6  7  8   9 10
   *     GK  DEF DEF DEF DEF MID MID MID MID FWD FWD   → 4-4-2
   * ```
   *
   * Because `0` is a *valid* slot, membership must be tested with
   * `lineupOrder !== undefined`. Testing `lineupOrder > 0` silently drops the
   * goalkeeper — see `LineupTab`'s seeding.
   */
  lineupOrder?: number
}

export interface MarketListing {
  id: string
  firstName?: string
  lastName: string
  teamId: string
  position: PositionKey
  marketValue: number
  marketValueTrend: MarketValueTrend
  /** What the seller is asking, in €. */
  price: number
  /**
   * When the listing is settled, as an epoch milli — **`undefined` on a
   * manager's listing**, which has no expiry at all and stands until they
   * withdraw it or accept an offer.
   *
   * Resolved from the wire's `exs` (a live countdown in seconds) against the
   * clock at fetch time, so it survives sitting in the cache: seconds-left
   * read straight off a cached response would be as stale as the response,
   * while an instant stays true.
   */
  expiresAt?: number
  /** When the listing went up, ISO 8601. */
  listedAt?: string
  /** Absent for listings from the computer-run market. */
  seller?: { id: string; name: string; image?: string }
  status: number
  /**
   * Offers **this account can see** — its own, and on a manager's listing the
   * ones made to it. Never a count of what other managers have bid on a
   * computer listing; those are invisible. See `MarketPlayer.ofc`.
   */
  offerCount: number
  /** This account's own standing offer, in €, if it has one. */
  ownOffer?: number
  /** Id of that offer, needed to withdraw it. */
  ownOfferId?: string
  image?: string
}

/**
 * The market, and the two instants the listings are read against.
 *
 * Both arrive on the market response itself rather than having to be found:
 * `mvud` names the nightly market-value recalculation, and `dt` — verified
 * against the fixture list — is the **first kick-off of the current matchday**.
 * They are the two moments that change what a listing is worth, which is why
 * they are worth drawing into a list ordered by expiry.
 */
export interface Market {
  /** Soonest to expire first; manager listings, which never expire, last. */
  listings: MarketListing[]
  /** When market values are next recalculated, epoch ms. */
  marketValueUpdateAt?: number
  /** The current matchday's first kick-off, epoch ms. */
  matchdayStartAt?: number
  /** The matchday {@link matchdayStartAt} belongs to. */
  day?: number
}

/**
 * What a manager pays to buy a listing outright, before haggling.
 *
 * The asking price, unless an offer of one's own already stands — then it is
 * that offer, because the question the market page answers changes once you
 * have bid: not "what would this cost" but "what did I say I would pay".
 */
export function offerBaseline(listing: MarketListing): number {
  return listing.ownOffer ?? listing.price
}

export interface CompetitionPlayerSummary {
  id: string
  lastName: string
  teamId: string
  position: PositionKey
  points: number
  minutesPlayed: number
  goals: number
  assists: number
  isInjured: boolean
  image?: string
}

export interface TableRow {
  teamId: string
  teamName: string
  teamImage?: string
  placement: number
  previousPlacement?: number
  points: number
  matchesPlayed: number
  goalDifference: number
  kickbasePoints: number
}

/* -------------------------------------------------------------------------- */
/* Player detail                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Availability, spelled out. Keyed by the wire's `st` — see
 * {@link PLAYER_AVAILABILITY} for how each was established.
 *
 * `stxt` on the payload carries the *reason* in German and is always present
 * for a player who is not fit, so these labels are the headline and the text
 * is the detail beneath it. An unrecognised code falls back to a neutral
 * "Nicht einsatzbereit" rather than inventing a category.
 */
export const AVAILABILITY_LABEL: Record<number, string> = {
  [PLAYER_AVAILABILITY.FIT]: 'Fit',
  [PLAYER_AVAILABILITY.INJURED]: 'Verletzt',
  [PLAYER_AVAILABILITY.DOUBTFUL]: 'Angeschlagen',
  [PLAYER_AVAILABILITY.BUILDING_UP]: 'Aufbautraining',
  [PLAYER_AVAILABILITY.SUSPENDED]: 'Gesperrt',
}

export function availabilityLabel(status: number): string {
  return AVAILABILITY_LABEL[status] ?? 'Nicht einsatzbereit'
}

/** One of the club's fixtures around the current matchday. */
export interface PlayerFixture {
  day: number
  /** Kick-off, ISO 8601. */
  kickoff: string
  isHome: boolean
  opponentId: string
  opponentImage?: string
  /** The API reports the match played to the end. */
  isFinished: boolean
  /** Only meaningful once `isFinished` — both read `0` beforehand. */
  goalsFor: number
  goalsAgainst: number
  /** True on the competition's current matchday. */
  isCurrent: boolean
}

/** A player's full profile. */
export interface PlayerDetail {
  id: string
  firstName?: string
  lastName: string
  /** Both names, or just the last one when the API has no first name. */
  fullName: string
  shirtNumber?: number
  teamId: string
  teamName?: string
  teamImage?: string
  position: PositionKey
  image?: string
  /** 0 means available; see {@link availabilityLabel}. */
  status: number
  /** Why they are unavailable, in German. Absent for a fit player. */
  statusText?: string
  startProbability?: StartProbability
  /** Who assessed {@link startProbability} — "Ligainsider" in practice. */
  probabilitySource?: string
  /** That source's logo, CDN-relative. */
  probabilitySourceLogo?: string
  /** When that assessment was last revised, ISO 8601. */
  probabilityUpdatedAt?: string
  /**
   * The **whole team's** projected starting eleven, as one poster image
   * (CDN-relative, 1280×1809).
   *
   * Not a per-player graphic despite living on a player: every player at a
   * club carries the identical hash, and `prob` above is the tier drawn on
   * this poster next to *this* player. It is worth showing at full size and
   * worthless shrunk — see
   * [docs/pages/player-detail.md](../../docs/pages/player-detail.md#the-lineup-poster).
   */
  lineupPoster?: string
  /** Owning manager's user id, or `undefined` when nobody owns them. */
  ownerId?: string

  marketValue: number
  marketValueTrend: MarketValueTrend
  /** Change over the last 24 hours, in €, signed. */
  marketValueChangeDay: number

  totalPoints: number
  averagePoints: number
  /** Minutes played this season, converted from the wire's seconds. */
  minutesPlayed: number
  goals: number
  assists: number
  yellowCards: number
  redCards: number
  cleanSheets: number

  /** The club's fixtures around the current matchday, ascending. */
  fixtures: PlayerFixture[]
}

/* --- Per-match performance ------------------------------------------------ */

/**
 * The events worth drawing a badge for.
 *
 * Substitutions are deliberately **not** in here: they say where a player was,
 * not what they did, and they are already carried by {@link PlayerMatchRole}.
 * Drawing them as badges too would put an arrow next to every second row.
 */
export type MatchEventKind =
  | 'goal'
  | 'ownGoal'
  | 'assist'
  | 'yellowCard'
  | 'secondYellow'
  | 'redCard'
  | 'penaltySaved'
  | 'cleanSheet'

const EVENT_BY_CODE: Record<number, MatchEventKind> = {
  [MATCH_EVENT.GOAL]: 'goal',
  [MATCH_EVENT.OWN_GOAL]: 'ownGoal',
  [MATCH_EVENT.ASSIST]: 'assist',
  [MATCH_EVENT.YELLOW_CARD]: 'yellowCard',
  [MATCH_EVENT.SECOND_YELLOW]: 'secondYellow',
  [MATCH_EVENT.RED_CARD]: 'redCard',
  [MATCH_EVENT.PENALTY_SAVED]: 'penaltySaved',
  [MATCH_EVENT.CLEAN_SHEET]: 'cleanSheet',
}

/**
 * One wire code, narrowed to a kind — `undefined` for anything not in the
 * table above, which includes the substitution codes and whatever Kickbase
 * adds next.
 *
 * The lookup itself has been module-private since `toEventTallies` was the only
 * caller. The [match timeline](#toTimelineKind) needs the same table plus the
 * substitutions, so it goes through this rather than duplicating the mapping.
 */
export function toMatchEventKind(code: number): MatchEventKind | undefined {
  return EVENT_BY_CODE[code]
}

export const MATCH_EVENT_LABEL: Record<MatchEventKind, string> = {
  goal: 'Tor',
  ownGoal: 'Eigentor',
  assist: 'Vorlage',
  yellowCard: 'Gelbe Karte',
  secondYellow: 'Gelb-Rot',
  redCard: 'Rote Karte',
  penaltySaved: 'Elfmeter gehalten',
  cleanSheet: 'Zu null',
}

/** One kind of event and how often it happened in a single match. */
export interface MatchEventTally {
  kind: MatchEventKind
  count: number
}

/**
 * The wire's repeated event codes, collapsed to one tally per kind.
 *
 * `[3, 3]` — a two-assist match — becomes a single "Vorlage ×2" rather than
 * two identical badges. Order follows {@link MATCH_EVENT_ORDER} so a row of
 * badges reads the same way every time; unknown codes are dropped, because a
 * code Kickbase adds later should not surface as an unlabelled marker.
 */
export function toEventTallies(codes: number[] | undefined): MatchEventTally[] {
  const counts = new Map<MatchEventKind, number>()

  for (const code of codes ?? []) {
    const kind = EVENT_BY_CODE[code]
    if (kind !== undefined) counts.set(kind, (counts.get(kind) ?? 0) + 1)
  }

  return MATCH_EVENT_ORDER.filter((kind) => counts.has(kind)).map((kind) => ({
    kind,
    count: counts.get(kind) ?? 0,
  }))
}

/** Badge order: what a player did, then what was done to them. */
const MATCH_EVENT_ORDER: MatchEventKind[] = [
  'goal',
  'assist',
  'penaltySaved',
  'cleanSheet',
  'ownGoal',
  'yellowCard',
  'secondYellow',
  'redCard',
]

/**
 * Where a player was during one match.
 *
 * Richer than the wire's `st` by one state: a starter who was taken off is
 * `substitutedOff`, which `st` does not distinguish — it stays `STARTED` and
 * only the `SUBSTITUTED_OFF` event in `k` gives it away. That state is the
 * point of the whole column, so it is resolved here rather than left to each
 * caller to spot.
 */
export type PlayerMatchRole =
  | 'started'
  | 'substitutedOff'
  | 'substitutedIn'
  | 'substitutedInAndOff'
  | 'didNotPlay'
  | 'injured'
  | 'upcoming'

export const MATCH_ROLE_LABEL: Record<PlayerMatchRole, string> = {
  started: 'Startelf',
  substitutedOff: 'Ausgewechselt',
  substitutedIn: 'Eingewechselt',
  substitutedInAndOff: 'Ein- & ausgewechselt',
  didNotPlay: 'Nicht im Einsatz',
  injured: 'Verletzt',
  upcoming: 'Ausstehend',
}

/** True for the roles that mean the player was actually on the pitch. */
export function didPlay(role: PlayerMatchRole): boolean {
  return (
    role === 'started' ||
    role === 'substitutedOff' ||
    role === 'substitutedIn' ||
    role === 'substitutedInAndOff'
  )
}

/** How one of the club's matches went, from this player's point of view. */
export type MatchOutcome = 'win' | 'draw' | 'loss'

export interface PlayerMatch {
  matchId: string
  day: number
  /** Kick-off, ISO 8601. */
  kickoff: string
  /** The API reports the match played to the end. */
  isFinished: boolean
  isHome: boolean
  opponentId: string
  opponentImage?: string
  goalsFor?: number
  goalsAgainst?: number
  /** `undefined` until the match has been played. */
  outcome?: MatchOutcome
  role: PlayerMatchRole
  /** `undefined` means the player did not feature — deliberately not `0`. */
  points?: number
  /** Minutes on the pitch. `0` for a non-appearance. */
  minutes: number
  /** Goals, cards and the rest, collapsed to one entry per kind. */
  events: MatchEventTally[]
}

/** One season of a player's career, as the performance tab lists it. */
export interface PlayerSeason {
  /** Season id — unique, and what the picker keys on. */
  id: string
  /** Season label, e.g. `"2026/2027"`. */
  label: string
  /** Competition name, e.g. `"Bundesliga"`. */
  competition: string
  /** Every fixture of the club that season, ascending by matchday. */
  matches: PlayerMatch[]
  /** Matches the player featured in. */
  appearances: number
  /** Points across those appearances. */
  totalPoints: number
  goals: number
  assists: number
}

/**
 * The top of the scale for the bar under a match row.
 *
 * **The player's own best game, or 150, whichever is larger.** A shared scale
 * across all players would flatten most of them into a stub — a defender who
 * tops out at 120 would never fill a bar sized for a striker's 400 — so each
 * player is measured against himself. The 150 floor stops the reverse problem:
 * a player whose season best is 40 would otherwise have that 40 draw a full
 * bar and read as a triumph.
 *
 * Taken across **every season**, not the one on screen, so switching seasons
 * does not silently rescale the bars underneath you.
 */
export function pointsScaleFor(seasons: PlayerSeason[]): number {
  let best = 0
  for (const season of seasons) {
    for (const match of season.matches) {
      if (match.points !== undefined && match.points > best) best = match.points
    }
  }
  return Math.max(150, best)
}

/* --- Market value --------------------------------------------------------- */

/** One day's market value. */
export interface MarketValueDay {
  /** Midnight UTC of that day, as an epoch millisecond count. */
  timestamp: number
  /** ISO date, `YYYY-MM-DD` — a stable React key and axis label source. */
  date: string
  value: number
  /**
   * Change against the previous day, in €.
   *
   * `undefined` on the first day of the series and on any day whose
   * predecessor is one of the `0` placeholders, where a "change" would be the
   * player's whole value appearing out of nowhere.
   */
  change?: number
}

/** The windows the market tab offers, and how densely each one lists days. */
export const MARKET_VALUE_WINDOWS = [
  { days: 30, label: '1M', step: 1 },
  { days: 90, label: '3M', step: 3 },
  { days: 180, label: '6M', step: 5 },
  { days: 365, label: '12M', step: 10 },
] as const

export type MarketValueWindow = (typeof MARKET_VALUE_WINDOWS)[number]

/** A player's market value over the last year, plus what it says about it. */
export interface MarketValueHistory {
  /**
   * Daily values, oldest first, with the leading `mv: 0` placeholders
   * stripped — those are days before the player entered the competition, not
   * a valuation of zero.
   */
  days: MarketValueDay[]
  /** Highest value in the year, and when. `undefined` for an empty series. */
  high?: MarketValueDay
  /** Lowest **real** value — the `0` days do not count. */
  low?: MarketValueDay
  /** Ownership, when somebody owns the player. */
  ownership?: PlayerOwnership
}

/**
 * What owning this player has been worth.
 *
 * `purchasePrice` is a price somebody actually paid only when
 * {@link wasGranted} is false. For a player dealt out at league start
 * Kickbase still books a basis — the market value of that day — and reports
 * it in the same field, so quoting it as "paid" would be wrong.
 */
export interface PlayerOwnership {
  managerId: string
  managerName?: string
  managerImage?: string
  /** In €. See the caveat above. */
  purchasePrice: number
  /** Profit or loss at today's market value, in €. */
  profitLoss: number
  /** Handed out at league start rather than bought. */
  wasGranted: boolean
  /** True when the signed-in user is the owner. */
  isViewer: boolean
  /** When they took the player on, ISO 8601. */
  since?: string
  /**
   * The market value on the day of purchase, looked up in the history.
   *
   * `undefined` when the purchase predates the year the API serves, which is
   * the normal case for a long-held player.
   */
  marketValueAtPurchase?: number
}

/**
 * How much over the market value the owner paid, in €.
 *
 * Positive means they overpaid. `undefined` when the purchase day is outside
 * the year of history, or when the player was granted rather than bought —
 * in both cases there is no pair of numbers to compare.
 */
export function purchasePremium(
  ownership: PlayerOwnership | undefined,
): number | undefined {
  if (ownership === undefined || ownership.wasGranted) return undefined
  if (ownership.marketValueAtPurchase === undefined) return undefined
  return ownership.purchasePrice - ownership.marketValueAtPurchase
}

/**
 * The slice of history a window covers, and the rows to list for it.
 *
 * Two different densities on purpose. The **chart** gets every day in the
 * window, because a line drawn from every tenth point over a year loses the
 * spikes that are the whole reason to look at it. The **list** gets one row
 * per `step` days, because 365 rows is not a list anyone reads.
 *
 * Sampling walks backwards from today, so the most recent day is always a row
 * whichever window is selected — a list that starts at "9 days ago" because
 * the arithmetic happened to land there looks broken.
 */
export function windowSlice(
  history: MarketValueHistory,
  window: MarketValueWindow,
): { chart: MarketValueDay[]; rows: MarketValueDay[] } {
  const chart = history.days.slice(-window.days)

  const rows: MarketValueDay[] = []
  for (let index = chart.length - 1; index >= 0; index -= window.step) {
    const day = chart[index]
    if (day !== undefined) rows.push(day)
  }

  return { chart, rows }
}
