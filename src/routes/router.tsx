import { createBrowserRouter, Navigate } from 'react-router'

import { RedirectIfAuthenticated, RequireAuth } from '@/auth/RequireAuth'
import { AppShell } from '@/components/layout/AppShell'
import { LeagueProvider } from '@/league/LeagueProvider'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { HomeRedirect } from '@/routes/HomeRedirect'
import {
  DashboardPage,
  JoinLeaguePage,
  LeagueGate,
  MarketPage,
  PlayersPage,
  RankingPage,
  SquadPage,
  TablePage,
} from '@/routes/lazyPages'

/**
 * Route table.
 *
 *   /login                       public
 *   /register                    public
 *   /                            redirect to the last used league
 *   /leagues                     resolves to the first league; renders only
 *                                when the account has none
 *   /join                        browse and join leagues
 *   /leagues/:leagueId/<page>    every league-scoped page
 *
 * The league id lives in the path, not in context alone, so a refresh, a
 * bookmark or a link shared between managers all resolve to the same view.
 *
 * To add a page: create it under `src/pages`, lazy-export it from
 * `lazyPages.tsx`, add a child route below, and add an entry to
 * `components/layout/navigation.ts`.
 */
export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <RedirectIfAuthenticated>
        <LoginPage />
      </RedirectIfAuthenticated>
    ),
  },
  {
    path: '/register',
    element: (
      <RedirectIfAuthenticated>
        <RegisterPage />
      </RedirectIfAuthenticated>
    ),
  },
  {
    element: <RequireAuth />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'leagues', element: <LeagueGate /> },
      // Top level, not under /leagues/:leagueId: joining is not scoped to a
      // league, and a user with none has to be able to reach it.
      { path: 'join', element: <JoinLeaguePage /> },
      {
        path: 'leagues/:leagueId',
        element: <LeagueProvider />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <Navigate to="dashboard" replace /> },
              { path: 'dashboard', element: <DashboardPage /> },
              { path: 'squad', element: <SquadPage /> },
              { path: 'market', element: <MarketPage /> },
              { path: 'ranking', element: <RankingPage /> },
              { path: 'table', element: <TablePage /> },
              { path: 'players', element: <PlayersPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
