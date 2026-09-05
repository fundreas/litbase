import { createBrowserRouter, Navigate, redirect } from 'react-router'

import { RedirectIfAuthenticated, RequireAuth } from '@/auth/RequireAuth'
import { AppShell } from '@/components/layout/AppShell'
import { LeagueProvider } from '@/league/LeagueProvider'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { HomeRedirect } from '@/routes/HomeRedirect'
import {
  DashboardPage,
  DuelDetailPage,
  DuelsPage,
  JoinLeaguePage,
  LeagueGate,
  MarketPage,
  MatchDetailPage,
  MatchdayPage,
  PlayerDetailPage,
  PlayersPage,
  RankingPage,
  SquadPage,
  TeamDetailPage,
  TeamsPage,
} from '@/routes/lazyPages'

/**
 * Where the app is mounted, taken from Vite's `base`.
 *
 * `/` for `npm run dev` and for any deploy that serves the app at a domain
 * root. GitHub Pages serves a project site under `/<repo>/`, so the Pages
 * workflow builds with `--base=/litbase/` and every route has to resolve
 * beneath that prefix. The trailing slash `BASE_URL` carries is stripped:
 * react-router does tolerate it, but only via a special case in
 * `stripBasename`, and `/litbase` is what the option actually means.
 */
const basename = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/'

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
 *   /leagues/:leagueId/squad/lineup        the pitch, under the squad
 *   /leagues/:leagueId/squad/live          the running matchday, while it runs
 *   /leagues/:leagueId/matchday            every fixture of a matchday
 *   /leagues/:leagueId/matchday/:matchId   one match, three tabs
 *   /leagues/:leagueId/players/:playerId   one player, three tabs
 *   /leagues/:leagueId/teams               every club, as a table
 *   /leagues/:leagueId/teams/:teamId       one club, four tabs
 *
 * The league id lives in the path, not in context alone, so a refresh, a
 * bookmark or a link shared between managers all resolve to the same view.
 *
 * To add a page: create it under `src/pages`, lazy-export it from
 * `lazyPages.tsx`, add a child route below, and add an entry to
 * `components/layout/navigation.ts`.
 */
export const router = createBrowserRouter(
  [
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
                // Three routes, one component: the active view is derived from
                // the segment, so each is linkable and refresh-safe. The pitch
                // is nested **under** the squad rather than a sibling, which is
                // what it always was conceptually and what keeps the drawer's
                // prefix match lighting "Mannschaft" for free.
                //
                // `squad/live` is registered unconditionally — the table is
                // built once, before any league or matchday is known — and the
                // page redirects to the Kader when no matchday is being
                // played, so the URL is a dead end exactly when its tab is
                // missing. Same pattern as `duels` in a non-duel league.
                { path: 'squad', element: <SquadPage /> },
                { path: 'squad/lineup', element: <SquadPage /> },
                { path: 'squad/live', element: <SquadPage /> },
                // `/lineup` was the pitch's own route until it moved under
                // `/squad`. Kept as a redirect so an old bookmark lands on the
                // page rather than on the 404.
                //
                // A loader rather than `<Navigate to="../squad/lineup">`: the
                // relative form depends on how `..` counts a pathless layout
                // route, which is a subtlety to get wrong silently. Rebuilding
                // the path from `params` says exactly where it goes.
                {
                  path: 'lineup',
                  loader: ({ params }) =>
                    redirect(`/leagues/${params.leagueId ?? ''}/squad/lineup`),
                },
                { path: 'market', element: <MarketPage /> },
                { path: 'ranking', element: <RankingPage /> },
                // The competition's own fixtures, and one match in detail.
                // Three routes for the detail, one component — the tab comes
                // from the segment, as on the squad and duel-detail pages.
                //
                // `:matchId` alone is enough: the matchday is resolved from
                // the season's fixture list, so a link cannot carry a `?day=`
                // that disagrees with the match it names.
                { path: 'matchday', element: <MatchdayPage /> },
                { path: 'matchday/:matchId', element: <MatchDetailPage /> },
                {
                  path: 'matchday/:matchId/lineup',
                  element: <MatchDetailPage />,
                },
                {
                  path: 'matchday/:matchId/ranking',
                  element: <MatchDetailPage />,
                },
                // Duel leagues only. The route is registered unconditionally —
                // the table is built once, before any league is known — and the
                // page itself redirects to the dashboard when the league does
                // not play duels, so the URL is a dead end exactly where the
                // drawer entry is missing.
                { path: 'duels', element: <DuelsPage /> },
                // `:duelId` is both manager ids joined with `-`. Two routes, one
                // component — the tab comes from the segment, so each view is
                // linkable and survives a refresh, as on the squad page.
                { path: 'duels/:duelId', element: <DuelDetailPage /> },
                { path: 'duels/:duelId/ranking', element: <DuelDetailPage /> },
                // The competition's clubs as a table, and one club in detail.
                // The list is the **parent** of the detail route rather than a
                // sibling of it, so `isNavItemActive`'s prefix test keeps
                // *Teams* lit when you tap into a club — and a club page
                // reached from a crest elsewhere now lights an entry at all,
                // which it never did while it had no list above it.
                { path: 'teams', element: <TeamsPage /> },
                // `/table` was the Bundesliga-table stub's own route until the
                // page was built as `/teams` — the same table, finally
                // rendered, plus the Kickbase-points view and a way into each
                // club. Kept as a redirect so an old bookmark lands on the page
                // rather than on the 404, exactly as `/lineup` does above, and
                // rebuilt from `params` for the same reason.
                {
                  path: 'table',
                  loader: ({ params }) =>
                    redirect(`/leagues/${params.leagueId ?? ''}/teams`),
                },
                { path: 'players', element: <PlayersPage /> },
                // Three routes, one component, as on the squad and duel-detail
                // pages: the bottom bar's tab is read out of the segment, so
                // each view is linkable and survives a refresh.
                { path: 'players/:playerId', element: <PlayerDetailPage /> },
                {
                  path: 'players/:playerId/performance',
                  element: <PlayerDetailPage />,
                },
                {
                  path: 'players/:playerId/market',
                  element: <PlayerDetailPage />,
                },
                // One club, four routes, one component — the tab comes from
                // the segment, as everywhere else. Reached by tapping a crest
                // on a player or a match rather than from the drawer: a club
                // is a detail page, and its way in is the thing that names it.
                //
                // `teams/:teamId/live` is registered unconditionally, like
                // `squad/live`: the table is built once, before any matchday
                // is known, and the page redirects to the club's Übersicht
                // when none of its fixtures is running — so the URL is a dead
                // end exactly when its tab is missing.
                { path: 'teams/:teamId', element: <TeamDetailPage /> },
                { path: 'teams/:teamId/squad', element: <TeamDetailPage /> },
                { path: 'teams/:teamId/matches', element: <TeamDetailPage /> },
                { path: 'teams/:teamId/live', element: <TeamDetailPage /> },
              ],
            },
          ],
        },
      ],
    },
    { path: '*', element: <NotFoundPage /> },
  ],
  { basename },
)
