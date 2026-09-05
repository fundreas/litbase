# Transfer market

[← API index](README.md)

Listings, bids, and the three rules Kickbase refuses a bid on. Everything here
is league-scoped, and the whole write surface was mapped by probing — an
`OPTIONS` request answers with an `Allow` header, and a wrong verb answers
`405` naming the right one.

| Method | Path | Auth | Used |
| ------ | ---- | ---- | ---- |
| `GET` | [`/v4/leagues/{leagueId}/market`](#get-v4leaguesleagueidmarket) | Bearer | yes |
| `POST` | [`/v4/leagues/{leagueId}/market`](#post-v4leaguesleagueidmarket) | Bearer | no |
| `DELETE` | [`/v4/leagues/{leagueId}/market/{playerId}`](#delete-v4leaguesleagueidmarketplayerid) | Bearer | no |
| `POST` | [`/v4/leagues/{leagueId}/market/{playerId}/offers`](#post-v4leaguesleagueidmarketplayeridoffers) | Bearer | yes |
| `DELETE` | [`/v4/leagues/{leagueId}/market/{playerId}/offers/{offerId}`](#delete-v4leaguesleagueidmarketplayeridoffersofferid) | Bearer | yes |
| `POST` | [`/v4/leagues/{leagueId}/market/{playerId}/sell`](#post-v4leaguesleagueidmarketplayeridsell) | Bearer | yes |

**Two naming conventions, on adjacent endpoints.** Listing a player takes the
abbreviated `{ pi, prc }`; bidding on one takes the spelled-out `{ price }`.
Sending `{ playerId, price }` to the first answers `500 NotFound`; sending
`{ prc }` to the second answers `400 InvalidData`. There is no rule here to
learn — only the two shapes.

---

## `GET /v4/leagues/{leagueId}/market`

Every listing currently on the market, plus the metadata a buying decision
needs.

**Auth** Bearer.

### Path parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `leagueId` | string | League id |

### Response `200`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `it` | array | The listings |
| `nps` | number | Players in the signed-in manager's squad |
| `tv` | number | The manager's team value, in €. **The base of the 33 % ceiling** |
| `mvud` | string | When market values are next recalculated, ISO 8601 — **nightly, 20:00 UTC**. Names only the *following* run |
| `dt` | string | The next matchday's deadline, ISO 8601. Verified against the fixture list: it is the matchday's first kick-off |
| `day` | number | Current matchday |
| `sn` | string | Season, e.g. `"26/27"` |

### `it[]` — one listing

| Field | Type | Description |
| ----- | ---- | ----------- |
| `i` | string | Player id |
| `n` | string | Last name |
| `fn` | string | First name |
| `tid` | string | Club id |
| `pos` | number | Position — see [Codes](codes.md#position-pos) |
| `mv` | number | Market value, in € |
| `mvt` | number | Market-value trend — see [Codes](codes.md#market-value-trend-mvt). **The direction only; no amount** |
| `prc` | number | Asking price, in €. On a computer listing this equals `mv` |
| `exs` | number | **Seconds until the listing expires** — a real countdown, decrementing one per second between polls. **Only computer listings carry it**; a manager's listing has no `exs` at all and stands until they withdraw it or accept an offer |
| `dt` | string | Listed at, ISO 8601 |
| `st` | number | **✗** Listing status |
| `u` | object | **The seller** — `{ i, n, uim, isvf, vft }`. **Absent for computer listings, which is what identifies them.** Nothing in the payload names "Kickbase"; the absence *is* the fact |
| `ofc` | number | Offers standing on the listing — but **only the ones this account may see**, which on a computer listing means its own and nothing else. A listing showing `0` up to expiry was then bought by another manager over the asking price, so `0` means "you have not bid", not "nobody has" |
| `ofs` | array | The offers this account may see — same visibility rule as `ofc`. See below |
| `uop` | number | **This account's own offer**, in € — present only while one stands |
| `uoid` | string | Id of this account's own offer, needed to withdraw it. **Equals the user id** |
| `isn` | boolean | **New to the market today**, i.e. `dt` after the most recent 00:00 UTC. *Not* "listed by a user" — the marker for that is `u` |
| `p` · `ap` | number | Season points and average. Absent for a player yet to appear |
| `pim` | string | Portrait, CDN-relative |
| `prob` | number | Lineup-probability tier — see [Codes](codes.md#lineup-probability-prob) |
| `plpim` | string | The **team's** probable-XI poster, CDN-relative |
| `ts` | string | Last update of the lineup-probability assessment, ISO 8601 |
| `iposl` | boolean | **?** "Is position locked". `false` on every listing observed |

#### `ofs[]` — one offer

| Field | Type | Description |
| ----- | ---- | ----------- |
| `u` | string | Bidding manager's user id |
| `unm` | string | Bidding manager's display name |
| `uoid` | string | Offer id — for one's own offer this is the user id again |
| `uop` | number | Offer price, in € |
| `st` | number | **✗** Offer status. `0` on every offer observed |

### The 24-hour change

**`tfhmvt` is not on this payload** — the market carries `mvt`, the direction,
and no amount. The [Market page](../pages/market.md#the-24-hour-change-costs-a-fan-out)
therefore fans out one [player-detail](players.md) request per listing, about
twenty, cached half an hour under the same key the squad and player pages use.

### Used by

[`useMarket`](../../src/api/hooks/useMarket.ts) → [Market](../pages/market.md).
**The one polled query in the app**, at 30 seconds — a market page is a page you
leave open while a listing runs out.

`exs` is a snapshot of the response, so the model converts it to an **absolute
instant** against the clock at fetch time; seconds-left read back off a cached
response would be as stale as the response.

---

## `POST /v4/leagues/{leagueId}/market`

Put one of your own players up **for auction**, at a price you set. **Unused** —
the app sells straight back to Kickbase instead, via
[`/market/{playerId}/sell`](#post-v4leaguesleagueidmarketplayeridsell).

**Auth** Bearer.

### Request body

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `pi` | string | yes | Player id |
| `prc` | number | yes | Asking price, in € |

```json
{ "pi": "123", "prc": 123123 }
```

**Wire-style names.** `{ playerId, price }` answers `500 NotFound`.

Whether the price is bounded — a floor at some fraction of market value, a
ceiling — has not been probed (**✗**).

---

## `DELETE /v4/leagues/{leagueId}/market/{playerId}`

Withdraw your own listing. **Unused.** No request body.

The spec claims the call is **idempotent**, and that a repeat may answer either
`204` or `404` depending on implementation — which is to say it does not know
(**?**). Not probed.

---

## `POST /v4/leagues/{leagueId}/market/{playerId}/offers`

Bid on a listing.

**Auth** Bearer.

### Path parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `leagueId` | string | League id |
| `playerId` | string | The listed player |

### Request body

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `price` | number | yes | Offer price, in € |

```json
{ "price": 1776380 }
```

**Spelled out**, unlike almost everything else on this API. The abbreviated
`{ prc }` is rejected with `400 InvalidData`.

### Response `200`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `ofi` | string | The new offer's id. **For one's own offer this is the user id** |

Bidding **costs nothing up front**: the budget is debited only when the listing
settles, so an offer placed and withdrawn leaves no trace on the account. That
is what makes it safe to expose as a plain button.

**A re-bid on the same player replaces its predecessor** rather than adding to
it — probed: a bid at the full 33 % ceiling was accepted on a listing that
already held one.

### What Kickbase refuses

Three rules, each with its own error name, **all served as HTTP 500**, and all
probed to the euro on 2026-09-05 against two leagues that disagree on the first
of them:

| Rule | `err` · `errMsg` | Bound |
| ---- | ---------------- | ----- |
| Underpaying, in a league that forbids it | `5080` `UnderpayNotAllowed` | offer ≥ market value |
| Underpaying, where it is allowed | `5060` `NinetyPercentRuleExceeded` | offer ≥ `floor(mv × 0.9)` |
| Borrowing too far | `5050` `ThirtyThreePercentRuleExceeded` | Σ standing offers ≤ budget + `floor(tv × 0.33)` |

Which of the first two applies is
[`upe` on `/leagues/{id}/overview`](leagues.md#upe--the-one-rule-the-market-has-to-know).

The rounding is not academic: on a player worth 1 973 756 the API took
1 776 380 and refused 1 776 379. The ceiling is exact too: with a budget of
150 000 000 and a team worth 99 771 034 the ceiling was 182 924 441
= `b + floor(tv × 0.33)`; at 180 000 000 committed elsewhere, a second bid of
2 924 442 was refused and 2 924 441 was taken.

**The 33 % ceiling counts every standing bid at once**, which is why the client
checks it up front — nobody tracks that sum in their head. See
[`offerRules.ts`](../../src/lib/offerRules.ts).

Two corners are **not** probed (**✗**), for want of a manager listing at the
time: whether the underpay floor on a *user's* listing is measured against the
market value or the asking price (the client assumes market value, which is
what the rule is named after), and what happens to a standing bid when the
seller accepts a different one.

### Used by

[`usePlaceOffer`](../../src/api/hooks/useMarketOffers.ts) → the bid dialog on
[Market](../pages/market.md#the-bid-dialog).

---

## `DELETE /v4/leagues/{leagueId}/market/{playerId}/offers/{offerId}`

Withdraw your own offer. No request body, empty response.

**Auth** Bearer.

### Path parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `leagueId` | string | League id |
| `playerId` | string | The listed player |
| `offerId` | string | The offer — `uoid` on the listing, which for your own offer is your user id |

This is the app's **only `DELETE`**, so it goes through the axios instance
directly rather than growing a `del()` helper with a single caller.

### Used by

[`useWithdrawOffer`](../../src/api/hooks/useMarketOffers.ts) → the **X** in the
bid dialog.

---

## `POST /v4/leagues/{leagueId}/market/{playerId}/sell`

Sell one of your own players **straight back to Kickbase**, at his market
value. This is what the squad page's [sale calculator](../pages/squad.md#selling)
fires, one request per player, behind a two-second hold.

**Request body: none.** Empty is what the app sends.

| | |
| --- | --- |
| Verb | `POST`, and only `POST`: `OPTIONS` answers `405` with `allow: POST` |
| Body | unknown, sent empty — see below |
| Answers | `200` on success; `500 NotFound` for a player the account does not own |

**The body was never confirmed, deliberately.** A sale cannot be undone, so it
was not fired against a player the account owns. What *was* established without
selling anything: with no body **and** with `{}`, a player the account does not
own answers `500 NotFound` — the ownership check, not a validation error — so
an empty body reaches at least that far. If Kickbase turns out to want a price
in there, this is the first place to look.

Note that the two public v4 collections disagree with each other and with the
server on this path: one documents a `DELETE` named *Accept Kickbase Offer*, the
other a `POST` that *lists* the player on the market. The `Allow` header settles
it.

---

## Selling, the parts the app does not do

| Path | Purpose |
| ---- | ------- |
| `POST /v4/leagues/{leagueId}/market/{playerId}/offers/{offerId}/accept` | Accept a bid on your own listing |
| `POST /v4/leagues/{leagueId}/market/{playerId}/offers/{offerId}/decline` | Decline one |

Neither has been probed. Note that accepting requires knowing the other
manager's `uoid`, which `ofs` only supplies for offers this account may see — on
your own listing, presumably all of them (**?**).
