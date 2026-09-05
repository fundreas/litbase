# Matches

[← API index](README.md)

One match as it is being played, and the catalogue of scoring events. Neither
is league-scoped.

| Method | Path | Auth | Used |
| ------ | ---- | ---- | ---- |
| `GET` | [`/v4/matches/{matchId}/details`](#get-v4matchesmatchiddetails) | Bearer | yes |
| `GET` | [`/v4/live/eventtypes`](#get-v4liveeventtypes) | Bearer | no |

---

## `GET /v4/matches/{matchId}/details`

The live state of one match: the score, the **minute**, the status, the
real-world starting elevens and a full event feed. **The only source of any of
it** — `/competitions/{id}/matchdays` carries a score too, but that payload is
the whole season and is cached for an hour, so it is no use to a page watching
a match.

**Auth** Bearer.

### Path parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| `matchId` | string | Match id — `mi` on a [fixture](competitions.md#get-v4competitionscompetitionidmatchdays) |

### Response `200`

> **It does not echo its own id.** There is no `mi` on the response, so a
> caller fanning out over several matches has to keep track of which answer
> belongs to which request.

| Field | Type | Description |
| ----- | ---- | ----------- |
| `t1` · `t2` | string | **Home** and **away** club ids |
| `t1n` · `t2n` | string | Club names |
| `t1sy` · `t2sy` | string | Club short symbols, e.g. `"VFB"` |
| `t1g` · `t2g` | number | Goals. Present from kick-off, `0` before either side scores |
| `t1im` · `t2im` | string | Crests, CDN-relative |
| `mt` | number | **The minute, as the API counts it** — observed `95` on a finished match whose `mtd` read `"90"`, so this runs past 90 with stoppage time |
| `mtd` | string | The minute as a display string, e.g. `"90"` |
| `md` | string | Kick-off, ISO 8601 |
| `mst` | number | Match status. `2` is played to the end, as `st` is elsewhere — see [Codes](codes.md#match-status-st-on-a-fixture-mst-on-a-match) |
| `il` | boolean | **?** "The lineups are official rather than predicted". `false` on a match played weeks ago, so it is less "the lineup is known" than a flag the app sets around kick-off — treat with care |
| `t1lp` · `t2lp` | array | The **starting elevens** |
| `t1nlp` · `t2nlp` | array | The rest of each squad |
| `ts1` · `ts2` | string | Formation strings, e.g. `"4-2-3-1"`. Note these are the **real** formations, which are richer than the ten Kickbase accepts for [your own lineup](codes.md#formations) |
| `events` | array | Everything that happened, **newest first** |

#### `t1lp[]` etc. — one player in a real lineup

| Field | Type | Description |
| ----- | ---- | ----------- |
| `i` | number | Player id — **a number here, a string everywhere else** |
| `n` | string | Last name |
| `pos` | number | Position — see [Codes](codes.md#position-pos) |
| `pim` | string | Portrait, CDN-relative |

**No points.** Kickbase points per player during a live match have to come from
`ph` on the [player endpoint](players.md), one request each — which is the
heaviest thing the app does, and why it is gated to players whose own club
match is actually under way.

#### `events[]` — one event

| Field | Type | Description |
| ----- | ---- | ----------- |
| `ke` | number | Event kind, on the **same scale as `k`** on the player-performance endpoint — see [Codes](codes.md#match-events-k-and-ke). Verified on a finished 5:1: five `1`s and one `2`, four `4`s, ten `8`s |
| `mt` | number | The minute it happened |
| `pi` | string | Player id, **or `"0"` for a match-level event** — kick-off, half-time, the whistle |
| `pn` | string | Player name. Absent on match-level events |
| `tid` | string | Club id |
| `pim` | string | Portrait, CDN-relative |
| `rev` | object | A related event, e.g. the assist folded into a goal. **Its `pi` is `"0"` even though `pn` names somebody**, so the related player cannot be identified by id — which is why it is unused |

> **Match-level entries are dropped.** Their `ke` codes are *not* on the player
> scale and have not been identified (**✗**). The
> [match timeline](../pages/match-detail.md#the-structural-markers) derives
> kick-off, half-time and the whistle from the fixture's own state instead. One
> probe reading the `ke` of a `pi: "0"` entry would settle it.

### Used by

[`useMatchDetails`](../../src/api/hooks/useMatchDetails.ts) →
[Match detail](../pages/match-detail.md),
[`useLiveMatches`](../../src/api/hooks/useLiveMatches.ts) →
[Matchday](../pages/matchday.md), one request per running match, and
[`useTeamSheets`](../../src/api/hooks/useTeamSheets.ts) →
[Duel detail](../pages/duel-detail.md#the-clubs-team-sheet) and the
[squad's live view](../pages/squad.md#live-tab), one request per match about to
start.

Polled every **ten seconds**, and only for matches that have kicked off and are
not over — see [`polling.ts`](../../src/api/polling.ts).

The last two are complementary halves of one cache entry and never overlap:
`useLiveMatches` takes the matches that **have** kicked off and reads the score,
the minute and the events, discarding the lineups; `useTeamSheets` takes those
still **to** kick off — within two hours of it, at a five-minute tick — and
reads only `t1lp`/`t1nlp`, and only when `il` says the sheets are official.
That gate is the one uncertain thing about it; see
[`il` is the gate](../pages/duel-detail.md#il-is-the-gate-and-it-is-the-uncertain-part).

---

## `GET /v4/live/eventtypes`

Names for every scoring event Kickbase knows — **621 of them**, ids `-17` to
`4765`, from *Deadly Pass* to *Fouled in the opponent's half*.

**Auth** Bearer. No parameters. **Unused.**

> **It is not live, whatever the path says.** Polled seven times at 30-second
> intervals during a running matchday, every response came back byte-identical
> and `lcud` read `2026-08-10T14:40:33Z` — a month stale. It takes no
> parameters, so there is nothing to scope it to a match. The
> `cache-control: no-store` on the response is about HTTP caching, not about
> the content moving. Samples and the full analysis:
> [`test-data/eventtypes/`](../../test-data/eventtypes/README.md).

### Response `200`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `lcud` | string | Last updated, ISO 8601. Moves when Kickbase revises its scoring, not per matchday |
| `it` | array | `{ i, ti }` — event type id and human-readable title. 621 entries, **169 distinct titles** |
| `dds` | object | **~** Templates for an event card's sub-line, keyed `1`…`7`, `20`, `100`: `"Assist by {assistBy}"`, `"Goal by {goalBy}"`, `"Missed by {missedBy}"`, `"Suspended for next match day"`, `"-"`. **✗** what indexes it — the keys look like `ke` codes but the meanings do not line up (`3` is a red card there, a goal here), so do not join them |

> **This is a different, much larger scale than the `ke` codes** on a match's
> event feed. Confirmed numerically: the lowest **positive** id here is `45`,
> and none of `1`, `2`, `3`, `4`, `8`, `9`, `25` — the codes the app actually
> reads — exists in the catalogue. The ids run into the thousands and repeat
> per game mode; `"Big Chance Created"` alone appears under 18 ids. It is what
> a **points-breakdown** view would need ("why did this player score 47?"), not
> what a live score needs. Do not cross the two scales; see
> [Codes](codes.md#the-other-event-scale).

#### The six negative ids

The only German strings left in the payload, and not scoring events at all:
`-1` Eingewechselt, `-2` Ausgewechselt, `-7` Auf Bank, `-8` Von Anfang an
gespielt, `-10` Erste Halbzeit des Spiels beendet, `-17` Zweite Halbzeit des
Spiels beendet.

The last two are exactly the half-time and full-time moments whose `ke` on a
`pi: "0"` event was never identified (**✗** above). **One probe would settle
it**: read the `ke` of a match-level entry on a live match and see whether it
is negative. If it is, the timeline could stop deriving those moments from the
fixture's state.

### Not used, and what would use it

A per-player points breakdown during a live match. The blocker is not this
endpoint but the other half: nothing found so far returns *which* of these
events a given player accumulated in a given match with their point values —
`k` on the [performance endpoint](players.md) is the coarse ten-code scale, not
this one.
