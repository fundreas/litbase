# Players

[← API index](README.md)

One player, four endpoints, all league-scoped. Three of the four have an
identical competition-scoped twin under `/v4/competitions/{competitionId}/…`;
the league-scoped spelling is used throughout so the whole detail page caches
under one league key — and because only the league-scoped detail carries `oui`,
the owning manager.

| Method | Path | Auth | Used |
| ------ | ---- | ---- | ---- |
| `GET` | [`/v4/leagues/{leagueId}/players/{playerId}`](#get-v4leaguesleagueidplayersplayerid) | Bearer | yes |
| `GET` | [`/v4/leagues/{leagueId}/players/{playerId}/performance`](#get-v4leaguesleagueidplayersplayeridperformance) | Bearer | yes |
| `GET` | [`/v4/leagues/{leagueId}/players/{playerId}/marketvalue/{timeframe}`](#get-v4leaguesleagueidplayersplayeridmarketvaluetimeframe) | Bearer | yes |
| `GET` | [`/v4/leagues/{leagueId}/players/{playerId}/transferHistory`](#get-v4leaguesleagueidplayersplayeridtransferhistory) | Bearer | yes |

---

## `GET /v4/leagues/{leagueId}/players/{playerId}`

Everything the [player detail page](../pages/player-detail.md) renders on its
first tab — and two things nothing else in the API supplies: **per-matchday
points** and the **lineup-probability tier**.

**Auth** Bearer.

### Path parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `leagueId` | string | League id |
| `playerId` | string | Player id |

### Response `200`

**Zeroed counters are omitted, not sent as `0`.** A player who has not featured
this season carries no `tp`, `ap`, `sec`, `g`, `a`, `y`, `r` or `cs` at all,
while one who has played carries all of them, `0` included. Every counter below
is therefore optional and every consumer defaults it.

#### Identity

| Field | Type | Description |
| ----- | ---- | ----------- |
| `i` | string | Player id |
| `ln` | string | **Last name.** Note this endpoint spells it `ln`, not `n` as everywhere else — a real response has `fn`/`ln` and no `n` at all |
| `fn` | string | First name |
| `shn` | number | Squad number |
| `tid` | string | Club id |
| `tn` | string | Club name, spelled out |
| `tim` | string | Club crest, CDN-relative (an SVG) |
| `pim` | string | Player photo, CDN-relative |
| `pos` | number | Position — see [Codes](codes.md#position-pos) |
| `oui` | string | **Owning manager's user id. `"0"` when nobody owns the player** — it is not omitted, so an emptiness test has to check the string, not presence. **Only on the league-scoped endpoint** |
| `uim` · `ua` | string | **?** The owner's avatar, CDN-relative, under two keys |
| `day` | number | The matchday this response is "current" for |

#### Season totals

| Field | Type | Description |
| ----- | ---- | ----------- |
| `tp` | number | Total points this season |
| `ap` | number | Average points per appearance |
| `sec` | number | **Seconds** played this season — not minutes |
| `g` | number | Goals |
| `a` | number | Assists |
| `y` | number | Yellow cards |
| `r` | number | Red cards — straight reds and second yellows together |
| `cs` | number | Clean sheets |
| `pes` | number | **?** Penalties — but **which side of one is unresolved**: it sits beside `cs` in the goalkeeper group, arguing for "saved", while the name argues for "scored". Every player probed had `0`. Deliberately not rendered |

#### Market value

| Field | Type | Description |
| ----- | ---- | ----------- |
| `mv` | number | Market value, in € |
| `mvt` | number | Market-value trend — see [Codes](codes.md#market-value-trend-mvt) |
| `tfhmvt` | number | **Change over the last 24 hours**, in €, signed. Named for "twenty-four-hour market-value trend", and confirmed arithmetically: it is the difference between the last two daily points of `/marketvalue/365` |
| `cv` | number | **?** A rounded market value — `59.800.000` against an `mv` of `59.866.450`. What Kickbase rounds it *for* is unknown, and it is never the figure to show. Documented only so it is not mistaken for something else |

#### Availability and lineup probability

| Field | Type | Description |
| ----- | ---- | ----------- |
| `st` | number | Availability — see [Codes](codes.md#availability-st-and-the-entries-of-stl) |
| `stl` | number[] | Additional status codes |
| `stxt` | string | Status text in the request's language, e.g. `"Wadenprobleme – verpasst BMG (H)"`. **Always supplied for a player who is not fit**, which is what makes it the safe fallback for an unrecognised `st` |
| `prob` | number | **The per-player lineup-probability tier, 1..5** — see [Codes](codes.md#lineup-probability-prob) |
| `plpim` | string | The **team's** probable-XI poster, CDN-relative. Not a per-player icon |
| `plpt` | string | Who assessed it — `"Ligainsider"` in practice |
| `plpurl` | string | The provider's logo, CDN-relative |
| `ts` | string | Last update of the assessment, ISO 8601. Ligainsider revises it several times before kick-off, so anything caching a tier should keep it briefly |

#### `ph` — points per matchday

The **only** source of a per-player, per-matchday score. There is no bulk
equivalent: `/leagues/{id}/players` and `?ids=` are both 404, which is why
[Duel detail](../pages/duel-detail.md#points-cost-one-request-per-player) fans
out one request per player.

| Field | Type | Description |
| ----- | ---- | ----------- |
| `hp` | boolean | Whether the player featured. `false` means `p` is **absent, not zero** |
| `p` | number | Points scored — only present when `hp` is true |

**Newest first.** `ph[0]` is `day`, the matchday this response is current for,
and the index counts back from there. It is also **dense**: one entry per
matchday from the first up to `day`, so the array is `day` long. A player who
missed a matchday gets `{ hp: false }` rather than being skipped, and so does
one whose club has not kicked off yet — an entry exists for the current
matchday from the moment it becomes current.

> This was documented as oldest-first until 2026-09-05 and is not. See
> [`matchdayEntry`](../../src/api/hooks/useMatchdayPoints.ts) for the
> measurement and the index that follows from it.

#### `mdsum` — fixtures around the current matchday

The club's fixtures either side of the current matchday — three in practice:
the one just played and the next two. Ordered by matchday.

| Field | Type | Description |
| ----- | ---- | ----------- |
| `day` | number | Matchday number |
| `md` | string | Kick-off, ISO 8601 |
| `t1` · `t2` | string | **Home** and **away** club ids |
| `t1g` · `t2g` | number | Goals. `0` before kick-off, so `mdst` is what says whether they count |
| `t1im` · `t2im` | string | Crests, CDN-relative |
| `mdst` | number | Matchday status — `0` not played, `2` finished |
| `cur` | boolean | True on the competition's current matchday |
| `mdln` | string | Display name, e.g. `"2 Match Day"` |

#### Unknown

`stud`, `smc`, `ismc`, `smdc` (numbers), `sl` (boolean), `opl` (array, empty on
every response observed), `dt` (a timestamp that is neither kick-off nor the
probability update) — all **✗**. `iposl` is **?** "is position locked".

### Used by

[`usePlayerDetail`](../../src/api/hooks/usePlayer.ts) →
[Player detail](../pages/player-detail.md), and — because it is the only source
of `tfhmvt`, `prob`, `stxt` and `ph` — by four fan-out hooks:
[`useMarketValueChanges`](../../src/api/hooks/useMarketValueChanges.ts),
[`useStartProbabilities`](../../src/api/hooks/useStartProbabilities.ts),
[`useStatusReasons`](../../src/api/hooks/useStatusReasons.ts) and
[`useMatchdayPoints`](../../src/api/hooks/useMatchdayPoints.ts). All four share
one cache entry per player, so a manager arriving from their own squad pays for
the overlap once.

---

## `GET /v4/leagues/{leagueId}/players/{playerId}/performance`

Every season the player has appeared in, each with **one entry per fixture of
their club's season** — played or not. The only source of per-match detail:
minutes, the events that happened, and whether they started, came on or sat
out.

Identical byte-for-byte to the competition-scoped
`/v4/competitions/{competitionId}/players/{playerId}/performance`.

**Auth** Bearer.

### Response `200`

`it[]` — one season, **oldest first**:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `sid` | string | Season id, e.g. `"42"`. Unique, and what a picker should key on |
| `ti` | string | Season label, e.g. `"2026/2027"` |
| `n` | string | Competition name, e.g. `"Bundesliga"` |
| `ph` | array | Every fixture of the player's club that season, ascending by matchday |

**The club is the club they were at that season**, so a player who moved has
another side's fixtures in the earlier entries.

#### `ph[]` — one fixture

| Field | Type | Description |
| ----- | ---- | ----------- |
| `mi` | string | Match id |
| `day` | number | Matchday number |
| `md` | string | Kick-off, ISO 8601 |
| `t1` · `t2` | string | **Home** and **away** club ids |
| `t1g` · `t2g` | number | Goals — absent until the match is played |
| `t1im` · `t2im` | string | Crests, CDN-relative |
| `pt` | string | The player's **own** club for this match — `t1` or `t2`. **Only present when they played**; for a match they sat out, which side they were on has to be inferred from the season's other entries |
| `p` | number | Points scored. **Absent — not `0` — for any match the player did not appear in**, which is what separates "played and scored nothing" from "did not play" |
| `mp` | string | Minutes played, as a string with a trailing apostrophe: `"96'"`. Reaches past 90 because stoppage time counts. `"0'"` for a non-appearance, absent entirely for a fixture still to come |
| `k` | number[] | Events — see [Codes](codes.md#match-events-k-and-ke). **Repeats**: two assists arrive as `[3, 3]` |
| `st` | number | The player's involvement — see [Codes](codes.md#match-involvement-st-on-a-performance-entry) |
| `mdst` | number | Matchday status — `0` not played, `2` finished |
| `cur` | boolean | True on the competition's current matchday |
| `tp` · `ap` · `asp` | number | Season points, average and seconds played **to date**, i.e. after this match |
| `mdsn` | string | Short matchday label, e.g. `"#1"` |

### Used by

[`usePlayerPerformance`](../../src/api/hooks/usePlayer.ts) →
[Player detail](../pages/player-detail.md).

---

## `GET /v4/leagues/{leagueId}/players/{playerId}/marketvalue/{timeframe}`

Daily market values, plus what the owning manager paid.

**Auth** Bearer.

### Path parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `leagueId` | string | League id |
| `playerId` | string | Player id |
| `timeframe` | number | Days of history. **See the warning** |

> **`timeframe` is not a free parameter — only `365` returns anything.**
> The published spec declares it as "92 or 365 — 3 Months or 1 Year". Probed
> live, every value other than 365 — including 92, and 1, 7, 30, 90, 180, 366,
> 1000, and 0…6 read as an enum — answers `200` with an **empty `it` and zeroed
> metadata**, which is easy to mistake for "this player has no history".
>
> The shorter windows the UI offers are therefore **sliced client-side** out of
> the one response. Either the spec is stale or 92 was withdrawn; nothing has
> separated the two.

The path segment is spelled **`marketvalue`**, lower case. The spec lists both
`marketValue` and `marketvalue` as separate operations, which is an artefact of
the collection it was generated from — the app uses the lower-case spelling and
it resolves.

### Response `200`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `it` | array | Daily values, **oldest first, no gaps**. Empty for any window but 365 |
| `trp` | number | **What the current owner paid**, in €. `0` when nobody owns the player |
| `prlo` | number | Profit or loss for the owner, in €. Exactly `mv − trp` |
| `lmv` | number | Lowest value in the returned window, in € — **see below** |
| `hmv` | number | Highest value in the returned window, in € |
| `iso` | boolean | True when the signed-in user is the owner. Absent when nobody owns them |
| `idp` | boolean | **?** "Is default player" — handed out when a manager joined rather than bought. Inferred, and it lines up on every player checked: true for exactly those whose transfer history is a single `GRANTED` entry, false for real purchases and unowned players |
| `sprmv` | object | **?** A sponsor block — `{ url, lf, durl }`: a `go.kickbase.com` link and two CDN-relative logos, light and dark. Not rendered |

#### `it[]`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `dt` | number | **Days since the Unix epoch, not a timestamp** — `20698` is 2026-09-02. Whole days in UTC, so `dt × 86_400_000` reconstructs the date |
| `mv` | number | Market value that day, in €. **`0` before the player entered the competition** |

**`lmv` can be `0`, and often is**: days before the player entered the
competition are still returned carrying `mv: 0`, and `lmv` is the plain minimum
over all of them. A meaningful low has to ignore those — see
`marketValueExtremes` in [`models.ts`](../../src/api/models.ts).

**`trp` is not always a price anybody paid.** For a player handed out at league
start (`idp`), Kickbase books the basis at the market value of the day and
`prlo` stays `0`; the UI has to say "Startkader" rather than quote it as a
purchase. `trp` here is nonetheless the *right* source for a purchase price —
the `trp` on a [transfer-history](#get-v4leaguesleagueidplayersplayeridtransferhistory)
entry is `0` for anything but a real buy.

### Used by

[`usePlayerMarketValue`](../../src/api/hooks/usePlayer.ts) →
[Player detail](../pages/player-detail.md). One cache entry serves all four UI
windows.

---

## `GET /v4/leagues/{leagueId}/players/{playerId}/transferHistory`

Who has owned the player **in this league**, oldest first.

**Auth** Bearer. Note the **camelCase path segment** — `transferHistory`.

### Query parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `start` | number | **?** Pagination offset. Declared by the spec with an empty sample value; not probed, and the app omits it |

### Response `200`

`it[]` — one **ownership event**, not a purchase:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `t` | number | What kind of event — see [Codes](codes.md#transfer-type-t) |
| `u` | string | The manager's user id. **Absent on a `RELEASED` entry**, because nobody received them |
| `unm` | string | The manager's display name |
| `uim` | string | The manager's avatar, CDN-relative |
| `dt` | string | When it happened, ISO 8601 |
| `trp` | number | Fee paid, in €. **`0` for anything but a real buy** — a player handed out at league start has `trp: 0` here, which is why the purchase price the UI shows comes from `/marketvalue`'s `trp` instead |

Empty for an unowned player who has never been owned.

### Used by

[`usePlayerTransfers`](../../src/api/hooks/usePlayer.ts) →
[Player detail](../pages/player-detail.md).

---

## The competition-scoped twins

| League-scoped | Competition-scoped | Difference |
| ------------- | ------------------ | ---------- |
| `/leagues/{id}/players/{pid}` | `/competitions/{cid}/players/{pid}` | **The competition one has no `oui`** — no ownership outside a league |
| `…/performance` | `/competitions/{cid}/players/{pid}/performance` | None; identical byte-for-byte |
| `…/marketvalue/{n}` | `/competitions/{cid}/players/{pid}/marketvalue/{n}` | **?** Presumably no `trp`/`prlo`/`iso`; not probed |

There is no competition-scoped transfer history — ownership is a league
concept. The spec also lists
`GET /v4/competitions/{competitionId}/playercenter/{playerId}`, which has not
been probed (**✗**).
