# Club

[← Back to index](../README.md) · Route `/leagues/:leagueId/teams/:teamId` ·
[`src/pages/TeamDetailPage.tsx`](../../src/pages/TeamDetailPage.tsx)

One Bundesliga club, in four views:

| Route | View | Costs |
| ----- | ---- | ----- |
| `/leagues/:leagueId/teams/:teamId` | Übersicht | one request per player (~25–30) |
| `…/squad` | Kader | — |
| `…/matches` | Spiele | the same fan-out, shared with Übersicht |
| `…/live` | Live | the match lineup's ~36 players, polling |

The page itself is **three requests**: the league table and the season's fixture
list, both shared hour-long caches the squad and matchday pages have usually
filled already, plus the club's own `teamprofile` — one response carrying the
entire squad. The Kader is arithmetic over those alone; the Übersicht adds the
per-player fan-out for its [scorer card](#punktesammler)'s season totals, which
the Spiele tab then reads for free.

Four routes, one component, the tab read out of the segment — the arrangement
[Squad](squad.md), [Player detail](player-detail.md), [Duel detail](duel-detail.md)
and [Match detail](match-detail.md) all use, and for the same reasons: every
view is linkable and survives a refresh.

## Why the page exists

A club page is the most available thing on the internet. Crest, table position,
fixtures, squad — a hundred sites have it, and most of them do it better than a
fantasy client will.

So none of that is why this page is here. It is here for the **join between the
real club and your Kickbase league**: who owns these players, what they cost,
what they are producing, and — while a match runs — which of your rivals is
banking the points. Every view is built on that axis, and the ones that are not
(the table row, the fixture list) are there to give the ones that are somewhere
to stand.

The test each card had to pass: *could kicker.de show this?* If yes, it is
supporting material and it stays small.

## Getting there

**No drawer entry.** A drawer entry needs a single subject — *your* squad, *the*
market — and there are eighteen clubs. It is a detail page like a player's, so
the way in is the thing that already names a club on the screen you are on:

- the **crest in the [player header](player-detail.md)**, at the far right;
- **either crest on a [match](match-detail.md)'s scoreline**, where the whole
  block — crest over name — is the target.

Both are wordless and therefore labelled: the destination rides as the tooltip
and as the accessible name.

## The header

Above all four tabs, so switching never moves it:

- crest, club name, placement with its **movement mark** — the shared
  [`PlacementChange`](../../src/components/ui/PlacementChange.tsx), extracted
  from [Ranking](ranking.md) when this page needed the same treatment;
- the season record spelled out, `4S · 1U · 2N · 14:11 Tore`, because the
  table's goal *difference* hides it: a 14:11 club and a 5:2 club share a `+3`;
- a **fixture strip** carrying the club's most immediate match — running if one
  is, else the next, else the last played.

The strip's three states are one shape, so it never changes height under a
reader watching it tick over. While a match runs it shows the **live score and
minute** from `/matches/{id}/details`; the fixture list's own goals are an hour
stale by construction, being the whole season in one cached payload. Same
division of labour as [`MatchClock`](../../src/components/matchday/MatchClock.tsx).

The score is read from **this club's** side (`liveScoreFor`). The payload is
home-and-away, and `2:1` under a club's own name has to mean that club is ahead
or the strip lies about who is winning — which is why the club's own id is a
prop rather than derived from the fixture, since a
[`TeamSeasonFixture`](../../src/api/models.ts) names only the opponent.

### Tapping the strip: the projected eleven, or the match

The strip has **two destinations, and the clock picks between them**:

| Fixture state | Tapping it opens |
| ------------- | ---------------- |
| Not kicked off | the **projected starting eleven** — Ligainsider's poster, full screen |
| Running or over | the [match page](match-detail.md) |

They never compete, because at any moment exactly one of them is the better
answer to "what about this match". A projected eleven is a claim about a game
that has not been played; the moment the whistle goes the real team sheet
exists, and the match page is where it lives. Which one applies is a fact about
the clock rather than a preference, so the strip needs no second control.

The poster is `plpim` — a 1280×1809 image of **the whole projected XI**, the
same hash every player at the club carries, which is what made it useless as a
per-player badge. It arrives on the club's own `teamprofile`, so opening it
costs nothing, and it renders in the existing
[`LineupPosterDialog`](../../src/components/player/LineupPosterDialog.tsx) —
fit to screen first, tap to zoom.

It is absent without Membership, in the off-season, and for a club nobody has
assessed. All three are normal rather than errors, so the strip simply falls
back to linking at the match.

## Übersicht

Four of the five cards are arithmetic over `/competitions/{id}/table`,
`/competitions/{id}/matchdays` and the club's `teamprofile` — the first two
hour-long caches shared with the squad, matchday and market pages, so in
practice one request. The fifth, [Punktesammler](#punktesammler), needs a season
total per player and there is no bulk source of one.

### Kickbase-Punkte vs. Tabellenplatz

The tile that justifies the page. `sp` on the table row is what that club's
players have produced, and its rank across the eighteen routinely disagrees
with the club's real position — a 9th-placed side sitting 3rd for fantasy
points is a buy signal no football table can express. The hint under the figure
(`3. von 18 Klubs`) is what makes the disagreement visible without a second
screen.

Spelled out rather than left as a bare `3.`, which beside a number reads as the
league position this tile exists to contradict.

### Form

The last five, **newest first**, each a tap away from its match. Newest first
because that is the direction the question runs — "how are they doing *now*" is
answered at the left-hand end, and a chronological strip buries the most recent
result where a phone runs out of width.

A letter **and** a colour, never colour alone, with the score underneath so the
strip is not a row of verdicts with no evidence.

### Nächste Spiele — the fixture ticker

The card a manager actually came for. "Heidenheim (H)" and "Bayern (A)" are the
same three words and completely different weeks, and the decision being made —
is one of these players worth buying — is mostly a question about the next
month of fixtures rather than the last one.

Each row is graded by the **opponent's own table position**, in three bands
(`fixtureDifficulty`): top third hard, bottom third dankbar, the rest even.
Three and not eighteen, because finer gradations would claim a precision a
league table six matchdays old has not got. The placement prints beside the
dot, so colour is never the only cue and anyone who wants the finer answer has
it.

### Saison-Fakten

Four things the standings swallow:

| Fact | What the table cannot say |
| ---- | ------------------------- |
| Heim / Auswärts | The points column merges two very different seasons |
| Zu Null | No notion of a defence at all |
| Höchster Sieg | Ties broken by goals scored — a 5:1 beats a 4:0 |
| (the record, in the header) | `gd` merges scored with conceded |

A club that has taken thirteen of its fifteen points at home is a different
proposition next Saturday, and that is exactly the sort of thing being priced.

### Punktesammler

The five biggest scorers of the season, ranked by **total**, with the average
per appearance underneath and the market value beside the name.

**Total is the headline, average the qualifier.** The total is what a season
actually produced and the figure a reader arrives with; the average is what
makes it comparable — a substitute on 480 from six appearances and a starter on
520 from twelve are very different propositions, and the second line is where
that shows.

**This is the one card on the Übersicht that costs anything.** `teamprofile`
carries `ap` and no total, and no appearance count either, so there is no
arithmetic that recovers one from the other: a season figure means `tp` off each
player's own detail, one request each. It rides the same fan-out the
[Spiele](#spiele) column pays for `ph`, so the two tabs share it and visiting
both costs one — but opening a club now issues that fan-out on the landing tab
rather than only on Spiele. See [`useTeamPoints`](../../src/api/hooks/useTeam.ts).

The rows have something to say from the first paint: the name, position, value
and average all come free with the profile, and the headline total fills in as
the responses land. A total that has not arrived is `–`, never `0` — a zero
would read as a season of nothing.

**A player with no total sorts last, not as zero.** Absent means either "has not
featured" or "his request has not landed", and neither is a performance;
ranking them level with a genuine nought would put whoever the network was
slowest about at the bottom of a list about merit. The same rule the duel and
match rankings hold.

## Kader

The tab the page is worth building for — and, since 2026-09-05, one request.

**Every player, always, in one flat list.** No filters and no sections: a club
has twenty-five to thirty players, which is a single screenful of scrolling,
and a filter over a list that short mostly hides the comparison the reader came
to make. Sorted by **position, then name** — so the shape of the squad is the
order of the list, and a player is found where his name puts him rather than
where this week's form does. Names sort through `localeCompare(…, 'de')`,
without which every umlaut lands after Z and Özcan turns up under Zirkzee.

Each row is a link to the [player's own page](player-detail.md), where the
season history, the market-value chart and the ownership detail live.

Everything on a row comes off one response:

| On the row | Wire field |
| ---------- | ---------- |
| **Marktwert** | `mv` |
| **Änderung 7 Tage**, with its arrow | `sdmvt` |
| **Startelf-Wahrscheinlichkeit** | `prob` |
| **Besitzer**, as the manager's photo | `oui` + `onm` |
| Verletzt / gesperrt | `st` |
| Name, Position | `n`, `pos` |

The probability sits on the second line **beside the position**, not next to
the name — beside the name it would collide with the availability mark, and the
two mean different things: *verletzt* is a fact, *unwahrscheinlich* is
somebody's estimate. Same separation the [squad list](squad.md) makes.

The availability mark stays even though it is not one of the columns this list
is for. A `prob` tier does not imply it — an injured player often carries no
assessment at all — so dropping it would lose the one signal a scouting list
must not be wrong about.

The change is drawn exactly as the squad list draws it: the arrow is the *same*
signal as the amount, its direction, so the two cannot contradict each other,
and it is omitted on a flat week rather than pointing nowhere.

### One request, not twenty-six

The whole tab comes from
[`GET /v4/leagues/{leagueId}/teams/{teamId}/teamprofile`](../api/competitions.md#get-v4competitionscompetitionidteamsteamidteamprofile),
found on 2026-09-05 after this tab shipped rendering **nothing at all** for
seventeen clubs out of eighteen.

What it was doing before: filtering `/v4/competitions/{id}/players` by `tid` for
the roster, then fanning out one request per player for the values and owners.
Both halves were wrong.

**The list it filtered is not a competition's players.** Probed live, that
endpoint returns **25 rows across exactly two clubs, all sharing one `mi`** — it
is *one fixture's* players. Its published documentation says otherwise, this
project's own API notes said otherwise, and nothing caught it because the only
consumer was a stub that printed a row count. Open Leipzig on a matchday
Stuttgart are playing and the filter matches zero rows. See
[the warning](../api/competitions.md#get-v4competitionscompetitionidplayers).

**And the fan-out was twenty-six requests for what one answers.** `teamprofile`
carries the market value, the seven-day change, the probability tier, the
availability, the average points *and* the owner, plus the club's placement,
record, total market value and projected-XI poster.

Two spellings exist and only the **league-scoped** one knows your league. The
competition-scoped twin returns a byte-identical body minus `oui`, `onm`, `lo`
and a real `mvgl` — established by diffing them for the same club.

Neighbouring spellings all 404: `/teams`, `/teams/{tid}`, `/teams/{tid}/players`,
`/teams/{tid}/squad`. Only the `teamprofile` suffix resolves, which is why an
earlier round of probing concluded no per-club endpoint existed at all.

### Seven days, not twenty-four

The market-value column shows `sdmvt`, the **seven-day** change, and the caption
above the list says so. The 24-hour figure is `tfhmvt` and lives only on a
player's own detail — one request each, twenty-six for a single column, which is
not a trade worth making when everything else on the row is already free.

The two are not interchangeable: measured on the same player the same afternoon,
the week read `+349.459` and the day `+6.799`. A column labelled for the wrong
window would be wrong by fifty times.

**A player who had no value a week ago shows `–`.** Kickbase prices a new
arrival up from zero, so his `sdmvt` is his *entire* valuation — El Aynaoui, two
days at Leipzig, read `+14.999.789` on a value of exactly that, and would have
led the club as its biggest riser. Eleven players league-wide carried it the day
it was checked; a transfer deadline produces a batch of them. The test is exact
rather than a heuristic — the change can only equal the value when the value
seven days ago was zero — and a dash says "not computable" where a number would
have made a claim.

### No `stxt`

The payload carries `st` but no reason text, so the availability badge falls back
to its own code's label (*Verletzt*, *Angeschlagen*, *Gesperrt*) rather than
Kickbase's German sentence. That is what the badge's `reason` parameter is
optional for, and it is the one thing the old per-player fan-out had that this
does not.

### `oui` is the right owner *here*

It is who owns the player **today**, which is the question a club's roster asks
and the exact opposite of what a played matchday wants — reading it on a match
page credited every transferred player to his new manager, twice, before
[`useMatchLineup`](../../src/api/hooks/useMatchLineup.ts) settled on the
per-manager snapshot instead.

On this payload `oui` is a **number**, and **absent** rather than the string
`"0"` when nobody owns the player — two differences from the player detail, and
the reason the mapping deliberately does not run it through `toOwnerId`. That
helper exists to strip the `"0"` placeholder; applied to a number it would
either reject every owner or let a real `0` through as an id.

The payload also names the manager (`onm`) but carries no avatar, so the
standings supply the face. The name comes from `onm` first — it is on the same
response as the ownership itself and so cannot disagree with it — and a manager
the standings do not list still gets a badge, drawn from initials.

Because the claim is always "owns him now", the roster reuses the match
lineup's own [`OwnerBadge`](../../src/components/matchday/OwnerBadge.tsx) and
[`ownerLabel`](../../src/components/matchday/ownerLabel.ts) verbatim:
`TeamSquadOwner` **is** `MatchPlayerOwner` with `source: 'currentOwner'`, and
that source's wording — *Gehört X* / *Dein Spieler* — is already right.

### One line above the list

The club's value and its squad size, left; the column caption *Marktwert ·
7 Tage*, right. One line of type, where there used to be two `StatTile`s and a
third card for the projected eleven — three panels a reader scrolled past to
reach the thing they came for.

**Kaderwert is `tv` off the payload**, Kickbase's own figure rather than a sum
over the rows that could quietly drift from it.

The caption exists for one word. A bare signed figure under a market value reads
as "since yesterday" — that is what it is on every other screen in this app —
and this one is a week, so it is said once here rather than thirty times in the
rows.

The **projected eleven** moved to the header's fixture strip, where a question
about the next match already has somewhere to be asked. The count of players
owned in your league, which used to be the second tile, is gone with it; the
owner column on the rows still answers it one row at a time.

## Spiele

All 34 fixtures, ascending, each its own card, the current matchday marked with
an accent border — a border rather than a filled row, because a tint at this
density reads as a selection the tap did not make.

The right-hand column is what makes it a tab rather than a card: **what the
club's players scored on each matchday**. A 0:0 that yielded 480 points and a
4:1 that yielded 260 are the sort of thing only this column says out loud, and
they are the weeks a manager wants to know about.

Nothing else in the API answers "where were this club's points" — there is no
bulk per-matchday source, per
[`useMatchdayPoints`](../../src/api/hooks/useMatchdayPoints.ts). It is worth
paying once because `ph` on each response is that player's whole season:
twenty-six requests yield the club's total for all 34 matchdays rather than for
one, **and** every player's season figure for the
[scorer card](#punktesammler). The two tabs share the cache entries, so between
them it is one fan-out; `enabled` keeps the Kader and the Live tab off it.

The days are read through the **exported** `matchdayEntry()` rather than by
indexing `ph` directly. That array is newest-first and indexed off the
payload's own `day`, and a second copy of that arithmetic — off by one in the
same quiet way — is a bug that has already shipped once: every matchday would
still have a plausible total, just the wrong one.

A matchday with no total is `–`, never `0`.

### The bar is the row's bottom edge

The same treatment [`PlayerMatchRow`](../../src/components/player/PlayerMatchRow.tsx)
gives a player's season, and worth copying for the reason it exists there: a
column of rows each ending in a filled edge reads as a **bar chart on its side**,
without anything having to draw a chart or spend width on one. The number keeps
the right-hand column to itself.

**The bar's full length is where gold begins.** Kickbase points have no natural
maximum, so the track is scaled to the best matchday this club has managed — but
on matchday 2 "the best so far" is one result, every bar would be full, and a
full bar would mean nothing. The floor is the top of `TEAM_POINTS_BANDS` rather
than a second number written out beside it, so a bar that fills its track is
exactly a bar that has turned gold, and the length and the colour say one thing.

Only played matchdays get a bar. An empty track under every upcoming fixture
would be seventeen rows of nothing.

### Two band sets, and no default

Colour is the app's shared [points scale](../../src/components/player/pointsScale.ts) —
same five colours, same meanings, same inclusive-at-the-bottom boundaries — and
the figure is tinted with it too, so the number and the edge under it cannot
disagree.

**But on the club band set, not the player one.** A club's yield is the sum of
everyone who played, fourteen to sixteen scores, so on the player thresholds
(`elite` at 300) every matchday of every club lands in gold and the colour says
nothing the length does not. That is what shipped first.

| Band | Player, one match | Club, one matchday |
| ---- | ----------------- | ------------------ |
| `low` — white | 0–99 | 0–799 |
| `good` — lime | 100–199 | 800–1399 |
| `strong` — green | 200–299 | 1400–1999 |
| `elite` — gold | 300+ | 2000+ |

2000 is the gold that 300 is for a player: occasional, notable, and comfortably
short of the 2500 that almost never happens.

`pointsBand` and `pointsColor` take the band set as an **explicit argument with
no default**. A default would be a standing invitation to paint a club's 1300 as
though it were a player's — and the wrong answer there is not an error but a
real colour on a real scale, which is exactly the kind of bug that survives
review.

The bands are **calibrated by eye rather than measured**: nothing has counted
the distribution of club matchday totals across a season. They rest on two
indirect signals — that above 2500 is very rare, observed from this tab across
a season's fixtures, and that a fixture's best individual scores ran 150–290 on
the matchday probed, so fifteen players at a routine 80–100 lands around
1200–1400. If the bars skew, `TEAM_POINTS_BANDS` is the one place to change and
every consumer follows.

## Live

Only exists while one of the club's fixtures is running. The route is
registered unconditionally — the table is built once, before any matchday is
known — and the page redirects to the Übersicht otherwise, so the URL is a dead
end exactly when its tab is missing. Same pattern as
[`squad/live`](squad.md#live-tab).

It deliberately does **not** reproduce [Match detail](match-detail.md), which
already has both sides, the timeline and a combined ranking. What it adds is
the half that page cannot emphasise, because it belongs to two clubs at once.

### Punkte an deine Liga

The card the tab exists for. Every player on the pitch is somebody's in your
league, or nobody's, and this adds the eleven up per manager:

> *Bayerns Elf produziert gerade 214 Punkte — 89 davon gehen an Andreas.*

Not a fact any football app can state. Three rules keep the arithmetic honest:

- **Substitutes count.** A player who came on and scored did so for whoever
  owns him; leaving the bench out would understate exactly the manager who got
  lucky with a substitution.
- **An unowned player is not a row.** His points are real but nobody's, so they
  sit in the club total and out of the list — which is what makes the gap
  between the two figures mean something.
- **A player with no figure yet contributes nothing**, not a zero. The fan-out
  lands one player at a time, so every total is climbing; the spinner says so
  rather than the numbers pretending to be final.

### The eleven

**Four bands, not eight** — the difference from the match page's pitch, and the
reason this view is worth having alongside it. One eleven on a phone gets
portraits at roughly twice the size two elevens do, which turns the owner badge
from a 12px suggestion into something identifiable without hovering. There is
room for a name under each, too, where the match page's plate carries only the
number.

The arrangement itself is
[`useMatchLineup`](../../src/api/hooks/useMatchLineup.ts)'s, unchanged: the
pitch follows the substitutions while the match runs and keeps the named eleven
otherwise, exactly as the match page's does. One place decides who is on the
grass, so the two screens cannot disagree.

Underneath: the club's **bench** as rows with their owners and figures, and the
club's **events** as a single column — unmixed with the opponent's, because the
opponent's goals are the other half of a scoreline the header already carries.
A link through to the full timeline sits in the card's header.

### What it costs

The match lineup's own fan-out: ~36 per-player requests plus one per manager,
polling at [the live rate](../api-layer.md) while the match runs. The same
cache entries the match page fills, so arriving from there pays nothing.

## Data sources, in one table

| Hook | Endpoint | Scope | Used by |
| ---- | -------- | ----- | ------- |
| [`useTeamDirectory`](../../src/api/hooks/useCompetition.ts) | `/competitions/{id}/table` | competition, 1 h | header, every opponent name |
| [`useCompetitionTable`](../../src/api/hooks/useCompetition.ts) | same cache entry | competition, 10 min | header, Übersicht, ticker grading |
| [`useTeamSeason`](../../src/api/hooks/useMatchday.ts) | `/competitions/{id}/matchdays` | competition, 1 h | everything derived about the club |
| [`useTeamProfile`](../../src/api/hooks/useTeam.ts) | `/leagues/{id}/teams/{tid}/teamprofile` | league, 30 min | Kader, Punktesammler, the club's name |
| [`useTeamPoints`](../../src/api/hooks/useTeam.ts) | `/leagues/{id}/players/{pid}` ×N | league, 30 min | Übersicht's scorer card, Spiele |
| [`useMatchLineup`](../../src/api/hooks/useMatchLineup.ts) | several | league | Live |
| [`useLiveMatches`](../../src/api/hooks/useLiveMatches.ts) | `/matches/{id}/details` | competition | the header's live score |

`useTeamSeason` is the fourth reading of the season payload, alongside the
current matchday, the schedule and the match lookup — the season's 34 matchdays
are scanned for the club's fixtures, memoised on the team id by `select`. A
club with no fixture on some matchday simply has no entry for it, so nothing
downstream may assume `fixtures[n].day === n + 1`.

## Things worth knowing

**An endpoint's name is not evidence.** `/v4/competitions/{id}/players` cost
this page a shipped-broken tab: it was documented as "every player in a
competition" by Kickbase's own spec and by this project's notes, and it returns
one fixture's. The row count its only consumer printed — 25 — looked entirely
reasonable. Counting *which clubs* were in it took one `jq` and would have
caught it before it was built on.

**The club's side of a match is resolved by id**, never from `isHome` on some
fixture. That would be a second source of the same fact, free to disagree with
the first.

## Not built

- **Per-match event history across the season** — 34 match requests to draw
  minute-of-goal charts. The `ph` matrix already gives the per-matchday shape
  for a fan-out that is being paid anyway.
- **Anything from `pes`** — meaning still unresolved, flagged as a guess in
  [`types.ts`](../../src/api/types.ts).
- **A composite club rating.** Every figure on this page is either the API's or
  arithmetic anyone can check.
- **`GET /v4/base/predictions/teams/{competitionId}`** — the bulk source of the
  posters keyed by `tid` ([API index](../api/README.md)). No longer needed here:
  `teamprofile` serves this club's poster on the response the tab already makes.
- **`GET /v4/competitions/{id}/players/search`** — answers 200, unprobed. The
  most likely candidate for a real all-players list, which
  [All players](players.md) now has no source for.
