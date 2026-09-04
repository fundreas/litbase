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

[Navigation](../routing-and-layout.md#navigation) explains why the *global*
bottom bar was removed: it duplicated the drawer and ate a row of height on
every screen, including the pitch that needs it most.

None of that applies here. This bar is not navigation between pages but between
three views of one player; it exists only while this page is open; and the page
is a long scroll under a thumb, which is exactly where a docked control belongs.
The [squad page](squad.md#the-bottom-bar) docks one on the same terms, and both
use [`BottomTabBar`](../../src/components/ui/BottomTabBar.tsx).

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
| `/v4/leagues/{lid}/players/{pid}/performance` | Details + Leistung | Every season, every fixture |
| `/v4/leagues/{lid}/players/{pid}/marketvalue/365` | Details + Markt | A year of daily values, purchase price, profit/loss |
| `/v4/leagues/{lid}/players/{pid}/transferHistory` | when owned | Who owns them, and since when |

The performance history is the page's largest response — a twelve-season career
runs to about 110 kB uncompressed — and Details needs it for three things: the
[current-matchday strip](#current-matchday-strip), the points and minutes on
the Spiele rows, and the appearance count. Only the Markt tab, which uses none
of it, goes without.

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

## Header

Shared by all three tabs, so a market chart is never a chart of nobody.

The **club is a 56 px crest at the far right, with no name beside it**. A
Bundesliga crest is the most recognisable thing about a club and at that size is
read faster than its name, so spelling the name out next to it spent a line of a
phone-width header saying the same thing twice. The name survives as the
image's `alt` and as the initials the fallback draws when the crest fails to
load. (It used to ride at the end of a 12 px meta row in the same grey as
everything else, which for a page whose whole subject is one footballer made his
club the quietest thing on it; the crest-only treatment is the other end of that
correction.)

The **position is the abbreviation** — `MF`, not `Mittelfeldspieler` — in a chip
on the given-name line, `POSITION_LABEL` being the form every squad row and pitch
tile already uses. The spelled-out name was long enough to push the given name
off a phone-width line; it stays as the chip's `title`.

### The lineup poster

The probability chip is rendered **on the Details tab only**. It is a statement
about the *next* matchday, and above a career points history or a market-value
chart — both of them about what has already happened — it read as one more
number on the page rather than the thing it is. Details is where someone goes to
ask "does he play?", so that is where the poster stays a tap away.

The **probability chip opens Ligainsider's projected starting eleven** for the
player's club, full screen.

`plpim` is a 1280×1809 poster of the whole team, not a per-player icon: every
player at a club carries the identical hash — verified live, Kimmich and
Musiala return the same file and four other clubs return four different ones —
and `GET /v4/base/predictions/teams/{cid}` serves the same hashes keyed by
`tid`. An earlier attempt to use it as a corner badge on a portrait therefore
put the same unreadable thumbnail on all 25 players at a club, and was
rightly dropped. At full size it is a different proposition: the projected XI
with a tier badge beside every name — including the `prob` this very chip
displays, which is read off that poster. So the chip is the way in, and the
poster gets the whole screen.

**Fit, then zoom.** It opens fit to the screen so the shape of the formation
reads first; tapping the image switches to natural width inside a scroll
container. That second step is what makes the names legible on a phone — 1280 px
of poster in a 390 px viewport is a third of a pixel per pixel, and no amount of
`object-contain` fixes it. Native pinch-zoom still works on top, and the zoom
resets on close so reopening never drops you into the middle of a poster with no
idea where you are.

**The image is the only control.** A zoom button in the bar said the same thing
twice on a screen holding exactly one tappable object: the cursor already turns
to a magnifier on a pointer device, and on a touch screen a full-bleed photo is
something people pinch and tap without being asked.

The dialog is `fixed inset-0` rather than the app's usual centred card: it is
one large image and nothing else, and a padded panel would spend the width that
is the entire point.

**The chip is a button only when there is a poster.** `plpim` is absent for an
account without Membership, in the off-season, and for a club nobody has
assessed — all normal, none an error — so it degrades to the static label it
was before.

### Current matchday strip

Under the identity, and **only while the matchday is actually being played**.
It answers three questions with one strip: has he played, is he playing, and if
not yet — when.

"Being played" is the schedule's own reading — `matchdayState` is `live`: the
first kick-off of the matchday has passed and not every fixture reports
finished. Between matchdays the strip would be a permanent line in the header
saying nothing the Spiele card does not already say. His own club may kick off
later that weekend, which is why all three states below stay reachable while
the matchday is live. The matchday list is the same cache entry the squad page
fills, so the check costs no request.

The fixture itself is the profile's `mdsum` entry with `cur: true`.

| State | Left | Right |
| ----- | ---- | ----- |
| Upcoming | `Sa, 5. Sep. · 18:30` | the matchday number |
| Running | pulsing dot, *Läuft*, accent-tinted card | points so far |
| Finished | the role marks (`S11`, →, ←) plus minutes and event badges | points |

**"Läuft" is inferred from the clock, not reported.** No observed field
distinguishes a match in progress: fixtures carry `mdst`, and only `0` (not
played) and `2` (finished) have ever been seen. Kick-off having passed on an
unfinished fixture is what live means here — the same reading `fixtureState`
uses across the app, which was widened to accept a `PlayerMatch` rather than
gaining a near-identical twin. There is no live *minute* either: Kickbase
serves minutes played only once the match is over, so a running match shows its
points and stays quiet about the clock.

The fixture comes from the profile, so the strip appears with the rest of the
header; the points and minutes inside it fill in when the performance request
lands.

## Details tab

| Block | Source |
| ----- | ------ |
| Status notice | `stxt` — German prose from Kickbase, rendered verbatim |
| Marktwert card | `mv` with `tfhmvt` beneath it |
| Punkte card | `tp` with `ap` beneath it |
| Manager | `transferHistory` + `marketvalue/365` — see [Ownership](#ownership) |
| Saisonstatistik | `sec` (÷60), `g`, `a`, `y`, `r`, `cs`, plus appearances in the header |
| Spiele | the days `mdsum` names, rendered as full match rows |

**Spiele are the same rows as the Leistung tab.**
[`PlayerMatchRow`](../../src/components/player/PlayerMatchRow.tsx) is shared, so
a match never looks like a different kind of thing depending on which tab you
found it on — and the played ones carry points, minutes, role and event badges
rather than just a scoreline. `mdsum` says *which* fixtures ("around now": the
one just played and the next two) and the season's performance list supplies
the detail, matched by matchday. The card is a skeleton until that lands, not a
list that grows numbers a second later. A day the performance list has no entry
for falls back to a fixture-only row of the same shape.

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
[`MatchdayPicker`](../../src/components/MatchdayPicker.tsx) — the thing
you are looking at is the thing you tap. Seasons come back **oldest first** and
are reversed, so it opens on the running season.

Each row: matchday, home/away, opponent crest and name, result and W/D/L chip,
the player's role, minutes, event badges, and points.

Points read `–`, never `0`, for a match the player took no part in. `0` would
claim they were on the pitch and scored nothing, which is a different — and
much worse — thing to be told about your striker.

### The season picker

The header is the control, as on the [duels page](duels.md#the-matchday-picker):
tap the season you are looking at and the full list opens in a drawer. Flanking
it are `‹` and `›` from
[`StepButton`](../../src/components/ui/StepButton.tsx), because stepping one
season is what the control is mostly used for, and a drawer is a lot of
ceremony for that.

**The arrows are chronological, the array is not.** `seasons` comes back newest
first, so the *older* season is the next index **up** — the two steps are
crossed over relative to the array so that left always means back in time, the
way it does on the matchday picker. They disable at the ends of a player's
career rather than disappearing, so the label beside them does not shift.

### The points scale

Kickbase points have no natural ceiling and no scale a newcomer knows: 87 is a
quiet afternoon, 340 is the best game of someone's season, and nothing about
the digits says which. So the figure is **coloured**, and a bar along the
bottom edge of the card repeats the same colour at the same width.

| Points | Band | Colour |
| ------ | ---- | ------ |
| `< 0` | `negative` | red |
| `0`–`99` | `low` | white |
| `100`–`199` | `good` | lime |
| `200`–`299` | `strong` | green |
| `300`+ | `elite` | gold |

Boundaries are **inclusive at the bottom** — 100 is already lime — so a score
sitting exactly on one reads as the achievement it just reached rather than the
one it just left. The ramp is deliberately not dark→bright: white is the
unremarkable middle, and the top band is gold because a 300-point game is a
trophy, not just more green. Colours are literals rather than theme tokens, for
the reason the probability badge uses literals: five steps, and the palette has
one green, one red and one amber.

The bar's scale is **the player's own career best, or 150, whichever is
larger** (`pointsScaleFor`). A shared scale would flatten most players into a
stub — a defender topping out at 120 never filling a bar sized for a striker's
400 — so each is measured against himself; the 150 floor stops the reverse,
where a season best of 40 would draw a full bar and read as a triumph. It is
taken across **every** season, so switching seasons does not silently rescale
the bars underneath you.

A **negative score does not grow the bar**: it gets a short fixed marker
instead. Scaling by magnitude would draw a long bar for a bad game, and a long
bar reads as good however it is coloured — the red figure beside it carries the
amount. Rows for matches that were never played get no bar at all rather than
an empty track.

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

`4` deliberately does **not** claim a place on the bench, and the row shows no
bench mark for it. Counting a full roster's statuses per matchday — with each
player's club resolved from `pt`, so nobody who spent that season at an
opposing club is miscounted — puts `3 + 4` at **eleven players on seven of
thirty-four matchdays**, and a Bundesliga bench holds nine. So `4` covers the
unused substitute and the player left out of the squad alike, and nothing in
any payload separates them. An armchair icon would tell the reader his striker
was among the substitutes on days he was not in the squad at all.

The model adds a state the wire does not have: a **starter who was taken off**.
`st` stays `5` for them and only the `SUBSTITUTED_OFF` event gives it away, so
`PlayerMatchRole` resolves `started` / `substitutedOff` / `substitutedIn` /
`substitutedInAndOff` once, centrally.

On the row those become **marks, not words**:

| Role | Mark |
| ---- | ---- |
| Started | `S11` chip |
| Started, then taken off | `S11` ← (red) |
| Came on | → (green) |
| Came on, then taken off | → ← |
| Did not feature | ✕ |
| Out injured | *Verletzt* |

The row already holds an opponent, a scoreline, minutes, event badges and a
points total, and "Startelf" and "Ausgewechselt" — nine and thirteen
characters — pushed the badges off the end of a phone. The marks also compose,
which the words do not: a starter taken off keeps the chip *and* gains the
arrow. The pair is **horizontal, green on and red off** — a player walks on from
the touchline and off to it, so left/right reads as a substitution where up/down
(what these were first drawn as) reads as promotion and demotion. It is the
shared `SwapMark`, so the same arrow means the same thing on a
[match](match-detail.md) timeline and lineup. Only an injury is still spelled out; it is the one non-appearance with a
cause, and the cause is why the reader is looking. Full wording stays in the
tooltip and the accessible name throughout.

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
match is one badge with a `2` on it, not two identical marks.

### One mark per statistic

[`statGlyphs.tsx`](../../src/components/player/statGlyphs.tsx) owns the marks,
and everything that counts a thing uses the same one: the badge on a match row,
the cell in Saisonstatistik, and the season summary under the picker. A reader
who learns that a ball means a goal on a row should not meet a second symbol
for the same idea three cards further down, and a season total that disagreed
visually with the rows it sums would read as a different statistic.

Cards are literal rectangles rather than icons — a yellow card *is* a yellow
rectangle, and Gelb-Rot is drawn as the two halves it is so it cannot be
mistaken for either card alone. Everything else is a lucide glyph, which stays
crisp at 11 px and takes its colour from a theme token. In the stat grid the
mark sits on the *label* line, not beside the figure: next to the values it
made the numbers themselves hard to compare across a row.

## Markt tab

Current value and 24-hour change, a window toggle, the chart, the twelve-month
extremes, and a dated list.

**No manager panel.** It had one, repeating the Details tab's Manager card a
scroll further down; ownership lives in one place now. See
[Known gaps](#known-gaps) for the two figures that went with it.

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

## Ownership

Shown on the Details tab as the **Manager card**: the manager on the left, the
purchase price as the figure on the right, the running profit or loss under it,
and nothing else. It is one line by request — a breakdown of the purchase under
it made a summary into a panel.

The model still computes more than the card shows —
`marketValueAtPurchase` and `purchasePremium` — because the arithmetic is the
interesting part and the wiring is done; nothing renders them at the moment.
See [Known gaps](#known-gaps).

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

## Transfer types (`t`)

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

- **The market value at purchase, and the over/underpay it implies, are
  computed but not rendered anywhere.** They were the Markt tab's manager
  panel, which was removed as a duplicate of the Details card; the Details card
  is deliberately one line. `PlayerOwnership.marketValueAtPurchase` and
  `purchasePremium()` are still there and still correct, so putting them back
  — a third line on the Manager card, or a marker on the chart at the purchase
  date, which is where they would arguably read best — is a rendering change
  only.
- **Nothing links here from the market, duel or ranking pages yet.** The route
  takes any player id in the competition, so wiring another entry point is one
  `<Link>`.
- **`pes` is unresolved** — see [Details tab](#details-tab).
- **Own goal (`k: 2`) is inferred**, not confirmed: no counter on any endpoint
  exposes own goals, so there is nothing to correlate against.
- The competition-scoped `performance` and league-scoped `performance` were
  compared byte-for-byte and are identical. If that ever diverges, the league
  one is what this page reads.
