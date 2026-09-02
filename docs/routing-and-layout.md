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

```
┌─────────────────────────────────────┐
│ ☰   MADMASSCREM Sunday Leauge   (A) │  Header — sticky, backdrop blur
├─────────────────────────────────────┤
│                                     │
│           <Outlet />                │  max-w-3xl, px-3, pb-24
│    (RouteErrorBoundary + Suspense)  │
│                                     │
└─────────────────────────────────────┘
```

Two behaviours:

- **Navigation closes the drawer**, including via the browser back button.
  This is done by comparing the current pathname against a stored one *during
  render* rather than in an effect, so the drawer never paints for a frame on
  top of the new page.
- **Each page starts at the top**, via a `scrollTo` effect keyed on pathname.

## Header

[`Header`](../src/components/layout/Header.tsx) — sticky, translucent with a
backdrop blur, padded for notches with `pt-safe`. Height lives in a single
`--header-h` custom property so sticky offsets stay in sync.

Three slots, exactly as specified:

| Position | Component |
| -------- | --------- |
| Left | Hamburger button, opens the nav drawer |
| Centre | [`LeagueSwitcher`](../src/components/layout/LeagueSwitcher.tsx) |
| Right | [`UserMenu`](../src/components/layout/UserMenu.tsx) |

**`LeagueSwitcher`** is a Radix dropdown listing every league with its
placement and budget, a check mark on the active one. With only one league it
degrades to plain text — a dropdown with a single option is noise. This is
the app's only league switcher.

**`UserMenu`** is the avatar dropdown: name and email, *Neu laden*, and
*Abmelden*, plus a footnote showing when the session expires and whether it
renews automatically. It deliberately has **no** "switch league" entry —
`/leagues` forwards straight into a league, so such an item would bounce right
back.

## Navigation drawer

Both read from one config, [`navigation.ts`](../src/components/layout/navigation.ts):

```ts
{ to: 'dashboard', label: 'Übersicht',          icon: …, primary: true  }
{ to: 'squad',     label: 'Mein Team',          icon: …, primary: true,
                   alsoMatchesInBar: ['lineup'] }
{ to: 'lineup',    label: 'Aufstellung',        icon: … }
{ to: 'market',    label: 'Transfermarkt',      icon: …, primary: true  }
{ to: 'ranking',   label: 'Rangliste',          icon: …, primary: true  }
{ to: 'table',     label: 'Bundesliga-Tabelle', icon: … }
{ to: 'players',   label: 'Alle Spieler',       icon: … }
```

**Mein Team** is the only entry for the team page, even though it has two
routes: the tabs on that page are the natural way between the squad list and
the lineup, and a second drawer entry for a sibling tab is noise. It therefore
declares `alsoMatches: ['lineup']`, and `NavDrawer` resolves the active item
with `isNavItemActive()` rather than `NavLink`'s own matching — otherwise the
drawer would highlight nothing while the lineup tab is open.

The drawer is the **only** navigation surface. There is no bottom tab bar: it
duplicated the drawer, ate a row of screen height on exactly the small screens
where the pitch needs it, and forced a second, coarser notion of which entry
was active (`/lineup` had no bar entry of its own, so **Mein Team** had to
stand in for it).

Pages can claim the leftover viewport height: `main` is a flex column, so a
page root with `flex-1` fills it. The [lineup](pages/squad.md#lineup-tab) uses
this, and gained a row of height when the bar went.

[`NavDrawer`](../src/components/layout/NavDrawer.tsx) is built on
[`Drawer`](../src/components/ui/Drawer.tsx), which wraps Radix Dialog — so
focus trapping, scroll locking, `Escape` and `aria-modal` all come for free.
It shows the league name and budget at the top and a logout action pinned to
the bottom.

Below a separator it also carries **Liga beitreten** → [`/join`](pages/join-league.md).
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
