# Duel detail — "Duell"

[← Back to index](../README.md) ·
Routes `/leagues/:leagueId/duels/:duelId?day=N` and `…/:duelId/ranking` ·
[`src/pages/DuelDetailPage.tsx`](../../src/pages/DuelDetailPage.tsx)

One duel from the [Duels](duels.md) list, opened: both elevens and a combined
player ranking.

## Layout

```
  (A) Danger du        :        GOATstaller (A)
      834                              824
      4 laufend · 2 offen      3 laufend · 1 offen
  1. Spieltag · Live

  ┌──────────────────────────────────────────┐
  │ (A) Danger du            ← whose half    │
  │                (Raab)                    │   keeper, top
  │                  9                       │
  │      (Anton) (Koch) (Tah) (Kimmich)      │   defence
  │        158     44    31      88          │
  │  ⋯                                       │
  │             (Kane)  (Sané)               │   attack
  │              215      12                 │
  │ ─────────────────────────────────────────│   halfway line
  │           (Guirassy) (Olise)             │   attack, facing back
  │               76        41               │
  │  ⋯                                       │
  │                (Nübel)                   │   keeper, bottom
  │                  64                      │
  │ (A) GOATstaller                          │
  └──────────────────────────────────────────┘

  DANGER DU 🪑           GOATSTALLER 🪑
  ┌────────────────┐     ┌────────────────┐
  │ (a) Karaman  🪑│     │ (a) Führich 92 │
  │ (a) Burkardt 4 │     │ (a) Grimaldo 🪑│
  └────────────────┘     └────────────────┘

  ┌──────────────────────────────────────────┐
  │      👕                    🏆            │   the bottom tab bar
  │  Aufstellung            Rangliste        │
  └──────────────────────────────────────────┘
```

**One pitch, two elevens facing each other.** The first manager's keeper is at
the top and the second's at the bottom, so the two attacks meet at the halfway
line the way a real fixture is drawn. It is **eight bands**, not four: the top
half runs keeper → defence → midfield → attack downwards (`ROW_ORDER_MIRRORED`)
and the bottom half runs the usual way up (`ROW_ORDER`). The card sizing in
[`pitchMetrics`](../../src/components/squad/pitchMetrics.ts) has to be told
`rows: 8`, or every portrait is budgeted twice the height it has and the lot
gets clipped.

From **`lg` up the pitch turns on its side** and the two halves sit *left and
right* instead — the first manager on the left, which is where the header's
scoreline already has them. Same eight bands, drawn as columns; see
[Landscape from `lg` up](squad.md#landscape-from-lg-up).

**Portraits carry a picture and one figure, nothing else.** With 22 players on
a 360px screen a name under each is unreadable and a fixture badge is noise.
That figure is the points, what he is **expected** to score while his match is
still to come, or the kick-off time when nothing expects anything of him — see
[the one figure a player gets](#the-one-figure-a-player-gets) — and it is
tinted accent while that player's match is running. The plate is sized
for one line
(`plate: 'points'`), which is also what lets the avatar floor drop to 26px on a
phone.

**Each corner chip also carries where that eleven is heading** — `⌖ 1.240`,
`SUM(coalesce(real points, the reader's guess, the model's prediction))` over
the fielded eleven ([`projectedPointsTotal()`](../../src/lib/expectedPoints.ts)).
A duel read before the weekend is two projections against each other, and the
scoreline in the header can only ever be two facts about the past. The
manager's name gives up width for it (`max-w-28` truncates): four digits of
projection beat the last four letters of a name on this pitch. Both chips
disappear once every match is settled, and the composition is in the tooltip.

**Telling the sides apart** takes two things: the ring around each portrait
(white on top, accent below) and a small manager chip in each half's corner.
The chips exist because the header pairs the managers *left and right* while a
portrait pitch has to stack them *top and bottom* — something has to bridge
those two arrangements, and a legend would cost a row of height the pitch
cannot spare. (On a landscape pitch the two arrangements finally agree, and the
chips sit **side by side along the top**, left and right, reading as one line in
the order the header names them. The full-screen button drops to the bottom
right to make room.)

Each chip is also **a link to that manager**, matchday and all — see
[Manager](manager-detail.md). It is the only thing on this pitch that names a
manager (the portraits are the players' and belong to the breakdown), and where
it leads is the same eleven drawn at twice the size with a bench you can read.

The portraits and the bench rows themselves are shared with that page: the card,
the plate and the bench row live in
[`RosterPitch`](../../src/components/roster/RosterPitch.tsx), so one player
cannot be a different size or colour on two screens one tap apart. What stays
here is the arrangement — eight bands, two benches side by side — which is the
part a duel does differently.

### The action breakdown

**Tapping a portrait opens the actions behind its number** — the same
[breakdown](player-detail.md#the-match-breakdown) the player page draws, from
`events[]` on the player centre.

It is the answer to what these plates always begged: they carry a points figure
and nothing else, and a duel is read precisely to find out where those points
came from. A tap now says *Tor (ABW) +100, Ballverlust −1, Minutenbonus +10*
rather than leaving 239 to stand there unexplained. It works mid-match too —
the endpoint serves the running tally with its events, so the list grows as the
match does.

**The header links to the player**, not the match: on a duel the fixture is
usually beside the point and the man is not. That is the opposite of the
[squad's live view](squad.md#live-tab), which links to the match, and the
reasoning is the same both times — link to whatever the screen has not already
told you.

Portraits were not tappable at all before this, so nothing was taken away. A
player whose club has no match that matchday has no actions to show and stays
inert.

### This replaced two stacked lists

The lineup view used to be two `RosterCard`s: a header per manager over eleven
rows, each with a fixture, a status word and a position. Those rows carried
more per player and still lost what a duel is about — the shape of two teams
against each other, and where the points are coming from. The pitch answers
that in one look, and the [Rangliste](#the-ranking-tab) is one tap away for
the per-player detail, so nothing is actually gone.

### The bench: two columns, left and right

Below the pitch, one column per manager — **first manager left, second
right**, matching the header rather than the pitch. Stacked rows rather than a
sideways-scrolling strip, because two benches side by side are meant to be
*compared*: rows at matching heights read against each other, and nothing hides
off the edge waiting to be swiped into view. A row has the width for a name
where a portrait on the pitch does not, so these carry one.

Bench players are dimmed as a set — the column heading says what they are, and
repeating "Bank" down every row is noise. A manager with a full eleven and
nothing spare gets *Alle Spieler aufgestellt* rather than an empty box.

### Header

**Each half of the scoreline is a link to that manager** —
[Manager](manager-detail.md), carrying `?day=`. On this page there is nothing
else a tap on a half could mean: the duel is what you are already looking at,
so the face, the name and the total together are one target, which is the
largest a two-column header can offer a thumb.

The scoreline is otherwise unchanged except that **`n laufend · n offen` moved
into it**, under the manager it belongs to. It used to sit inside each roster card, which
the pitch replaced; it reads better here anyway, since it qualifies the total
directly above it — 40 points behind with four matches to play is winning. The
line is simply absent until the rosters land, rather than claiming
`0 laufend · 0 offen`.

**There is no back link.** It cost a row at the top of a page whose content
wants to be a pitch, to duplicate what the browser's back gesture and the nav
drawer already do.

### Full screen

The control in the pitch's top-right corner — the one the two name plates leave
free — gives it the whole window
([`FullscreenPane`](../../src/components/ui/FullscreenPane.tsx), shared with
[match detail](match-detail.md#full-screen)). Twenty-two portraits on a phone
are as small as this app ever draws a player, and the header, the benches and
the app's own bar are what they are small *for*. Full screen those step aside,
the pitch measures the viewport, and the sizing search hands every card the
extra room.

The bar that replaces the app header carries the **two managers and their two
totals** — the reason to be looking at all — and drops the placement, the leader
emphasis and `n laufend · n offen`, which are one tap back. The totals are
Kickbase's own for the matchday, the same figure the page shows, so the number
does not change when the pitch grows.

The ✗ is the only control, and Escape and the back gesture do the same thing. It
is a dialog rather than a route on purpose: full screen is a way of *looking* at
what is already on the page, so closing it lands you exactly where you were,
mid-tab and mid-scroll, without spending an entry in the history stack.

**On its side, the benches come along** — manager one's column, the grass,
manager two's, in the order the header pairs them, which on a landscape pitch is
also which half of the grass is whose. Full screen the pitch has the whole
window, so a column either side costs it little (on a desktop the portraits stay
at their 96px ceiling), and this is the one view with nothing underneath to
scroll to — so the half of a duel the grass cannot show comes with it. Each
column takes a fixed 9rem, 12rem where the window is `lg` or wider, and scrolls
inside itself rather than squeezing the pitch.

**Upright they stay behind:** they are rows of names, which the page underneath
already does well, and eight bands plus two columns in a portrait window is that
page again.

## The routes are the views

```
/leagues/:leagueId/duels/:duelId          → Aufstellung (the pitch)
/leagues/:leagueId/duels/:duelId/ranking  → Rangliste
```

Two routes, one component, the view derived from the segment — the same
convention as the [squad page](squad.md), for the same reason: each is linkable
and survives a refresh. Switching uses `replace`, so back leaves the page
rather than walking through every visit.

**The control is a [`BottomTabBar`](../../src/components/ui/BottomTabBar.tsx)**,
the app's control for views of one page — the same bar the
[squad](squad.md#the-bottom-bar) and [match detail](match-detail.md) pages
carry. It replaced a one-button, two-glyph toggle in the header, which was the
right control while these were two *readings* of one screen and the wrong one
once they became two sub-pages: the bar names both destinations instead of
leaving one to a tooltip, and it sits where a thumb already is on a screen you
scroll.

The toggle did not disappear so much as move down a level — the
[Rangliste](#the-ranking-tab) now uses one for its own two arrangements. Which
is the division this page should have had all along: **the bar for where you
are, a toggle for how it is arranged.**

`?day=` is on **both tab links**, not just the current URL. A tab that dropped
it would land on the competition's current matchday while the reader was
looking at another one — the same duel id, a different week, and no visible
sign of the switch.

The bar is **fixed to the viewport**, so it is on screen wherever the page is
scrolled to — see [It is fixed, not sticky](squad.md#it-is-fixed-not-sticky) for
what that replaced. The content between the scoreline and the bar still sits in
a `min-h-0 flex-1` box, but for the pitch's sake now rather than the bar's.

`duelId` is **both manager ids sorted and joined with `-`** — the same string
the list page uses as a React key, so the URL needs no lookup table and a link
resolves for anyone in the league. `?day=` rides along exactly as on the list;
the pairing is read from the very same `useDuels` query the list ran, so
arriving here costs nothing for the duel itself.

A duelId whose pairing does not exist on the selected matchday — a link kept
from another week, where the two managers are not drawn against each other —
renders an `EmptyState` with a way back, not an error.

## Player status

| Status | Means | Source |
| ------ | ----- | ------ |
| `bench` | The manager did not field them | the snapshot's `nlp` list |
| `open` | Fielded, their club has not kicked off | fixture kick-off in the future |
| `playing` | Fielded, match in progress | kick-off passed, not reported finished |
| `finished` | Fielded, match over | fixture `st === 2` |
| `substituted` | Taken off | **nothing produces this yet** — see below |

**These are hardly ever words on screen any more.** A row shows the match's
own [scoreline](#a-row-is-two-marks-and-two-numbers) instead, which says the
same thing and more — "Läuft" cannot tell you it is 2:1 — and the bench is the
[armchair](../../src/components/player/BenchMark.tsx). On the **pitch** the
state is a tint: a running player's points are accent-coloured and everything
else is white, because there is no room for anything else under a portrait.

The union keeps its German labels for tooltips and screen-reader text, where a
mark needs spelling out.

### Unverified: `Ausgewechselt`

Nothing in any observed payload distinguishes a player taken off from one still
on the pitch. The manager squad carries only availability (`st`: 0 fit, 2 out,
with `stxt` naming the injury), and the per-player live fields are absent
outside a running matchday — every probe here was run between matchday 1
finishing and matchday 2 kicking off.

The status is therefore **in the union, labelled and styled, but never
returned**. Wiring it up is a change to
[`duelPlayerStatus()`](../../src/api/models.ts) alone once the field is
identified during a live matchday. Candidates to check then: `st`/`mst` on
`teamcenter/myeleven` (which carries per-player match state but only for the
signed-in user), and `st` on `/v4/competitions/{id}/players`, where a value of
`5` appears on players who completed a match.

**There is now a fourth candidate, and it is a real one.** The match's own event
feed states substitutions outright, and the
[match lineup](match-detail.md#who-came-off) already reads them: the incoming
player by id, the outgoing one by name against the starting eleven. That feed is
per *match*, not per player, so a duel would need it for every fixture a
manager's eleven touches — which the page already fetches through
`useLiveMatches` for the scoreline. So the wiring is: pass the player's own
`live` match into `duelPlayerStatus()` and read his substitution out of it.

## The one figure a player gets

Every player has exactly one slot for a number — the plate under a portrait,
or the right-hand column of a row — and four things can go in it.
`playerFigure()` in [`models.ts`](../../src/api/models.ts) decides which, in
this order:

| Shown | When | Why this order |
| ----- | ---- | -------------- |
| **Points** | they are known | The most informative thing available, benched players included — a bench that outscored the eleven is why benches are on screen at all |
| **The armchair** ([`BenchMark`](../../src/components/player/BenchMark.tsx)) | benched, no points | A kick-off time would mislead: his match starting changes nothing, because his points will never count |
| **[Expected points](squad.md#erwartete-punkte)** | fielded, match still to come, and a figure exists for him | *What for* beats *when*: 22 identical `Sa` plates say almost nothing, and 22 expected figures say what the two elevens are worth. The **target glyph** rides in front of the number, orange for the model's prediction and accent green for the reader's own guess — without it a coloured number on a pitch is what points already scored look like |
| **Kick-off** (`20:30` today, `So` before that) | fielded, match still to come, no expected figure | Answers the question the dash left hanging. On a Friday evening most of a lineup has not kicked off |
| **`–`** | nothing to say | No fixture that matchday, or a match under way whose points have not arrived |

The glyph sits **in the plate, not in the portrait's corner**: that corner
belongs to [the club's team sheet](#the-clubs-team-sheet), which appears in
exactly this window — the hour before a kick-off — and a second badge there
would have to displace the one mark that can say a fielded striker is not in
the eighteen. It is sized from the plate's own font
([`pitchMetrics`](../../src/components/squad/pitchMetrics.ts)), so it tracks a
10px phone plate and a 16px desktop one instead of being a speck at one end and
a dinner plate at the other.

The expected figure is the one entry in the table that is **not** about this
matchday's events, so it is the one with a second condition on it:
[`isBeforeKickoff()`](../../src/api/models.ts) — no points yet *and* the
fixture still ahead. It never sits next to a real score, and it is never shown
for a matchday whose matches are over. On a **row**, where there is width for
both, it does not take the kick-off's place at all: the chip goes in front of
the figure column and the column stays a column. The bench gets one too, in
the row's chip form beside the armchair — an expected 240 next to *did not
count* is precisely the question a bench is on screen to raise.

**Points are never `0` for a player who has not scored.** That distinction is
why `DuelPlayer.points` is optional: printing `0` would claim they played and
failed to score. A player who genuinely did not feature carries `hp: false` in
the API and also stays `undefined` — and `0` really does render as `0`, for
someone who played and scored nothing.

The kick-off is **the time on the day it is played, and the weekday before
that** — `17:30` today, `So` for a match still two nights away
([`kickoffShort()`](../../src/lib/format.ts)), in the reader's own timezone and
never the date. The slot is about five characters wide on a phone plate, so it
holds one of the two, and which one is wanted depends entirely on the distance:
today, the time is the whole question; on any other day it is the wrong answer
to a question nobody asked. Eleven portraits reading `17:30` on a Friday
evening say the lineup all kicks off at once, which is exactly the impression a
matchday spread over three days must not give. The full kick-off rides along as
the tooltip and the screen-reader text.

"Today" is read against the app's own clock (`nowMs()`), so the
[live development profile](../../src/dev/simulation.ts) sees the same one
everything else does.

**The bench is a mark, not a word.** The armchair — the same glyph the squad
page's bench section is headed with — replaces *Bank* wherever a player is
labelled as benched: in the figure column, and as the status on a row. It had
to compete for width with a name, a fixture and a score, and a mark says it in
a tenth of the space; the word rides along as screen-reader text and as the
tooltip. **And the status mark is dropped when the figure is already that
mark** — a benched player with no points would otherwise carry two armchairs
across one row. One who *did* score keeps both, because there the figure is a
number and the mark is what says it did not count.

A real score is drawn at full contrast and a placeholder stays quiet, so the
eye finds the numbers first.

## The expected points in the header of the breakdown

Tapping a portrait opens the
[action breakdown](player-detail.md#the-match-breakdown), and its header shows
**both** expected figures for that player and that matchday beside the real
total: the reader's own guess in accent green, the model's prediction in
orange, each as the chip the squad rows draw.

Both, unusually. Everywhere else in the app a guess overrules a prediction and
the reader is shown one number — that is the whole arrangement. Here the
question is *how did the two of us do*: before kick-off they are what the plate
that opened the sheet was showing, and after the final whistle the figure that
actually happened is sitting right next to them.

Nothing is shown for an **archived season**: guesses are filed under a matchday
number and nothing else, so "matchday 3" is the running season's, and printing
it over a 2019 match would be a fabrication. `seasonId` is set only for
archived seasons, which makes it the gate.

## The club's team sheet

For roughly the last hour before a kick-off there is one fact nobody's points
and no scoreline can carry: **whether the club has actually named the player.**
[`TeamSheetMark`](../../src/components/player/TeamSheetMark.tsx) draws it, on
this page and on the [squad page's live view](squad.md#live-tab).

| Mark | Means | Where it is drawn |
| ---- | ----- | ----------------- |
| ✓ green | In the starting eleven | Corner of the portrait on both pitches; inline on a row |
| 🪑 grey | On the club's bench | as above |
| ✗ red | Not in the matchday squad at all | as above |
| *nothing* | The club has not named a team yet, or the match has kicked off | — |

**It appears for the starters too**, and that is deliberate: eleven quiet
checks are what make one cross mean something. A mark that only ever showed bad
news would leave its absence ambiguous — nothing to report, or nothing known
yet? — and an hour before kick-off those are very different answers.

**It is a filled disc; the manager's bench mark is a bare glyph.** Both can
appear on one row and both can be an armchair, but they are said by different
people: [`BenchMark`](../../src/components/player/BenchMark.tsx) is *your*
manager leaving a player out of *your* eleven, this is *his club* leaving him
out of *theirs*. Weight says who is speaking; the tooltip says the rest
("Vereinsaufstellung: Ersatzbank").

### Where it comes from

[`useTeamSheets`](../../src/api/hooks/useTeamSheets.ts) →
`GET /v4/matches/{matchId}/details`, the **same payload and the same cache
entry** [`useLiveMatches`](../../src/api/hooks/useLiveMatches.ts) fills. The two
are complementary halves of one request:

- `useLiveMatches` takes every match that **has** kicked off, and reads the
  score, the minute and the events — throwing the lineups away.
- `useTeamSheets` takes every match still **to** kick off, and reads only the
  lineups.

The windows are disjoint by construction, so no match is ever asked for twice.

Only matches within **two hours** of kick-off are fetched, at a five-minute
tick — the sheets appear about an hour out, and polling all nine matches of a
matchday from Friday morning would be two days of requests to learn nothing.
Because a window decided from the clock has to be told when the clock moves —
the dead end [`useMatchDetails`](../../src/api/hooks/useMatchDetails.ts)
documents at length, and there is no other poll running on these pages before
the matchday's first kick-off — a request-free heartbeat re-reads the clock
every five minutes while a match is still waiting outside the window.

### `il` is the gate, and it is the uncertain part

A sheet is used **only when the payload says it is official** (`il`). That
field is marked **?** in [the API notes](../api/matches.md): it reads `false` on
a match played weeks ago, so it behaves like a flag raised around kick-off
rather than a durable fact. Raised around kick-off is exactly what this needs,
but it has **not been watched live** — one look at a real Saturday, an hour
before the 15:30 block, settles it.

The failure mode was picked accordingly. If `il` never turns true, no marks
appear and the pages read as they did before: the app says nothing rather than
something wrong. Gating on "the lineup arrays are populated" instead would fail
the other way — if Kickbase serves a *predicted* lineup ahead of the official
one, every prediction would be drawn as a fact. `hasOfficialSheets()` is the
one place that decision is made.

## The squad it shows is the matchday's

Both rosters come from the **matchday snapshot**,
`GET /v4/leagues/{leagueId}/users/{userId}/teamcenter?dayNumber={n}`, read
through [`useMatchdaySquad`](../../src/api/hooks/useMatchdaySquad.ts). `lp` is
the eleven that was fielded that matchday and `nlp` the rest, for **any**
manager in the league — so a matchday from four weeks ago lists the players who
played it, not today's squad.

### The one thing the snapshot cannot do, and the fallback for it

**`lp` is empty until the matchday starts.** Probed six hours before kick-off:
the snapshot returned `lp: []` with all fifteen players in `nlp`, while
`/squad` plainly had eleven fielded with `lo` `0…10`. So it fills at or after
the first kick-off, and before then there is nothing in it to draw.

`canUseMatchdaySquad()` in [`models.ts`](../../src/api/models.ts) decides,
per manager:

| Snapshot | Matchday | Source |
| -------- | -------- | ------ |
| no lineup in it | any | today's squad and its `lo` |
| has a lineup | settled (`st === 2` on every fixture) | **the snapshot**, whatever the count — a manager who fielded nine really did field nine |
| has a lineup | still running | **the snapshot**, once it holds at least as many players as are fielded today |
| empty both lists | any | today's squad — this is a matchday before the league existed |

The third row is the guard that matters. If `lp` turns out to fill *per match*
rather than all at once, a half-filled lineup would otherwise be drawn as the
whole team, with the rest wrongly on the bench and an empty-slot penalty to
match. Comparing against today's fielded count catches exactly that, because
Kickbase locks the lineup at kick-off — so during a matchday `lo` is both
complete and current, and the right yardstick.

**An earlier version gated on the matchday being *finished*.** That was safe
and too crude by half: a live matchday fell back to today's squad, and so did
every matchday under `dev:live`, since the simulation marks the replayed one
unfinished on purpose. The data was sitting there and the app refused it.
Testing completeness rather than the clock fixed both.

`isSettled` deliberately reads the API's own `st === 2` rather than comparing
kick-offs to the clock, so a [simulated clock](../infrastructure.md#development-profiles)
cannot make a matchday look settled when it is not.

### What this replaced, and why it is worth remembering

Until 2026-09-04 this page had a visible compromise, and the reasoning behind
it was sound but built on a wrong premise. `managers/{uid}/squad` serves a
squad only as it stands now (`?dayNumber=` is accepted and ignored), and the
notes concluded that nothing else existed — so a past matchday listed *today's*
eleven with that matchday's points beside each player, under a banner
explaining the mismatch.

It was not a small error. Measured on a real league, matchday 1: one manager's
current eleven scored **1434** on a matchday they actually took **824** from,
having rebuilt the team since.

The premise was wrong because the earlier probing missed one spelling. It
covered `managers/{uid}/squad?dayNumber=` and `teamcenter/myeleven` (own user
only) plus eighteen 404s — but not `users/{userId}/teamcenter`, which differs
on *both* segments. `users/{uid}/squad` really is a 404, which made the whole
`users/…` branch look dead. The lesson generalises: in this API a route's
spelling is not predictable from its neighbours, so a 404 on one shape says
nothing about a sibling.

`HistoricalNotice` and the `isHistorical` check are gone from the page — a
settled matchday now shows the truth rather than an apology. What remains
true:

1. **The manager totals still come from the standings.**
   `DuelRoster.totalPoints` is Kickbase's own `mdp`. Now that the rows are the
   real ones the two *should* agree, up to the 100-point-per-empty-slot
   penalty — which makes summing the rows a genuine cross-check, and a
   worthwhile [extension](#possible-extensions).
2. **Empty is not zero.** The endpoint answers 200 with both lists empty for a
   matchday it has nothing for — one before the league existed, or out of
   range. `MatchdaySquad.isEmpty` carries that, and the page renders an
   `EmptyState` saying so rather than two blank teams.

### Positions, and the sold players that went missing

The snapshot does not reliably carry `pos` — it is present on
`teamcenter/myeleven`'s entries and absent from the day-scoped variant's — so
it is back-filled from two sources, in order:

1. **Today's squad** (`useManagerSquad`), which is read anyway as the
   live-matchday roster source, so this costs no request.
2. **The player's own detail**, which
   [`useMatchdayPoints`](../../src/api/hooks/useMatchdayPoints.ts) already
   fetches for the points and which carries `pos`. It hands back a
   `positionByPlayerId` map as a by-product.

The second source exists because of a bug worth remembering. A player
**transferred away since** the matchday is in the snapshot but in nobody's
current squad, so his position was `undefined` — and the pitch places players
by filtering each band on `position`, so he matched no band and was **silently
dropped**. The ranking view listed him correctly all along, which is what made
it look like a data problem rather than a rendering one: same rosters, same
points, one view showing him and the other not.

So the fan-out now takes a `needsPosition` flag per player and fetches him even
when his match cannot have produced points yet — the answer does not depend on
any match having started. On a settled matchday every player is fetched for the
points anyway, so this adds requests only for a sold player on a matchday still
to be played.

`DuelPlayer.position` stays optional even so: if neither source answers, a row
renders `–` for the label and the pitch leaves the player out rather than
guessing. `toPosition()`'s midfield default would have put a stranger in the
middle of the park and looked deliberate.

## Where the points come from

There are **two** per-player scores in this API and they answer at different
times. Getting that wrong is what had every live page in the app showing `–`
through a whole matchday.

| | `ph` on `/players/{pid}` | `p` on `/playercenter/{pid}` and on the squad snapshot |
| --- | --- | --- |
| While the match runs | **nothing** — `{hp: false}`, no `p` at all | the running tally |
| Once it is over | the settled score | frozen, and **never reconciled** |

Measured live on 2026-09-05 during matchday 2: a player on the pitch had his
score climb 23 → 105 → 110 on the player centre while `ph[0]` stayed
`{hp: false}` throughout. A player whose fixture had already finished read `-8`
on the running tally against `-14` from `ph`, `tp` and `/performance` alike.

**The running tally wins while the matchday is unsettled**, and `ph` takes over
once every fixture is finished. Three sources agreeing on `-14` sounds decisive,
but Kickbase is still counting the `-8`: the manager totals it publishes sum the
running tallies exactly — 430 against a published `mdp` of 430, checked
mid-matchday against this very page's header. Showing the settled score early
would make the rows stop adding up to the total above them and disagree with the
official app about a number both are showing. The two converge anyway once a
matchday is played out.

The switch is by **matchday, not by match**: a fixture that finishes on Friday
still contributes its running tally to a total that moves until Sunday night.

### What it costs

**Nothing extra, on this page.** The running tally arrives per *squad* on the
[matchday snapshot](#the-squad-it-shows-is-the-matchdays) this page already
fetches for both managers, so a live duel spends **two requests a tick** on
points rather than thirty — the snapshots are simply polled at the live rate,
and the rows are then guaranteed to agree with the header, since both come from
the one payload. `livePoints` on a points subject is how a caller says so;
[`useMatchdayPoints`](../../src/api/hooks/useMatchdayPoints.ts) skips the
per-player request for anyone it covers.

The per-player fan-out is what is left over, and its rules still hold:

1. **A player whose club has not kicked off is not fetched.** There is nothing
   to read, so an upcoming matchday issues **zero** player requests.
2. **A settled player is fetched once**, `staleTime: Infinity` for the session.
3. **Only players on the pitch are polled**, per player rather than per page, so
   a matchday with one late kick-off costs one request a tick rather than
   twenty-two.

[Match detail](match-detail.md) has no per-squad shortcut — most of a fixture's
twenty-two belong to nobody — so it pays the per-player rate against
`/playercenter/{playerId}`, which answers for any player, owned or not.

### Indexing `ph`

**`ph` is newest first**, and `ph[0]` is the matchday the response is current
for — `day` on the payload itself. The index therefore counts *back* from there
(`matchdayEntry`), and a matchday older than the array reads `undefined`. The
array is dense: one entry per matchday up to `day`, with `{ hp: false }` and no
`p` for a matchday the player missed *and* for one his club has not kicked off
in yet.

It was read as `ph[day - 1]` until 2026-09-05, on the opposite and wrongly
documented ordering. That is right for exactly one matchday — index `0` either
way — and from the second onward it served **the previous matchday's points**,
on this page and on [match detail](match-detail.md) alike, while the scoreline
above it stayed correct because that comes from the standings. Two payloads
settle the ordering, both measured against `/performance`, which carries an
explicit `day` per entry:

| Player | `ph` | `/performance` |
| ------ | ---- | -------------- |
| Heskey — played MD2, missed MD1 | `[{hp:true,p:-14},{hp:false}]` | MD1 –, MD2 **-14** |
| Vermeeren — MD2 not kicked off | `[{hp:false},{hp:true,p:25}]` | MD1 **25** |

Vermeeren is the decisive one: his club had not played matchday 2 and he still
has an entry for it, at the front.

The cache key is `qk.playerDetail(leagueId, playerId)` with **no matchday** in
it: one response carries every matchday's points, so all matchdays share the
entry and stepping through a season re-reads nothing.

The hook is shared with the squad page's [live view](squad.md#live-tab), which
is the same job for one manager instead of two. Everything above holds there
too — the rules are the hook's, not this page's.

## Data

| Query | Endpoint | Shared with |
| ----- | -------- | ----------- |
| `useDuels` | `/leagues/{id}/ranking?dayNumber=` | [Duels](duels.md) — already warm |
| `useMatchdaySquad` ×2 | `/leagues/{id}/users/{uid}/teamcenter?dayNumber=` | [Squad — live tab](squad.md#live-tab), [Manager](manager-detail.md) |
| `useManagerSquad` ×2 | `/leagues/{id}/managers/{uid}/squad` | positions only — see [above](#positions-still-come-from-todays-squad); the [manager page](manager-detail.md#kader) renders the same entry |
| `useMatchdayFixtures` | `/competitions/{id}/matchdays` | squad page, duel picker |
| `useMatchdayPoints` ×N | `/leagues/{id}/players/{pid}` | [Squad — live tab](squad.md#live-tab) |
| `useLiveMatches` ×N | `/matches/{mid}/details` | every started match — [Matchday](matchday.md) |
| `useTeamSheets` ×N | `/matches/{mid}/details` | every match about to start — [above](#the-clubs-team-sheet) |

`useManagerSquad` is how the app reads another manager's lineup today. It is
**not** the only way, though this file said so until 2026-09-04:
`users/{uid}/teamcenter?dayNumber=` ([above](#the-squad-it-shows-is-the-matchdays)) serves any
manager's team for any matchday. `teamcenter/myeleven` really is own-user-only —
`userId`, `uid`, `u` and `dayNumber` are all silently ignored there, and 18
other path spellings answer 404, which is what the old claim was based on.

`useManagerSquad` does carry a `mu` block naming both duel managers, which is
how the current pairing could be read without the standings — the app uses the
standings anyway, because those work for every matchday.

**All of it now goes through one hook per manager.**
[`useManagerRoster`](../../src/api/hooks/useManagerRoster.ts) holds everything
above for *one* side — the source split, the poll, the points — and
`useDuelRosters` is two of those with the results paired. The split happened
when the [manager page](manager-detail.md) needed exactly one side: every rule
here is a fact about a manager's matchday rather than about a duel, and the
second copy of it would have been the copy that drifted. The points are now
fanned out per side rather than over both squads at once, which is **the same
set of requests** — a player cannot be in two managers' squads, and the queries
are keyed by player id either way.

`useMatchdayFixtures` reads the same cache entry as `useCurrentMatchday` and
`useSeasonSchedule` through a third `select`. Its selector closes over `day`,
so it is memoised with `useCallback` rather than being a module constant — the
other two selectors are constants precisely because they close over nothing.

### Deliberately not memoised

The rosters and the points map are rebuilt on every render. `useQueries`
returns a fresh array each time, so neither can be memoised on its own input
without inventing a surrogate key — and a signature-string memo is harder to
trust than the thirty object allocations it saves. Nothing here is on a hot
path: the page re-renders on a once-a-minute poll and on a tab switch.

## A row is two marks and two numbers

Every player row — in the [Rangliste](#the-ranking-tab), in the bench columns,
and in the squad page's live list, since they are all
[`DuelPlayerRow`](../../src/components/duels/DuelPlayerRow.tsx) — reads:

```
(portrait)  Anton
            🏠 (crest)  2:1                    158
```

The second line **used to be `ABW @ ELF`**: a position abbreviation, a `vs`/`@`
and the opponent's three-letter symbol, plus a status word. It now carries

- the opponent's **crest**, wearing a house or an aeroplane in its corner
  ([`FixtureBadge`](../../src/components/squad/FixtureBadge.tsx), the app's
  wordless fixture — a crest is recognised faster than three letters), and
- the match's own **scoreline**
  ([`MatchStateBadge`](../../src/components/player/MatchStateBadge.tsx)):
  a faint `–:–` before kick-off, a **pulsing dot** with the running score and
  the **minute** while it is on, the final score once it is over, and
- his **club's team sheet**, in the hour it exists and the match has not
  started ([`TeamSheetMark`](../../src/components/player/TeamSheetMark.tsx)) —
  see [The club's team sheet](#the-clubs-team-sheet), and
- what the player **did** — goals, own goals, assists, cards — as the same
  glyphs the [player page](player-detail.md) draws, from the match's own event
  feed.

Three pieces of text became two marks and a number, and the row gained the one
thing it never had: how that match is actually going. The score is read from
the player's own side of the fixture, so `2:1` always means his club is
winning.

**The position went with them.** It is the least useful thing about a player in
a list ranked by points, and it is one tap away on his own page. The scoreline
and the crest are wordless, so both carry the state and the kick-off as their
tooltip and as screen-reader text.

### Where the live numbers come from

[`useLiveMatches`](../../src/api/hooks/useLiveMatches.ts) →
`GET /v4/matches/{matchId}/details`, **one request per match** (nine for a
matchday) rather than per player, polled at the shared live rate only while a
match is running and fetched once and held for a finished one.

The score used to come from the fixture list, which is the whole season and
cached for an hour — an hour-old number beside a pulsing "live" dot. The
fixture is still the fallback, which is right the moment a match is over and
nothing can change, and it is still the source of every match's *state*: that
payload now goes stale at once and polls while the current matchday is under
way, since `st` is what says a matchday is finished.

The score is read from the player's **own side** (`liveScoreFor`), so `2:1`
always means his club is winning, and the minute reads `90+'` past ninety
rather than the API's raw `95`.

The events are the same `ke` codes as the player page's `k`, verified on a
finished 5:1 whose feed decoded to four goals plus an own goal one way and one
goal the other — which is that scoreline exactly. Substitutions are in the feed
and deliberately not drawn: `toEventTallies()` drops them, because they say
where a player was rather than what he did.

## The ranking tab

Every player of the duel, best first, benches included — in either of **two
readings**, switched by a [`PairToggle`](../../src/components/ui/PairToggle.tsx)
above the list. The same two the [match ranking](match-detail.md#two-readings-one-toggle)
offers, for the same reasons, and now the same control.

| Reading | What it is for |
| ------- | -------------- |
| ***Gemeinsam*** (default) | The two squads **interleaved**. Whose players occupy the top of a combined table says more about how a duel is going than two separate lists can — it is the one arrangement that makes the comparison itself visible. Each row carries the owning manager's avatar next to the score, the only thing telling otherwise identical rows apart |
| ***Nach Manager*** | Split, first manager above second, **each numbered from 1**. The reading for "who carried my team today" — a question the combined list buries as soon as the other side has run away with the matchday |

**The restarting numbers are the point of the split.** A player carrying `14`
because thirteen of the *opponent's* outscored him answers a different question
from the one this reading is opened for. It is the same reasoning the match
ranking's per-club split rests on.

**No manager avatar on the rows in the split reading.** In the combined list it
is the only thing distinguishing two rows; under a heading that already names
the manager it is one fact repeated down a whole column.

**The heading itself is the link to that manager**, the whole row of it: it is
the one thing in this reading that names them, and the rows beneath it are the
players' and lead to the players.

Each section's total is `totalPoints` — **Kickbase's own figure from the
standings, not the sum of the rows beneath it.** That is deliberate: it is the
number the page header shows and the number the duel is decided on, so the two
cannot drift apart while the rows fill in, and a sum of a list that includes the
bench would be neither.

The choice is remembered in `localStorage` and deliberately **not** in the URL —
a preference, not a place, so a shared link opens in the reader's own reading
rather than the sender's. It keeps its own key rather than sharing the match
ranking's: the two views are alike, but a habit on one need not follow to the
other.

**Bench players are included** in both, tagged `Bank`. They scored what they
scored, it just did not count, and omitting them would make this tab disagree
with the lineup tab about who exists. Players with no points yet sort **last**
rather than as zero — not knowing is not the same as nothing.

## States

| State | Rendering |
| ----- | --------- |
| Schedule or duel loading | `SkeletonList rows={8}` |
| Rosters loading | The header and toggle render; `SkeletonList` in place of the pitch |
| Error | `ErrorState` with retry |
| Pairing not on this matchday | `EmptyState` with a link back to the list |
| Matchday the API has no squads for | `EmptyState` — `isEmpty`, not an error; see [above](#the-squad-it-shows-is-the-matchdays) |

Points arriving late do **not** block the rows: a player renders with `–` and
fills in, which is what keeps a live page from flashing a skeleton every minute.

## Possible extensions

- Sum the fielded rows and compare against the official `mdp`. Now that the
  rows are the real ones the two should agree up to the empty-slot penalty, so
  a mismatch means something is wrong — and this is the check that would have
  caught the historical-lineup gap years earlier than reading the docs did.
- **Read points from the snapshot.** A `p` field on its player entries would
  collapse the per-player fan-out below to one request per manager. Unconfirmed
  on a played matchday, hence unused — see
  [`TeamcenterPlayer`](../../src/api/types.ts).
- Use `stxt` from the player detail (already fetched) to explain an unavailable
  player: "Hip bruise – misses FCA (A)".
- Goals and assists per player; the player detail carries `g` and `a`.
