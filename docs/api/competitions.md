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
> **This returns the current matchday's twenty-five best players**, points
> descending — not "every player in a competition", which is what the published
> documentation calls it.
>
> #### It is not "one fixture's players" either
>
> This page said that from 2026-09-05 to 2026-09-06, and it was wrong. The
> claim came from a probe taken **mid-matchday**, when exactly one fixture had
> been played: all 25 rows carried that one `mi`, across Stuttgart and Köln,
> and it read like a per-fixture list. Read back the next morning, the same
> matchday's response spans **seven matches and nine clubs** — still 25 rows,
> still sorted by points.
>
> The list was never scoped to a fixture. It is scoped to *having points*, and
> early on a matchday those are nearly the same set. A probe taken while the
> data is still filling in can support a rule that the data will contradict
> within hours.
>
> #### What the old reading got right
>
> **It is not a way to enumerate a club's squad.** Filtering it by `tid` is
> what gave the [club page](../pages/team.md) an empty Kader for seventeen
> clubs out of eighteen — a top-25 list simply does not contain most players.
> That fix stands: for a club's players use
> [`teamprofile`](#get-v4competitionscompetitionidteamsteamidteamprofile),
> which serves the whole squad in one response.
>
> #### It ignores every parameter *except its own two*
>
> This page said "every parameter" until 2026-09-06, on the strength of
> `?dayNumber=`, `?matchId=` and `?mi=` all being swallowed. The spec's own
> `position` and `sorting` had never been tried, and **both work** — see
> [Query parameters](#query-parameters) below. What stays true is that there
> is **no way to ask it for a past matchday**: it is always the competition's
> current one, which is what `day` on the response reports.

This is the one endpoint whose published documentation the project was
originally seeded from.

**Auth** Bearer.

### Path parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `competitionId` | string | Competition id |

### Query parameters

Both are declared "required" by the spec and both are sent empty in its own
example; the app omits them and gets the default list. Probed live
2026-09-06, competition `1`, matchday 2 settled.

| Name | Type | Description |
| ---- | ---- | ----------- |
| `position` | number | **Filters by position**, on the [`pos` codes](codes.md#position-pos) — `1` keeper, `2` defender, `3` midfielder, `4` striker. Each answers that position's own top 25. Out-of-range values (`0`, `5`) fall back to the unfiltered list |
| `sorting` | number | `1` switches the list to **season points**; every other value probed (`0`, `2`–`10`, `-1`, `mv`, `points`) gives the default, the current matchday |

They **compose**: `?position=1&sorting=1` is the season's twenty best keepers.

#### `position` is the way past 25

The response is capped at 25 and there is no way to raise it — `max`, `limit`,
`start`, `count`, `size`, `top`, `page`, `offset` and `n` were each tried and
each answered the identical 25 rows. But the cap applies **per filtered
list**, so the four positions are four separate top-25s:

| `position` | Matchday rows | Season rows |
| ---------- | ------------- | ----------- |
| *(none)* | 25 | 25 |
| `1` keeper | 18 | 20 |
| `2` defender | 25 | 25 |
| `3` midfielder | 25 | 25 |
| `4` striker | 25 | 25 |

Four requests therefore yield **93 distinct players** where one yields 25, and
the union is a strict superset of the unfiltered list. The keeper counts are
below the cap because they are the whole population, not a slice: 18 keepers
scored on a 9-fixture matchday, exactly one per club.

#### `sorting=1` is season points, verified

Kimmich came back with `p: 556` under `sorting=1` on 2026-09-06; his
[performance](#get-v4competitionscompetitionidplayersplayeridperformance)
`ph` for 26/27 read `303` on day 1 and `253` on day 2, which summed to exactly
that. The `sorting=1` rows also **drop `mi` and `ot`** — there is no one
fixture for a season total to point at — so a consumer must not assume those
fields are present.

> **A settled matchday's points can still move.** Read back on 2026-09-07 the
> same two numbers were `303` and `254`, against a season total of `557` — the
> pair stayed consistent, so this is Kickbase revising a score after the fact
> rather than a disagreement between endpoints. It is the reason
> [the seed script](../../scripts/build-matchday-rankings.mjs) rebuilds the
> whole season on every run instead of appending the newest matchday.

**Scoping parameters still do nothing.** `dayNumber`, `matchId`, `mi`, `day`,
`md`, `matchDay`, `matchday`, `d` and `dn` were each tried and each returned
the identical body, so an unrecognised parameter is silently ignored rather
than rejected — do not read a `200` here as confirmation that a parameter was
understood.

#### There is no bulk source for a *past* matchday

Nothing else in the API serves one either:
[`teamprofile`](#get-v4competitionscompetitionidteamsteamidteamprofile) carries
`ap`, a season average, and no per-matchday score;
[`/v4/matches/{mi}/details`](matches.md) carries the real starting elevens with
**no points on them at all**. A past matchday's top scorers can only be
assembled per player, from
[`playercenter`](#get-v4competitionscompetitionidplayercenterplayerid)`?dayNumber=`
or from the `ph` of the performance endpoint.

**So the app assembles them offline.**
[`scripts/build-matchday-rankings.mjs`](../../scripts/build-matchday-rankings.mjs)
does exactly that sweep — 18 `teamprofile` calls for the players, then one
`performance` call each, which is ~470 requests and answers *every* matchday of
the season at once — and commits the result under
[`data/rankings/`](../../data/README.md) for the app to `fetch`. Verified
against this endpoint: on 2026-09-07 all 25 rows of the `sorting=1` list were
exactly the sum of the two matchday files.

That is a build step precisely because it cannot be a request. Doing it in the
browser would be several hundred calls to render one list.

### Response `200`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `it` | array | The 25 best players, points descending — of `day` by default, of the season under `sorting=1`, and of one position under `position=` |
| `day` | number | The matchday the list is for. **Not the same as the fixture list's `day`**: probed 2026-09-07 this read `2` where [`/matchdays`](#get-v4competitionscompetitionidmatchdays) already said `3`, so it tracks the last matchday *with points* rather than the next to be played. Present under `sorting=1` too, where it does not scope the points |
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
| `mi` | string | Match id of the current/next fixture. **Absent under `sorting=1`** |
| `p` | number | Points |
| `pos` | number | Position — see [Codes](codes.md#position-pos) |
| `st` | number | Availability — see [Codes](codes.md#availability-st-and-the-entries-of-stl). The spec's example shows `5` here, which is a *match-involvement* value, so this field may be on the other scale (**?**) |
| `il` | boolean | **?** "Is injured / listed out" |
| `mt` | number | Minutes played — a **number** here, where the performance endpoint uses the string `"96'"` |
| `g` · `a` | number | Goals, assists |
| `cs` | number | Clean sheets |
| `pes` | number | **?** Penalties — same unresolved question as on [player detail](players.md) |
| `pim` | string | Portrait, CDN-relative |
| `ot` | object | The opponent club of that fixture — `{ i, tim }`. **Absent under `sorting=1`** |

**No market value and no first name.** For either, the player has to be fetched
individually.

### Used by

[`useCompetitionPlayers`](../../src/api/hooks/useCompetition.ts) → the
**Rangliste** view of the [matchday page](../pages/matchday.md#rangliste), and
the [All players](../pages/players.md) stub.

It is **the only bulk source of per-player matchday points in the API**, which
is what makes that view cost one small request where
[`useMatchdayPoints`](../../src/api/hooks/useMatchdayPoints.ts) would have
needed one per player across nine fixtures. Polled at the
[live rate](../api-layer.md) while a matchday runs; between matchdays it cannot
move at all.

**Both parameters are sent, from two different pages.** `position` comes from
the chip row on either Rangliste — one cache entry per chip, and only the one on
screen polls. `sorting=1` is what makes the
[Saison page's Rangliste](../pages/season.md#rangliste) a season list rather
than a matchday one.

They are two pages rather than a toggle on one because the scope is what the
page *is*: [Spieltag](../pages/matchday.md) is one weekend,
[Saison](../pages/season.md) is everything up to now. A `sorting` switch on the
matchday page was built and removed for exactly that reason.

`CompetitionPlayer` in [`types.ts`](../../src/api/types.ts) has `mi` and `ot`
optional, which is what makes the `sorting=1` rows safe to map with the same
code — a season row has neither.

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
table has to derive the rest from the fixture list.

### ⚠ There is no richer table endpoint. Goals scored:conceded are derived

Probed live 2026-09-05, looking for a payload carrying goals **for** and
**against** rather than only `gd`. Nothing serves them:

| Probe | Result |
| ----- | ------ |
| `/v4/competitions/1/tables` | empty |
| `/v4/competitions/1/table/full` | empty |
| `/v4/competitions/1/table/2` | empty |
| `/v4/competitions/1/standings` | empty |
| `/v4/competitions/1/teams` | empty |
| `/v4/leagues/{leagueId}/competition/table` | empty |
| `/v4/competitions/1/table?full=true` | the **same 12 fields** — the parameter is ignored |

So `gd` is all the table has, and `14:11` and `5:2` are the same `+3` to it.
The [Saison page](../pages/season.md) needs the split, and gets it by summing
[`matchdays`](#get-v4competitionscompetitionidmatchdays) — one payload the app
already caches, so the page costs no extra request.

**The derivation was verified against the table itself.** Summing every fixture
with `st === 2` over all 34 matchdays reproduces the API's own `mc`, `gd` *and*
`cp` for **all 18 clubs, exactly** — so the same pass that yields goals for and
against is demonstrably counting the right matches the right way:

```
club            mc  mc*   gd  gd*   cp  cp*   gf:ga
Bayern           1    1    4    4    3    3   5:1
Stuttgart        2    2   -1   -1    3    3   5:6
Köln             2    2   -2   -2    3    3   4:6
…                                             (18/18 reconcile)
```

Only `st === 2` counts, which is what [`teamResult`](../../src/api/models.ts)
already enforces: a 1:0 in the 30th minute is not a win, and the fixture list is
cached for an hour besides. That is why the page shows the **API's** `mc` and
`cp` rather than the derived ones — they agree today, and where they ever
disagree the server is the authority.

### Used by

[`useCompetitionTable`](../../src/api/hooks/useCompetition.ts) → the
[Saison](../pages/season.md) page, together with
[`useSeasonRecords`](../../src/api/hooks/useMatchday.ts) for the goal split.
[`useTeamDirectory`](../../src/api/hooks/useCompetition.ts) reads the same cache
entry for club names and crests.

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
[Matchday](../pages/matchday.md), [Match detail](../pages/match-detail.md), the
fixture chips on [Squad](../pages/squad.md) and [Market](../pages/market.md),
and — via `useSeasonRecords` — the goals column on
[Saison](../pages/season.md), which the
[table](#get-v4competitionscompetitionidtable) cannot serve.
