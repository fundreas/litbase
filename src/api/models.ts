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
