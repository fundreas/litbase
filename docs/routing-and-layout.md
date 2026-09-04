# Routing and layout

[← Back to index](README.md)

## Route table

Defined in [`routes/router.tsx`](../src/routes/router.tsx) using
`createBrowserRouter` — react-router in library mode, no framework layer.

```
/login                              public, redirects away if signed in
/register                           public, redirects away if signed in
│
└─ <RequireAuth>                    everything below needs a session
   ├─ /                             → last used league, else /leagues
   ├─ /leagues                      → first league, else "no leagues"
   ├─ /join                         browse and join leagues
   └─ /leagues/:leagueId            <LeagueProvider>
      └─                            <AppShell>
         ├─ (index)                 → dashboard
         ├─ dashboard
         ├─ squad     ┐ same component, tab from the segment
         ├─ lineup    ┘
         ├─ market
         ├─ ranking
         ├─ duels      ?day=N — duel leagues only, else → dashboard
         │  └─ :duelId          both manager ids joined with "-"
         │     └─ ranking       second tab of the same component
         ├─ table
         └─ players
/*                                  404
```

### Why the league id is in the path

Putting it in context alone would mean a refresh loses it, a bookmark is
useless, and a link shared between managers opens the wrong league. With it in
the path, all three resolve correctly, and the context is *derived* from the
URL rather than the other way round.

## Landing without a league

Three components cooperate so the user never has to choose a league when there
is an obvious answer.

**[`HomeRedirect`](../src/routes/HomeRedirect.tsx)** handles `/`. It reads the
remembered league id from `localStorage` synchronously — no query, so no
loading state — and redirects to it, or falls through to `/leagues`.

**[`LeagueGate`](../src/pages/LeagueGate.tsx)** handles `/leagues`. It
resolves rather than asks: fetch the league list, then `<Navigate>` to the
first league's dashboard. It only renders a screen for the three cases where
there is nowhere to send the user — loading, error, or an account in no
league. See [League gate](pages/league-gate.md).

**[`LeagueProvider`](../src/league/LeagueProvider.tsx)** validates
`:leagueId` against the fetched memberships. An id that is not in the list
(left the league, typo, stale bookmark) redirects to `/leagues`.

These three cannot loop. The worst case is a stale remembered id:

```
/  →  /leagues/999/dashboard  →  /leagues  →  /leagues/4127831/dashboard
      (stale, not in list)        (resolves)   (id taken from the live list)
```

The second hop can only ever target an id that came from the live list, so it
terminates. All redirects use `replace`, so the back button does not walk back
through them.

## Guards

**[`RequireAuth`](../src/auth/RequireAuth.tsx)** renders an `<Outlet />` when a
session exists, otherwise redirects to `/login` carrying
`state.from` so login can return the user to where they were headed. Because
the session hydrates from `localStorage` synchronously during the first render,
there is **no "checking…" state** — a returning user goes straight to the page
they asked for.

**`RedirectIfAuthenticated`** is the inverse, wrapping both `/login` and
`/register` so a signed-in user cannot sit on either.

Both public routes are eagerly imported rather than lazy — they are the app's
entry point, and a spinner before the login form would be worse than the few
kilobytes saved.

## League context

[`LeagueProvider`](../src/league/LeagueProvider.tsx) is a layout route: it
resolves the league, then renders `<Outlet />`. Consumers use
[`useActiveLeague()`](../src/league/useActiveLeague.ts), which throws outside a
league route rather than returning `undefined` — a bug surfaces immediately
instead of rendering blank fields.

```ts
const { league, leagueId, competitionId, leagues, switchLeague } =
  useActiveLeague()
```

`switchLeague(id)`:

1. Remembers the new id for the next visit.
2. Drops the departing league's cache (`removeQueries` on
   `['league', oldId]`).
3. Navigates to **the equivalent page** in the new league —
   `/leagues/A/market` becomes `/leagues/B/market`, falling back to
   `dashboard` when the sub-path cannot be determined.

The provider also writes the active league id to storage on every mount, which
is what `HomeRedirect` reads.

## App shell

[`AppShell`](../src/components/layout/AppShell.tsx) is the chrome every league
page renders inside. It owns spacing, safe areas and scroll behaviour so pages
only handle their own content.

Phone and tablet — navigation is behind the hamburger:

```
┌─────────────────────────────────────┐
│ ☰   MADMASSCREM Sunday Leauge   (A) │  Header — sticky, backdrop blur
├─────────────────────────────────────┤
│                                     │
│           <Outlet />                │  max-w-3xl, px-3, pb-safe
│    (RouteErrorBoundary + Suspense)  │
│                                     │
└─────────────────────────────────────┘
```

From **`lg` (64rem)** up the drawer becomes a permanent column and the
hamburger goes away. The header keeps spanning the full width above both:

```
┌───────────────────────────────────────────────────────┐
│     MADMASSCREM Sunday Leauge                     (A) │  full-width header
├──────────────┬────────────────────────────────────────┤
│ ⬛ Liga       │                                        │
│  Budget …    │                                        │
│              │            <Outlet />                  │
│ Übersicht    │      max-w-3xl, centred in the rest    │
│ Mannschaft   │                                        │
│ Rangliste    │                                        │
│ ─────────    │                                        │
│ Liga beitr.  │                                        │
│              │                                        │
│ Abmelden     │  sticky, h = 100dvh − header           │
└──────────────┴────────────────────────────────────────┘
```

### Two surfaces, one at a time

[`NavContent`](../src/components/layout/NavContent.tsx) holds the league card,
the page links and *Liga beitreten*. It is rendered twice — inside
[`NavDrawer`](../src/components/layout/NavDrawer.tsx) below `lg` and inside
[`NavSidebar`](../src/components/layout/NavSidebar.tsx) from `lg` up — so there
is one list of pages, not two that can drift.

**The switch is CSS, not JavaScript.** The sidebar is `hidden lg:flex` and the
hamburger is `lg:hidden`, so there is no flash on first paint and no layout
that depends on a resize handler having fired. JavaScript knows the breakpoint
in exactly one place, and only to **close an already-open drawer** when the
window grows past it (rotating a tablet) — otherwise the drawer would sit on
top of the sidebar that just appeared, with the hamburger gone. The
`matchMedia` query in `AppShell` therefore has to stay in step with those `lg:`
classes.

Three behaviours:

- **Navigation closes the drawer**, including via the browser back button.
  This is done by comparing the current pathname against a stored one *during
  render* rather than in an effect, so the drawer never paints for a frame on
  top of the new page.
- **Growing past `lg` closes it too**, per above.
- **Each page starts at the top**, via a `scrollTo` effect keyed on pathname.

## Header

[`Header`](../src/components/layout/Header.tsx) — sticky, translucent with a
backdrop blur, padded for notches with `pt-safe`. It spans the **full window
width** at every size and sits above both navigation surfaces, so the sidebar
starts underneath it rather than beside it.

Two custom properties in [`index.css`](../src/index.css) keep the offsets in
one place: `--header-h` is the bar itself, and `--header-total` adds the notch
padding above it — which is what anything sticking *below* the header needs,
the sidebar included.

Three slots:

| Position | Component |
| -------- | --------- |
| Left | Hamburger button, opens the nav drawer — **`lg:hidden`** |
| Centre | [`LeagueSwitcher`](../src/components/layout/LeagueSwitcher.tsx) |
| Right | [`UserMenu`](../src/components/layout/UserMenu.tsx) |

The bar's contents are **not** capped to the content column's `max-w-3xl` any
more. With a sidebar down the left of a wide window, a centred bar left the
avatar floating in the middle of the screen instead of in its corner.

**`LeagueSwitcher`** is a Radix dropdown listing every league with its
placement and budget, a check mark on the active one. With only one league it
degrades to plain text — a dropdown with a single option is noise. This is
the app's only league switcher.

**`UserMenu`** is the avatar dropdown: name and email, *Neu laden*, and
*Abmelden*, plus a footnote showing when the session expires and whether it
renews automatically. It deliberately has **no** "switch league" entry —
`/leagues` forwards straight into a league, so such an item would bounce right
back.

## Navigation

Both surfaces read one config,
[`navigation.ts`](../src/components/layout/navigation.ts):

```ts
{ to: 'dashboard', label: 'Übersicht', icon: … }
{ to: 'squad',     label: 'Mannschaft', icon: …, alsoMatches: ['lineup'] }
{ to: 'ranking',   label: 'Rangliste', icon: … }
{ to: 'duels',     label: 'Duelle',    icon: …, requiresDuelMode: true }
```

**Duelle is conditional.** Only leagues played as duels have that page, and
nothing in the URL says whether this is one — it is read off the standings
(`hhpl`, see [Ranking](pages/ranking.md#duel-mode)). So `NavContent` calls
`useRanking` and filters entries carrying `requiresDuelMode`. That makes the
navigation a consumer of a query, which it otherwise would not be; the cost is
one small request, already shared with the dashboard and the ranking page. The
entry is **hidden until the query resolves** rather than shown and withdrawn,
which would flash an entry a normal league never has.

Its **route is registered unconditionally** — the route table is built once, at
module load, long before any league is known. [Duels](pages/duels.md) instead
redirects to the dashboard when the league does not play duels, so a typed or
bookmarked URL is a dead end exactly where the drawer entry is missing. This is
the pattern to copy for any future league-dependent page.

**Only built pages are listed.** `market` (*Transfermarkt*), `table`
(*Bundesliga-Tabelle*) and `players` (*Alle Spieler*) are still
[`PagePlaceholder`](../src/components/PagePlaceholder.tsx) stubs, and offering
them in the drawer promises a screen that is not there. Their **routes are
untouched** — a direct URL still opens the stub — so each one comes back by
adding its entry here once the page exists.

**Detail routes keep their page lit.** `isNavItemActive()` matches a nav item's
segment exactly *or* as a path prefix, so `/duels/3212306-2857817` and its
`/ranking` tab all keep **Duelle** highlighted. A drawer that goes blank as
soon as you tap into a row reads as having left the app. The rule is general,
so any future detail route inherits it without a per-item flag.

**Mannschaft** is the only entry for the team page, even though it has two
routes: the tabs on that page are the natural way between the squad list and
the lineup, and a second drawer entry for a sibling tab is noise. It therefore
resolves the active item with `isNavItemActive()` rather than `NavLink`'s own
matching. That helper also prefix-matches, so a page's detail routes keep its
entry lit: `/squad/lineup` and `/players/:playerId` both leave **Mannschaft**
highlighted, rather than the drawer going dark the moment you tap into a row.

There is **no global bottom tab bar**: it duplicated the drawer, ate a row of
screen height on exactly the small screens where the pitch needs it, and forced
a second, coarser notion of which entry was active (`/lineup` had no bar entry
of its own, so **Mannschaft** had to stand in for it).

Two pages dock a bar **of their own**, which is a different thing:
[`BottomTabBar`](../src/components/ui/BottomTabBar.tsx) switches between views
of the page you are already on — squad ⇄ lineup, and the player page's three
tabs — rather than between pages, and exists only while that page is open. It
is `sticky`, not `fixed`, so at `lg` and up it stays inside the content column
instead of lying across the sidebar.

Pages can claim the leftover viewport height: `main` is a flex column, so a
page root with `flex-1` fills it. The [lineup](pages/squad.md#lineup-tab) uses
this, and gained a row of height when the bar went.

[`NavDrawer`](../src/components/layout/NavDrawer.tsx) is built on
[`Drawer`](../src/components/ui/Drawer.tsx), which wraps Radix Dialog — so
focus trapping, scroll locking, `Escape` and `aria-modal` all come for free.
Logout is pinned to its footer.

[`NavSidebar`](../src/components/layout/NavSidebar.tsx) is a plain `<aside>`,
16rem wide with a right border, sticky below the header and exactly the
viewport minus the header tall — so a long nav scrolls inside itself rather
than with the page, and logout stays pinned to its foot. No dialog machinery:
it is not a layer over the page, it *is* part of the page, and trapping focus
in permanently visible navigation would be wrong.

Both carry **Liga beitreten** → [`/join`](pages/join-league.md) below a
separator.
That one is declared inline rather than in `navigation.ts`, because every entry
there is built from the `/leagues/:leagueId/...` pattern and `/join` is
deliberately not league-scoped.

## Code splitting

Pages are lazy, declared in
[`routes/lazyPages.tsx`](../src/routes/lazyPages.tsx) — kept in a separate
file because a module that mixes components with plain values (like `router`)
breaks React Fast Refresh.

Two `Suspense` boundaries: one in `AppShell` around the outlet, and one in
[`App.tsx`](../src/App.tsx) around `RouterProvider` for the lazy routes that
render outside the shell (`LeagueGate`).

## Adding a page

1. Create `src/pages/MyPage.tsx`.
2. Lazy-export it from [`lazyPages.tsx`](../src/routes/lazyPages.tsx).
3. Add a child route under `AppShell` in
   [`router.tsx`](../src/routes/router.tsx).
4. Add an entry to [`navigation.ts`](../src/components/layout/navigation.ts) —
   that alone puts it in the drawer.

The page body itself:

```tsx
export function MyPage() {
  const { leagueId } = useActiveLeague()
  const { data, isPending, isError, error, refetch } = useSquad(leagueId)

  if (isPending) return <SkeletonList />
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />

  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="…" subtitle="…" />
      {/* content */}
    </div>
  )
}
```

## UI primitives

[`components/ui/`](../src/components/ui/) — all touch-sized, all theme-token
based.

| Component | Notes |
| --------- | ----- |
| `Button` | Variants `primary` / `secondary` / `ghost` / `danger`; sizes clear 44px |
| `Input` | Labelled, 16px font (no iOS zoom), error and hint slots, trailing slot |
| `Avatar` | Radix Avatar; resolves CDN paths, falls back to initials |
| `Drawer` | Radix Dialog as an off-canvas panel, left or right |
| `DropdownMenu` | Styled Radix dropdown, 44px rows |
| `ConfirmDialog` | Radix Dialog — bottom sheet on phones, centred from `sm` |
| `Tabs` | Styled Radix Tabs with equal-width segments |
| `FilterChip`, `FilterChipRow` | Toggleable filters in a sideways-scrolling row |
| `Card`, `CardHeader`, `StatTile` | Panels and the label-over-value tile |
| `Skeleton`, `SkeletonList` | Loading placeholders |
| `Spinner` | Inline SVG spinner |
| `LoadingState`, `ErrorState`, `EmptyState` | The three shared page states |
| `PageHeading` | Consistent title block — start every page with one |
| `PagePlaceholder` | Scaffold for a page with a query but no UI yet |
