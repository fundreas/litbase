import { createBrowserRouter, Navigate, redirect } from 'react-router'

import { RedirectIfAuthenticated, RequireAuth } from '@/auth/RequireAuth'
import { AppShell } from '@/components/layout/AppShell'
import { LeagueProvider } from '@/league/LeagueProvider'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { HomeRedirect } from '@/routes/HomeRedirect'
import {
  DuelDetailPage,
  DuelsPage,
  EventsPage,
  JoinLeaguePage,
  LeagueGate,
  LeaguePage,
  ManagerDetailPage,
  MarketPage,
  MatchDetailPage,
  MatchdayPage,
  PlayerDetailPage,
  PlayersPage,
  RankingPage,
  SeasonPage,
  SquadPage,
  TeamDetailPage,
  WhatIfPage,
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
 *   /leagues/:leagueId/league              the league itself: rules, members,
 *                                          battles
 *   /leagues/:leagueId/squad/lineup        the pitch, under the squad
 *   /leagues/:leagueId/squad/live          the running matchday, while it runs
 *   /leagues/:leagueId/market              the transfer market, to buy from
 *   /leagues/:leagueId/market/managers     what the rest of the league is
 *                                          selling
 *   /leagues/:leagueId/market/offers       your own listings, and the bids on
 *                                          them
 *   /leagues/:leagueId/whatif/:playerId    a purchase, with the squad and the
 *                                          lineup rearranged around it
 *   /leagues/:leagueId/matchday            every fixture of a matchday
 *   /leagues/:leagueId/matchday/ranking    the matchday's 25 best players
 *   /leagues/:leagueId/duels               the matchday's duels
 *   /leagues/:leagueId/duels/ranking       the matchday's manager standings
 *   /leagues/:leagueId/matchday/:matchId   one match, three tabs
 *   /leagues/:leagueId/players/:playerId   one player, four tabs
 *   /leagues/:leagueId/managers/:managerId one manager, four tabs
 *   /leagues/:leagueId/teams               the season: every club, as a table
 *   /leagues/:leagueId/teams/ranking       the season's 25 best players
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
                { index: true, element: <Navigate to="events" replace /> },
                { path: 'events', element: <EventsPage /> },
                // The league itself — its rules, its members and the battles
                // running inside it. Reached by tapping the league card at
                // the top of the drawer and the sidebar, which is the one
                // thing on every screen that names the league; it has no
                // entry in NAV_ITEMS for the same reason a player or a club
                // has none — the way in is the thing that names it.
                { path: 'league', element: <LeaguePage /> },
                // The league's landing page was `/dashboard` until the stat
                // tiles and the standings preview came off it and the event
                // feed became the whole page. Kept as a redirect: it is the
                // URL every bookmark, every shared link and the old
                // league-switcher point at.
                {
                  path: 'dashboard',
                  element: <Navigate to="../events" replace relative="path" />,
                },
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
                // Three routes, one component: the view comes from the
                // segment, as on the squad and season pages. `market/managers`
                // is the rest of the league's listings and `market/offers` the
                // seller's side, both registered unconditionally — whether
                // there is anything in either depends on the market payload,
                // which no route can know. The page renders an empty one with
                // its bar intact rather than bouncing the URL.
                { path: 'market', element: <MarketPage /> },
                { path: 'market/managers', element: <MarketPage /> },
                { path: 'market/offers', element: <MarketPage /> },
                // "What if I bought him?" — the bid, the sales that would fund
                // it and the lineup it would change, on one page. The player
                // is in the path and **required**: the whole page is about one
                // purchase, and there is no scenario without a target.
                {
                  path: 'whatif/:playerId',
                  element: <WhatIfPage />,
                },
                { path: 'ranking', element: <RankingPage /> },
                // The competition's own fixtures, and one match in detail.
                // Three routes for the detail, one component — the tab comes
                // from the segment, as on the squad and duel-detail pages.
                //
                // `:matchId` alone is enough: the matchday is resolved from
                // the season's fixture list, so a link cannot carry a `?day=`
                // that disagrees with the match it names.
                { path: 'matchday', element: <MatchdayPage /> },
                // Declared before `:matchId` for readability only — React
                // Router ranks a static segment above a dynamic one whatever
                // the array order, and match ids are numeric, so `ranking`
                // can never be mistaken for one.
                { path: 'matchday/ranking', element: <MatchdayPage /> },
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
                // page itself redirects to the events page when the league does
                // not play duels, so the URL is a dead end exactly where the
                // drawer entry is missing.
                { path: 'duels', element: <DuelsPage /> },
                // The matchday's standings — the same page, its other view.
                // Declared before `:duelId` for readability only: React Router
                // ranks a static segment above a dynamic one whatever the
                // array order, and a duel id is two user ids joined with `-`,
                // so `ranking` can never be mistaken for one. Same
                // arrangement as `matchday/ranking` above.
                { path: 'duels/ranking', element: <DuelsPage /> },
                // `:duelId` is both manager ids joined with `-`. Two routes, one
                // component — the tab comes from the segment, so each view is
                // linkable and survives a refresh, as on the squad page.
                { path: 'duels/:duelId', element: <DuelDetailPage /> },
                { path: 'duels/:duelId/ranking', element: <DuelDetailPage /> },
                // The competition's clubs as a table, and one club in detail.
                // **Saison** — the table and the season's player ranking, two
                // views of one page as on the matchday and squad pages.
                //
                // The path is still `teams` after the page was renamed,
                // because the club page lives *under* it: moving the parent
                // would have meant either orphaning `/teams/:teamId` or
                // rewriting every crest link in the app for a word in the
                // drawer. The list being the **parent** of the detail route
                // rather than a sibling is also what keeps `isNavItemActive`'s
                // prefix test lighting *Saison* when you tap into a club.
                //
                // `teams/ranking` is registered before `teams/:teamId` for
                // readability only — React Router ranks a static segment above
                // a dynamic one however they are ordered, the same arrangement
                // `matchday/ranking` and `matchday/:matchId` already rely on.
                { path: 'teams', element: <SeasonPage /> },
                { path: 'teams/ranking', element: <SeasonPage /> },
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
                // One manager, four routes, one component — the tab comes
                // from the segment, as everywhere else. Reached by tapping a
                // manager's name or face: a row of either standings, a duel's
                // scoreline, a player's owner, a transfer in the feed. No
                // drawer entry of its own, but `alsoMatches` on *Rangliste*
                // keeps that entry lit, since the standings are the list every
                // manager on the page came out of.
                //
                // `?day=` selects the matchday the Aufstellung tab shows and
                // rides along on all four tab links, exactly as on the duel
                // detail page.
                { path: 'managers/:managerId', element: <ManagerDetailPage /> },
                {
                  path: 'managers/:managerId/squad',
                  element: <ManagerDetailPage />,
                },
                {
                  path: 'managers/:managerId/events',
                  element: <ManagerDetailPage />,
                },
                {
                  path: 'managers/:managerId/details',
                  element: <ManagerDetailPage />,
                },
                { path: 'players', element: <PlayersPage /> },
                // Four routes, one component, as on the squad and duel-detail
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
                {
                  path: 'players/:playerId/transfers',
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
