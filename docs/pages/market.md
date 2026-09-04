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
| `expiresInSeconds` | Seconds left on the listing. **Only on computer listings** — see below |
| `seller` | `{ id, name, image }`, **`undefined` for computer listings** |
| `status` | 0 = fit, otherwise injured/suspended/away |
| `offerCount` | Offers **this account can see** — see below |
| `image` | Player image, CDN-relative |

`staleTime` is **30 seconds**, the shortest in the app — prices and countdowns
are the most time-sensitive data Kickbase exposes.

The wire payload carries more than the model maps today
(`MarketPlayer` in [`types.ts`](../../src/api/types.ts)):

| Wire field | Meaning |
| ---------- | ------- |
| `dt` | When the listing went up, ISO 8601 |
| `isn` | **New to the market today** — see the correction below |
| `p`, `ap` | Season points and average; absent for a player yet to appear |
| `prob` | Lineup-probability tier, 1..5 — the same field the squad tabs use |
| `uop`, `uoid` | This account's own standing offer and its id |
| `ofs[]` | The offers this account may see: `{ u, unm, uoid, uop, st }` |
| `iposl` | Position locked. `false` on every listing observed |

and the response has a top-level block beside `it`: `nps` (own squad size),
`tv` (own team value), `mvud` (when market values are next recalculated —
20:00 UTC), `dt` (the next matchday deadline), `day`, `sn` (season).

## When a listing is sold

Two kinds of listing sit in the same array and they settle differently.

**Computer listings** (`seller === undefined`) carry `exs`, and it is a real
countdown — polled once a minute it decrements by exactly 60. So the sale time
is knowable in advance:

```
soldAt = <time the response arrived> + exs seconds
```

Verified end to end on 2026-09-04: *Da Costa*, listed `2026-09-02T05:26:45Z`,
counted down to zero at `13:26:45Z`, was gone from the next poll, and the
league feed recorded the sale at `13:27:00Z` — settlement lands within ~15 s of
expiry. Listing durations are not uniform (12 h to 2½ d were seen in one
league), so `dt + fixed duration` does **not** work; `exs` is the only source.

**Manager listings** (`seller` present) carry **no `exs` at all**. They stand
until the seller withdraws them or accepts an offer, so there is no sale
timestamp to predict — only `dt`, when it went up. The UI has to handle a
missing countdown rather than render `undefined`; the type says `exs: number`
today, which is wrong.

The *actual* sale, with its exact timestamp, is recorded in the league's event
log — `GET /v4/leagues/{leagueId}/activitiesFeed`, newest first, ~67 entries
deep, paged with `?start=&max=`. Type `15` is a completed transfer:

```json
{ "i": "12560937044", "t": 15, "dt": "2026-09-04T13:27:00Z",
  "data": { "pi": "1540", "pn": "Da Costa", "tid": "18",
            "t": 1, "trp": 12000000, "byr": "Marvin" } }
```

`data.t` is the direction — `1` bought off the market (`byr`, no seller), `2`
sold back to it (`slr`, no buyer) — and `trp` is the fee actually paid. Other
types in the feed: `3` a player being listed, `5`/`13` managers joining, `26` a
league milestone, `28` the league's founding. Per player, the same events are
available as
[`playerTransfers`](../../src/api/endpoints.ts) (`transferHistory`).

## Two things the old notes had wrong

**`isn` is not "listed by a user".** It marks a listing that is **new to the
market today**: it is `true` for exactly those whose `dt` falls after the most
recent 00:00 UTC, checked against 43 listings across two leagues. The marker
for a manager's listing is the presence of `u` (`seller`), nothing else. A
fresh listing appears roughly once an hour and the market holds ~21.

**`offerCount` is not "offers already placed".** It counts only the offers this
account is allowed to see, which on a computer listing means its own bid and
nothing else. *Da Costa* above showed `ofc: 0` in every poll up to expiry and
was then bought for 12.0 M against an asking price of 10.6 M — somebody else's
bid, invisible the whole time. Read `0` as "you have not bid", never as
"nobody has".

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
These want visually distinct treatment — and only the first has a countdown to
show at all. (`isn` does *not* say the same thing; see above.)

**Price versus market value.** Both are present and they differ on user
listings. Showing the delta (asking price over or under market value) is more
useful than showing either alone.

## Buying and selling — the endpoints, probed

The whole surface, read off the `Allow` header an `OPTIONS` request returns —
a wrong verb answers 405 and names the right one:

| Path (under `/v4/leagues/{leagueId}`) | Verb | Body | Answers |
| ------------------------------------- | ---- | ---- | ------- |
| `market` | GET | — | the listings |
| `market` | POST | `{ pi, prc }` | `{}` — lists your player |
| `market/{playerId}` | DELETE | — | `{}` — withdraws your listing |
| `market/{playerId}/offers` | POST | `{ price }` | `{ ofi }` — the offer id |
| `market/{playerId}/offers/{offerId}` | DELETE | — | `{}` — withdraws the offer |

Note the **inconsistent body spellings**: listing a player takes the wire-style
`{ pi, prc }` and rejects `{ playerId, price }` with a 500 `NotFound`, while
placing an offer takes the plain `{ price }` and rejects `{ prc }` with a 400
`InvalidData`. The offer id that comes back is just the bidder's user id, and
it reappears as `uoid` on the listing.

Neither a listing nor an offer moves money: budget was unchanged at every step,
and only settlement at expiry debits it.

All five were exercised against the test account on 2026-09-04 (list a player,
bid on a computer listing, withdraw both) and the account was restored — squad,
budget and lineup byte-identical to the capture taken first.

Wiring buy/sell into the app still means adding these to
[`endpoints.ts`](../../src/api/endpoints.ts) and writing the first
`useMutation` hooks in the codebase — `queryClient` has mutation defaults
(`retry: false`) but nothing uses them. They should invalidate
`qk.market(leagueId)` and `qk.leagueMe(leagueId)` (budget) on success.

## Suggested layout

A list of cards, sorted by expiry ascending so the urgent listings lead —
that matches how the Kickbase app presents it and how the data is most
actionable. Filters by position and price band would come next.
