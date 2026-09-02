import { lazy } from 'react'

/**
 * Route-level code splitting. Kept apart from `router.tsx` so that file exports
 * only the route table — a module that mixes components with plain values
 * breaks React Fast Refresh.
 *
 * Each page is a named export, hence the `default:` re-wrap.
 */

export const LeagueGate = lazy(async () => ({
  default: (await import('@/pages/LeagueGate')).LeagueGate,
}))

export const DashboardPage = lazy(async () => ({
  default: (await import('@/pages/DashboardPage')).DashboardPage,
}))

export const SquadPage = lazy(async () => ({
  default: (await import('@/pages/SquadPage')).SquadPage,
}))

export const MarketPage = lazy(async () => ({
  default: (await import('@/pages/MarketPage')).MarketPage,
}))

export const RankingPage = lazy(async () => ({
  default: (await import('@/pages/RankingPage')).RankingPage,
}))

export const TablePage = lazy(async () => ({
  default: (await import('@/pages/TablePage')).TablePage,
}))

export const PlayersPage = lazy(async () => ({
  default: (await import('@/pages/PlayersPage')).PlayersPage,
}))
