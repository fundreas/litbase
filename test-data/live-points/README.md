# Where live per-player points actually come from

Captured **2026-09-05, 14:12–14:18 UTC**, matchday **2**, five Bundesliga
matches at ~37–40 minutes and one already finished. League `90000001`, user
`1000001`.

> **These payloads are scrubbed.** This repository is public, and the raw
> teamcenter responses carry the league's members — five user ids, their
> display names and their matchday scores, four of them people other than the
> repo's owner. Every league-member id was rewritten to `100000N` and every
> display name to *Manager A…E*, consistently across all files, and the league
> id to `90000001`. **Player data is untouched** — those are public Bundesliga
> footballers and they are the point of the capture. No token is stored here.
> Nothing the analysis below rests on was changed: the ids are opaque
> throughout, and every number quoted is a player's or a match's.

Answering: why do duel-detail and squad › live show `–` for every player?

## The short answer

**Neither `/players/{id}` nor `/players/{id}/performance` carries points while a
match is running.** They gain them only after the final whistle. The only field
that moves during a live match is **`lp[].p` on `teamcenter`** — and it does
*not* settle to the final value afterwards.

| Source | During the match | After the whistle |
| ------ | ---------------- | ----------------- |
| `/players/{id}` → `ph[0]` | `{"hp": false}` — **no `p` key at all** | `{"hp": true, "p": -14}` |
| `/players/{id}` → `tp` | last completed matchday only | updated |
| `/performance` → current `ph[]` entry | `p: null`, `mp: "0'"`, `mdst: 1` | `p: -14`, `mp: "20'"`, `mdst: 2` |
| `teamcenter` → `lp[].p` | **moves**, every ~90s | freezes, **and disagrees** |

So the `–` is not a bug in the index arithmetic — `ph[0]` genuinely has no `p`
during the match, and the app has nothing to render.

## The three questions

### 1. During a live match, does `ph[0]` carry a `p`, and is `hp` true or false?

**No `p`, and `hp` is `false`.** Baku (`2141`, Leipzig, match `11947` live at
37'), unchanged across three samples 90 seconds apart:

```json
"ph": [{"hp": false}, {"hp": true, "p": 233}]
```

Cross-checked against `/performance`, which carries an explicit `day`: matchday
1 was `p: 233`, matchday 2 is `p: null`. So `ph[0]` **is** the live matchday and
it is empty — confirming newest-first ordering, and confirming that `hp` means
"has points", not "has played". Baku is on the pitch and `hp` is `false`.

Rönnow (`2279`, Union Berlin, live) is the same with no history to speak of:
`[{"hp": false}, {"hp": false}]`, `tp: null`.

### 2. Does the payload's top-level `day` equal `ph.length`?

**Yes, right now.** `day: 2`, `ph.length: 2` — for Baku, Rönnow and Heskey
alike. Note this is the weakest of the three findings: with only two matchdays
played, `day` and `ph.length` cannot yet be told apart by observation. It
confirms nothing about which one leads at a matchday boundary.

### 3. Does teamcenter's per-player `p` move during a live match?

**Yes, and in both directions.** Four samples across six minutes:

| Player | Club live? | 13:57 | 14:14 | 14:16 | 14:17 |
| ------ | ---------- | ----- | ----- | ----- | ----- |
| Uduokhai | ✔ | 31 | 39 | 44 | 44 |
| Baku | ✔ | 48 | 51 | 51 | **49** |
| Rönnow | ✔ | 59 | 58 | 58 | 60 |
| Philippe | ✔ | 33 | 33 | 32 | 32 |
| Quansah | ✔ | 21 | 23 | 23 | 23 |
| Heskey | ✗ (finished) | -8 | -8 | -8 | -8 |
| Andrich, Vermeeren, Prates, De Cat | ✔ | `null` | `null` | `null` | `null` |

It ticks, and it can go **down** — so anything built on it has to tolerate a
non-monotonic value. `p` is `null` for players in a live match who are not
accruing (bench, not in the squad), so `null` is not "no data yet".

> ## Corrected after the fact
>
> Two things below were wrong, both established by probes run after this
> capture (see `0cc13b1` and the section at the end).
>
> 1. **The live source is neither of the two endpoints in the table.** It is
>    `GET /v4/leagues/{leagueId}/playercenter/{playerId}?dayNumber=N`, which
>    carries a running `p` for any player, owned or not, plus a full `events[]`
>    breakdown. This capture simply never probed it.
> 2. **"Teamcenter is the wrong one after full time" is too strong.** It is
>    unreconciled, as measured — but Kickbase is still counting the -8: the
>    fielded eleven's teamcenter `p` sums to the `mdp` published in the same
>    payload (291 vs 291, then 430 vs 430). So during a matchday the running
>    tally *is* the official number, and a page showing `ph`'s -14 early makes
>    its own rows stop adding up to the header total. The precedence flip is
>    **by matchday, not by match** — and the two sources converge once
>    everything is settled (matchday 1 returned 50 from both).
>
> Everything else below stands as measured.

## The -8 vs -14 disagreement, resolved

`useMatchdaySquad.ts` flags teamcenter's `p` as disagreeing with `ph` by -8 vs
-14. Both numbers are real, and **teamcenter is the wrong one**. Heskey
(`15373`), whose match had already finished at capture time:

| Source | Value |
| ------ | ----- |
| `teamcenter` `lp[].p` | `-8` — in all four samples, frozen |
| `/players/15373` `ph[0]` | `{"hp": true, "p": -14}` |
| `/players/15373` `tp` | `-14` |
| `/performance` day 2 | `p: -14`, `mp: "20'"`, `mdst: 2` |

Three sources say -14 and only teamcenter says -8. **Teamcenter's `p` is a live
running tally that is not reconciled to the settled score while the matchday is
still in progress** — but see the correction above: it is the number Kickbase
itself is totalling in the meantime, so it is not simply wrong. The switch to
`ph` happens when the whole **matchday** settles, not when this one match ends.
Marking that `p` merely "unconfirmed" in
[squad-and-lineup.md](../../docs/api/squad-and-lineup.md) understated it either
way; it is now stated there with the `mdp` arithmetic behind it.

## Files

| File | What |
| ---- | ---- |
| `teamcenter-day2.json` | First sample, 13:57 |
| `teamcenter-day2-t{0,1,2}-*.json` | Three more, 90s apart |
| `player-2141-baku.json` · `-performance.json` | Live player, played MD1 |
| `player-2141-t{0,1,2}-*.json` | The same player over the same window — identical throughout |
| `player-2279-roennow.json` · `-performance.json` | Live player, no MD1 points |
| `player-15373-heskey.json` · `-performance.json` | Match already finished — the -8/-14 case |
| `playercenter-2141-day2.json` | **The actual live source**, captured at full time |
| `match-11947-details.json` | The event feed that identified the `pi: "0"` codes |

No token is stored here.

## The follow-up probes

Two questions this capture left open were settled afterwards on the same
matchday.

**The per-event breakdown exists.** `playercenter-2141-day2.json` holds 129
`events[]` entries, each with an `eti` and the `p` that action was worth. They
sum to **239 — exactly the player's matchday `p`**. 123 of the 129 `eti`
resolve against `/v4/live/eventtypes`; all six that do not are structural
markers worth `p: 0`. Every `eti` came from the catalogue's `3849…4393` block.
`ddi` on an event indexes the catalogue's `dds` map — observed `ddi: "100"` on
the goal.

**The `pi: "0"` codes are identified.** The player centre pairs negative `eti`
with a `ke`, and the catalogue names one of them outright, which pins the rest
by minute. Cross-checked against `match-11947-details.json`, whose six
match-level events carry exactly the same codes and minutes:

| `ke` | `eti` | `mt` | Meaning |
| ---- | ----- | ---- | ------- |
| `10` | `-9` | `0` | Kick-off |
| `12` | `-11` | `45` | **?** Start of the second half |
| `26` | `-20` | `45`, `90` | Added time — carries `amn` (`3`, then `6`) |
| `11` | `-10` | `48` | End of the first half — *named by the catalogue* |
| `13` | `-12` | `96` | Full time |

Note `-17`, which the catalogue names as the end of the second half, never
appeared; the real event used `-12`. Treat the catalogue as an incomplete index
of the negative ids.

**The feed is sorted by `mt` descending, not chronologically** — verified by
reading all 20 events of match `11947` in delivery order.

## Caveats

- One matchday, one league, one six-minute window. The switch-at-the-whistle
  rule is inferred from a single finished match (Heskey) and should be
  re-checked at full time on a match watched across the transition.
- Whether teamcenter's `p` is per-lineup-slot rather than per-player was not
  tested; a player benched mid-matchday might behave differently again.
