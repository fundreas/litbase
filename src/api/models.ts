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
  fixture: MatchdayFixture,
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
/* Duel detail                                                                */
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
  /** Which side of the duel they belong to. */
  managerId: string
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
  totalPoints: number
  averagePoints: number
  /** 0 means available; anything else is injured / suspended / away. */
  status: number
  /** 1..5, higher means more likely to start. */
  startProbability?: number
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
