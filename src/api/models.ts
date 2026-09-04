/**
 * Readable domain models.
 *
 * The query hooks map the abbreviated wire DTOs from `types.ts` into these, so
 * components only ever see spelled-out names. When you add an endpoint, add its
 * model here and map it in the hook — don't leak raw keys into the UI.
 */

import {
  GAME_PLAY_MODE,
  MARKET_VALUE_TREND,
  MATCH_EVENT,
  PLAYER_AVAILABILITY,
  PLAYER_POSITION,
} from '@/api/types'

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
  now: number = Date.now(),
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
  now: number = Date.now(),
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
  now: number = Date.now(),
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
  position: PositionKey
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
   * Which side of the duel they belong to.
   *
   * Absent when there are no sides to tell apart — the live view of one's own
   * squad, where every row belongs to the same manager.
   */
  managerId?: string
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
 * [docs/pages/duel-detail.md](../../docs/pages/duel-detail.md#unverified-substituted).
 */
export function duelPlayerStatus(
  player: { lineupOrder?: number; fixture?: MatchdayFixture },
  now: number = Date.now(),
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
  price: number
  /** Seconds remaining on the listing. */
  expiresInSeconds: number
  /** Absent for listings from the computer-run market. */
  seller?: { id: string; name: string; image?: string }
  status: number
  offerCount: number
  image?: string
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
