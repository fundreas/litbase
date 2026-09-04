# Market — "Transfermarkt"

[← Back to index](../README.md) · Route `/leagues/:leagueId/market` ·
[`src/pages/MarketPage.tsx`](../../src/pages/MarketPage.tsx)

**Status: implemented.**

## What it does

One list, **soonest to expire first**. That order is the page's whole
argument: a computer listing settles the instant its countdown reaches zero,
to the highest bid standing at that moment and with no second round, so the
listings about to close are the only ones you can still do anything about.
Manager listings have no expiry at all and sort last.

Each row carries what a buying decision actually needs:

```
┌────┬─────────────────────────────┬────┬────────┐
│    │ Kohr                 ABW    │    │ 9 Std. │
│ 👤 │ 🏪 Kickbase   7,77 Mio. €   │ 🏠 │ 22:48  │
│    │            MW 7,77 Mio. €   │ FCB│        │
│    │            ↘ −390 Tsd. €    │    │        │
└────┴─────────────────────────────┴────┴────────┘
```

name and position · who owns him (a manager, or *Kickbase* when nobody does) ·
what he would cost · market value and its overnight move · his club's next
fixture, home or away · how long the listing has left, and the clock time that
lands on.

**Two targets, split at the portrait.** Tapping the picture opens the player's
page — the reference move, the one you make to read a scoring history before
deciding. Tapping anywhere else opens the bid dialog, because bidding is what
the market is *for* and it deserves the large target.

The price shown is the asking price until you have bid, and **your own offer**
once you have — see `offerBaseline` in [`models.ts`](../../src/api/models.ts).
The question changes after you bid: not "what would this cost" but "what did I
say I would pay", and the row turns accent-coloured to say so.

### The bid dialog

[`OfferDialog`](../../src/components/market/OfferDialog.tsx) opens seeded with
that same baseline, so the default action is "buy it at the number on the row".
Six shortcut buttons step the amount by ±1, ±1 000 and ±100 000 — a hundred
thousand is the unit market values move in overnight, a thousand is haggling
range, and one euro exists because a tie goes to the higher bid.

Three ways out, and they differ:

| Control | Does |
| ------- | ---- |
| *Abbrechen* | closes the dialog, changes nothing |
| *Bieten* / *Gebot ändern* | `POST`s the amount in the field |
| **X** beside the title | withdraws the offer that already stands |

The X only appears when there is an offer to withdraw, and sits away from the
two full-width buttons deliberately: it is the destructive one, and it should
not be reachable by the same thumb sweep that dismisses the dialog.

Bidding costs nothing up front — the budget is debited only when the listing
settles — which is what makes a plain button the right affordance. The dialog
still refuses an amount above the budget, because Kickbase would.

### Countdowns

`exs` is a snapshot of the response, so the model converts it to an **absolute
instant** (`expiresAt`) against the clock at fetch time; seconds-left read back
off a cached response would be as stale as the response. The page holds one
interval for the whole list — ten seconds, since `duration()` shows whole
minutes — and passes `now` down, so twenty rows cannot drift apart. Under an
hour the countdown takes the accent.

The market query also **polls every 30 seconds**, the only polled query in the
app: this is a page you leave open while a listing runs out, and nothing else
would take the settled ones off it. React Query pauses the interval while the
tab is in the background.

### The 24-hour change costs a fan-out

`tfhmvt` lives only on the player detail endpoint — the market payload carries
`mvt`, the *direction*, and no amount. So
[`useMarketValueChanges`](../../src/api/hooks/useMarketValueChanges.ts) issues
one request per listing, about twenty, cached half an hour under
`qk.playerDetail`. That is the same cache entry the squad, player and
probability lookups use, so a manager arriving from their own squad pays for
the overlap once.

## The data

[`useMarket(leagueId)`](../../src/api/hooks/useMarket.ts) →
`/v4/leagues/{leagueId}/market`, mapped to `MarketListing[]`:

[`useMarket(leagueId)`](../../src/api/hooks/useMarket.ts) →
`/v4/leagues/{leagueId}/market`, mapped to `MarketListing[]`:

| Field | Meaning |
| ----- | ------- |
| `id`, `firstName`, `lastName` | Player identity — the market payload has first names, unlike the squad |
| `teamId`, `position` | Club and position (`'gk' \| 'def' \| 'mid' \| 'fwd'`) |
| `marketValue` | Current market value, € |
| `marketValueTrend` | `'up' \| 'down' \| 'flat'` |
| `price` | Asking price, € — may differ from market value on user listings |
| `expiresAt` | When the listing settles, epoch ms. **`undefined` on a manager's listing** — see below |
| `listedAt` | When it went up, ISO 8601 |
| `seller` | `{ id, name, image }`, **`undefined` for computer listings** |
| `status` | 0 = fit, otherwise injured/suspended/away |
| `offerCount` | Offers **this account can see** — see below |
| `ownOffer`, `ownOfferId` | This account's standing bid, and the id needed to withdraw it |
| `image` | Player image, CDN-relative |

`staleTime` is **30 seconds** and the query polls at the same rate — prices and
countdowns are the most time-sensitive data Kickbase exposes.

The wire payload carries more still (`MarketPlayer` in
[`types.ts`](../../src/api/types.ts)), unmapped because nothing renders it yet:

| Wire field | Meaning |
| ---------- | ------- |
| `isn` | **New to the market today** — see the correction below |
| `p`, `ap` | Season points and average; absent for a player yet to appear |
| `prob` | Lineup-probability tier, 1..5 — the same field the squad tabs use |
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

The page uses the two offer rows —
[`usePlaceOffer` and `useWithdrawOffer`](../../src/api/hooks/useMarketOffers.ts),
both invalidating `qk.market(leagueId)`. `useWithdrawOffer` is the app's only
`DELETE` and calls the axios instance directly rather than growing a `del()`
helper for one caller.

## Not built yet

**Selling.** `POST /market` and `DELETE /market/{playerId}` are probed and in
[`endpoints.ts`](../../src/api/endpoints.ts), but nothing calls them — listing
a player belongs on the squad page, next to the player you would be listing,
not here.

**Filters.** Position and price band are the obvious next ones; twenty-odd
rows do not need them yet.

**Offers on your own listings.** `ofs[]` carries the bids made *to* you with
the bidder's name, and accepting one is presumably a verb on the same paths.
Neither was probed, because the test account had nothing listed at the time.
