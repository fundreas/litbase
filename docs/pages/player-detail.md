# Player detail

One player, in four views.

```
/leagues/:leagueId/players/:playerId              → Details
/leagues/:leagueId/players/:playerId/performance  → Leistung
/leagues/:leagueId/players/:playerId/market       → Markt
/leagues/:leagueId/players/:playerId/transfers    → Transfers
```

Four routes, one component
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
four views of one player; it exists only while this page is open; and the page
is a long scroll under a thumb, which is exactly where a docked control belongs.
The [squad page](squad.md#the-bottom-bar) docks one on the same terms, and both
use [`BottomTabBar`](../../src/components/ui/BottomTabBar.tsx).

It is `sticky`, not `fixed`. Fixed positions against the viewport and would lie
across the sidebar at `lg` and up, where the content is a column in the middle
of the screen. Sticky keeps the bar inside that column and still rides the
bottom of the viewport while the page scrolls.

## Requests

Five, all keyed under `qk.playerDetail(leagueId, playerId)` so one
`invalidateQueries` drops the whole page — which is exactly what every write on
the [seller panel](#what-the-owner-can-do) does. Four of them are gated on the
tab that needs them.

| Endpoint | Fetched | Carries |
| -------- | ------- | ------- |
| `/v4/leagues/{lid}/players/{pid}` | always | Profile, season totals, availability, lineup probability, **owner id** |
| `/v4/leagues/{lid}/players/{pid}/performance` | Details + Leistung | Every season, every fixture |
| `/v4/leagues/{lid}/players/{pid}/marketvalue/365` | everywhere but Leistung | A year of daily values, purchase price, profit/loss |
| `/v4/leagues/{lid}/players/{pid}/transferHistory` | when owned, and on Transfers | Every hand the player has passed through, all seasons — [cut to this one](#the-season-cut-and-why-it-is-1-july) in the mapping |
| `/v4/leagues/{lid}/players/{pid}/transfers` | on Transfers, **for one's own player** | Whether he is listed, at what, and the bids standing on him — polled at 30 s while a listing stands |
| `/v4/leagues/{lid}/playercenter/{pid}?dayNumber=&seasonId=` | on opening a [match breakdown](#the-match-breakdown) | Every scoring action of one match, and what each was worth |
| `/v4/live/eventtypes` | with the first breakdown | Names for all 621 event types. One shared entry, cached for a day |

The performance history is the page's largest response — a twelve-season career
runs to about 110 kB uncompressed — and Details needs it for three things: the
[current-matchday strip](#current-matchday-strip), the points and minutes on
the Spiele rows, and the appearance count. The two tabs that use none of it,
Markt and Transfers, go without.

The market values are the opposite case: **three tabs want them**, because a
fee only means something next to what the player was worth the day it was paid.
One cache entry serves the chart, the owner panel and every row of the
transfer list.

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

Shared by all four tabs, so a market chart is never a chart of nobody.

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

### The match breakdown

**Tapping a match he played opens every scoring action Kickbase credited him
with in it**, and what each was worth —
[`PlayerMatchEventsDialog`](../../src/components/player/PlayerMatchEventsDialog.tsx).

This is the one number on the page that could never be explained. A defender's
239 is arrived at through a hundred and eleven small things — a pass into the
final third, a possession lost, a goal conceded, and once in a while the goal
itself — and none of them were anywhere in the app. Kickbase serves the lot:
`events[]` on the [player centre](../api/players.md#get-v4leaguesleagueidplayercenterplayerid),
per action and per minute, named through the
[event-type catalogue](../api/matches.md#get-v4liveeventtypes).

```
┌──────────────────────────────────────────┐
│ (crest) ✈ Leipzig 1:3                 →  │  the header, a link to the match
│         2. Spieltag · 238 Punkte     [✗] │
├──────────────────────────────────────────┤
│   0′  Startelf                       +5  │
│   1′  Geklärt (außerhalb 16er)       +3  │  scrolls
│   3′  Ballverlust                    −1  │
│       Tor kassiert                   −5  │  ← minute printed once per moment
│   5′  Pass gegn. Hälfte              +1  │
│  94′  Tor (ABW)                    +100  │
│  96′  Spiel verloren                −15  │
│       Minutenbonus                  +10  │
├──────────────────────────────────────────┤
│  5 nachträgliche Korrekturen …           │
└──────────────────────────────────────────┘
```

**The names arrive in German**, and for free: the catalogue is localised from
the `Accept-Language` the [client](../../src/api/client.ts) already sends, so
`4240` is *Ballverlust* here and *Possession lost* to an English client. Nothing
in the app translates anything — worth knowing before someone starts a lookup
table.

**It adds up, exactly.** The rows sum to the total in the header — 111 rows
against a stated 239, checked — which is what makes it worth drawing rather
than a selection of highlights. Getting there takes three rules, all in
[`toPlayerMatchBreakdown`](../../src/api/hooks/usePlayerMatchEvents.ts):

1. **Reversals are netted out.** Kickbase re-scores by *appending a correction*
   rather than editing, so a raw breakdown says *Ball intercepted +5* and *Ball
   intercepted −5* a line apart — its revision history, not an account of the
   match. Pairs are dropped **only when they negate exactly**, which is what
   keeps the total provably unchanged; the footnote says how many went.
2. **Zero-point entries go.** All eight in the probed match were the fixture's
   own structure — kick-off, the halves, added time, full time, and whether he
   started or sat on the bench. The row that opened the dialog already says how
   he played.
3. **Earliest first.** The payload is ordered by `ei` descending, which is
   neither chronological nor anything else useful — minutes ran 1, 1, 1, 70, 96
   in the first five entries. A finished match read afterwards is a report, so
   it runs forwards.

**The minute is printed only when it changes**, so a burst of actions in one
minute reads as a single moment rather than five rows restating `45′`. That is
what makes a hundred rows scannable: the gutter becomes a timeline instead of a
repeated number.

**The header is the way out, upwards.** It carries the result from this player's
side and his total, and it links to [the match](match-detail.md) — the question
this dialog answers ("what did *he* do") has an obvious next one ("what happened
in the match"). The ✗ sits beside it rather than inside, so one target
navigates and the other closes.

The link is **only offered for the running season.** The match page resolves a
fixture from the current season's list, so a 2019 match id lands on its "not
found" state; an archived season's header is not a link at all rather than one
that looks tappable and dead-ends.

**The archive is reachable even so**, which is the find that made this worth
building: `?seasonId=` alongside `dayNumber` serves any season the player has
appeared in, back to 2017/2018 in the squad probed. So a breakdown opens on a
2018 fixture as readily as on last Saturday's.

**Only rows he played.** A fixture still to come has no actions in it, and one
he sat out has nothing but the match's own structure — a tappable row there
would promise a list and deliver an empty state. A substitute who came on and
never touched the score *is* a real empty case, and says so in words.

The same rows appear on the [Details tab](#details-tab)'s *Spiele* card and
behave identically there, because they are the same component and a match should
not be a different kind of thing depending on the tab it was found on.

**And the dialog is now shared with three pitches.** Tapping a portrait on
[duel detail](duel-detail.md#the-action-breakdown), the
[match lineup](match-detail.md#the-action-breakdown) or the
[squad's live view](squad.md#live-tab) opens the same breakdown of the same
endpoint. What differs is only where the header goes, and it goes to whatever
the screen has not already answered:

| Opened from | The header links to | Because |
| ----------- | ------------------- | ------- |
| Player page | the **match** | you are on the man; the fixture is the unknown |
| Duel lineup | the **player** | you are on the duel, and the question is whose players are carrying it |
| Match lineup | the **player** | you are already in the match |
| Squad live view | the **match** | it is your own eleven, so the men are the one thing you know |

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

## Transfers tab

Every hand the player has passed through **in this league, this season**,
newest first — [`PlayerTransfersTab`](../../src/components/player/PlayerTransfersTab.tsx)
over one `transferHistory` request.

### The season cut, and why it is 1 July

`transferHistory` reaches back as far as the **league** does, which across a
season change is more than anybody wants to scroll. Neither the endpoint nor the
league payload dates a season, so the boundary is derived from the fixture list
by [`seasonStart`](../../src/api/models.ts): **the most recent 1 July at or
before the first kick-off**, in UTC.

**Not matchday one**, which is the tempting answer and the wrong one. The
Bundesliga stops in May and starts again in August, while leagues form and trade
through **July** — a cut at the opening whistle would throw away a pre-season
window that holds a good share of a season's deals. The gap between two seasons
is the one part of the year the fixture list says nothing about, and 1 July sits
squarely in it. Reading the year off the schedule rather than hard-coding it
also keeps the rule honest for a competition that opens in January: there the
answer is the July before, which is what "most recent" gives.

**No schedule, no cut.** Until the matchday list lands the whole history shows;
a boundary the app has not worked out is not a reason to hide a transfer.

### One row per event, not per owner

The wire is a chain of ownership events that names only the manager who
**received** the player, and a sale back to Kickbase names nobody at all — see
[the API note](../api/players.md#the-seller-is-never-named--it-is-the-previous-entrys-owner).
So who *sold* has to be recovered, and
[`toTransferHistory`](../../src/api/models.ts) does it as a fold: walk
oldest-first carrying the current holder, hand each entry the holder it found,
then reverse for display.

That is not bookkeeping for its own sake. It is the only thing separating a
purchase **off Kickbase's market** from one **out of a manager's squad** —
Maksimovic was released a minute after being granted and bought three days
later, and a naive "previous entry's manager" reading would have credited that
sale to a manager who no longer had him.

**The fold runs before the season cut, over everything the API sent.** A player
bought last season and sold in this one is a sale *by the manager who bought him
then*, and filtering the wire's entries first would have discarded the only
record of who that was. So dropped entries still shape the rows that survive
them, and the oldest row on the tab can name a manager whose own purchase is not
listed above it.

Each row is therefore:

| Part | What it is |
| ---- | ---------- |
| Face and name | **The manager who acted** — the buyer on a purchase, the seller on a sale. Never Kickbase, unless the chain opens with a sale and there is nobody else to name |
| Under it | Where the player came from or went — *Von Marvin*, *Von Kickbase*, *An Kickbase verkauft*, *Startkader*, *Freigegeben* — and when, to the minute |
| Right, top | The fee, or `–` where none was paid |
| Right, under | The **difference to the market value of that day** |

Faces come from the [standings](../api/leagues.md#get-v4leaguesleagueidranking),
not the payload: `uim` arrived on about one manager in five, so without the fill
the tab is a column of initials. A manager who has since **left the league** is
not in the standings any more and keeps whatever the history carried.

### What the owner can do

Above the list, and **only for the manager who owns the player**, sits the one
part of this page that writes anything:
[`PlayerOwnerActions`](../../src/components/player/PlayerOwnerActions.tsx). The
tab is otherwise a record of what has already happened; this is where the next
entry in it gets made.

| Control | Endpoint | Confirmation |
| ------- | -------- | ------------ |
| *An Kickbase* | [`POST …/market/{pid}/sell`](../api/market.md#post-v4leaguesleagueidmarketplayeridsell) | **Two-second hold** |
| *Auf den Markt* / *Preis ändern* | [`POST …/market`](../api/market.md#post-v4leaguesleagueidmarket) | Tap |
| *Vom Markt nehmen* | [`DELETE …/market/{pid}`](../api/market.md#delete-v4leaguesleagueidmarketplayerid) | Tap |
| Tapping a bid | [`POST …/offers/{oid}/accept`](../api/market.md#post-v4leaguesleagueidmarketplayeridoffersofferidaccept) | **Two-second hold** |
| *Gebot ablehnen*, in that dialog | [`POST …/offers/{oid}/decline`](../api/market.md#post-v4leaguesleagueidmarketplayeridoffersofferiddecline) | **A second question**, in place of the action row |

All five live in
[`PlayerSaleDialogs`](../../src/components/player/PlayerSaleDialogs.tsx) and all
five invalidate the whole league key: a player changing hands moves the squad,
the budget, the market, this page and the feed at once.

**Two ways out, presented as two buttons.** Selling to Kickbase is at the market
value, now, to nobody; listing is an ask that other managers answer. The choice
is made before the figure rather than inside one dialog with a mode.

**Held, not tapped, for the two that cannot be undone.** The same
[`HoldButton`](../../src/components/ui/HoldButton.tsx) the
[squad's sale calculator](squad.md#selling) uses, for the same reason — and in
the accept's case doubly so, because its success path is the one request here
nobody has ever watched work (see below).

**A bid has two answers, and they are not the same weight.** Accepting is held.
Declining is a plain button under the bid — the quiet position *Vom Markt
nehmen* holds in its own dialog — and pressing it **takes the action row over**:
the accept and the cancel go, a hairline is drawn, and the row asks *Gebot von
… wirklich ablehnen?* over *Abbrechen* and a red *Ablehnen*. Leaving the
original pair on screen underneath would offer three conclusions to a
yes-or-no question, and *Annehmen* is the last thing that should sit within
reach of a thumb aiming at *Ablehnen*. Backing out returns to the bid rather
than closing the dialog: the question was about the decline, not about being
here.

Nothing changes hands when a bid is turned down — the player stays yours, the
listing stays up — so a hold would be theatre. It is still somebody's bid being
thrown away, which is more than one tap should be able to do. The dialog
carries **no warning panel**: it had one, and it was about the accept, sitting
under a dialog that now asks two questions and warning about only one of them.

**Listing commits nothing**, so it is a plain tap, and withdrawing sits at the
foot of the same dialog rather than becoming a third button on the page: it
belongs to the listing, and only exists while there is one. Re-listing is how a
price changes — Kickbase re-prices a standing listing on a second `POST` — so
*Preis ändern* is the same call as *Auf den Markt*.

**The price dialog rounds up as well as steps.** Above the market's eight
[± shortcuts](market.md#the-bid-dialog) sits *Aufrunden auf* with two buttons,
`1 Mio.` and `100k`, each marked with an arrow into a ceiling line. They are a
destination rather than a delta: `4.837.000 €` becomes `5.000.000 €` or
`4.900.000 €` in one tap, where the `+` rows ask the seller to work out the
difference first — and an asking price is a figure picked out of the air, so the
ones people pick are round. Already-round is left where it is; the tap means
"make this round" and a figure sitting on a million should not jump to the next
one. No hold-to-repeat, unlike the steps: a second tap does nothing.

**A seller may ask what he likes.** The 90 % floor and the 33 % ceiling that
govern [bidding](market.md#the-bid-dialog) say nothing about asking: probed
across the whole integer range, and only the integer bounds it. A price under
the market value gets a note — Kickbase would have paid more outright — not a
block, because underselling to a particular manager is a real move.

**The bids poll at thirty seconds while a listing stands**, the market page's
cadence for the market page's reason: the interesting change comes from other
managers. The poll is driven by the response, so a player sitting quietly in a
squad costs one request and then nothing. The bidders arrive as bare ids and are
matched against the standings for a face, exactly as the transfer rows are.

> **Neither answer to a bid is proven** (**?**). `OPTIONS` establishes both
> verbs and a made-up offer id answers `500 NotFound` on both, but producing a
> real bid needs a second account bidding on the first, and accepting cannot be
> undone. Whether declining tells the bidder, and whether he may bid again, is
> unknown for the same reason. Equally, that `ofs` shows *other* managers' bids on one's own listing
> is read off the market payload's identical field rather than measured here —
> so an empty list means "none Kickbase is showing you".

### The colour flips with the direction

Over the market value is a paper loss for a buyer and a win for a seller, so
the same sign means opposite things on the two kinds of row and the colour
follows the **acting manager's side**, not the sign: an *Aufpreis* on a purchase
is red, the same figure on a sale is green. It is the one place in the app where
a positive delta can be red, and `premiumTone` is the four lines that decide it.

The comparison needs the year of market values, which the tab does **not** wait
for: the rows render with their fees and grow the second figure when that
request lands. A deal older than the year Kickbase serves simply keeps the fee
on its own — the same limit the
[transfer sheet](../pages/events.md) runs into on the events page.

## Ownership

Shown on the Details tab as the **Manager card**: the manager on the left, the
purchase price as the figure on the right, the running profit or loss under it,
and nothing else. It is one line by request — a breakdown of the purchase under
it made a summary into a panel.

**The manager's half of the line is a link to their page** —
[Manager](manager-detail.md), where the rest of their squad and their eleven
are. The price on the right stays put: it is a fact about *this deal*, not
about the manager, and one target per meaning is the rule this app follows
wherever a row has two of them.

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
| `2` | **A deal, either direction**: a purchase when `u` names the manager who got them, a sale back to Kickbase when it does not. The only type carrying a fee |
| `3` | Released for nothing; carries no `u`. Observed a minute after a `GRANTED`, i.e. a manager leaving |

**The sale was the assumed gap and it is not one** — `2` is both halves, and `u`
is the difference. Established on 2026-09-08 by pairing every entry in two
leagues with the [activity feed](../api/leagues.md#get-v4leaguesleagueidactivitiesfeed)'s
`t: 15` transfers, which name the direction, the seller and the fee outright.

`1` and anything above `3` still presumably exist, so unknown values are not
guessed at: they render as a neutral *Wechsel*.

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
| Never owned by anyone | `EmptyState` on the Transfers tab |
| Fewer than two data points | The chart says so rather than drawing a dot |

## Known gaps

- **`PlayerOwnership.marketValueAtPurchase` and `purchasePremium()` are still
  computed and still unrendered.** The [Transfers tab](#transfers-tab) now shows
  the same arithmetic per deal, which covers the current owner's purchase along
  with every earlier one, so the two are duplicates of each other rather than a
  missing feature — the open question is only whether the Manager card wants a
  third line, or the chart a marker at the purchase date.
- **What a manager-to-manager sale looks like on the wire is unproven.** Neither
  probed league produced one; the fold names the right seller under either
  reading, but nothing has confirmed which one Kickbase writes. See
  [the API note](../api/players.md#the-seller-is-never-named--it-is-the-previous-entrys-owner).
- **Nothing links here from the market, duel or ranking pages yet.** The route
  takes any player id in the competition, so wiring another entry point is one
  `<Link>`.
- **`pes` is unresolved** — see [Details tab](#details-tab).
- **Own goal (`k: 2`) is inferred**, not confirmed: no counter on any endpoint
  exposes own goals, so there is nothing to correlate against.
- The competition-scoped `performance` and league-scoped `performance` were
  compared byte-for-byte and are identical. If that ever diverges, the league
  one is what this page reads.
