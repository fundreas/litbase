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
│ 👤 │ Kohr          7,77 Mio. €   │ 🏠 │ 9 Std. │
│    │ ABW          ↘ −390 Tsd. €  │ FCB│ 22:48  │
└────┴─────────────────────────────┴────┴────────┘
```

name · position, and the manager who owns him when one does · **one** money
figure and its overnight move · his club's next fixture, home or away · how
long the listing has left, and the clock time that lands on.

**One figure, not three.** It is your own offer if you have made one, else what
a manager is asking, else the market value — which is what a computer listing
charges anyway. Price, market value and offer stacked in one column made the
eye reconcile three numbers of which two were usually identical; the 24-hour
move sits under the survivor as its subtitle, being the one thing about that
figure the figure itself does not say.

**Nobody is named "Kickbase".** A computer listing has no seller on the wire,
and printing the house name in that slot says nothing you could act on — the
absence of a manager *is* the fact. The position takes the line instead, and
shares it when there is a manager to name.

**The list is cut where the clock matters.** Because it is ordered by expiry it
is also a timeline, so two hairlines are drawn into it: the nightly
**market-value recalculation** and the matchday's **first kick-off**. A row's
position against them is the point — a listing settling after the
recalculation is settled against a value nobody knows yet, and one settling
after kick-off is a player who may already have played the matchday you were
buying him for. Both instants come off the market response itself (`mvud` and
`dt`, the latter verified against the fixture list), so neither costs a
request. A milestone already past is dropped rather than drawn at the top,
where it would be a line about nothing.

The recalculation is **drawn every night it happens**, not just the next one:
`mvud` names only the following run, but listings reach two and a half days out
— three recalculations — and a row sitting after the second deserves different
caution than one sitting after the first. The rest follow at a day's spacing,
which is the cadence the field has been observed to keep (20:00 UTC), and stop
at the last listing that has an expiry at all.

**The heading counts what you have promised.** Beside the budget, and only when
at least one bid stands, sits what would be left **if every one of them won**.
Kickbase counts every standing bid against **one** ceiling — budget plus 33 %
of team value — so the figure is three different situations and takes three
colours: accent while the bids fit inside the budget, **amber** once they
borrow past it, which the game allows, and **red** past the ceiling, where the
next bid is refused outright. The last needs no action to reach: the nightly
recalculation moves team value, and the ceiling with it, under bids already
standing.

**Two targets, split at the portrait.** Tapping the picture opens the player's
page — the reference move, the one you make to read a scoring history before
deciding. Tapping anywhere else opens the bid dialog, because bidding is what
the market is *for* and it deserves the large target.

The price shown is the asking price until you have bid, and **your own offer**
once you have — see `offerBaseline` in [`models.ts`](../../src/api/models.ts).
The question changes after you bid: not "what would this cost" but "what did I
say I would pay". A row you have bid on takes the **accent outline** the squad
page uses for a player marked for sale — a label under the price said the same
thing somewhere you had to look for it, and an outline is seen while scanning.

### The bid dialog

[`OfferDialog`](../../src/components/market/OfferDialog.tsx) opens seeded with
that same baseline, so the default action is "buy it at the number on the row".
It names the market value and its 24-hour move; the **asking price only appears
when it differs** from the market value, which on a computer listing it never
does — the same number under two labels invites a hunt for a difference that is
not there.

Six shortcut buttons step the amount by ±1, ±1 000 and ±100 000 — a hundred
thousand is the unit market values move in overnight, a thousand is haggling
range, and one euro exists because a tie goes to the higher bid. They **repeat
while held**, like a keyboard key: 400 ms before the first repeat, then every
60 ms. Reaching a five-figure adjustment a euro per tap is not something to ask
of anyone. The step goes through the functional form of `setAmount`, because
the interval is installed once per press and a captured amount would add the
same step to the same number for as long as the finger stayed down.

Three ways out, and they differ:

| Control | Does |
| ------- | ---- |
| *Abbrechen* | closes the dialog, changes nothing |
| *Bieten* / *Gebot ändern* | `POST`s the amount in the field |
| **X**, at the end of the field | withdraws the offer that already stands |

The X only appears when there is an offer to withdraw. It rides the input's
`trailing` slot rather than joining the two buttons below: it acts on the
amount it sits beside, and it is not one of the dialog's two conclusions.

Bidding costs nothing up front — the budget is debited only when the listing
settles — which is what makes a plain button the right affordance. An amount
**above the budget is not refused**: Kickbase lends against team value, and the
dialog says so instead. What it does refuse is the three things Kickbase
refuses, below.

### What Kickbase refuses

Three rules, each with its own error name, all served as HTTP 500 and all
**probed to the euro on 2026-09-05** against two leagues that disagree on the
first of them. They live in
[`offerRules.ts`](../../src/lib/offerRules.ts), and the same three names are
mapped to German in [`errors.ts`](../../src/api/errors.ts).

| Rule | Refused with | Bound |
| ---- | ------------ | ----- |
| Underpaying, in a league that forbids it | `5080` `UnderpayNotAllowed` | offer ≥ market value |
| Underpaying, where it is allowed | `5060` `NinetyPercentRuleExceeded` | offer ≥ `floor(mv × 0.9)` |
| Borrowing too far | `5050` `ThirtyThreePercentRuleExceeded` | Σ standing offers ≤ budget + `floor(tv × 0.33)` |

**Which of the first two applies is a league setting: `upe` on
`/leagues/{id}/overview`.** It is the only place the rule is exposed —
`/leagues/{id}/settings` holds the league's configuration but is admin-only
(500 `NotFound` for everyone else), and neither `/me` nor the market payload
mentions it. Both leagues probed followed their own flag exactly: with
`upe: false`, 499 999 on a player worth 500 000 was refused; with `upe: true`,
1 776 380 on a player worth 1 973 756 was taken and 1 776 379 was not, which is
`floor(mv × 0.9)` and pins the rounding. The two leagues also differ in `gpm`
(Classic vs. Anfänger), so whether `upe` is a setting an admin can flip or a
consequence of the game mode is **not settled** — it is the field that reports
the truth either way.

**The 33 % ceiling counts every bid at once, not one at a time.** This is the
rule the page cannot leave to the server, because nobody tracks the sum. With a
budget of 150 000 000 and a team worth 99 771 034 the ceiling was
182 924 441 = `b + floor(tv × 0.33)`, exactly: at 180 000 000 committed
elsewhere, a second bid of 2 924 442 was refused and 2 924 441 was taken. A
**re-bid on the same player replaces** its predecessor rather than adding to it
— a bid at the full ceiling was accepted on a listing that already held one.

Two corners are **not** probed, for want of a manager listing at the time:
whether the underpay floor on a user's listing is measured against the market
value or the asking price (the client assumes market value, which is what the
rule is named after), and what happens to a standing bid when the seller
accepts a different one.

### Countdowns

`exs` is a snapshot of the response, so the model converts it to an **absolute
instant** (`expiresAt`) against the clock at fetch time; seconds-left read back
off a cached response would be as stale as the response. The page holds one
interval for the whole list and passes `now` down, so twenty rows cannot drift
apart. Under an hour the countdown takes the accent.

**Hours are the largest unit** — `41 Std.`, never `1 Tag`. The question a
countdown answers is "can I still think about this", and that is arithmetic
against the hours in an evening; rounding 41 hours down to a day throws away
most of what was asked.

**The last three minutes count seconds** (`2:45`, from
`COUNTDOWN_SECONDS_FROM` in [`format.ts`](../../src/lib/format.ts)), and the
page's interval drops from ten seconds to one to keep them honest. That is the
only window where the exact figure changes what you would do — a listing
settles at zero to whatever stands at that instant, and "1 Min." held still for
sixty seconds while the thing being watched quietly ended. The switch happens
thirty seconds *before* the seconds appear, so the first one drawn is right
rather than `2:51` where `3:00` belonged.

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
`/v4/leagues/{leagueId}/market`, mapped to a `Market`: the `listings` below,
plus `marketValueUpdateAt`, `matchdayStartAt` and `day` — the response's own
`mvud`, `dt` and `day`, resolved to epoch millis so they compare directly
against a listing's `expiresAt`. Those are what the milestone rules are drawn
from. `teamValue` (`tv`) rides along too: it is the base of the 33 % ceiling,
and this is the one response the page already fetches that carries it.

The league's underpay setting comes from a second query,
[`useLeagueDetails`](../../src/api/hooks/useLeague.ts) → `/overview`, as
`allowsUnderpay`. It is cached ten minutes and the dashboard has usually filled
it already; until it lands, the dialog enforces no underpay rule at all rather
than guessing at one.

Each listing:

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
`tv` (own team value, **mapped** — the 33 % ceiling is measured against it),
`mvud` (when market values are next recalculated — 20:00 UTC), `dt` (the next
matchday deadline), `day`, `sn` (season).

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

**Listing a player.** `POST /market` and `DELETE /market/{playerId}` are probed
and in [`endpoints.ts`](../../src/api/endpoints.ts), but nothing calls them —
putting a player *up for auction* belongs on the squad page, next to the player
you would be listing, not here.

Selling **back to Kickbase** at market value is built, and lives there too: the
squad's [sale calculator](squad.md#selling) marks players and its dialog fires
`POST /market/{playerId}/sell` per player behind a three-second hold.

**Filters.** Position and price band are the obvious next ones; twenty-odd
rows do not need them yet.

**Offers on your own listings.** `ofs[]` carries the bids made *to* you with
the bidder's name, and accepting one is presumably a verb on the same paths.
Neither was probed, because the test account had nothing listed at the time.
