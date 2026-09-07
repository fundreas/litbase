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
| `GET` | [`/v4/leagues/{leagueId}/activitiesFeed`](#get-v4leaguesleagueidactivitiesfeed) | Bearer | The league's event log — *Aktivitäten* |
| `GET` | [`/v4/leagues/{leagueId}/activitiesFeed/{activityId}`](#get-v4leaguesleagueidactivitiesfeedactivityid) | Bearer | One entry, in full |

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
and — with `dayNumber`, one cached response read two ways —
[`useDuels`](../../src/api/hooks/useDuels.ts) for the pairings plus
`useMatchdayStandings` for that matchday's manager ranking, both →
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

---

## `GET /v4/leagues/{leagueId}/activitiesFeed`

The league's event log — what the Kickbase app shows under **Aktivitäten**:
players put up for sale, completed transfers, managers joining and leaving,
matchdays being scored, and achievements. **Newest first**, back to the
league's founding.

Probed on 2026-09-07 against two leagues (131 and 489 entries), with every
parameter spelling below tried against both.

**Auth** Bearer.

### Path parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `leagueId` | string | League id |

### Query parameters

All optional. The spec declares all three *required*; the bare path answers the
first 25.

| Name | Type | Description |
| ---- | ---- | ----------- |
| `start` | number | **Zero-based offset** of the first entry. `start=10&max=10` returns exactly entries 10–19 of `start=0&max=200`, and `start=5` the five-shifted window. Past the end → `200` with an empty `af` |
| `max` | number | **Page size.** Default **25**. **No cap found**: `max=500` and `max=1000` both returned all 489 entries the larger league had, and `max=201` returned 201. `0` and `-1` answer one entry; a non-number is ignored |
| `filter` | string | **The event type**, one code or a comma-separated list of codes — `filter=15` is transfers only, `filter=15,26` transfers and achievements. See [the type table](codes.md#activity-type-t) and the notes below |

### What `filter` can and cannot do

It filters on **`t` and nothing else**. Established by elimination:

- **A list works, a repeat does not.** `filter=15,26` (or `15%2C26`) returns
  both types; `filter=15&filter=26` keeps only the first. `filter=[15,26]` is
  ignored.
- **Codes that match nothing return an empty list**, not an error — `0`, `1`,
  `2`, `4`, `8`, `22`, `-1`. Every integer 1–120, 200, 500 and 1000 was tried:
  only the codes that actually occur in the feed return anything, plus one
  oddity — **`filter=34` returns the type-`17` entries**, the same ids as
  `filter=17`. Whether `34` is an alias or a category containing `17` is
  unresolved (**?**).
- **A non-numeric value is ignored** and returns the unfiltered feed — `all`,
  `transfer`, `transfers`, `abc`. This is the failure mode to watch for: it
  looks like a filter that "does not narrow much".
- **There is no other filter.** Every spelling of a type filter (`type`,
  `types`, `t`, `activityType`, `activityTypes`, `category`), of a manager
  filter (`userId`, `managerId`, `user`, `uid`, `ui`, `byr`), of a date window
  (`from`, `to`, `since`, `until`, `dateFrom`, `dateTo`, `startDate`,
  `endDate`), of a cursor (`before`, `after`, `beforeId`, `lastId`) and of a
  matchday (`dayNumber`, `matchday`, `day`) answered `200` with the identical
  unfiltered first page. **Filtering by manager or by period has to happen on
  the client**, over pages fetched with `start`/`max`.

`OPTIONS` answers `405` with `allow: GET` — read-only.

### Response `200`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `af` | array | The entries, newest first — "activities feed". Both `dt` and the numeric `i` are strictly descending in every page observed |
| `onbft` | string | **✗** An image path, identical across both leagues |

#### `af[]` — one entry

| Field | Type | Description |
| ----- | ---- | ----------- |
| `i` | string | Entry id |
| `t` | number | Event type — see [Codes](codes.md#activity-type-t) |
| `dt` | string | When, ISO 8601 |
| `coc` | number | **Comment count** — `0` on all 620 entries across two leagues, so never observed non-zero. Read as the count because it is the one field beside `it` on the comments endpoint itself (`{ coc, it: [] }`), and `it` is always "the list". Proving it needs a `POST`, and **a comment cannot be taken back**: `OPTIONS` on the collection answers `allow: GET, POST`, and there is no single-comment route, so a test comment would stand in the league feed for good. The comments live at `…/activitiesFeed/{activityId}/comments?start=&max=`; `POST` there with `{ comm }` adds one (declared by the spec, not tried) |
| `data` | object | **Depends on `t`** — the shapes follow. `{}` on some entries |

#### `data` by type

**`3` — a player was listed** (both Kickbase's daily listings and managers')

| Field | Type | Description |
| ----- | ---- | ----------- |
| `pi` | string | Player id |
| `tid` | string | Club id |
| `fn` | string | First name. Present but **empty** for single-name players |
| `ln` | string | Last name |
| `nin` | string | Nickname, on the rare player who has one (`"Bernardo"`) |
| `mv` | number | Market value at listing, in € |
| `pim` | string | Portrait, CDN-relative |
| `tim` | string | Club crest, CDN-relative. **Absent on about a quarter** of the entries |
| `prurl` | string | **✗** `pool/players/{pi}.jpg` — a second portrait path, on some entries only |
| `iposl` | boolean | **?** `false` throughout — as on the market listing |

Nothing says *who* listed the player. A manager's listing and Kickbase's look
the same here.

**`15` — a transfer went through**

| Field | Type | Description |
| ----- | ---- | ----------- |
| `pi` | string | Player id |
| `pn` | string | Player's **last name** only |
| `tid` | string | Club id |
| `t` | number | **Direction.** `1` a manager **bought** — `byr` is set, no `slr`. `2` a manager **sold back to Kickbase** — `slr` is set, no `byr`. 28 entries, 9 and 19, never both names |
| `trp` | number | The fee, in € |
| `byr` | string | Buyer's display name |
| `slr` | string | Seller's display name |
| `pim`, `tim` | string | Portrait and crest |

A **manager-to-manager** sale has not been observed (**✗**) — presumably both
names on one entry.

**`5` — a manager joined** · **`13` — a manager left**

| Field | Type | Description |
| ----- | ---- | ----------- |
| `i` | string | User id |
| `n` | string | Display name |
| `uim` | string | Avatar, CDN-relative — only for users who have one |

`13` as *left* is read off the membership: all three users carrying it in the
test league had a `5` earlier and are absent from `/ranking` today, while every
`5`-only user is a current member.

**`17` — a matchday was scored.** The feed is **personalised** here: `data`
describes the **viewer**.

| Field | Type | Description |
| ----- | ---- | ----------- |
| `day` | number | Matchday |
| `mdln` | string | `"Spieltag 2"` — already localised (`"2 Match Day"` in English) |
| `i` | string | The **viewer's** user id |
| `pl` | number | The viewer's placement on that matchday |

**`data` is `{}`** when the viewer took no part — both entries in a league the
account had joined without fielding a team.

**`26` — the viewer earned an achievement.** Also personalised: the six
entries in the test league are exactly the six achievements
`/v4/leagues/{leagueId}/user/achievements` lists as earned (`ise: true`), and
a league where the account has earned none shows no `26` at all. Other
managers' achievements do not appear.

| Field | Type | Description |
| ----- | ---- | ----------- |
| `t` | number | Achievement type — see [Codes](codes.md#achievement-type) |
| `n` | string | Name — `"Spieltagssieger"`, localised by `Accept-Language` |
| `d` | string | Description — `"Werde Spieltagssieger"` |

**`28` — the league was founded.** The oldest entry of every feed.
`{ lnm }`, the league name.

**`16`** — one entry per league, `data: {}`, timestamped to the second with the
viewer's first achievement (**✗**). **`22`** — the daily login bonus
(*Auflaufprämie*) according to the spec's example for the single-entry
endpoint, `{ bn: 10000, day: 1 }`; **not observed live** — the test account has
never collected one, and `filter=22` is empty in both leagues (**?**). The
bonus itself is claimed with `GET /v4/bonus/collect`, which answers one
`{ li, lnm, v, day, b, lim }` per league — not called, because it is a write
dressed as a `GET`.

### Used by

[`useActivities`](../../src/api/hooks/useActivities.ts) →
[Dashboard](../pages/dashboard.md#aktivitäten), as an infinite query paged
with `start`/`max` at 25 a page.

---

## `GET /v4/leagues/{leagueId}/activitiesFeed/{activityId}`

One entry, with **more than the list carries** — and for some types nothing at
all.

**Auth** Bearer.

### Response `200`

`{ t, dt, data }` — no `i`, no `coc`. The `data` is the fuller reading:

| `t` | What the single entry adds |
| --- | -------------------------- |
| `3` | The player's stats — `tp`, `ap`, `pos`, `st`, `shn`, `tfhmvt` (the 24-hour market-value change), `smc`/`ismc`/`smdc` (**✗**) — and `mv` as it stands **now**, not at listing |
| `15` | `byr` / `slr` become objects `{ i, n }`, plus `fn`, `ln`, `mv` (current). `isop` is **`true` on every buy and `false` on every sale** (9 and 19) — it tracks the direction, not the viewer's involvement; it is *not* "the viewer bid on this" |
| `17` | **The whole matchday table**: `us[]` of `{ i, n, pl, p }` — every manager's placement and points — and `fp` (**✗**, empty). Note it listed **four of the five** members; the one missing had joined the day before the matchday (**?**) |
| `5` | `uc` (**✗** `5`), `spld` (**?** `1` — starting players dealt), `ibun` (**✗** the name again) |
| `13` | `uc`, `ds` (**✗** `1`) |

| `t` | Answer |
| --- | ------ |
| `26`, `28`, `16` | **`500 NotFound`** — there is no detail view for these |

### Used by

Nothing yet. The `17` reading is what a "matchday result" row would expand into;
the [dashboard](../pages/dashboard.md#aktivitäten) reads `/ranking?dayNumber=`
for that instead, which has avatars.

### Where a bid of your own can be read back

**Not from the feed.** Neither the list entry nor the single-entry detail names
anyone but the parties to the deal, and `isop` on the detail looks like the
flag and is not: it is `true` on all nine buys and `false` on all nineteen
sales, so it tracks the direction.

**Not from the manager's transfer log** either.
`GET /v4/leagues/{leagueId}/managers/{managerId}/transfer` answers **completed**
deals only — `{ u, unm, it: [{ pi, pn, tid, tty, trp, dt, pim, othnm? }] }`,
`tty` `1` bought / `2` sold, `othnm` the other party when there was one, paged
with `?start=`. League-level `/market/history`, `/user/offers`, `/me/offers`,
`/transfers` and `/user/transfers` are all 404 or 405.

**One endpoint does carry it, per player:**

```
GET /v4/leagues/{leagueId}/players/{playerId}/transfers
```

Note the spelling — `transfers`, *not* the `transferHistory` documented under
[Players](players.md). It answers
`{ n, oui, mv, prc, iotm, exs, uop, uoid, ofs[], iposl, ipl, plpim, ts }`,
where **`uop` is what the viewer offered**, `uoid` their offer id (their own
user id), and `ofs[]` the offers this account may see — `{ u, uoid, uop, st }`,
`st` `0` on every one observed.

Verified on 2026-09-07 by placing an offer on a live listing and withdrawing it
again: with no bid the response carries `ofs: []` and no `uop` at all, and with
one both appear. The market listing shows the same pair, but only while the
listing stands and only inside a list of twenty.

> **Whether a *losing* bid survives the sale is unresolved** (**?**). Every
> completed transfer probed answered `ofs: []` — but the account had bid on
> none of them, and producing a lost bid costs a listing's full run. The
> [dashboard](../pages/dashboard.md#aktivitäten) asks anyway and renders the
> answer when there is one.
