# Matches

[← API index](README.md)

One match as it is being played, and the catalogue of scoring events. Neither
is league-scoped.

| Method | Path | Auth | Used |
| ------ | ---- | ---- | ---- |
| `GET` | [`/v4/matches/{matchId}/details`](#get-v4matchesmatchiddetails) | Bearer | yes |
| `GET` | [`/v4/live/eventtypes`](#get-v4liveeventtypes) | Bearer | yes |

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

> **Match-level entries are dropped**, and that is now a choice rather than a
> gap: their `ke` codes sit on a separate band — `10` kick-off, `11` end of the
> first half, `12` start of the second, `13` full time, `26` added time (with
> `amn` minutes) — identified on 2026-09-05 and tabulated in
> [Codes](codes.md#match-level-ke-pi-0). The
> [match timeline](../pages/match-detail.md#the-structural-markers) still
> derives those moments from the fixture's own state, which keeps it testable
> off-matchday.

#### `events[]` — extra fields on match-level entries

| Field | Type | Description |
| ----- | ---- | ----------- |
| `amn` | number | **Added minutes**, on `ke: 26` only. `3` at minute 45, `6` at minute 90 |

> **The feed is sorted by `mt` descending, not chronologically** — verified by
> reading all 20 events of match `11947` in delivery order. `ke: 12` (minute
> 45) therefore lands *after* `ke: 11` (minute 48). Never infer sequence from
> array position.

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

**Auth** Bearer. No parameters. **Used** — it is the lookup table for `eti` on
the player centre's `events[]`, and that join is what the
[player page's match breakdown](../pages/player-detail.md#the-match-breakdown)
is built on: it is what turns `eti: 4249` into *Goal conceded*. Read through
[`useEventTypeNames`](../../src/api/hooks/usePlayerMatchEvents.ts), one request
cached for a day, as a `Map` keyed by id. See
[the join](#the-join-that-was-missing).

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

> **`ti` is localised from `Accept-Language`.** The same id answers
> *Ballverlust* to a `de-DE` request and *Possession lost* to an `en-US` one —
> checked on `4240`, `4291` and `4237`. The app's [client](../../src/api/client.ts)
> sends `de-DE,de;q=0.9`, so the breakdown reads German without translating
> anything. Probes run with no `Accept-Language` get English, which is why the
> earlier notes here quote English titles.
| `dds` | object | Templates for an event card's sub-line, keyed `1`…`7`, `20`, `100`: `"Assist by {assistBy}"`, `"Goal by {goalBy}"`, `"Missed by {missedBy}"`, `"Suspended for next match day"`, `"-"`. **What indexes it is `ddi`** on a player-centre event — observed `ddi: "100"` on a goal, resolving to `dds["100"]`. These keys are *not* `ke` codes; do not join them to that scale |

> **This is a different, much larger scale than the `ke` codes** on a match's
> event feed. Confirmed numerically: the lowest **positive** id here is `45`,
> and none of `1`, `2`, `3`, `4`, `8`, `9`, `25` — the codes the app actually
> reads — exists in the catalogue. The ids run into the thousands and repeat
> per game mode; `"Big Chance Created"` alone appears under 18 ids. It is what
> a **points-breakdown** view would need ("why did this player score 47?"), not
> what a live score needs. Do not cross the two scales; see
> [Codes](codes.md#the-other-event-scale).

#### The negative ids are the match-structure scale

The only German strings left in the payload, and not scoring events at all:
`-1` Eingewechselt, `-2` Ausgewechselt, `-7` Auf Bank, `-8` Von Anfang an
gespielt, `-10` Erste Halbzeit des Spiels beendet, `-17` Zweite Halbzeit des
Spiels beendet.

A player centre's `events[]` uses **negative `eti`** for exactly the structural
moments, and pairs each with a `ke` — which is what finally identified the
`pi: "0"` codes. Observed on match `11947`:

| `eti` | `ke` | `mt` | Catalogue name |
| ----- | ---- | ---- | -------------- |
| `-9` | `10` | `0` | *(absent)* — kick-off |
| `-11` | `12` | `45` | *(absent)* |
| `-20` | `26` | `45`, `90` | *(absent)* — added time, carries `amn` |
| `-10` | `11` | `48` | **Erste Halbzeit des Spiels beendet** |
| `-12` | `13` | `96` | *(absent)* — full time |

> **The catalogue is not a complete index of the negative ids.** Only `-10` of
> the five actually observed is in it, while `-17` — which the catalogue *does*
> name, as the end of the second half — never appeared; the real full-time
> event used `eti: -12`. So `-17` looks legacy. Resolve a negative `eti`
> defensively and fall back to the `ke`.

That one named row is enough to pin `ke: 11`, and the rest follow by minute —
see [Codes](codes.md#match-level-ke-pi-0).

### The join that was missing

This endpoint's stated blocker was that nothing returned *which* of these
events a player accumulated. **`GET /v4/leagues/{leagueId}/playercenter/{playerId}?dayNumber=N`
does** — see [Players](players.md). Its `events[]` entries carry `eti` (this
catalogue's scale) and `p`, the points that action was worth.

Verified on Baku, matchday 2: **129 events, 123 of whose `eti` resolve against
the catalogue**, and their `p` values sum to **239 — exactly the player's `p`
for the matchday**. The six that do not resolve are the negative structural
ids above, all worth `p: 0`.

Every `eti` in that match came from the **`3849…4393` block** — so a consumer
does not need all 621 entries, but it does need to key by id rather than
assume a block, since the blocks repeat per game mode.

```
eti 4153  p=-5   Ball intercepted
eti 4150  p=-1   Interception (outside the box)
eti 4390  p=3    Cleared (outside the box)
eti 4291  p=100  Goal (Defender)          ← ddi "100"
eti 4270  p=10   Played Minutes Bonus
eti 4267  p=-15  Game Lost
```
