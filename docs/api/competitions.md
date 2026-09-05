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
| `GET` | [`/v4/competitions/{competitionId}/teams/{teamId}/teamprofile`](#get-v4competitionscompetitionidteamsteamidteamprofile) | Bearer | see note |

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

> ### ⚠ Not what its name says
>
> **This returns one _fixture's_ players, not a competition's.** Probed live on
> 2026-09-05 against Bundesliga matchday 2: **25 rows, across exactly two clubs
> (Stuttgart and Köln), every one of them carrying the same `mi`.** The other
> sixteen clubs appear nowhere in it.
>
> The published documentation calls it "every player in a competition", this
> page said so too, and the [All players](../pages/players.md) stub was written
> around "expect several hundred". All three were wrong, and nothing caught it
> because the only consumer was a stub that printed a row count — 25 looks like
> a perfectly plausible number until you ask which clubs are in it.
>
> It was found when the [club page](../pages/team.md) filtered this list by
> `tid` to build a squad and got an empty Kader for seventeen clubs out of
> eighteen. **For a club's players use
> [`teamprofile`](#get-v4competitionscompetitionidteamsteamidteamprofile)**,
> which serves the whole squad in one response.
>
> Which fixture it picks is **✗** — presumably the current or next one, but a
> single observation cannot separate "the current match" from "the match this
> account last looked at". Whatever the rule, it is not a competition-wide list.

This is the one endpoint whose published documentation the project was
originally seeded from.

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
[All players](../pages/players.md) stub, which is the only thing that can
honestly be built on it until the scoping rule above is understood.

---

## `GET /v4/competitions/{competitionId}/teams/{teamId}/teamprofile`

**A club, and every player it has.** The only bulk source of a squad, and the
answer to the question the endpoint above only looks like it answers.

Probed live 2026-09-05 across all 18 Bundesliga clubs — 23–29 players each,
with `i`, `n`, `pos`, `st`, `mv` and `prob` present on every single row.

**Auth** Bearer.

### Path parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `competitionId` | string | Competition id |
| `teamId` | string | Club id, as `tid` on the [table](#get-v4competitionscompetitionidtable) |

### ⚠ Use the league-scoped spelling when ownership matters

`GET /v4/leagues/{leagueId}/teams/{teamId}/teamprofile` answers the **same body
plus four fields**, established by diffing the two responses for one club:

| Extra field | Meaning |
| ----------- | ------- |
| `oui` | Owning manager's user id — **a number**, and **absent** when unowned |
| `onm` | That manager's display name |
| `lo` | His lineup slot for the player, if fielded |
| `mvgl` | Profit/loss against what was paid — `0` for everybody on the competition-scoped one |

`iotm` and `ofc` are also filled in rather than sent zeroed. The app uses the
league-scoped spelling exclusively; see
[Squad and lineup](squad-and-lineup.md) and
[`useTeamProfile`](../../src/api/hooks/useTeam.ts).

### Response `200`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `tid` · `tn` · `tim` | string | Club id, name, crest (an SVG) |
| `pl` | number | Placement in the real table |
| `tv` | number | **The club's total market value**, in € |
| `tw` · `td` · `tl` | number | Wins, draws, losses |
| `it` | array | The squad |
| `npt` | number | Player count — has matched `it.length` on every club probed |
| `plpim` | string | The club's projected XI **as one poster**, CDN-relative. The same image `plpim` carries on a player detail, served once where it belongs |
| `plpurl` | string | The assessment source's logo (Ligainsider) |
| `pclpurl` | string | **✗** A second logo. Unidentified |
| `avpcl` | boolean | **✗** `true` on every club probed |
| `ts` | string | When the lineup assessment was last revised, ISO 8601 |

#### `it[]`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `i` | string | Player id — spelled `i`, as on the squad payload |
| `n` | string | Last name. **No first name is served here** |
| `tid` | string | Club id, repeated on every row |
| `pos` | number | Position — see [Codes](codes.md#position-pos) |
| `st` | number | Availability — see [Codes](codes.md#availability-st-and-the-entries-of-stl). **No `stxt`**, so no German reason text |
| `pim` | string | Portrait, CDN-relative |
| `mv` · `mvt` | number | Market value in €, and its trend |
| `sdmvt` | number | Change over the **last seven days**, signed — see the caveat below |
| `ap` | number | Average points per appearance. Omitted for a player who has not featured |
| `prob` | number | Lineup-probability tier, 1..5 — see [Codes](codes.md#lineup-probability-prob) |
| `lst` | number | **✗** `1` on every player probed |

**`sdmvt` is seven days, not twenty-four.** Confirmed arithmetically against
`/marketvalue/365`: for a player on `mv: 34781516` it read `349459`, and the
daily series showed `34432057` exactly seven points earlier. The 24-hour figure
is `tfhmvt` on the [player detail](players.md), which for the same player the
same afternoon was `6799` — **fifty times smaller**. A column labelled for the
wrong window is not slightly wrong.

**`sdmvt` equals `mv` for a player who had no value a week ago.** Kickbase
prices a new arrival up from zero, so his "change" is his entire valuation —
eleven players league-wide carried it on the day this was probed, which is what
a transfer deadline does. The equality is an exact test rather than a
heuristic, since the change can only equal the value when the value seven days
ago was zero. Treat it as "not computable", not as a rise.

### Used by

[`useTeamProfile`](../../src/api/hooks/useTeam.ts) → the whole Kader tab and the
scorer card on the [club page](../pages/team.md).

Neighbouring spellings that **404**: `/teams`, `/teams/{tid}`,
`/teams/{tid}/players`, `/teams/{tid}/squad`, and `/leagues/{id}/teams/{tid}`
without the suffix. Only `teamprofile` resolves, which is why an earlier round
of probing concluded there was no per-club endpoint at all.

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
