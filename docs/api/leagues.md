# Leagues

[← API index](README.md)

Which leagues you are in, what one league is, where everyone stands in it, and
how to join another. Squads, lineups, the market and players are all
league-scoped too and have their own pages:
[Squad and lineup](squad-and-lineup.md) · [Market](market.md) ·
[Players](players.md).

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `GET` | [`/v4/leagues/selection`](#get-v4leaguesselection) | Bearer | Leagues you belong to |
| `GET` | [`/v4/leagues/{leagueId}/me`](#get-v4leaguesleagueidme) | Bearer | You, inside one league |
| `GET` | [`/v4/leagues/{leagueId}/overview`](#get-v4leaguesleagueidoverview) | Bearer | League metadata, rules and members |
| `GET` | [`/v4/leagues/{leagueId}/ranking`](#get-v4leaguesleagueidranking) | Bearer | Standings, optionally for one matchday |
| `GET` | [`/v4/leagues/recommended`](#get-v4leaguesrecommended) | Bearer | Leagues Kickbase suggests |
| `GET` | [`/v4/leagues/list`](#get-v4leagueslist) | Bearer | Browsable / searchable joinable leagues |
| `POST` | [`/v4/leagues/{leagueId}/join`](#post-v4leaguesleagueidjoin) | Bearer | Join one |

---

## `GET /v4/leagues/selection`

Every league the signed-in user belongs to, with the two figures a league
switcher wants: budget and placement.

**Auth** Bearer. No parameters.

### Response `200`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `it` | array | The leagues — see below |
| `anol` | number | **?** "Amount of open leagues" — how many joinable leagues exist. The [League gate](../pages/league-gate.md) uses it to decide whether to offer joining |
| `anopl` | number | **✗** A second count alongside `anol` |

#### `it[]`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `i` | string | League id |
| `n` | string | League name |
| `cpi` | string | Competition id — `"1"` is Bundesliga |
| `b` | number | **Budget, in €. Can be negative** — Kickbase lends against team value |
| `tv` | number | Team value, in € |
| `pl` | number | Your placement in the league |
| `un` | number | Unread notifications |
| `bs` | number | **?** Total member count |
| `lpc` | number | **?** Lineup player count — how many of the eleven slots are filled |
| `cpim` | string | Competition icon, CDN-relative |
| `lim` | string | League avatar, CDN-relative |
| `f` | string | **?** The league avatar again, under a second key |
| `gpm` | number | Game mode — see [Codes](codes.md#game-modes-gpm) |
| `adm` | boolean | Whether you administer this league |
| `vr` | number | **✗** Verification tier |
| `idf` | boolean | **✗** |
| `rnkm` | number | **✗** "Ranking mode"? Observed `1` |

### Used by

[`useLeagues`](../../src/api/hooks/useLeagues.ts) → [League gate](../pages/league-gate.md).
Cached ten minutes — membership does not change while you look at it.

---

## `GET /v4/leagues/{leagueId}/me`

The signed-in manager inside one league. This is where the **budget in the
header** comes from.

**Auth** Bearer.

### Path parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `leagueId` | string | League id |

### Response `200`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `b` | number | Budget, in €. Negative when you have borrowed |
| `bs` | number | **?** Squad size |
| `lnm` | string | League name |
| `cpi` | string | Competition id |
| `un` | number | Unread notifications |
| `adm` | boolean | Whether you administer the league |
| `mppu` | number | **Max players one manager may hold.** `0` = no limit |
| `mpst` | number | **Max players from one real club.** `0` = no limit |
| `tpc` | array | Per-club counts in your squad — `{ tid, npt, tim }`: club id, number of players, crest. What a "you already have 3 from Bayern" warning would read |
| `lim` | string | League avatar, CDN-relative |
| `gpm` | number | Game mode — see [Codes](codes.md#game-modes-gpm) |
| `rnkm` | number | **✗** Observed `1` |

`mppu`, `mpst` and `gpm` are **also on `/overview`**, which is where the app
reads them; `/me` is fetched for the budget.

### Used by

[`useLeagueMe`](../../src/api/hooks/useLeague.ts) → the app header, and the
[Market](../pages/market.md) page's budget line.

---

## `GET /v4/leagues/{leagueId}/overview`

League metadata, the member list, and — crucially — the **league rules**.

**Auth** Bearer.

### Path parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `leagueId` | string | League id |

### Query parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `includeManagersAndBattles` | boolean | **?** Declared required by the published spec, and the app omits it and gets a usable response anyway. With `true` the spec's example additionally carries `us` (managers, spelled out) and `btls` (the league's award standings — "Matchday Master", "Transfer King", …). **Unused; a Dashboard extension is what would want it** |

### Response `200`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `i` | string | League id |
| `lnm` | string | League name |
| `cpi` | string | Competition id |
| `cpn` | string | Competition name, already resolved — `"Bundesliga"` |
| `dt` | string | Created at, ISO 8601 |
| `d` | string | League description, as the admin wrote it |
| `b` | number | **Starting** budget of the league, in € |
| `mid` | string[] | Member user ids |
| `m` | array | Members, thin — `{ ui, uim }`: user id and avatar path. **No names**; the app resolves those from `/ranking` |
| `mgc` | number | Manager count |
| `mgm` | number | Max managers the league takes |
| `mppu` | number | Max players one manager may hold. `0` = no limit |
| `mpst` | number | Max players from one real club. `0` = no limit |
| **`upe`** | boolean | **Underpaying allowed** — see below |
| `gpm` | number | Game mode — see [Codes](codes.md#game-modes-gpm) |
| `isr` | boolean | **✗** |
| `amd`, `isp`, `ism` | boolean | **✗** From the spec's example; not observed live |
| `adm` | boolean | Whether you administer the league |
| `us` | array | **?** Managers with names — only with `includeManagersAndBattles=true` |
| `btls` | array | **?** Award standings — `{ t, n, d, u }`: type code, title, description, and the manager leading it. Only with `includeManagersAndBattles=true`. The `t` codes are **✗** |

### `upe` — the one rule the market has to know

Whether a bid may fall **below the player's market value**, and this is the
only place it is exposed: `/v4/leagues/{leagueId}/settings` carries the
league's configuration but is **admin-only** (500 `NotFound` for everyone
else), and neither `/me` nor the market payload mentions it.

Probed on 2026-09-05 across two leagues that disagree on it, and the API
followed the flag exactly:

- **`false`** → anything below the market value is refused with
  `UnderpayNotAllowed`, down to a single euro short.
- **`true`** → the floor drops to `floor(mv × 0.9)`, below which it is
  `NinetyPercentRuleExceeded`.

The two leagues also differed in `gpm` (Classic vs. Anfänger), so whether `upe`
is a setting an admin can flip or a **consequence of the game mode** is not
settled — but it is the field that reports the truth either way. See
[`offerRules.ts`](../../src/lib/offerRules.ts) and
[Market](market.md#what-kickbase-refuses).

### Used by

[`useLeagueOverview`](../../src/api/hooks/useLeague.ts) → the member list on
[Ranking](../pages/ranking.md), and `upe` on [Market](../pages/market.md).

---

## `GET /v4/leagues/{leagueId}/ranking`

The standings of every manager. Also — via `?dayNumber=` — **the only known
source of duel pairings** for a matchday other than the current one.

**Auth** Bearer.

### Path parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `leagueId` | string | League id |

### Query parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `dayNumber` | number | Scope the response to one matchday. **camelCase**, like the `/leagues/list` filters. Omitted, the response describes the last *scored* matchday |

**Out-of-range values do not error.** `dayNumber=0`, `35` and `99` all answer
`200` with the managers stripped of their per-matchday fields, so the caller has
to clamp to `1…nd` itself.

### Response `200`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `ti` | string | League name ("title") |
| `cpi` | string | Competition id |
| `us` | array | The managers — **not in placement order**, see below |
| `day` | number | The matchday this response describes — echoes `?dayNumber=` back, nonsense values included. Without the parameter it is the **last scored** matchday, which is *not* the competition's current one |
| `sn` | string | Season label, e.g. `"26/27"` |
| `nd` | number | Number of matchdays in the season |
| `lfmd` | number | Last finished matchday |
| `gpm` | number | Game mode — see [Codes](codes.md#game-modes-gpm) |
| `clpc` | number | **?** Current lineup player count — observed `11` |
| `shmdn` | number | **✗** |
| `ish`, `il`, `ia` | boolean | **✗** |

**`us` is not sorted.** The API returns the managers in some other order
entirely — a real response led with the manager sitting 6th — so the client
must sort by `spl`. See [`useRanking`](../../src/api/hooks/useRanking.ts).

With matchday 1 played and matchday 2 not yet kicked off, `day` reads `1` while
`/competitions/{id}/matchdays` reports `2`. **Anything that means "the matchday
being played now" has to come from the competition, not from here.**

#### `us[]` — one manager

| Field | Type | Description |
| ----- | ---- | ----------- |
| `i` | string | User id |
| `n` | string | Display name |
| `uim` | string | Avatar, CDN-relative |
| `sp` | number | Season points |
| `spl` | number | Season placement |
| `mdp` | number | Points for **this response's matchday** — live while it is being played, `0` before kick-off |
| `mdpl` | number | Placement on that matchday. `0` before it has been played |
| `tv` | number | Team value, in € |
| `lp` | (number\|null)[] | Points per matchday, **oldest first**. `null` = did not play. (The spec's example shows player ids here instead; live responses carry points, which is what [Ranking](../pages/ranking.md) charts) |
| `ppc` | number | Placement change vs. the previous matchday |
| `adm` | boolean | Is a league admin |
| `pa` | boolean | **✗** `true` for every member observed |
| `iapl`, `hll` | boolean | **✗** |
| `lipc` | number | **✗** |
| `shp` | number | **✗** |

#### Duel ("Duell") mode

Present only in duel leagues, and how the app **detects the mode**: a normal
league carries no `hhpl` at all.

| Field | Type | Description |
| ----- | ---- | ----------- |
| `hhpl` | number | Head-to-head placement — the duel table position. **Its presence is the mode flag** |
| `hhsp` | number | Head-to-head **season** points — the running duel total. Present as `0` in leagues without duels |
| `hhmp` | number | Head-to-head **matchday** points — the duel result. Confirmed against live data: across all five duels of a played matchday, the manager with the higher `mdp` carried `3` and the other `0`. **A draw is presumably `1`** (**?**); none has been observed. Absent for a matchday not yet played |
| `hhoui` | string | **Opponent's user id for the duel on this response's matchday.** The pairing changes with `?dayNumber=`, which is what makes the [Duels](../pages/duels.md) page possible. Verified mutual: every `hhoui` points back at the manager naming it, and ten managers resolve to exactly five duels with none left over |

### Used by

[`useRanking`](../../src/api/hooks/useRanking.ts) → [Ranking](../pages/ranking.md),
and [`useDuels`](../../src/api/hooks/useDuels.ts) (with `dayNumber`) →
[Duels](../pages/duels.md).

---

## `GET /v4/leagues/recommended`

Leagues Kickbase suggests. **Note the item shape differs from `/leagues/list`**
— the id is `i` (not `li`), the competition arrives as a resolved **name**
(`cpn`) rather than an id, and there is no game mode or member cap. The app
maps both into one `JoinableLeague` model.

**Auth** Bearer. No parameters.

### Response `200`

`it[]`:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `i` | string | League id |
| `lnm` | string | League name |
| `cpn` | string | Competition **name**, already resolved — `"Bundesliga"`, `"La Liga"` |
| `mgc` | number | Manager count |
| `lim` | string | League avatar, CDN-relative |
| `mid` | string[] | Member user ids |
| `m` | array | Members, thin — `{ ui, uim }` |
| `isvf` | boolean | **?** Is verified / featured |
| `vft` | number | **✗** Verification tier |

### Used by

[`useRecommendedLeagues`](../../src/api/hooks/useJoinableLeagues.ts) →
[Join a league](../pages/join-league.md).

---

## `GET /v4/leagues/list`

Browsable and searchable joinable leagues.

**Auth** Bearer.

### Query parameters

All optional; with none, the unfiltered list comes back.

| Name | Type | Description |
| ---- | ---- | ----------- |
| `query` | string | Search string, matched against the league name |
| `competitionId` | string | Restrict to one competition — `"1"` Bundesliga, `"3"` La Liga |
| `gamePlayMode` | number | Restrict to one game mode — see [Codes](codes.md#game-modes-gpm) |
| `start` | number | **?** Pagination offset. Declared by the spec, not probed |
| `max` | number | **?** Page size. Declared by the spec, not probed |

**The spellings are camelCase, and a wrong one is silently ignored** rather
than rejected — it returns the unfiltered list, which is easy to mistake for a
filter that simply does not narrow anything. `cpi`, `gpm` and `gameMode` are
all ignored.

> **Unresolved:** the app sends **`gamePlayMode`** (probed, and it filters);
> the published spec declares **`gameplayMode`**, lower-case *p*. Either the
> server accepts both, or one of the two claims is stale. Nothing has separated
> them — a single probe comparing the two would.

### Response `200`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `it` | array | The result list |
| `rml` | array | Recommended leagues, returned alongside **every** query, in the same item shape |

#### `it[]`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `li` | string | League id — **`li`, not `i`** |
| `lnm` | string | League name |
| `cpi` | string | Competition id |
| `cpim` | string | Competition icon, CDN-relative |
| `lim` | string | League avatar, CDN-relative |
| `mgc` | number | Manager count |
| `mgm` | number | Maximum managers |
| `gpm` | number | Game mode — see [Codes](codes.md#game-modes-gpm) |
| `hum` | boolean | **?** `true` on arena-mode leagues |
| `isvf` | boolean | **?** Is verified / featured |
| `vft` | number | **✗** Verification tier |

The spec's own field table reads `mgc` as "matchdays played", which contradicts
the response — the value tracks the member list, not the season. Treat it as
the manager count.

### Used by

[`useJoinableLeagues`](../../src/api/hooks/useJoinableLeagues.ts) →
[Join a league](../pages/join-league.md).

---

## `POST /v4/leagues/{leagueId}/join`

Join a league. **No request body.**

**Auth** Bearer.

### Path parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `leagueId` | string | League id |

### Response `200`

Empty. On success the app invalidates both `/leagues/selection` and the
browsable lists — membership changed, and the league you just joined is no
longer joinable.

### Errors

| Status | `errMsg` | Cause |
| ------ | -------- | ----- |
| `500` | `NotFound` | The league no longer exists — note the 5xx |

What happens on a **full** league, or one that has already started, has not
been probed (**✗**).

### Used by

[`useJoinLeague`](../../src/api/hooks/useJoinableLeagues.ts) →
[Join a league](../pages/join-league.md).
