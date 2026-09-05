# `GET /v4/live/eventtypes` — seven samples, 30 seconds apart

Probed **2026-09-05, 13:52:12–13:55:12 UTC**, mid-matchday, with Bundesliga
matches actually running. Seven requests, one every 30 seconds.

**All seven responses are byte-identical** — same 22 500 bytes, same
`sha256 b88220697b59b902…`. `lcud` read `2026-08-10T14:40:33Z` in every one:
almost a month stale at probe time.

Despite living under `/v4/live/`, this is a **static catalogue**, not a feed. It
takes no parameters, so there is nothing to scope it to a match or a matchday.
`cache-control: no-store, no-cache` and `cf-cache-status: DYNAMIC` on every
response are about HTTP caching, not about the content changing.

## Files

| File | What |
| ---- | ---- |
| `sample-NN-<utc>.json` | The response body |
| `sample-NN-<utc>.headers.txt` | Its response headers |

The bearer token is deliberately **not** stored here.

## What is in the payload

```
{ lcud: string, it: [{ i: number, ti: string }], dds: { [k: string]: string } }
```

**`it` — 621 entries, 169 distinct titles.** Ids run `-17 … 4765`, all unique.
Titles are almost entirely **English** now (`Deadly Pass`, `Big Chance
Created`, `Fouled in the opponent's half`) — the German ones the earlier probe
saw (*Fernschusstor (Bonus)*, *Pass des Todes*) are gone.

Titles repeat because the catalogue is **the same event list re-issued per game
mode / scoring variant**. `Big Chance Created` appears 18 times, `Goal
conceded` 17, `Team Goal` 15. The ids fall into blocks with wide gaps between
them:

| Block | Entries | Character |
| ----- | ------- | --------- |
| `-17 … 209` | 121 | The base scale, plus the six negative ids |
| `1742 … 1868` | 75 | Adds `Assist`, `Goal (Field player)`, `Clean Sheet (FP)`, `Time penalty` |
| `2250` | 1 | `Pass`, alone |
| `2638 … 2825` | 59 | The **game-mode** block: `Goal "PlusOne"`, `Goal "3 Play"`, `Goal "1-ON-1"`, `Goal behind "The Line"` |
| `3336 … 3593` | 116 | Splits by zone: `Cleared (in the box)` / `(outside the box)`, `Interception (in/outside the box)`, `Secondary Assist` per position |
| `3849 … 4393` | 248 | The largest — everything above folded together |
| `4765` | 1 | `Fouled in the opponent's half`, alone |

**The six negative ids are the interesting find**, and they are the only German
strings left:

| `i` | `ti` |
| --- | ---- |
| `-1` | Eingewechselt |
| `-2` | Ausgewechselt |
| `-7` | Auf Bank |
| `-8` | Von Anfang an gespielt |
| `-10` | Erste Halbzeit des Spiels beendet |
| `-17` | Zweite Halbzeit des Spiels beendet |

These are **not scoring events** — they are appearance and match-structure
markers. `-10` and `-17` are exactly the half-time and full-time moments the
[match timeline](../../docs/pages/match-detail.md) currently derives from the
fixture's own state because the `ke` of a `pi: "0"` event was never identified.
Worth a probe: read the `ke` of a match-level entry on a live
`/v4/matches/{id}/details` and see whether it is negative.

**`dds` — 9 entries, keyed `1`–`7`, `20`, `100`.** Templates for an event
card's sub-line, with placeholders:

```json
{ "1": "Assist by {assistBy}",  "2": "Forced by {forcedBy}",
  "3": "Goal by {goalBy}",      "4": "-",
  "5": "Suspended for next match day", "6": "Suspended for next match day",
  "7": "Missed by {missedBy}",  "20": "Missed by {missedBy}", "100": "-" }
```

Keys `1`, `2`, `3`, `4`, `7` sit in the same small range as the `ke`/`k` codes,
but the meanings **do not line up** with that scale (`3` is a red card there,
not a goal), so do not join them either. What indexes `dds` is still unknown.

## Still the two scales must not be crossed

Confirmed numerically here: the lowest **positive** id in `it` is `45`. None of
the `ke`/`k` codes the app actually uses — `1`, `2`, `3`, `4`, `8`, `9`, `25` —
exists in this catalogue. See [Codes](../../docs/api/codes.md#the-other-event-scale).
