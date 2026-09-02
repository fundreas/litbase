/**
 * Readable domain models.
 *
 * The query hooks map the abbreviated wire DTOs from `types.ts` into these, so
 * components only ever see spelled-out names. When you add an endpoint, add its
 * model here and map it in the hook — don't leak raw keys into the UI.
 */

import { MARKET_VALUE_TREND, PLAYER_POSITION } from '@/api/types'

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
