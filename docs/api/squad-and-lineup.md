# Squad and lineup

[← API index](README.md)

Who you own, who you field, and — the awkward part — who you owned and fielded
*then*. Kickbase splits that across four differently-spelled endpoints with
four different player shapes, and the differences are the whole reason this
page is long.

| Method | Path | Auth | Used |
| ------ | ---- | ---- | ---- |
| `GET` | [`/v4/leagues/{leagueId}/squad`](#get-v4leaguesleagueidsquad) | Bearer | yes |
| `GET` | [`/v4/leagues/{leagueId}/managers/{userId}/squad`](#get-v4leaguesleagueidmanagersuseridsquad) | Bearer | yes |
| `GET` | [`/v4/leagues/{leagueId}/users/{userId}/teamcenter`](#get-v4leaguesleagueidusersuseridteamcenter) | Bearer | yes |
| `GET` | [`/v4/leagues/{leagueId}/teamcenter/myeleven`](#get-v4leaguesleagueidteamcentermyeleven) | Bearer | no |
| `GET` | [`/v4/leagues/{leagueId}/lineup`](#get-v4leaguesleagueidlineup) | Bearer | no |
| `POST` | [`/v4/leagues/{leagueId}/lineup`](#post-v4leaguesleagueidlineup) | Bearer | yes |
| `POST` | [`/v4/leagues/{leagueId}/lineup/clear`](#post-v4leaguesleagueidlineupclear) | Bearer | yes |
| `POST` | [`/v4/leagues/{leagueId}/lineup/fill`](#post-v4leaguesleagueidlineupfill) | Bearer | no |
| `GET` | [`/v4/leagues/{leagueId}/lineup/overview`](#get-v4leaguesleagueidlineupoverview) | Bearer | no |

## Which one answers which question

| Question | Endpoint |
| -------- | -------- |
| Who do **I** own, right now? | `/squad` |
| Who does **another manager** own, right now? | `/managers/{userId}/squad` |
| Who did **anyone** own and field **on matchday N**? | `/users/{userId}/teamcenter?dayNumber=N` |
| Who am I fielding right now, with fixtures? | `/teamcenter/myeleven` |

**`/managers/{userId}/squad` takes no matchday parameter** — `?dayNumber=` is
accepted and silently ignored — so it is always the squad *as it stands now*.
For a past matchday that is today's players, not the ones fielded then.

**Note the spelling of the historical one**: `users/{userId}/teamcenter`, not
`managers/{userId}/…`. Both segments differ from the neighbouring endpoints,
which is why an earlier round of probing concluded — wrongly, for two months —
that no historical lineup existed anywhere in this API.
`users/{userId}/squad` really is a 404; only that spelling resolves.

---

## `GET /v4/leagues/{leagueId}/squad`

The signed-in manager's players.

**Auth** Bearer.

### Path parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `leagueId` | string | League id |

### Response `200`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `it` | array | The players |
| `ua` | string | **?** The manager's avatar, CDN-relative |

#### `it[]` — one owned player

| Field | Type | Description |
| ----- | ---- | ----------- |
| `i` | string | Player id |
| `n` | string | **Last** name |
| `fn` | string | First name |
| `tid` | string | Club id |
| `pos` | number | Position — see [Codes](codes.md#position-pos) |
| `mv` | number | Market value, in € |
| `mvt` | number | Market-value **trend** — see [Codes](codes.md#market-value-trend-mvt) |
| `mvgl` | number | Market-value gain/loss since purchase, in €, signed |
| `tfhmvt` | number | Change over the **last 24 hours**, in €, signed. Not in the published spec for this endpoint, so treat as optional |
| `sdmvt` | number | The same measure over **seven days**, in €, signed |
| `p` | number | Total points this season |
| `ap` | number | Average points |
| `st` | number | Availability — see [Codes](codes.md#availability-st-and-the-entries-of-stl) |
| `stl` | number[] | Additional status codes |
| `lo` | number | **Lineup slot, 0-based**, or absent when benched. Because `0` is a valid slot, membership must be tested with `lo !== undefined` |
| `ofc` | number | Offers standing on this player |
| `pim` | string | Portrait, CDN-relative |
| `iotm` | boolean | **?** Is player of the match |
| `prob` | number | Lineup-probability tier — see [Codes](codes.md#lineup-probability-prob). Not documented on this endpoint; when present it saves a per-player detail request |
| `plpim` | string | The **team's** probable-XI poster, CDN-relative. Not a per-player value |
| `mdst` | number | **?** Matchday status of this player's club fixture — same `0`/`2` scale as elsewhere |
| `lst` | number | **✗** Observed `0` and `1` |

### Used by

[`useSquad`](../../src/api/hooks/useSquad.ts) → [Squad](../pages/squad.md),
including the lineup tab, which re-seeds itself from `lo`.

---

## `GET /v4/leagues/{leagueId}/managers/{userId}/squad`

Another manager's players, **including which of them are fielded**. The same
information as your own squad, minus the fields that only make sense for your
own team (offers) — and with **every key renamed**: `pi`/`pn` here where your
own squad says `i`/`n`.

**Auth** Bearer.

### Path parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `leagueId` | string | League id |
| `userId` | string | The manager. The spec calls it `managerId` |

`?dayNumber=` is accepted and **silently ignored**. Use
[`/users/{userId}/teamcenter`](#get-v4leaguesleagueidusersuseridteamcenter) for
a matchday snapshot.

### Response `200`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `u` | string | The manager's user id |
| `unm` | string | The manager's display name |
| `uim` | string | The manager's avatar, CDN-relative |
| `st` | number | **✗** Manager status |
| `nps` | number | Number of players in the squad |
| `it` | array | The players |

#### `it[]`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `pi` | string | Player id |
| `pn` | string | Last name. **No first name on this endpoint** |
| `tid` | string | Club id |
| `pos` | number | Position — see [Codes](codes.md#position-pos) |
| `lo` | number | Lineup slot, **0-based**, or absent when benched. Confirmed on a real opponent: 11 of 15 players carried `lo` `0…10`, the other 4 carried none |
| `st` | number | Availability — see [Codes](codes.md#availability-st-and-the-entries-of-stl) |
| `stl` | number[] | Additional status codes |
| `p` | number | **Season** total points — not this matchday's |
| `ap` | number | Average points per matchday |
| `mv` | number | Market value, in € |
| `mvt` | number | Market-value trend |
| `mvgl` | number | Gain/loss since purchase, in € |
| `tfhmvt` · `sdmvt` | number | 24-hour and 7-day change, in €, signed |
| `prc` | number | **?** What this manager paid — the spec's example has `prc` ≈ `mv − mvgl`, which is consistent with a purchase price |
| `pim` | string | Portrait, CDN-relative |
| `iotm` | boolean | **?** Is player of the match |
| `lst` | number | **✗** Observed `0` on every player |

### Used by

[`useDuelRosters`](../../src/api/hooks/useDuelRosters.ts) →
[Duel detail](../pages/duel-detail.md) for the **current** matchday.

---

## `GET /v4/leagues/{leagueId}/users/{userId}/teamcenter`

**The matchday snapshot** — one manager's squad and lineup as they stood then.
The only historical source in this API, and the only way to see *any* manager's
lineup for a matchday other than the current one.

**Auth** Bearer.

### Path parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `leagueId` | string | League id |
| `userId` | string | **Any** manager in the league, not just the signed-in one |

### Query parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `dayNumber` | number | **Required, and honoured.** The player set and the lineup come back as they were that matchday |

Verified on 2026-09-04 against a league with played matchdays. **Out-of-range
days (`0`, `99`), an omitted parameter, and matchdays from before the league
existed all answer `200` with both lists empty** rather than erroring — so
"empty" has to be read as "nothing to show", never as "no players".

The spec's own path-variable mapping wires `userId` to `{{playerId}}`, which is
a mistake in the published collection; it is a **user** id.

### Response `200`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `n` | string | The requested manager's display name |
| `lp` | array | **Fielded players** — the eleven in the lineup that matchday |
| `nlp` | array | Everyone else in the squad that matchday |
| `us` | array | Every manager in the league with the players they have fielded — **see the warning below** |
| `clpc` | number | **?** Count of the current lineup; observed `11` |
| `ppc` | number | **✗** Observed `0` |

> **`us` ignores `dayNumber`.** It looks like the one bulk source of historical
> ownership in this API and it is not: whatever matchday is asked for, those
> lineups come back **as they stand today**. It was used for the
> [match lineup](../pages/match-detail.md#it-is-the-matchdays-lineup-not-todays-squad)'s
> ownership badges for exactly one round, and a past matchday duly showed the
> current elevens. Only the addressed manager's own `lp`/`nlp` honour the
> parameter, which is why the app fans out one request per manager instead.

#### `lp[]` / `nlp[]` — one player

| Field | Type | Description |
| ----- | ---- | ----------- |
| `i` | string | Player id |
| `n` | string | Last name |
| `tid` | string \| number | Club id. **The type varies** between the two lists |
| `st` | number | Availability — see [Codes](codes.md#availability-st-and-the-entries-of-stl) |
| `pos` | number | Position. **Present on `lp`, absent from the day-scoped variant's `nlp`** — the app back-fills it from the squad it already holds |
| `mi` | string \| number | The player's club fixture that matchday |
| `md` | string | Kick-off of that fixture, ISO 8601 |
| `mst` | number | **?** Per-player match status. Observed `0` before kick-off; scale unconfirmed |
| `pim` | string | Portrait, CDN-relative |
| `p` | number | **?** Points that matchday. Unconfirmed — the account available for probing had no played matchday, so the app reads points from `ph` on the [player endpoint](players.md) instead. A candidate to switch to once seen |
| `ictp` | boolean | **✗** `false` on everything observed |
| `ot` | object | **?** The opponent club — `{ i, tim }` |

#### `us[]` — one league member

| Field | Type | Description |
| ----- | ---- | ----------- |
| `i` | string | User id |
| `unm` | string | Display name |
| `mdp` | number | **?** That manager's matchday points |
| `lp` | array | That manager's fielded players. **Observed empty before kick-off.** The spec's example has bare player ids here; live responses carry objects |
| `lpi` | array | Portraits for `lp` — `{ i, pim, ictp }`. Declared as `string[]` in [`types.ts`](../../src/api/types.ts), which the spec's example contradicts; **unresolved**, and unused either way |
| `pa` | boolean | **✗** `true` for every member observed |

### Used by

[`useMatchdaySquad`](../../src/api/hooks/useMatchdaySquad.ts) →
[Duel detail](../pages/duel-detail.md) and
[Match detail](../pages/match-detail.md), one request per manager.

---

## `GET /v4/leagues/{leagueId}/teamcenter/myeleven`

Your own current eleven with each player's next fixture attached. Same player
shape as the day-scoped team center, `pos` always present, plus `ot` naming the
opponent club.

**Auth** Bearer. **Unused** — the app derives the same thing from `/squad` plus
the fixture list, which it already holds.

### Response `200`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `lp` | array | Fielded players — the shape above, with `ot` |
| `nlp` | array | Everyone else |
| `p` | number | **?** Points; observed `0` before kick-off |
| `lpc` | number | **?** Lineup player count |
| `clpc` | number | **?** Confirmed lineup player count |
| `pa` | boolean | **✗** |

**It cannot be asked about another manager** — that is what
`/users/{userId}/teamcenter` is for.

---

## `GET /v4/leagues/{leagueId}/lineup`

Reads the current lineup. **Unused** — the app re-seeds the lineup editor from
`lo` on `/squad`, which it fetches anyway. Response shape not probed (**✗**);
see `/lineup/overview` below, which is the richer of the two.

---

## `POST /v4/leagues/{leagueId}/lineup`

Replaces the lineup **wholesale**, not as a delta. Every write is the complete
intended state, so a write that lands late is merely stale, never corrupting.

`PUT` answers `405`.

**Auth** Bearer.

### Request body

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `type` | string | yes | Formation label, e.g. `"4-4-2"` |
| `players` | string[] | yes | Player ids in the starting eleven, **in slot order** |

```json
{ "type": "4-4-2", "players": ["1235", "…"] }
```

### The rules the spec does not state

The published documentation shows only the example above. These were
established against the live API:

- **`players` must have exactly 11 entries.** Fewer →
  `LineupNotEnoughPlayers` (`err: 4020`, served as HTTP 500).
- **It is positional.** The array index *is* the slot that comes back as `lo`.
  `type` defines the layout: slot 0 keeper, then the defender slots, then
  midfield, then forwards.
- **`type` must be one of the ten real formations** — see
  [Codes](codes.md#formations). `"5-3-1"`, `"2-1-0"` and `""` are all rejected,
  so even a partial lineup has to be declared inside a legal formation that can
  hold it.
- **`""` marks an empty slot** — a gap at index *n* leaves slot *n* empty.
  `null` and `"NULL"` also work; `"0"` and `"-1"` are rejected as invalid
  player ids.
- **A player in a slot of the wrong position is silently dropped** — HTTP 200,
  but he is not in the lineup afterwards. Grouping by position is mandatory,
  not stylistic.
- **An all-empty array is a no-op**, not a clear. Use `/lineup/clear`.

### Response `200`

Empty.

### Used by

[`useSaveLineup`](../../src/api/hooks/useLineup.ts) →
[Squad — lineup tab](../pages/squad.md#lineup-tab).

---

## `POST /v4/leagues/{leagueId}/lineup/clear`

Empties the lineup. **No request body**, and no body in the response.

Exists because the plain `POST /lineup` expects a formation, and there is no
formation that describes "nobody".

### Used by

[`useSaveLineup`](../../src/api/hooks/useLineup.ts), for the `clear` variant.

---

## `POST /v4/leagues/{leagueId}/lineup/fill`

Auto-fills the lineup. **Unused.**

### Request body

Note the **different field names** to `POST /lineup`'s `{ type, players }`:

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `lud` | string | yes | **?** Formation label — the example sends `"4-4-2"` |
| `pls` | string[] | yes | **?** Player ids |

Whether it fills *around* the ids given or replaces with them has not been
probed (**✗**).

---

## `GET /v4/leagues/{leagueId}/lineup/overview`

The lineup with slot assignments and each player's fixture, plus the **lineup
deadline** — which nothing else exposes. **Unused**, and the most interesting
of the unused endpoints for that reason.

### Response `200`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `mdln` | string | Current matchday number, as a string |
| `lis` | string | **Lineup lock**, ISO 8601 — when the lineup can no longer be changed. Nothing else in this API carries it; the app approximates it with the matchday's first kick-off (`dt` on the [market](market.md) payload) |
| `t` | string | Active formation, e.g. `"4-2-4"` |
| `b` | number | **?** Budget/balance indicator; observed `0` |
| `lpc` | number | Total players in the lineup |
| `clpc` | number | **?** Count of players with a confirmed lineup status |
| `ua` | string | The manager's avatar, CDN-relative |
| `cpte` | boolean | **✗** |
| `lp` | array | The lineup — see below |
| `lt` | array | **✗** Empty on the observed response |

#### `lp[]`

Player id `pi`, last name `n`, club `tid`, position `pos`, **slot `lo`**,
availability `st`, average points `ap`, market value `mv`, portrait `pim`, and
the club's fixture that matchday as `t1`/`t2` with crests `t1im`/`t2im`. Plus
`mdst` (matchday status), `lst` (**✗**) and `ictp` (**✗**).
