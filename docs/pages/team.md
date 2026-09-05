# Club

[← Back to index](../README.md) · Route `/leagues/:leagueId/teams/:teamId` ·
[`src/pages/TeamDetailPage.tsx`](../../src/pages/TeamDetailPage.tsx)

One Bundesliga club, in four views:

| Route | View | Costs |
| ----- | ---- | ----- |
| `/leagues/:leagueId/teams/:teamId` | Übersicht | **nothing** — three shared caches |
| `…/squad` | Kader | one request per player (~25–30) |
| `…/matches` | Spiele | the same fan-out, shared with Kader |
| `…/live` | Live | the match lineup's ~36 players, polling |

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
  is, else the next, else the last played — which links through to the match
  page.

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

## Übersicht

Everything here is arithmetic over three payloads the app already holds:
`/competitions/{id}/table`, `/competitions/{id}/matchdays` and
`/competitions/{id}/players`. All three are cached for an hour and shared with
the squad, matchday and market pages, so **opening a club costs no request**.
That is a design constraint rather than a happy accident: the expensive
per-player fan-out is deferred to the tabs that genuinely need it.

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

The five biggest scorers, with **points per 90 minutes** beside the total. The
total alone rewards whoever has been fit longest; a substitute on 40 from 200
minutes and a starter on 90 from 540 look nothing alike in a season column and
are the same player for the purpose of buying one — and the cheaper of the two
is the one nobody has noticed.

A rate is `–` for a player with no minutes, never `0`: he has no rate, and a
zero would rank him below someone who has actually played badly.

## Kader

The tab the page is worth building for, and the one that costs something.

**Every player, always, in one flat list.** No filters and no sections: a club
has twenty-five to thirty players, which is a single screenful of scrolling,
and a filter over a list that short mostly hides the comparison the reader came
to make. Sorted by **position, then name** — so the shape of the squad is the
order of the list, and a player is found where his name puts him rather than
where this week's form does. Names sort through `localeCompare(…, 'de')`,
without which every umlaut lands after Z and Özcan turns up under Zirkzee.

Each row is a link to the [player's own page](player-detail.md), where the
season history, the market-value chart and the ownership detail live.

Rows carry the free half immediately — name and position, from the competition
list — and fill in with the things that only exist league-scoped:

| On the row | Wire field | Source |
| ---------- | ---------- | ------ |
| **Marktwert** | `mv` | `/v4/leagues/{id}/players/{pid}` |
| **Änderung 24 h**, with its arrow | `tfhmvt` | same response |
| **Startelf-Wahrscheinlichkeit** | `prob` | same response |
| **Besitzer**, as the manager's photo | `oui` | same response |
| Verletzt / gesperrt, and why | `st`, `stxt` | same response |

The probability sits on the second line **beside the position**, not next to
the name — beside the name it would collide with the availability mark, and the
two mean different things: *verletzt* is a fact, *unwahrscheinlich* is
somebody's estimate. Same separation the [squad list](squad.md) makes.

The availability mark stays even though it is not one of the columns this list
is for. A `prob` tier does not imply it — an injured player often carries no
assessment at all — so dropping it would lose the one signal a scouting list
must not be wrong about.

The 24-hour change is drawn exactly as the squad list draws it: the arrow is
the *same* signal as the amount, its direction, so the two cannot contradict
each other, and it is omitted on a flat day rather than pointing nowhere. A
value that has not arrived is `–`, never `0 €` — a zero would read as a
worthless player rather than as a pending request.

### One fan-out, four answers, and a fifth for free

There is **no bulk spelling** of that endpoint — `/leagues/{id}/players` and
`?ids=` both 404 — so this is one request per player, twenty-five to thirty for
a Bundesliga club. It is worth paying once because a single response answers
every column *and* carries `ph`, the player's points for every matchday of
the season, which is what the [Spiele](#spiele) tab adds up per club.

The cache key is `qk.playerDetail`, the same entry the squad page's probability
badges, the player detail page and every points fan-out fill — so a club whose
players have been looked at this session is already half fetched, and nothing
polls: a market value moves once a night.

See [`useTeamRoster`](../../src/api/hooks/useTeam.ts).

### `oui` is the right owner *here*

It is who owns the player **today**, which is the question a club's roster asks
and the exact opposite of what a played matchday wants — reading it on a match
page credited every transferred player to his new manager, twice, before
[`useMatchLineup`](../../src/api/hooks/useMatchLineup.ts) settled on the
per-manager snapshot instead.

Because the claim is always "owns him now", the roster reuses the match
lineup's own [`OwnerBadge`](../../src/components/matchday/OwnerBadge.tsx) and
[`ownerLabel`](../../src/components/matchday/ownerLabel.ts) verbatim:
`TeamSquadOwner` **is** `MatchPlayerOwner` with `source: 'currentOwner'`, and
that source's wording — *Gehört X* / *Dein Spieler* — is already right.

### The lineup poster finally has a home

`plpim` is a 1280×1809 Ligainsider graphic of the whole projected XI, **the same
hash for every player at a club** — which is what made it useless as a corner
badge on a portrait and makes it exactly right on a club page. It is taken from
the first player who carries one and opens in the existing
[`LineupPosterDialog`](../../src/components/player/LineupPosterDialog.tsx).

Absent without Membership, in the off-season, and for a club nobody has
assessed — all normal, none an error, so the button simply does not appear.

### The summary

Two tiles above the list: the **Kaderwert** (a sum over the values that have
arrived, so it climbs rather than jumping from nothing) and **In deiner Liga**,
`14 / 27` with how many of them are yours. Not "Bayern are worth 600 million"
but "eleven of these are already gone, and three of them are mine".

## Spiele

All 34 fixtures, ascending, the current matchday marked with an accent edge —
an edge rather than a filled row, because a tint at this density reads as a
selection the tap did not make.

The right-hand column is what makes it a tab rather than a card: **what the
club's players scored on each matchday**. A 0:0 that yielded 480 points and a
4:1 that yielded 260 are the sort of thing only this column says out loud, and
they are the weeks a manager wants to know about.

Nothing else in the API answers "where were this club's points" — there is no
bulk per-matchday source, per
[`useMatchdayPoints`](../../src/api/hooks/useMatchdayPoints.ts). It comes out
of the Kader's fan-out: `ph` on each response is that player's whole season, so
the same twenty-six requests yield the club's total for all 34 matchdays.
Flicking between the two tabs therefore costs nothing; the Übersicht, needing
neither, pays for neither.

The days are read through the **exported** `matchdayEntry()` rather than by
indexing `ph` directly. That array is newest-first and indexed off the
payload's own `day`, and a second copy of that arithmetic — off by one in the
same quiet way — is a bug that has already shipped once: every matchday would
still have a plausible total, just the wrong one.

A matchday with no total is `–`, never `0`. The bar under each figure is scaled
to the club's **own best matchday**, because Kickbase points have no natural
ceiling and the useful comparison is between this club's weeks.

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
| [`useCompetitionPlayers`](../../src/api/hooks/useCompetition.ts) | `/competitions/{id}/players` | competition, 1 h | Punktesammler, the Kader's free half |
| [`useTeamRoster`](../../src/api/hooks/useTeam.ts) | `/leagues/{id}/players/{pid}` ×N | league, 30 min | Kader, Spiele |
| [`useMatchLineup`](../../src/api/hooks/useMatchLineup.ts) | several | league | Live |
| [`useLiveMatches`](../../src/api/hooks/useLiveMatches.ts) | `/matches/{id}/details` | competition | the header's live score |

`useTeamSeason` is the fourth reading of the season payload, alongside the
current matchday, the schedule and the match lookup — the season's 34 matchdays
are scanned for the club's fixtures, memoised on the team id by `select`. A
club with no fixture on some matchday simply has no entry for it, so nothing
downstream may assume `fixtures[n].day === n + 1`.

## Things worth knowing

**The competition player list has no market values.** It carries performance
only, which is the single fact that decides the cost structure of this whole
page — see [All players](players.md#note-on-market-value), which hit the same
wall.

**`st` is omitted for a fit player on some payloads and sent as `0` on others.**
So an *arrived* response means fit unless it says otherwise, and `undefined`
has to keep meaning "not fetched yet" — which is what lets a row draw no
availability mark while the fan-out is still in flight, rather than asserting
that a player nobody has heard back about is healthy.

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
  posters keyed by `tid` ([API index](../api/README.md)). It would give the
  Kader its poster without waiting on the fan-out, which is the one thing on
  the page that currently depends on a request it does not otherwise need.
