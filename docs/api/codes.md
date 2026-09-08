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

### Match-level `ke` (`pi: "0"`)

**Match-level events use `pi: "0"`** and their `ke` codes are on a **separate
band of the same scale** — `10`–`13` and `26`, which do not collide with the
player codes above. Captured on Bremen 3-1 Leipzig (match `11947`, matchday 2,
full time) on 2026-09-05:

| Code | Event | `mt` seen | How it was established |
| ---- | ----- | --------- | ---------------------- |
| `10` | Kick-off | `0` | The only event at minute zero |
| `11` | **End of the first half** | `48` | **Named outright**: the player centre pairs it with `eti: -10`, which [eventtypes](matches.md#the-negative-ids-are-the-match-structure-scale) calls *Erste Halbzeit des Spiels beendet* |
| `12` | **?** Start of the second half | `45` | By elimination — the remaining structural marker, carrying the nominal 45 rather than a stoppage-inclusive minute |
| `13` | Full time | `96` | Last event of the feed, and its `mt` equals the match's own final `mt` |
| `26` | **Added time announced** | `45`, `90` | The only code carrying **`amn`**, the number of added minutes — `3` at 45', `6` at 90', matching the two halves' stoppage |

> **The feed is sorted by `mt` descending, not chronologically.** `ke: 12` at
> minute 45 therefore appears *after* `ke: 11` at minute 48 in the array even
> though the first half ended later than the second began by Kickbase's own
> numbering. Do not read sequence from position.

This resolves a long-standing **✗**. The app still derives kick-off, half-time
and the whistle from the fixture's own state — see
[match detail](../pages/match-detail.md#the-structural-markers) — which stays
correct, but no longer has to.

### The other event scale

[`GET /v4/live/eventtypes`](matches.md#get-v4liveeventtypes) is a **different,
much larger catalogue** — 621 entries, ids `-17` to `4765`, repeating per game
mode. Its lowest **positive** id is `45`, and none of the *player* codes in the
table above appears in it. It is **not** the `ke` scale and the two must not be
crossed — with one deliberate exception below.

Where the two scales meet is the **player centre**, whose `events[]` carries
both: `eti` on this catalogue's scale and, on structural events only, a `ke` on
the scale above. That pairing is what named `ke: 11`. See
[players.md](players.md) for the endpoint and
[the negative ids](matches.md#the-negative-ids-are-the-match-structure-scale)
for the mapping.

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
| `2` | **A deal, either direction.** With a `u`, that manager bought them for `trp`; **without one, the owner sold them back to Kickbase for `trp`**. The only type carrying a non-zero fee, whichever way it points |
| `3` | Released for nothing; carries no `u` and `trp: 0`. Observed a minute after a `GRANTED`, i.e. a manager leaving the league |

**A sale is not its own type** — that was the assumed gap, and it is not there.
`2` covers both halves and `u` is what separates them; verified on 2026-09-08
against the [activity feed](leagues.md#get-v4leaguesleagueidactivitiesfeed)'s
`t: 15` entries, which state the direction and the seller. See
[transferHistory](players.md#get-v4leaguesleagueidplayersplayeridtransferhistory).

Only these three values have been observed. `1` and anything above `3`
presumably exist, so unknown ones should render as a neutral "Wechsel" rather
than be guessed at.

## Activity type (`t`)

On the [activities feed](leagues.md#get-v4leaguesleagueidactivitiesfeed), and
the value its `filter` parameter takes. Decoded on 2026-09-07 from 620 entries
across two leagues by reading each type's `data` against what the league had
done; declared as `ACTIVITY_TYPE` in `types.ts`.

| Value | Event | `data` | Evidence |
| ----- | ----- | ------ | -------- |
| `3` | A player was put on the market | player, club, `mv` | 570 of the 620 entries; roughly one an hour, which is the market's own listing rate |
| `5` | A manager joined | `{ i, n, uim? }` | Every current member has one |
| `13` | **?** A manager left | `{ i, n, uim? }` | All three carriers had a `5` before and are no longer members |
| `15` | A transfer completed | player, `t` direction, `trp` fee, `byr` or `slr` | Matches the market page's observed sale to the second |
| `16` | **✗** | `{}` | One per league, same second as the viewer's first achievement |
| `17` | A matchday was scored | `{ day, mdln, i, pl }` — **the viewer's** placement | Timestamped the Monday after the matchday; `{}` where the viewer sat it out |
| `22` | **?** Daily login bonus (*Auflaufprämie*) | `{ bn, day }` | **Spec example only**; never observed |
| `26` | **The viewer** earned an achievement | `{ t, n, d }` | The set equals the account's earned achievements exactly |
| `28` | The league was founded | `{ lnm }` | The oldest entry of every feed |
| `34` | **?** | — | As a `filter` value it returns the `17` entries; never seen as a `t` |

## Achievement type

`t` on `/v4/leagues/{leagueId}/user/achievements` and inside a type-`26` feed
entry. The names are Kickbase's own (German with `Accept-Language: de-DE`), the
codes group by the hundred:

| Range | Family | Members |
| ----- | ------ | ------- |
| `1`–`5` | Spieltagssieger | `5` Spieltagssieger · `1`/`2`/`3` Bronze/Silber/Gold · `4` The Special One |
| `100`–`103` | Spieltagspunkte | Bronze · Silber · Gold · `103` Jahrhundertspiel |
| `200`–`204` | Saisonpunkte | Bronze · Silber · Gold · Platin · `204` Weltpokalsieger |
| `300`–`303` | A player's points | `300` Topscorer · Matchwinner · Weltklasse · Fussballgott |
| `400`–`404` | Mannschaftswert | Bronze · Silber · Gold · Platin · `404` Die Galaktischen |
| `500`–`504` | Transfers | `500` Erster Deal · Transferkönig Bronze/Silber/Gold · `504` F. Magath |
| `600`–`603` | League level | Kreisliga · Regionalliga · 2. Liga · 1. Liga |
| `700`–`704` | Transfer profit | Glückliches / Bronzenes / Silbernes / Goldenes Händchen · `704` Königstransfer |
| `900` | Managerlizenz | |
| `2001`, `2002` | Meister, Vizemeister | League champion and runner-up — `2001`'s `ac` is **how often the viewer has won the league**, see [Leagues](leagues.md#how-often-has-a-manager-won-the-league) |
| `3000` | Lange Bank | |
| `4000`, `4001` | Panini, Choreo | |
| `5001` | MVP | |
| `7502` | Tormaschine | "Deine Spieler haben die meisten Tore deiner Liga erzielt" |

The list endpoint answers `{ t, n, ac, ise }` per achievement — `ac` a counter,
`ise` whether it is earned; `…/achievements/{type}` adds `d` (description),
`er` (**?** the reward in €, `1000000` for Spieltagssieger), `dt` (when earned)
and `isrp` (**✗**). `/v4/user/achievements` without a league is `404`.

**Both paths are `/user/…` and take no `managerId`** — they only ever describe
the viewer. For anyone else, a season history has to come from
[`/managers/{managerId}/performance`](leagues.md#get-v4leaguesleagueidmanagersmanageridperformance).

## Match status (`st` on a fixture, `mst` on a match)

| Value | Meaning | Seen on |
| ----- | ------- | ------- |
| `0` | Not played | both |
| `1` | **In progress** | `st` on a fixture; `mst` on a player/team centre |
| `2` | Finished | both |
| `4` | **In progress**, some other phase (**?**) | `mst` |
| `8` | **In progress** — the value seen for most of a match | `mst` |

Captured live on 2026-09-05: the five running fixtures of matchday 2 all read
`st: 1` in `/competitions/{id}/matchdays` while the finished ones read `2` and
the evening's read `0`. On the *match* payload the same match read `mst: 8`, and
two others in the same slot read `1` and `4` minutes apart — so **`mst` is a
richer scale than `st` and its in-play values are not a single code.**

The safe test either way is `=== 2` for finished and `=== 0` for not started,
never "not 0 means running".

**The app still decides "is this match running" from the clock**, not from
`st: 1` — deliberately. `st` is what
[the live development profile](../../src/dev/simulation.ts) rewrites to replay a
played matchday, and a clock reading is what lets it; a page that trusted `st: 1`
would be untestable outside the few hours a week a real match is on.

`mdst` on a fixture summary uses the same scale.

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
