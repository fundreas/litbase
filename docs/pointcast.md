# pointcast — the second API

Everything on screen that Kickbase cannot answer comes from
[litbase-pointcast](https://github.com/fundreas/litbase-pointcast): a static
JSON tree on GitHub Pages, rebuilt nightly around **22:30 UTC**, read-only and
unauthenticated. Every operation is a plain `GET` of a file.

```
https://fundreas.github.io/litbase-pointcast/v1/…
```

| | |
| --- | --- |
| Base URL | `VITE_POINTCAST_BASE_URL`, see [Infrastructure](infrastructure.md#configuration) |
| Auth | **None.** No token, no league, CORS open to anyone |
| Spec | [`/v1/openapi.json`](https://fundreas.github.io/litbase-pointcast/v1/openapi.json) |
| Competition | **Bundesliga only** (`competitionId` `1`) |
| Cache | Ten minutes at Pages, an hour in the app |

**The axios instance is deliberately not used.** Every interceptor on it —
bearer token, 401 re-auth, Kickbase error mapping — is wrong for a foreign
static host, so these hooks call `fetch` directly. The same arrangement as the
[foresight API](pages/player-detail.md#the-forecast-on-top), which serves
market-value forecasts the same way.

**Fields are only ever added within `/v1/`.** A breaking change moves to a new
version prefix, so an unknown field is to be ignored rather than guarded
against.

## What the app reads

| Group | File | Used by |
| ----- | ---- | ------- |
| Predictions | `/v1/matchday/{md}.json` | [Erwartete Punkte](pages/squad.md#erwartete-punkte) — [`usePointcast`](../src/api/hooks/usePointcast.ts) |
| [Rankings](#rankings) | `/v1/rankings/matchday/{md}.json` | [Spieltag — Rangliste](pages/matchday.md#rangliste) |
| [Rankings](#rankings) | `/v1/rankings/season/{md\|current}.json` | [Saison — Rangliste](pages/season.md#rangliste) |
| [Rankings](#rankings) | `/v1/rankings/index.json` | The Saison picker — which matchdays it may offer |

The spec also publishes `/v1/index.json`, `/v1/players/index.json` and
`/v1/players/{playerId}.json`. The app calls none of them: it already knows the
matchday it wants from the season schedule, and asking an index first would be
a round trip to learn something it can simply try.

`rankings/index.json` is the exception, and only on Saison. There the matchday
is a **stopping point** for a cumulative total, so the picker has to know which
matchdays have a file *before* it offers them — the fixture list cannot say,
because the run is nightly and a matchday played on Sunday has no file until
that night.

## Rankings

**Actual Kickbase points, not predictions.** The run reads every player's
performance history to train its model, and these files are that history
folded the other way: ranked tables of what was actually scored.

They exist because **Kickbase serves exactly one player ranking and it is
always the current matchday's** — see
[competitions](api/competitions.md#get-v4competitionscompetitionidplayers),
where nine spellings of "which matchday" were each probed and each answered the
identical rows.

| | |
| --- | --- |
| `GET /v1/rankings/matchday/{matchday}.json` | One matchday's points |
| `GET /v1/rankings/matchday/current.json` | The latest matchday that has kicked off |
| `GET /v1/rankings/season/{matchday}.json` | Season totals **through** that matchday — one file per matchday, each cumulative |
| `GET /v1/rankings/season/current.json` | Season totals so far |
| `GET /v1/rankings/index.json` | Which matchdays have a ranking, and `latestMatchday` |

A file that does not exist is a **404**, which the app reads as "not published
yet" rather than as an error. Before the season's first kickoff there are none
at all.

**`current.json` is not the same as the newest matchday by number.** It is the
only file of its scope guaranteed to exist, which is why it is what the app
asks for when nobody has picked a matchday: between a matchday's last whistle
and that night's run, the newest matchday the fixture list knows about has no
file, and a page defaulting to its number would greet the reader with "not
published yet" on the one view that always has an answer.

The cumulative files are real history, not a rolling window. `season/2.json`
read on 2026-10-03 still had Kimmich top on `557` — exactly the figure
Kickbase's own `sorting=1` list returned on 2026-09-06, when matchday 2 was
the newest there was.

### Response `200`

```json
{
  "apiVersion": "v1",
  "seasonId": "42",
  "scope": "matchday",
  "matchday": 4,
  "complete": true,
  "matchesPlayed": 9,
  "matchesTotal": 9,
  "top": 100,
  "generatedAt": "2026-10-03T11:03:08Z",
  "overall": [
    { "rank": 1, "playerId": "8329", "name": "Olise", "teamId": "2",
      "teamName": "Bayern", "position": "MID", "points": 663, "minutes": 96 }
  ],
  "byPosition": { "GK": [], "DEF": [], "MID": [], "FWD": [] }
}
```

| Field | Type | Description |
| ----- | ---- | ----------- |
| `scope` | string | `matchday` or `season` |
| `matchday` | int | The matchday ranked, or the one season totals run **through** |
| `complete` | bool | **False while matches of this matchday are scheduled or live** — the points are then partial |
| `matchesPlayed` · `matchesTotal` | int | Kicked off, of the matchday's fixtures |
| `top` | int | `100`, the published depth of every list |
| `overall` | array | The top 100 of the whole competition, best first |
| `byPosition` | object | `GK` · `DEF` · `MID` · `FWD`, each its **own** top 100 |

One entry — and unlike the [Kickbase reference](api/README.md#confidence),
nothing here is guesswork: the fields are
[the published spec](https://fundreas.github.io/litbase-pointcast/v1/openapi.json),
and `| null` is where the spec says so.

| Field | Type | Description |
| ----- | ---- | ----------- |
| `rank` | int | Placement **within this list**, ties sharing a place: 1, 1, 3 |
| `playerId` · `name` | string | Kickbase's id, and the short name |
| `teamId` · `teamName` | string \| null | On a matchday list, the club he played for; on a season list, his club **now**. Null for a player who has left |
| `position` | string \| null | `GK` · `DEF` · `MID` · `FWD` |
| `points` | int | Kickbase points — roughly −100…600 per matchday |
| `minutes` | int \| null | Minutes played |
| `appearances` | int | *Season lists only.* Matchdays he scored points on |
| `pointsPerAppearance` | number \| null | *Season lists only.* `points / appearances` |

### Four position lists, not one filtered one

`byPosition.DEF` is the hundred best **defenders**, not the defenders among the
hundred best players — overall, four or five rows would be defenders. So the
position chips on the Rangliste are neither four more requests (as they must be
against Kickbase, where the position is the only way past the 25-row cap) nor a
`.filter()` over rows already in hand. They are five readings of one file, which
is why they cost nothing.

**A short list is not a truncated one.** `GK` came back with 18 rows for a
nine-fixture matchday — every keeper who played. The cap is simply above the
population.

**A tie at the hundredth place is kept whole**, so a list can run a row or two
past 100. Nothing in the app trims it back.

### What the files do not carry

**No portrait.** Kickbase's own payloads carry a content-hashed image path
(`content/file/….png`) that nothing derives from a player id, and these files
carry no image at all. The app reaches for the CDN's id-keyed pool instead —
`pool/playersbig/{playerId}.png`, see
[`playerPortraitUrl`](../src/api/cdn.ts) — which answers for about four rows in
five and falls back to initials for the rest. Probed 2026-10-03: 22 of the top
100 on matchday 4 had no pooled portrait, all of them recently added players.

**No goals, assists or fixture.** Nothing on the Rangliste renders them; the
mapped rows carry zeroes so that one row type serves both sources.

**No ownership.** That is a fact about *your league*, not about the Bundesliga,
and it is resolved separately — see
[the owner badge](pages/matchday.md#the-owner-badge-across-matchdays).

### Freshness, and where the live list still wins

The run rebuilds once a night. So from the moment a matchday kicks off until
the following night, the newest ranking file is **behind**: `current.json`
either stops at the previous matchday or holds a partial one with
`complete: false`.

That is why [`usePlayerRanking`](../src/api/hooks/usePlayerRanking.ts) splits
by *time* rather than by preference:

| Selection | Source | Rows |
| --------- | ------ | ---- |
| The matchday being played | Kickbase, live | 25 |
| Any earlier matchday | pointcast | 100 |
| The season | pointcast | 100 |

The season list is the one judgement call. It moves during a matchday too, but
nobody watches a season total move, and a hundred rows with real placements
beats twenty-five rows current to the minute — the footnote under it names the
matchday it runs through, so being a day behind is on screen rather than
implied.

**A settled matchday's points still move**, which is why nothing here is cached
forever. Kimmich's matchday 2 read `253` on 2026-09-07 and `254` a day later,
his season total moving `556` → `557` to match — Kickbase revising a score. The
nightly run rebuilds the whole season for exactly that reason, and the app's
one-hour `staleTime` is what lets a revision reach the screen.
