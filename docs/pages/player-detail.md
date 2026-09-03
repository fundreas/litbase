# Player detail

One player, in three views.

```
/leagues/:leagueId/players/:playerId              → Details
/leagues/:leagueId/players/:playerId/performance  → Leistung
/leagues/:leagueId/players/:playerId/market       → Markt
```

Three routes, one component
([`PlayerDetailPage`](../../src/pages/PlayerDetailPage.tsx)), with the active
view read out of the URL — the same arrangement as
[Squad](squad.md) and [Duel detail](duel-detail.md), and for the same reasons:
every view is linkable, survives a refresh, and opens in a new tab on a middle
click.

Reached by tapping a row on the **Kader** tab of the squad page. There is **no
in-page back link**: the browser's own back is a system gesture on a phone and
a hardware button on Android, and an in-page chevron duplicated it while
spending the first line of a small screen.

## Why this page has a bottom bar

It is the only bottom bar in the app, and that is deliberate.
[Navigation](../routing-and-layout.md#navigation) explains why the global one
was removed: it duplicated the drawer and ate a row of height on every screen,
including the pitch that needs it most.

None of that applies here. This bar is not navigation between pages but between
three views of one player; it exists only while this page is open; and the page
is a long scroll under a thumb, which is exactly where a docked control belongs.

It is `sticky`, not `fixed`. Fixed positions against the viewport and would lie
across the sidebar at `lg` and up, where the content is a column in the middle
of the screen. Sticky keeps the bar inside that column and still rides the
bottom of the viewport while the page scrolls.

## Requests

Four, all keyed under `qk.playerDetail(leagueId, playerId)` so one
`invalidateQueries` drops the whole page. Two of them are gated on the tab that
needs them.

| Endpoint | Fetched | Carries |
| -------- | ------- | ------- |
| `/v4/leagues/{lid}/players/{pid}` | always | Profile, season totals, availability, lineup probability, **owner id** |
| `/v4/leagues/{lid}/players/{pid}/performance` | Leistung tab only | Every season, every fixture |
| `/v4/leagues/{lid}/players/{pid}/marketvalue/365` | Details + Markt | A year of daily values, purchase price, profit/loss |
| `/v4/leagues/{lid}/players/{pid}/transferHistory` | when owned | Who owns them, and since when |

The profile is the **same query key the squad page already fills** for its
lineup-probability badges (`useStartProbabilities`) and injury tooltips
(`useStatusReasons`), so arriving from a squad row usually costs no request at
all. The header renders the moment it lands, so switching tabs never blanks the
page — only the panel below waits.

### League-scoped, not competition-scoped

`/v4/competitions/{cid}/players/{pid}` returns a byte-identical body **minus
`oui`**, the owning manager. Everything on this page except ownership could
come from either; the league spelling is used throughout so one cache key
covers the lot. (The competition spelling needs no league membership, which
makes it the one to probe with.)

## Details tab

| Block | Source |
| ----- | ------ |
| Status notice | `stxt` — German prose from Kickbase, rendered verbatim |
| Marktwert card | `mv` with `tfhmvt` beneath it |
| Punkte card | `tp` with `ap` beneath it |
| Manager | `transferHistory` + `marketvalue/365` — see [Ownership](#ownership) |
| Saisonstatistik | `sec` (÷60), `g`, `a`, `y`, `r`, `cs` |
| Spiele | `mdsum` — the fixture just played and the next two |

The first two are **one card each, not two tiles**. A market value and its
24-hour move are one fact read two ways, as are a points total and its average;
splitting each pair across two bordered boxes made a row of four containers
that all looked equally important and left the reader pairing them up by eye.
The derived number sits below the thing it derives from, and only it takes the
green/red. `MarketValueCard` is shared with the Markt tab so the two lead with
the same widget.

**Zeroed counters are omitted by the API, not sent as `0`.** A player who has
not featured this season carries no `tp`, `ap`, `sec`, `g`, `a`, `y`, `r` or
`cs` at all, while one who has carries all of them including the zeroes. Every
one is optional in the DTO and defaulted in the mapper.

`pes` sits with the goalkeeper fields and is **not rendered**: the name says
"penalties scored", the company it keeps says "saved", and every player in the
probe had `0` because the season was one matchday old. The confirmed half of
that — a saved penalty — shows up as a per-match event instead.

## Leistung tab

A season picker over a list of every fixture the player's club played that
season, whether or not they took part in it.

The picker is the header itself, following
[`MatchdayPicker`](../../src/components/duels/MatchdayPicker.tsx) — the thing
you are looking at is the thing you tap. Seasons come back **oldest first** and
are reversed, so it opens on the running season.

Each row: matchday, home/away, opponent crest and name, result and W/D/L chip,
the player's role, minutes, event badges, and points.

Points read `–`, never `0`, for a match the player took no part in. `0` would
claim they were on the pitch and scored nothing, which is a different — and
much worse — thing to be told about your striker.

### Per-match status (`st`)

**A different scale to the availability `st`** described in
[Squad](squad.md#availability-st), despite the shared key. Established from the
payload's own internal agreement across 60 players' full careers:

| `st` | Meaning | How it was established |
| ---- | ------- | ---------------------- |
| `0` | Fixture not played yet | No `mp` and no `p` at all |
| `1` | Missed it, injured | Every currently-injured player probed (an ACL tear, a shoulder injury) carries it for the matchday they missed |
| `3` | Came on | All 266 observed carry `SUBSTITUTED_IN`; median 29 minutes |
| `4` | Did not play | `0'`, no points, and the player was fit — rested, doubtful or left out |
| `5` | Started | Never carries `SUBSTITUTED_IN`; the only value routinely reaching 90+ minutes |

`4` deliberately does **not** claim a place on the bench. Counting a full
squad's statuses per matchday put `3 + 4` at up to eleven players, which is
more than a bench holds — so it covers the unused substitute and the player
left out of the squad alike, and the two are not distinguishable here.

The model adds a state the wire does not have: a **starter who was taken off**.
`st` stays `5` for them and only the `SUBSTITUTED_OFF` event gives it away, so
`PlayerMatchRole` resolves `started` / `substitutedOff` / `substitutedIn` /
`substitutedInAndOff` once, centrally.

### Event codes (`k`)

Decoded by correlation, not from documentation: each code's occurrences across
a season were counted against the season totals on `/players/{id}` for 60
players. The four marked *exact* matched every player with no exceptions.

| Code | Event | Evidence |
| ---- | ----- | -------- |
| `1` | Tor | exact match with `g` |
| `2` | Eigentor | **inferred** — 8 occurrences, all defenders; no counter exposes own goals |
| `3` | Vorlage | exact match with `a` |
| `4` | Gelbe Karte | exact match with `y` |
| `5` | Gelb-Rot | never appears without a `4` beside it |
| `6` | Rote Karte | heavily negative points, player off early, and both suspended players had one |
| `7` | Elfmeter gehalten | only ever on goalkeepers |
| `8` | Eingewechselt | on all 266 matches with `st: 3` and no others |
| `9` | Ausgewechselt | only alongside a start or an `8` |
| `25` | Zu null | exact match with `cs` |

`8` and `9` are **not** drawn as badges — they say where a player was, not what
he did, and the role column already carries that. Repeats collapse: a two-assist
match is one `👟2` badge, not two identical marks.

## Markt tab

Current value and 24-hour change, a window toggle, the chart, the
twelve-month extremes, the ownership panel, and a dated list.

### One request, four windows

`/v4/leagues/{lid}/players/{pid}/marketvalue/{days}` **only answers for
`365`.** Every other value probed — 1, 7, 30, 90, 180, 366, 1000, and 0…6 as an
enum — returns HTTP 200 with an empty `it` and zeroed metadata, which is easy to
mistake for "this player has no history". So 1M / 3M / 6M / 12M are slices of
one response, not four requests.

`dt` is **days since the Unix epoch**, not a timestamp: `20698` is 2026-09-02.

### Chart and list are sampled differently

| | Density | Why |
| --- | --- | --- |
| Chart | every day in the window | A line built from every tenth point over a year loses exactly the spikes worth looking at |
| List | every `step` days — 1 / 3 / 5 / 10 | 365 rows is not a list anyone reads |

Sampling walks **backwards from today**, so the newest day is always a row
whichever window is selected. Both come from the same slice, so the two never
disagree about the period. Each row's change is that day's 24-hour move, not
the move across the step.

The chart is inline SVG rather than a library: one series, no axes to speak of,
and the smallest library that draws it is larger than the rest of the page. The
path lives in a `preserveAspectRatio="none"` viewBox so it fills any width with
no arithmetic, with `vectorEffect="non-scaling-stroke"` keeping the stroke even
despite the stretch; every label is HTML outside the SVG, because text cannot
survive that stretch. Touching or hovering anywhere on it reads out that day.

### All-time high and low

Computed from the series, **not read off `lmv`/`hmv`**. The API returns days
from before the player entered the competition as `mv: 0` and takes the plain
minimum over them, so `lmv` is `0` for anyone who joined the league inside the
last year — confirmed on two real players. The mapper strips the `mv: 0`
placeholders first and derives both ends from what is left.

### Ownership

Assembled from **three** sources, because no single one has it:

| Wanted | Where it comes from |
| ------ | ------------------- |
| Who owns them | `transferHistory` — the last entry that is not a release |
| What they paid | `marketvalue/365`'s `trp` |
| Profit / loss | `marketvalue/365`'s `prlo` |
| Market value that day | the history itself, looked up by the purchase date |
| Over- / underpay | `trp − marketValueAtPurchase` |

**`trp` means different things in the two payloads, and only one of them is a
price.** `transferHistory` reports `trp: 0` for a squad dealt out when a
manager joined; `marketvalue/365` reports the basis Kickbase actually books,
which for a real purchase *is* the fee. Verified against two live buys: a
player bought for 80.000.000 € reports exactly that, and `mv − trp` reproduces
`prlo` here and `mvgl` on the squad row to the euro.

For a player **handed out at league start** (`idp: true`, a single
`TRANSFER_TYPE.GRANTED` entry in the history) nobody paid anything — Kickbase
books the basis at that day's market value, and `prlo` stays `0`. Quoting it as
a purchase would invent a transfer, so the card says *Startkader* and the
over/underpay line is suppressed.

When the purchase predates the year of history the market value on the day is
unknowable, and the card says so rather than showing a blank cell.

`transferHistory` names the owner, but not every entry carries `unm`/`uim`. The
standings (`useRanking`) always do, so they fill the gaps.

### Transfer types (`t`)

| `t` | Meaning |
| --- | ------- |
| `0` | Handed over without a fee — the squad dealt at league start |
| `2` | Bought; the only type seen with a non-zero `trp` |
| `3` | Released back to the market; carries no `u` |

`1` and anything above `3` presumably exist — a sale back to the market is the
obvious gap — so unknown values are not guessed at.

## Team names

Opponents arrive as an id and a crest; no fixture payload carries a full name,
and there is **no `/v4/competitions/{id}/teams` endpoint** (404). `useTeamDirectory`
builds the lookup from the league table instead, which means it only knows
*this season's* clubs — a relegated side in an older season resolves to
nothing. Every consumer therefore pairs the name with the crest the payload
itself carries and treats the name as the optional half.

## States

| State | Rendering |
| ----- | --------- |
| Profile loading | `SkeletonList rows={6}` for the whole page |
| Profile failed | `ErrorState` with a retry |
| Tab loading | Header stays; `SkeletonList` in the panel |
| Tab failed | Header stays; `ErrorState` in the panel |
| No market history | `EmptyState` on the Markt tab |
| No season data | `EmptyState` on the Leistung tab |
| Fewer than two data points | The chart says so rather than drawing a dot |

## Known gaps

- **Nothing links here from the market, duel or ranking pages yet.** The route
  takes any player id in the competition, so wiring another entry point is one
  `<Link>`.
- **`pes` is unresolved** — see [Details tab](#details-tab).
- **Own goal (`k: 2`) is inferred**, not confirmed: no counter on any endpoint
  exposes own goals, so there is nothing to correlate against.
- The competition-scoped `performance` and league-scoped `performance` were
  compared byte-for-byte and are identical. If that ever diverges, the league
  one is what this page reads.
