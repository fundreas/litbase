# Market — "Transfermarkt"

[← Back to index](../README.md) · Route `/leagues/:leagueId/market` ·
[`src/pages/MarketPage.tsx`](../../src/pages/MarketPage.tsx)

**Status: stub.** The query is wired and proven; the UI is not built.

## What it does today

The page calls the real hook and renders
[`PagePlaceholder`](../../src/components/PagePlaceholder.tsx), which reports
how many listings came back:

```
  Transfermarkt
  Noch nicht gebaut

           🔨
  Diese Seite wartet auf ihre UI

  12 Einträge geladen — die API-Anbindung steht.

        useMarket(leagueId)
```

That number is the point of the stub: it proves the endpoint, the bearer
token, the mapping and the cache all work before any layout is written.
Loading and error states are already handled by the placeholder.

## Data ready to use

[`useMarket(leagueId)`](../../src/api/hooks/useMarket.ts) →
`/v4/leagues/{leagueId}/market`, mapped to `MarketListing[]`:

| Field | Meaning |
| ----- | ------- |
| `id`, `firstName`, `lastName` | Player identity — the market payload has first names, unlike the squad |
| `teamId`, `position` | Club and position (`'gk' \| 'def' \| 'mid' \| 'fwd'`) |
| `marketValue` | Current market value, € |
| `marketValueTrend` | `'up' \| 'down' \| 'flat'` |
| `price` | Asking price, € — may differ from market value on user listings |
| `expiresInSeconds` | Seconds left on the listing |
| `seller` | `{ id, name, image }`, **`undefined` for computer listings** |
| `status` | 0 = fit, otherwise injured/suspended/away |
| `offerCount` | Offers already placed |
| `image` | Player image, CDN-relative |

`staleTime` is **30 seconds**, the shortest in the app — prices and countdowns
are the most time-sensitive data Kickbase exposes.

## Things to get right when building it

**The countdown is the hard part.** `expiresInSeconds` is a snapshot from
whenever the response arrived, not a live value. Rendering it directly means
it freezes until the next refetch. Options:

- Record `Date.now()` at fetch time and derive remaining seconds on a 1 s
  interval. `duration()` in [`lib/format.ts`](../../src/lib/format.ts) already
  formats a seconds count as `2 Tage` / `3 Std.` / `14 Min.` and returns
  *abgelaufen* at zero.
- Or refetch on an interval and accept coarse granularity.

The first is better; the formatter deliberately drops to minute precision so a
per-second re-render is not needed for most listings.

**Seller presence is the meaningful split.** `seller === undefined` means the
computer-run market; a defined seller means another manager listed the player.
These usually want visually distinct treatment, and `isn` on the wire
(`MarketPlayer.isn`) says the same thing.

**Price versus market value.** Both are present and they differ on user
listings. Showing the delta (asking price over or under market value) is more
useful than showing either alone.

## Not yet possible

Placing a bid needs a **mutation endpoint that has not been probed**. Nothing
in [`endpoints.ts`](../../src/api/endpoints.ts) covers offers, and the app has
no mutations at all yet — `queryClient` has mutation defaults configured
(`retry: false`) but they are unused. Adding buy/sell means:

1. Probing the offer endpoints.
2. Adding them to the endpoint registry.
3. Writing `useMutation` hooks that invalidate `qk.market(leagueId)` and
   `qk.leagueMe(leagueId)` (budget changes) on success.

## Suggested layout

A list of cards, sorted by expiry ascending so the urgent listings lead —
that matches how the Kickbase app presents it and how the data is most
actionable. Filters by position and price band would come next.
