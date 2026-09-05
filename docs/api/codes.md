# Codes and enums

[← API index](README.md)

Every numeric code the payloads use, in one place, because most of them appear
in four or five different responses and none of them is documented by Kickbase.
The declarations live in [`src/api/types.ts`](../../src/api/types.ts).

Confidence markers are as in the [index](README.md#confidence): no marker =
confirmed, **?** = assumption, **✗** = unknown.

## Position (`pos`)

On every player payload.

| Value | Position | German |
| ----- | -------- | ------ |
| `1` | Goalkeeper | TW |
| `2` | Defender | ABW |
| `3` | Midfielder | MF |
| `4` | Forward | ANG |

## Availability (`st`, and the entries of `stl`)

On squad rows, market listings, player detail and team-center entries. **Not**
the same scale as `st` on a per-match performance entry — see
[below](#match-involvement-st-on-a-performance-entry).

Probed live across all 18 Bundesliga squads (467 players) and cross-checked
against the German `stxt` each one carries:

| Value | Name | `stxt` seen on it |
| ----- | ---- | ----------------- |
| `0` | Fit | *(none)* |
| `1` | Injured | "Schulterverletzung – fällt 2-3 Wochen aus" |
| `2` | Doubtful — training individually | "Nach muskulären Problemen – verpasst M05 (H)" |
| `4` | Building up after injury | "Nach Fußverletzung – absolviert erste Laufeinheit" |
| `8` | **?** Suspended | *(none)* — both players carrying it had been sent off in their club's last fixture |

`stl` is the same information as a list; every player observed had at most one
entry in it. **Codes above 8 exist** — the spec's own examples show `st: 128`
on squad rows, which nothing has decoded (**✗**) — so anything unrecognised
must fall back to `stxt`, which the API always supplies for a player who is not
fit.

## Match involvement (`st` on a performance entry)

On [`/players/{id}/performance`](players.md#get-v4leaguesleagueidplayersplayeridperformance)
only. A different scale to availability despite the shared key name,
established from the payload's own internal agreement:

| Value | Name | How it was established |
| ----- | ---- | ---------------------- |
| `0` | Fixture not played yet | Carries no `mp` and no `p` at all |
| `1` | Missed through injury | Every currently-injured player probed carries it for the matchday they missed |
| `3` | Came on as a substitute | All 266 observed carry `SUBSTITUTED_IN`; median 29 minutes |
| `4` | Did not play — bench *or* not in the squad | Rested/doubtful/left-out players carry it. `3 + 4` reached more than eleven per matchday, so it cannot mean "bench" alone; the two cases are **not distinguishable** |
| `5` | Started | `SUBSTITUTED_IN` never appears on it, and it is the only value whose minutes routinely reach 90+ |

## Match events (`k`, and `ke`)

`k` on a performance entry lists what happened to the player in that match.
`ke` on a [match's live `events` feed](matches.md#get-v4matchesmatchiddetails)
turned out to use the **identical scale** — verified on a finished 5:1 whose
feed held five `1`s and a `2`, four `4`s and ten `8`s.

Decoded by correlation, not from documentation: season counters on
`/players/{id}` (`g`, `a`, `y`, `r`, `cs`) were compared against how often each
code appears across the same season for 60 players.

| Code | Event | How it was established |
| ---- | ----- | ---------------------- |
| `1` | Goal | Exact match with `g`, every player, no exceptions |
| `2` | **?** Own goal | 8 occurrences, all defenders. No counter exposes own goals, so nothing could confirm it |
| `3` | Assist | Exact match with `a` |
| `4` | Yellow card | Exact match with `y` |
| `5` | Second yellow | Never appears without a `4` beside it |
| `6` | Red card | Heavily negative points, player off early, and both suspended players had one in their last match |
| `7` | Penalty saved | Only ever on goalkeepers |
| `8` | Substituted on | Present on all 266 matches with `st: 3` and on no other |
| `9` | Substituted off | Only ever alongside an `8` or a start, never on a non-appearance |
| `25` | Clean sheet | Exact match with `cs` |

**Match-level events use `pi: "0"`** — kick-off, half-time, the whistle — and
their `ke` codes are *not* on this scale and have not been identified (**✗**).
The app drops them and derives those three moments from the fixture's own
state; one probe reading the `ke` of a `pi: "0"` entry would settle it.

### The other event scale

[`GET /v4/live/eventtypes`](matches.md#get-v4liveeventtypes) is a **different,
much larger catalogue** — 621 entries running into the thousands and repeating
per game mode, from *Fernschusstor (Bonus)* to *Pass des Todes*. It is what a
points-breakdown view would need. It is **not** the `ke` scale and the two must
not be crossed.

## Market-value trend (`mvt`)

| Value | Meaning |
| ----- | ------- |
| `0` | Flat |
| `1` | Up |
| `2` | Down |

The *direction* only. The amount lives in `tfhmvt` (24 hours) and `sdmvt`
(seven days), and only on some payloads — which is why the market page pays a
fan-out for it (see [Market](market.md#the-24-hour-change)).

## Transfer type (`t`)

On [`/players/{id}/transferHistory`](players.md#get-v4leaguesleagueidplayersplayeridtransferhistory).

| Value | Meaning |
| ----- | ------- |
| `0` | Granted — handed to a manager without a fee, the squad dealt at league start |
| `2` | Bought. The only type observed with a non-zero `trp` |
| `3` | Released back to the market; carries no `u`, because nobody received them |

Only these three have been observed. `1` and anything above `3` presumably
exist — a sale back to the market is the obvious gap — so unknown values should
render as a neutral "Wechsel" rather than be guessed at.

## Match status (`st` on a fixture, `mst` on a match)

| Value | Meaning |
| ----- | ------- |
| `0` | Not played |
| `2` | Finished |

Other values presumably exist for "in progress" (**?**); none has been
captured, which is why the app decides "is this match running" from kick-off
time and the final-whistle flag rather than from a status code.

`mdst` on a fixture summary uses the same two values.

## Game modes (`gpm`)

From the values `gamePlayMode` actually filters on. `3` returns nothing and `5`
is ignored, so only these four are real. **The labels are inferred from the
league names each filter returns** — nothing in `/v4/config` names them, which
was probed.

| Value | Label | Evidence |
| ----- | ----- | -------- |
| `0` | Beginner | "liga Anfänger" |
| `1` | Classic — the default | The Kickbase default mode |
| `2` | High management | "High-Management" |
| `4` | Arena | Large open leagues |

## Lineup probability (`prob`)

A **per-player tier, 1..5, lower is more likely**. Undocumented, and the one
lineup-probability field that actually varies per player. Verified against the
badges drawn inside the `plpim` poster:

| `prob` | Poster badge | Meaning |
| ------ | ------------ | ------- |
| `1` | Blue star | Sicher dabei |
| `2` | Green check | Wahrscheinlich |
| `3` | Orange ? | Fraglich |
| `4` | Red ! | Unrealistisch |
| `5` | Black ✕ | Ausgeschlossen |

**`plpim` is not a per-player icon.** Despite the name and despite what the
community documentation suggests, it is a 1280×1809 Ligainsider graphic of the
**whole projected XI**, identical for every player at the same club — probed
live on 2026-09-03, and `GET /v4/base/predictions/teams/{competitionId}` serves
the very same hashes keyed by `tid`. Rendering it per player shows the same
picture 25 times.

Both fields are a **Membership feature**, supplied by Ligainsider (`plpt`)
rather than by Kickbase. An account without Membership, the off-season, and a
player nobody has assessed yet all produce neither field — indistinguishable on
the wire, and all of them the normal case rather than an error.

## Formations

The ten `type` values [`POST /lineup`](squad-and-lineup.md#post-v4leaguesleagueidlineup)
accepts. Anything else — `"5-3-1"`, `"2-1-0"`, `""` — is rejected, so even a
partial lineup has to be declared inside a legal formation that can hold it.

`3-4-3` · `3-5-2` · `3-6-1` · `4-2-4` · `4-3-3` · `4-4-2` · `4-5-1` · `5-2-3` ·
`5-3-2` · `5-4-1`

## Recurring keys that are still unknown

Fields that turn up across several payloads and have resisted decoding:

| Key | Seen on | Status |
| --- | ------- | ------ |
| `ictp` | Lineup overview, team center, `myeleven` | **✗** — boolean, `false` on everything observed |
| `lst` | Squad rows, manager squad, lineup overview | **✗** — observed `0` and `1`; not the lineup slot, which is `lo` |
| `iposl` | Market listings, player detail | **?** "Is position locked" — `false` on every listing observed |
| `pes` | Player detail, competition players | **?** Penalties — but *which side*: it sits in the goalkeeper group beside `cs`, arguing for "saved", while the name argues for "scored". Every player probed had `0`. Deliberately not rendered |
| `vr` | League selection, league list | **✗** — verification tier, presumably paired with `isvf` |
| `hum` | League list | **?** `true` on arena-mode leagues |
| `sl`, `smc`, `ismc`, `smdc`, `stud` | Player detail | **✗** — integers and a boolean, unmapped |
| `flags`, `notifications`, `perms` | User payloads | **✗** — bitfields |
