# Saison

[← Back to index](../README.md) ·
Routes `/leagues/:leagueId/teams` · `/leagues/:leagueId/teams/ranking` ·
[`src/pages/SeasonPage.tsx`](../../src/pages/SeasonPage.tsx)

**The season so far**, in two views: the eighteen clubs as a table, and the
players who have scored the most across all of it. Tapping a table row opens
that [club's page](team.md).

Both are about the real-world competition rather than your league, which is
what separates this page from the fantasy [Rangliste](ranking.md) of managers —
and from [Spieltag](matchday.md), which asks the same two questions of *one*
weekend.

> **The page was called *Teams*** and was the table alone. The season player
> ranking briefly lived on the matchday page as a *Saison* toggle, which was
> the wrong home: a screen built around one selected matchday should not also
> answer a question that has nothing to do with which matchday you picked. Here
> it has a sibling that shares its scope.
>
> **It also replaces the `/table` stub.** `/leagues/:leagueId/table` still
> **redirects** here, so old bookmarks land on it — the same treatment
> `/lineup` got when the pitch moved under `/squad`.

## Two views

A bottom tab bar, the same
[`BottomTabBar`](../../src/components/ui/BottomTabBar.tsx) the matchday, squad
and duel pages dock:

| Tab | What |
| --- | ---- |
| **Tabelle** | The clubs — everything below |
| **Rangliste** | The season's [100 best players](#rangliste) |

The view is a **path segment**, so each is linkable and survives a refresh, and
`?pos=` rides along on the tab link so the position filter survives a trip to
the table and back.

**The path stayed `/teams`** when the page was renamed, because the club page
lives *under* it at `/teams/:teamId`. Moving the parent would have meant either
orphaning that child or rewriting every crest link in the app for the sake of a
word in the drawer. It is also what keeps *Saison* lit when you tap into a
club: the drawer's match is a prefix one, and the list is the detail route's
parent rather than its sibling.

## The two tables

The toggle in the heading — a [`PairToggle`](../routing-and-layout.md), the
app's standard two-way control — switches the whole view, not just a column. It
belongs to the table and is **absent on the ranking**, rather than sitting
there inert:

| | Ranked by | Columns |
| --- | --------- | ------- |
| **Ligatabelle** (🏆) | the league's own placement | `#` · crest · club · `Sp` · `Tore` · `Pkt` |
| **Kickbase-Punkte** (Σ) | Kickbase points, descending | `#` · crest · club · `Sp` · `Punkte` |

**They are genuinely different tables, which is the whole point of the toggle.**
On the day this was built Stuttgart sat **7th** in the Bundesliga and **1st** on
Kickbase points; Freiburg was 2nd and 6th. A side that grinds out 1:0s ranks
high in one and low in the other. Showing Kickbase points as an extra column
against league placements would bury exactly that, so the order changes with the
currency — the same reasoning as the
[Rangliste](ranking.md)'s duel/total switch.

The Σ glyph is the one the Rangliste already uses for Kickbase points, so the
notation is learned once for the whole app.

## Scope: competition, not league

This is the one page whose data is **not league-scoped**. It reads
`competitionId` from `useActiveLeague()`, not `leagueId`:

```ts
const { leagueId, competitionId } = useActiveLeague()
const table = useCompetitionTable(competitionId)
```

That matters for caching. The key is `['competition', cid, 'table']`, outside
the `['league', leagueId]` namespace, so switching leagues does **not** drop
it — see [API layer](../api-layer.md#query-keys). Two leagues in the same
competition share one cached table, which is correct.

`leagueId` is still needed, but only to build the link into a club page.

## Where each column comes from

Two queries, and the second one is free — see below.

[`useCompetitionTable(competitionId)`](../../src/api/hooks/useCompetition.ts) →
`/v4/competitions/{competitionId}/table`, mapped to `TableRow[]`:

| Field | Column |
| ----- | ------ |
| `teamId` | the link target |
| `teamName` | Klub |
| `teamImage` | the crest — **an SVG**, not a raster image |
| `placement` | `#`, in Ligatabelle mode |
| `previousPlacement` | the movement mark beneath it |
| `matchesPlayed` | `Sp` |
| `points` | `Pkt` |
| `kickbasePoints` | `Punkte`, and the `#` in Kickbase mode |

`staleTime` is 10 minutes — a real table only changes on matchdays.

[`useSeasonRecords(competitionId)`](../../src/api/hooks/useMatchday.ts) →
`/v4/competitions/{competitionId}/matchdays`, for the one column the table
cannot serve.

### The goals column is derived, and why it has to be

**The API's table has goal *difference* and nothing else** — `14:11` and `5:2`
are the same `+3` to it — and no endpoint serves the split. Six neighbouring
spellings were probed on 2026-09-05 and every one came back empty; `?full=true`
returns the same twelve fields. The probe table is in
[the API docs](../api/competitions.md#-there-is-no-richer-table-endpoint-goals-scoredconceded-are-derived).

So the goals are summed out of the season's fixture list, which carries `t1g`
and `t2g` per match. `useSeasonRecords` groups the season by club and hands each
group to [`teamRecord`](../../src/api/models.ts) — **the same function the club
page's header already uses**, rather than a second summation with its own idea
of which matches count. That matters: `teamRecord` counts only fixtures the API
has marked finished (`st === 2`), because a 1:0 in the 30th minute is not a win.
Two derivations would eventually disagree about exactly that, and the club page
and this table would then show one club two records.

**The derivation was verified against the table itself.** Summing that way
reproduces the API's own `mc`, `gd` *and* `cp` for all 18 clubs exactly. The
page still renders the **server's** figures for those three and takes only the
goals from here — they agree today, and where they ever disagree the server is
the authority.

### Why the second query is free

`/matchdays` is the whole season in one response, cached for an hour, and
[Matchday](matchday.md), [Match detail](match-detail.md), [Squad](squad.md),
[Market](market.md) and the [club page](team.md) all already read it. This is
the fifth `select` over that one cache entry, so in any session that has opened
another page it costs no request at all.

It is also **not gated on**: the page renders as soon as the table arrives, and
the goals column shows `–:–` until the fixture list does. A complete league
table bar one column beats a spinner, and the query's error is ignored for the
same reason.

`–:–`, never `0:0` — a goalless draw is a scoreline, and a column that cannot
tell "not loaded" from "nobody scored" is worse than one that admits it.

## Ranking

**Ligatabelle mode does not compute a rank — it uses the API's own `cpl`.**
Re-deriving it would mean reimplementing the Bundesliga's tiebreakers (goal
difference, then goals scored, then the head-to-head record), and getting that
subtly wrong would show a table disagreeing with every other place the reader
has seen it. The server has already decided.

**Kickbase mode has to compute one**, because no field carries it. Clubs level
on Kickbase points *share* a rank — the count of clubs strictly ahead, plus
one — rather than being split by whatever order the payload arrived in. Same
rule as [`teamStanding`](../../src/api/models.ts), which ranks a single club for
the club page's header, so the two can never contradict each other.

The club name breaks ties in the sort, so two clubs sharing a rank never swap
places between renders.

Both live in [`clubStandings`](../../src/api/models.ts), which is a pure
function of the table, the records and the mode — the component picks columns,
not data.

## The movement mark

`PlacementChange` beneath the rank, and **only in Ligatabelle mode**. `pcpl` is
the club's previous *league* placement; hanging it off a row currently ranked by
Kickbase points would draw an arrow for movement in a different table. So
`ClubStanding.movement` is `undefined` there and the mark is simply absent
rather than borrowed.

It is `pcpl − cpl`, because every movement mark in this app speaks in **places
gained** — 5th → 3rd is `+2`. Subtracting the other way round would put a green
arrow on every relegation. Same component and same convention as
[Ranking](ranking.md#placement-change) and the
[club header](team.md).

## Layout

A real tabular layout, not cards — this is the one screen where readers scan
columns, and eighteen rows of card need a lot of scrolling.

The rows sit **flush in one card**, divided by hairlines: the
[list idiom](../infrastructure.md#the-list-idiom) the whole app uses, and here
it does the table's own job — eighteen clubs are one ranked sequence, and the
4px of page that used to show between two placements said they were eighteen
separate things. Unlike the ranked lists of managers these rows reserve **no
2px rail** on the left: nothing in a league table is ever marked as yours, and
reserving one would push every row out of line with the column header above.

Header and rows share **one grid template per mode**, declared together in
`GRID`, so the columns cannot drift apart. One string per mode rather than a
shared prefix plus extras: the point is that the header and the rows are laid
out by the *same* declaration, and a template assembled from fragments is one
edit away from being two templates again.

`minmax(0,1fr)` on the club column — not `1fr` — is what actually lets the name
truncate. A bare `1fr` floors at the content's min-width, so a long club name
would push the numbers off a narrow phone instead of ellipsing. It fits a 390px
viewport with no horizontal scroll.

The column labels are drawn **once**, above the list, and marked
`aria-hidden`: three unlabelled numeric columns are a puzzle, and repeating the
label in every row is the noisier way to solve it. `Sp` / `Tore` / `Pkt` are how
a printed German table abbreviates them, with the long form on `title` since
those forms are conventional but not universal. Screen readers get the row's own
content rather than a decorative header row.

**The whole row is the link**, not just the name: the row is what a reader aims
at, and on a phone a tap target the width of a club name is a target you miss.

## Rangliste

```
  ◀   bis 4. Spieltag          ⌄    ▶
      16. Aug – 28. Sep · Beendet

  ( Alle )  ( TW )  ( ABW )  ( MF )  ( ANG )

  1  [img] Olise                  1269
        MF                          ← the crest is behind the row
  2  [img] Kimmich         (ᴍ)     865
        MF
  3  [img] Pavlović                838
        MF

  litbase-pointcast — die besten 100 je Kategorie.
```

The season's hundred best players, points descending — the same
[`PlayerRankingTab`](../../src/components/ranking/PlayerRankingTab.tsx) the
[matchday page](matchday.md#rangliste) renders, with the same position chips
and the same owner badges. One list, two pages: the scope is the only
difference, and both go through the same
[`usePlayerRanking`](../../src/api/hooks/usePlayerRanking.ts).

**It comes from [pointcast](../pointcast.md#rankings), not Kickbase**, and that
is a judgement rather than a rule. Kickbase does serve a season ranking —
`?sorting=1` on the competition's player list, a different *question* rather
than a different sort, verified against a player's own `ph` — but it is capped
at twenty-five like everything else there. The published file is a hundred
rows with real placements, ties sharing a place, and a top hundred per
position rather than four more requests.

What it costs is freshness: the run rebuilds once a night, so from the moment
a matchday kicks off the list is behind. That is the right trade **here** and
nowhere else — a season total is not a number anyone watches move, and
[Spieltag](matchday.md) still reads the live list for the matchday in play. The
picker names the matchday the totals run through, so "behind" is on screen
rather than implied.

A competition pointcast does not publish for falls back to Kickbase's
twenty-five, which is what those leagues have always had.

### The matchday is a stopping point

`rankings/season/{n}.json` is published **per matchday**, each holding the
totals through it — so this page can answer *who was top after the second
matchday*, not only *who is top now*. That is the
[`MatchdayPicker`](../../src/components/MatchdayPicker.tsx) above the list —
the same control [Duelle](duels.md) docks, in its `card` variant, with `?day=`
in the URL beside `?pos=`.

**It reads *bis 4. Spieltag*, not *4. Spieltag*.** The selection is a stopping
point rather than a subject, and a control naming one matchday over a table of
four matchdays' points would be naming the wrong thing. The caption widens to
match: the span runs from the season's first kick-off to the selected
matchday's last, not that matchday's own weekend.

**Which matchdays it offers comes from
[`rankings/index.json`](../pointcast.md#rankings), not the fixture list.** They
disagree for a few hours every week — the run is nightly, so a matchday played
out on Sunday evening has no file until that night, and the fixture list would
have the picker offering it. The index is the list of files that exist, so the
picker cannot step onto a 404.

**No index, no picker.** That is one condition covering both reasons there
might be nothing to pick from: a competition pointcast does not cover, and a
season before its first kick-off. The list then falls back to Kickbase or to
`season/current.json` respectively, and the control is absent rather than drawn
with one option in it.

**With no `?day=` the app asks for `current.json`**, which is deliberately not
the same as asking for the newest matchday by number — see
[pointcast](../pointcast.md#rankings). Picking from the drawer always writes
the number out, so a URL can be shared and will still show the same list
tomorrow.

**The owner badge follows the selection.** `day` travels with the list, so a
ranking through matchday 2 draws the lineups *of* matchday 2 — the fan-out
reads `teamcenter?dayNumber=`, the lineup as it stood. On the default view
that makes it the most recent matchday's, which is as close to *now* as one
request gets: the badge answers "whose team was he in that weekend", not "who
owned him for the goals that got him up here". No season-long ownership
history exists anywhere to offer instead.

**It does not poll.** A season total does move while a matchday runs, but this
is not the screen anyone watches it move on — a request every ten seconds for a
number nobody is staring at. [Spieltag](matchday.md) is where live belongs.

## Navigation

`Saison` in the drawer, between *Spieltag* and *Duelle*, with a shield.

The list is the **parent** of the club route rather than a sibling, so
`isNavItemActive`'s prefix test keeps *Saison* lit when you tap into a club, and
for the Rangliste view too — and a club page reached from a crest somewhere else
now lights an entry at all, which it never did while it had no list above it.
See [Navigation](../routing-and-layout.md#navigation).
