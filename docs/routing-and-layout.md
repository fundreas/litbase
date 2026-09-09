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
         ├─ (index)                 → events
         ├─ events
         ├─ league      the league itself: rules, members, battles
         ├─ squad     ┐ same component, tab from the segment
         │  ├─ lineup │
         │  └─ live   ┘ only while a matchday is being played, else → squad
         ├─ lineup      the pitch's old URL, kept as a redirect
         ├─ market
         ├─ ranking
         ├─ duels      ?day=N — duel leagues only, else → events
         │  └─ :duelId          both manager ids joined with "-"
         │     └─ ranking       second tab of the same component
         ├─ matchday   ?day=N — every fixture of one matchday
         │  ├─ ranking          the matchday's 25 best players
         │  └─ :matchId         one match; the matchday is looked up from it
         │     └─ lineup        second tab of the same component
         ├─ table       the Bundesliga table's old URL, kept as a redirect
         ├─ managers
         │  └─ :managerId       one manager; four tabs from the segment
         │                      ?day=N — the matchday the lineup tab shows
         ├─ players
         │  └─ :playerId        one player; four tabs from the segment
         └─ teams       the season: every club as a table
            └─ ranking  the season's 25 best players
            └─ :teamId          one club; four tabs from the segment
               ├─ squad
               ├─ matches
               └─ live          only while one of its fixtures runs, else → the club
/*                                  404
```

### Why the league id is in the path

Putting it in context alone would mean a refresh loses it, a bookmark is
useless, and a link shared between managers opens the wrong league. With it in
the path, all three resolve correctly, and the context is *derived* from the
URL rather than the other way round.

## Modals in the URL

The same argument one level down: an open sheet is part of where you are, so it
belongs in the address rather than in a component's `useState`.
[`useHashModal`](../src/lib/useHashModal.ts) keeps it in the **hash** —
`/leagues/1/events#activity:9f2c` — and reads `isOpen` back out of it instead
of remembering it:

```tsx
const sheet = useHashModal('activity')       // #activity or #activity:<id>

sheet.open(activity.id) //  push  → the sheet opens
sheet.isOpen            //  read  → is this modal's layer in the hash
sheet.id                //  read  → what it was opened for, decoded
sheet.close()           //  pop   → back to the URL it was opened from
<Dialog open={sheet.isOpen} onOpenChange={sheet.setOpen} />
```

Three things follow that a boolean cannot give:

- a **refresh** — or a link sent to someone else — reopens the sheet the reader
  was in, however deep;
- the **back gesture** dismisses what is on top of the page instead of leaving
  the page, which is what it means everywhere else on a phone;
- and the thing being looked at is **named**, so "the transfer I was just
  reading" has an address.

The page does not remount on a hash change, so scroll position, the tab in view
and the query cache all survive in both directions.

**The hash is a stack.** `#fullscreen/player:4711` is the full-screen pitch
with a player's breakdown on top of it — the one case where a sheet opens over
another one. Each layer is `key` or `key:id`, outermost first; opening pushes a
layer and closing drops it *and anything above it*. Where the hook pushed the
entry the app is on, closing goes **back** rather than replacing, so a back
press after closing does not spend itself repainting the same screen. Where it
did not — a refresh, a shared link — the hash is dropped in place instead.

**A dismissed sheet does not come back on a forward press.** Going back does
not delete the entry the modal was open in — it is still sitting ahead of the
reader, and forward (or the forward swipe on iOS) would reopen what they just
dismissed. The History API cannot drop it: only a `pushState` truncates what is
ahead, and pushing puts a second identical entry under the reader, which would
spend their next *back* press repainting the screen they are already looking
at. Back is used constantly on a phone and forward hardly at all, so the entry
is marked **spent** instead: a forward press onto it opens nothing — the modal
is declined during render, so no frame of it is ever painted — and the layer
comes out of the URL in place, so the address matches the screen and a refresh
there cannot bring the sheet back either. It is short-lived in any case; any
ordinary navigation truncates the stack ahead and throws the entry away.

A link *inside* a hash modal needs no `onClose`: it changes the URL, the hash
goes with it, and the modal closes by construction. Those links carry `replace`
so the destination swallows the modal's entry — otherwise the way back out of a
player's page leads through the sheet it was opened from. A link that *pushes*
leaves the sheet's entry behind rather than ahead, and going back to it does
find the sheet open again — the entry was never dismissed.

| Hash | Where |
| ---- | ----- |
| `#activity:<id>` | [Events](pages/events.md) — the transfer, achievement and matchday sheets |
| `#match:<matchId>` | [Player](pages/player-detail.md) — a match's points breakdown |
| `#player:<playerId>` | The breakdown behind a portrait on the [squad's live](pages/squad.md#live-tab), [duel](pages/duels.md) and [match](pages/match-detail.md) pitches |
| `#fullscreen` | The duel and match pitches, full screen |
| `#poster` | The projected eleven, on a [player](pages/player-detail.md) and on a [club](pages/team.md) |
| `#legend`, `#formations` | The [squad](pages/squad.md)'s symbol legend and formation reference |
| `#offer:<playerId>` | [Transfermarkt](pages/market.md) — the bid dialog |

The [manager page](pages/manager-detail.md)'s lineup tab reuses three of these
unchanged — `#fullscreen`, `#player:<id>` and the stack of the two — because it
draws the same pitch as a duel does with one eleven on it.

**Two kinds of modal are deliberately left on `useState`**, and both fail the
one test that matters — whatever the modal shows has to be recoverable from the
URL, because a refresh will reopen it with nothing but an id in hand:

- the **confirmations** — a sale, a swap, taking a player off the pitch,
  joining a league — are asked about a selection that a refresh throws away,
  and re-asking a question about a selection nobody can see is worse than not
  restoring it;
- the **pickers** — matchday, season, and the nav drawer — exist to change
  where you are, and their way out is a choice rather than a dismissal. Their
  selection navigates, and a close racing that navigation would undo it.

## Landing without a league

Three components cooperate so the user never has to choose a league when there
is an obvious answer.

**[`HomeRedirect`](../src/routes/HomeRedirect.tsx)** handles `/`. It reads the
remembered league id from `localStorage` synchronously — no query, so no
loading state — and redirects to it, or falls through to `/leagues`.

**[`LeagueGate`](../src/pages/LeagueGate.tsx)** handles `/leagues`. It
resolves rather than asks: fetch the league list, then `<Navigate>` to the
first league's events page. It only renders a screen for the three cases where
there is nowhere to send the user — loading, error, or an account in no
league. See [League gate](pages/league-gate.md).

**[`LeagueProvider`](../src/league/LeagueProvider.tsx)** validates
`:leagueId` against the fetched memberships. An id that is not in the list
(left the league, typo, stale bookmark) redirects to `/leagues`.

These three cannot loop. The worst case is a stale remembered id:

```
/  →  /leagues/999/events  →  /leagues  →  /leagues/4127831/events
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
   `events` when the sub-path cannot be determined.

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
│ ⬛ Liga     › │                                        │
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
the page links and *Liga beitreten*. The **league card is a link** — it opens
[Liga](pages/league.md), the page about the league itself — and it used to
print the manager's budget under the name. That figure is gone: it is the
*manager's* money shown where the **league** is named, it is already on
[Transfermarkt](pages/market.md) where it is spent, and it made the league's
identity read as an account balance. The card is that page's only entry point,
which is why the page has no entry in `navigation.ts`. It is rendered twice — inside
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
{ to: 'events',    label: 'Aktivitäten', icon: … }
{ to: 'squad',     label: 'Mannschaft',   icon: …, alsoMatches: ['players', 'lineup'] }
{ to: 'market',    label: 'Transfermarkt', icon: … }
{ to: 'ranking',   label: 'Rangliste',    icon: … }
{ to: 'duels',     label: 'Duelle',       icon: …, requiresDuelMode: true }
{ to: 'matchday',  label: 'Spieltag',     icon: … }
```

**Duelle is conditional.** Only leagues played as duels have that page, and
nothing in the URL says whether this is one — it is read off the standings
(`hhpl`, see [Ranking](pages/ranking.md#duel-mode)). So `NavContent` calls
`useRanking` and filters entries carrying `requiresDuelMode`. That makes the
navigation a consumer of a query, which it otherwise would not be; the cost is
one small request, already shared with the events page and the ranking page. The
entry is **hidden until the query resolves** rather than shown and withdrawn,
which would flash an entry a normal league never has.

Its **route is registered unconditionally** — the route table is built once, at
module load, long before any league is known. [Duels](pages/duels.md) instead
redirects to the events page when the league does not play duels, so a typed or
bookmarked URL is a dead end exactly where the drawer entry is missing. This is
the pattern to copy for any future league-dependent page.

**Only built pages are listed.** `players` (*Alle Spieler*) is still a
[`PagePlaceholder`](../src/components/PagePlaceholder.tsx) stub, and offering it
in the drawer promises a screen that is not there. Its **route is untouched** —
a direct URL still opens the stub — so it comes back by adding its entry here
once the page exists. `table` (*Bundesliga-Tabelle*) was the other stub; it is
now the table view of the [Saison](pages/season.md) page, and `/table`
redirects onto it.

**Detail routes keep their page lit.** `isNavItemActive()` matches a nav item's
segment exactly *or* as a path prefix, so `/duels/3212306-2857817` and its
`/ranking` tab all keep **Duelle** highlighted. A drawer that goes blank as
soon as you tap into a row reads as having left the app. The rule is general,
so any future detail route inherits it without a per-item flag.

**Mannschaft** is the only entry for the *squad* page, even though it has three
routes: the tabs on that page are the natural way between the squad list, the
lineup and the [live view](pages/squad.md#live-tab), and a second drawer entry
for a sibling tab is noise. (It is the manager's own team; the *club* pages at
`/teams/:teamId` are a different thing, listed under **Teams** — see below.)
It therefore
resolves the active item with `isNavItemActive()` rather than `NavLink`'s own
matching. That helper also prefix-matches, so a page's detail routes keep its
entry lit: `/squad/lineup` and `/players/:playerId` both leave **Mannschaft**
highlighted, rather than the drawer going dark the moment you tap into a row.

**The [manager page](pages/manager-detail.md) has no entry either**, and its
list is *Rangliste* — so that entry carries `alsoMatches: ['managers']`. Unlike
the club page below, the prefix rule could not do this on its own: the page
lives at `/managers/:managerId`, beside `/ranking` rather than under it. Giving
it a parent route was the alternative and it would have meant
`/ranking/managers/:id`, which reads as a *view of the standings* rather than as
a manager, and would have put a list segment in the middle of every link to one.
So this is the one detail page that names its list explicitly.

**The [club page](pages/team.md) has no entry of its own**, and never will: a
drawer entry needs a single subject — *your* squad, *the* market — and a club
page has eighteen of them. It is a detail page like a player's, and one way in
is still the thing that names a club on the screen you are already on: the crest
in the [player header](pages/player-detail.md) and either crest on a
[match](pages/match-detail.md)'s scoreline.

It does now **light an entry**, though, because it has a list above it.
[Saison](pages/season.md) is registered as `/teams` with the club page at
`/teams/:teamId` **beneath** it rather than beside it, so the prefix rule above
keeps **Saison** highlighted for the club page and all four of its tabs —
however the reader got there. That was the one case the rule did not cover, and
the fix was giving the detail page a parent rather than giving it a flag.

There is **no global bottom tab bar**: it duplicated the drawer, ate a row of
screen height on exactly the small screens where the pitch needs it, and forced
a second, coarser notion of which entry was active (`/lineup` had no bar entry
of its own, so **Mannschaft** had to stand in for it). What the bottom *does*
carry, wherever a page docks a bar of its own, is a single thin tab of three
dots — the pages behind one thumb, described in [The dots
tab](#the-dots-tab) below.

Several pages dock a bar **of their own**, which is a different thing:
[`BottomTabBar`](../src/components/ui/BottomTabBar.tsx) switches between views
of the page you are already on — Kader ⇄ Aufstellung ⇄ Live, the player page's
four tabs, the match page's three, the [team page](pages/team.md)'s four, and
the [market](pages/market.md#the-bar-and-which-tabs-it-has)'s Markt ⇄ Manager ⇄
Gebote — rather than between pages, and exists only while that page is open. Two of those bars have a **conditional last tab**, appearing only while
something is being played: the squad page's *Live* while a matchday runs, and
the team page's while that club's own fixture does. Both are **appended**
rather than inserted, so the permanent tabs never move under a thumb that had
learned where they are.

The market's bar is conditional as a **whole**, and so is each of its two
last tabs: *Manager* appears while the league is selling something, *Gebote*
while a listing of your own is up, and the bar itself only once two tabs are
inhabited — a one-tab bar spends a row of screen height offering no choice, and
a tab that opens an empty view is a question with one answer. They are
**inserted in a fixed order** rather than appended, the market's own: the
house, the league, then you. It is also the one bar with a **badge** — a count
on the *Gebote* icon of the bids standing on your listings, which is the only
thing on that page that arrives while nobody is looking at it. A badge is drawn
only above zero, and *Manager* has none: a new listing there is news about the
league, not something waiting for an answer.

The bar is `fixed`, not `sticky` — it was reported scrolling out of view, and
sticky is only ever as reliable as the height chain above it. So it pins to the
viewport and starts where the sidebar ends (`lg:left-64`) rather than lying
across it, and it reserves its own footprint in the flow so the last row of a
list can be scrolled clear of it.

Pages can claim the leftover viewport height: `main` is a flex column, so a
page root with `flex-1` fills it. The [lineup](pages/squad.md#lineup-tab) uses
this, and gained a row of height when the bar went.

### The dots tab

Reaching another page on a phone was a stretch to the **top left** — the far
corner from a right thumb — followed by a pick from a drawer covering the
screen. Two deliberate moves for the app's most frequent act, the first of them
across the whole display, while the thumb sits parked on the bottom bar.

So every `BottomTabBar` ends with one tab that is **not** a view of the page:
[`NavMoreTab`](../src/components/layout/NavMoreTab.tsx), three vertical dots,
`w-8` against the tabs' `flex-1` and fenced off by a left border. It is added
by the bar itself rather than passed in by each page — "always there" is the
whole point, and a page that had to opt in would be the page where the reach
comes back. It is `lg:hidden`: from `lg` up the sidebar is already on screen.

```
┌──────────────┐
│ Aktivitäten  │
│ Mannschaft   │   ← thumb slides up; the row under it fills, the phone ticks
│ Transfermarkt│
│ Rangliste    │
└──────────────┘
   ▲                lift over a row  → that page opens
┌──┴──┬─────┬───┐
│ Markt│Gebote│ ⋮ │   lift on the dots → the sheet stays open
└──────┴─────┴───┘
```

**The press opens it, not the release.** From `pointerdown` the same unbroken
press can finish the job: slide up, and the row under the thumb fills and the
phone ticks as it is crossed; lift, and that page opens. The rest of the
gesture follows from what a thumb actually does:

| The thumb | What happens |
| --------- | ------------ |
| slides up over the rows | the row under it fills; a short buzz per row crossed |
| lifts over a row | that page opens |
| slides off the sheet | nothing is highlighted — but the sheet **stays**, because sliding out is how a choice is withdrawn |
| lifts outside | the sheet closes, nothing chosen |
| lifts on the dots, never having moved | a plain tap: the sheet is **left open** and its rows are ordinary links, so a second tap navigates |
| taps the dots again | put away — and a *press* from that state is a gesture again, so tapping it open costs nothing |

The last two are one event landing in different places, which is why the
release tests the dots' own rectangle — otherwise a tap would open the sheet on
the way down and close it again on the way up.

Three implementation notes, each of which the gesture does not work without:

- **The press is captured.** `setPointerCapture` on the dots keeps every
  `pointermove` and the `pointerup` coming to them however far away the thumb
  has moved, which is what makes this one press rather than a press that hands
  over to whatever it slides onto. It also means the sheet cannot scroll under
  the thumb mid-drag, since it never sees the touch.
- **The row under the thumb is asked of the document**, not of React: no row
  ever receives a pointer event, so `elementFromPoint` is hit-tested against a
  `data-nav-more-to` attribute that carries each row's path.
- **The dim is a portal on `body`.** The bar carries `backdrop-blur`, and a
  `backdrop-filter` makes its element the containing block for `fixed`
  descendants — an in-place dim would stretch to the bar's own box rather than
  to the window. It sits at `z-40`, and the bar raises itself to `z-50` while
  the sheet is out, so the bar stays lit with the sheet growing out of it. That
  is why the open state lives in `BottomTabBar`: an element cannot raise its
  own parent. Being up there also means any navigation puts the sheet away,
  the back button included — the same during-render pathname comparison the
  shell uses for the drawer.
- **The dim dismisses on the release, not the press.** It already swallows the
  press, so the row or button under a dismissing tap never sees a
  `pointerdown` — but a tap is a press *and* a release, and a dim that
  unmounted in between would leave the release to be hit-tested against
  whatever had become topmost, so a tap meant to close the sheet would open a
  player. Closing on `click` keeps the dim in the DOM for the whole tap: it is
  the tap's own target, the page gets nothing, and nothing is decided until the
  finger comes off — the rule the gesture follows too.

The sheet lists **the pages**, from the same `navigation.ts` with the same
active-entry rules, *Duelle* included only where the league plays them. It
deliberately leaves out the rest of the drawer — the league card, *Liga
beitreten*, *Abmelden*: none of them is what a thumb reaches for mid-game, and
every extra row pushes the top ones out of reach. The drawer stays the complete
surface, and the hamburger stays where it is.

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
| `PlacementChange` | Up/down mark for a table movement; nothing at all when it held |
| `Skeleton`, `SkeletonList` | Loading placeholders |
| `Spinner` | Inline SVG spinner |
| `LoadingState`, `ErrorState`, `EmptyState` | The three shared page states |
| `PageHeading` | Consistent title block — start every page with one |
| `PagePlaceholder` | Scaffold for a page with a query but no UI yet |
