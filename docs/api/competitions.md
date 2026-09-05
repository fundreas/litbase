# Competitions

[← API index](README.md)

The real-world football underneath the game: which competitions exist, their
players, their table and their fixture list. **None of these is league-scoped**
— two managers in different leagues watching the same Bundesliga should share
the answer, and the app's query keys reflect that.

| Method | Path | Auth | Used |
| ------ | ---- | ---- | ---- |
| `GET` | [`/v4/competitions`](#get-v4competitions) | Bearer | yes |
| `GET` | [`/v4/competitions/{competitionId}/players`](#get-v4competitionscompetitionidplayers) | Bearer | yes |
| `GET` | [`/v4/competitions/{competitionId}/table`](#get-v4competitionscompetitionidtable) | Bearer | yes |
| `GET` | [`/v4/competitions/{competitionId}/matchdays`](#get-v4competitionscompetitionidmatchdays) | Bearer | yes |

Competition ids seen so far: `1` Bundesliga · `2` 2. Bundesliga · `3` La Liga ·
`4` GP Frauen-Bundesliga · `6` DFB-Pokal · `9` MLS. The list is not stable —
read it from `/v4/competitions` rather than hard-coding it. `"1"` is the only
one the app has been exercised against.

---

## `GET /v4/competitions`

All competitions. Effectively static — the app caches it an hour.

**Auth** Bearer. No parameters.

### Response `200`

`it[]`:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `i` | string | Competition id |
| `n` | string | Display name |
| `cpim` | string | Competition icon, CDN-relative |
| `fb` | string | **?** Full-bleed background image, CDN-relative. Absent on DFB-Pokal and MLS |
| `fts` | number[] | **?** Available feature ids — `[1,2,3,4,5]` on the big leagues, `[1,3]` on DFB-Pokal, `[1,2,3,5,7,8,9,10]` on MLS. The codes themselves are **✗** |

### Used by

[`useCompetitions`](../../src/api/hooks/useJoinableLeagues.ts) → the filter
chips on [Join a league](../pages/join-league.md).

---

## `GET /v4/competitions/{competitionId}/players`

Every player in a competition. This is the one endpoint whose published
documentation the project was originally seeded from.

**Auth** Bearer.

### Path parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `competitionId` | string | Competition id |

### Query parameters

Both are declared "required" by the spec and both are sent empty in its own
example; the app omits them and gets the full list.

| Name | Type | Description |
| ---- | ---- | ----------- |
| `position` | ? | **?** Filter by position. Presumably the [`pos` codes](codes.md#position-pos); not probed |
| `sorting` | ? | **?** Sort order. The unfiltered response arrives sorted by points descending, so the default is presumably "points". The accepted values are **✗** |

### Response `200`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `it` | array | The players |
| `day` | number | Current matchday |
| `sn` | string | **?** Season label |
| `mdsn` | string | **?** Short matchday label, e.g. `"#1"` |
| `spr` | object | **?** A sponsor block — `{ url, lf, durl }`, as on the market-value response. Not rendered |

#### `it[]`

The counters here are **this matchday's**, not the season's — which is what
separates this payload from the [player detail](players.md) one, where `g`/`a`
are season totals.

| Field | Type | Description |
| ----- | ---- | ----------- |
| `pi` | string | Player id |
| `n` | string | Last name |
| `tid` | string | Club id |
| `mi` | string | Match id of the current/next fixture |
| `p` | number | Points |
| `pos` | number | Position — see [Codes](codes.md#position-pos) |
| `st` | number | Availability — see [Codes](codes.md#availability-st-and-the-entries-of-stl). The spec's example shows `5` here, which is a *match-involvement* value, so this field may be on the other scale (**?**) |
| `il` | boolean | **?** "Is injured / listed out" |
| `mt` | number | Minutes played — a **number** here, where the performance endpoint uses the string `"96'"` |
| `g` · `a` | number | Goals, assists |
| `cs` | number | Clean sheets |
| `pes` | number | **?** Penalties — same unresolved question as on [player detail](players.md) |
| `pim` | string | Portrait, CDN-relative |
| `ot` | object | The opponent club of that fixture — `{ i, tim }` |

**No market value and no first name.** For either, the player has to be fetched
individually.

### Used by

[`useCompetitionPlayers`](../../src/api/hooks/useCompetition.ts) → the
[All players](../pages/players.md) stub.

---

## `GET /v4/competitions/{competitionId}/table`

The real-world league table.

**Auth** Bearer.

### Response `200`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `it` | array | The rows. **Not in table order** in the spec's example — they arrive grouped by fixture (`mi`), so the client must sort by `cpl` |
| `conf` | array | **✗** Empty on the observed response. Presumably promotion/relegation zone configuration |

#### `it[]`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `tid` | string | Club id |
| `tn` | string | Club name |
| `tim` | string | Crest, CDN-relative |
| `cp` | number | Current **football** points |
| `cpl` | number | Current placement |
| `pcpl` | number | Previous placement |
| `mc` | number | Matches played |
| `gd` | number | Goal difference |
| `sp` | number | **Kickbase points** scored by the club's players — a different currency to `cp` |
| `mdp` | number | **?** Kickbase points this matchday |
| `mi` | string | **?** The club's current/next match id |
| `il` | boolean | **?** Same flag as on a player row |

**No wins/draws/losses and no goals for/against** — only the difference. A full
table would have to derive the rest from the fixture list.

### Used by

[`useCompetitionTable`](../../src/api/hooks/useCompetition.ts) → the
[Bundesliga table](../pages/table.md) stub.

---

## `GET /v4/competitions/{competitionId}/matchdays`

**Every matchday of the season with its fixtures**, in one response. The app's
source of truth for what matchday it is, when things kick off, and who plays
whom.

**Auth** Bearer.

### Response `200`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `day` | number | **The current matchday.** This — not `/ranking`'s `day` — is what "the matchday being played now" means |
| `it` | array | Every matchday |

#### `it[]` — one matchday

| Field | Type | Description |
| ----- | ---- | ----------- |
| `day` | number | Matchday number |
| `mdln` | string | Display name, e.g. `"2 Match Day"` |
| `it` | array | The fixtures. **A club appears exactly once per matchday**, so this doubles as a club → next-fixture lookup |

#### `it[].it[]` — one fixture

| Field | Type | Description |
| ----- | ---- | ----------- |
| `mi` | string | Match id — what [`/v4/matches/{mi}/details`](matches.md) takes |
| `day` | number | Matchday number |
| `dt` | string | Kick-off, ISO 8601 |
| `t1` · `t2` | string | **Home** and **away** club ids |
| `t1sy` · `t2sy` | string | Club short symbols, e.g. `"FCB"` |
| `t1im` · `t2im` | string | Crests, CDN-relative (SVGs) |
| `t1g` · `t2g` | number | Goals — present once played |
| `st` | number | Match status — `0` upcoming, `2` finished; others **?** |
| `mtd` | string | **?** Minute as a display string, `"90"` on a finished match |
| `il` | boolean | **?** Same flag as elsewhere |
| `bo` | object | **?** Betting odds — `{ o1, ox, o2 }`: home, draw, away. Not rendered, and presumably regional |

### The score is here, but do not watch it here

This payload carries `t1g`/`t2g`, so it *looks* like a live-score source. It is
the **whole season in one response**, and the app caches it for an hour and
re-reads it only every 60 seconds during a matchday — because the only thing in
it that moves is `st`, the flag that says a match is over. Polling a season
every ten seconds to learn a boolean would be the app's largest response
fetched for its smallest fact. The live score comes from
[`/v4/matches/{matchId}/details`](matches.md) instead. See
[`polling.ts`](../../src/api/polling.ts).

### Used by

[`useMatchdays`](../../src/api/hooks/useMatchday.ts) →
[Matchday](../pages/matchday.md), [Match detail](../pages/match-detail.md), and
the fixture chips on [Squad](../pages/squad.md) and
[Market](../pages/market.md).
