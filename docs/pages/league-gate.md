# League gate

[← Back to index](../README.md) · Route `/leagues` ·
[`src/pages/LeagueGate.tsx`](../../src/pages/LeagueGate.tsx)

The route reached whenever **no league is in the URL**. It resolves rather
than asks.

## What happens

```
/leagues
   └─ useLeagues()
        ├─ pending          → LoadingState
        ├─ error            → ErrorState + retry (inside signed-in chrome)
        ├─ leagues[0] exists → <Navigate replace> /leagues/{id}/dashboard
        └─ list empty       → "Keine Liga gefunden"
```

So a user with at least one league never sees this screen — they land straight
in their first league. The page only renders for the three cases where there
is nowhere to send them.

## Why there is no league list here

An earlier version showed a pickable list of leagues. Once `/leagues` began
forwarding automatically, that list became unreachable, so it was removed
rather than left as dead code.

**Switching leagues lives in the header**, in
[`LeagueSwitcher`](../../src/components/layout/LeagueSwitcher.tsx) — a Radix
dropdown that already lists every league with its placement and budget. That
is the app's only league switcher.

For the same reason, the avatar menu has no "switch league" entry: it would
navigate to `/leagues`, which would bounce straight back.

## Redirect safety

`LeagueGate` is one of three components that cooperate on landing, and the set
cannot loop — the full argument is in
[Routing](../routing-and-layout.md#landing-without-a-league). The short
version: this page only ever navigates to an id taken from the **live** league
list, so it is always a valid destination.

`<Navigate replace>` is used so the back button does not walk back through the
redirect.

## The empty state

```
  (A)  Hallo Danger                    [Abmelden]
       litbase

            🏆
      Keine Liga gefunden

  Dein Kickbase-Konto ist in keiner Liga.
  Tritt einer bei, um loszulegen.

      [ + Liga beitreten ]
        Erneut prüfen
```

Three deliberate details:

- **Signed-in chrome is kept** — avatar, greeting and a logout button. The
  user is authenticated but has nowhere to go, so without a logout affordance
  this screen would be a dead end.
- **"Liga beitreten" is the primary action**, leading to
  [`/join`](join-league.md). This is the normal first experience after
  [registering](register.md), so the screen offers a way forward rather than
  only an explanation.
- **"Erneut prüfen" refetches** rather than reloading the document, for when
  the league was joined on another device.

The error state reuses the same chrome, swapping the empty state for
`ErrorState` with its retry button.

## Data

[`useLeagues()`](../../src/api/hooks/useLeagues.ts) → `/v4/leagues/selection`,
mapped to `League[]` (id, name, competitionId, image, budget, teamValue,
placement, unreadCount). `staleTime` is 10 minutes — league membership changes
rarely, and this query also backs the header switcher, so it is worth caching
generously.

## Implementation note

The forwarding decision uses `leagues[0]` rather than a length check:

```ts
const firstLeague = leagues[0]
if (firstLeague !== undefined) return <Navigate … />
```

With `noUncheckedIndexedAccess` enabled, `leagues[0]` is typed
`League | undefined`, so that single check is exactly the branch the page
needs — and TypeScript guarantees `firstLeague.id` is safe inside it.

## Possible extensions

- Prefer the **remembered** league here too, validated against the list, so a
  multi-league user returning via `/leagues` lands where they left off. Today
  that preference is applied only at `/`.
- Kickbase's selection response also carries `anol` / `anopl` (counts of open,
  joinable leagues). A "browse open leagues" affordance could hang off the
  empty state.
