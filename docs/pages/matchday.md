# Matchday

[← Back to index](../README.md)

`/leagues/:leagueId/matchday` · `/leagues/:leagueId/matchday/ranking`

Every match of one matchday, live while they are being played, and the way into
[one match in detail](match-detail.md).

This is the only screen in the app that is about **football** rather than about
Kickbase. Nothing on it depends on the league except the URL it lives under —
which is deliberate, because the league is how you got here and the crest under
your finger is why you stayed.

## Two views

A bottom tab bar, the same
[`BottomTabBar`](../../src/components/ui/BottomTabBar.tsx) the squad, duel and
match-detail pages dock:

| Tab | What |
| --- | ---- |
| **Spiele** | The fixtures, grouped by kick-off — everything below |
| **Rangliste** | The [best players](#rangliste) of the selected matchday |

Two questions, not one page scrolled twice. *Spiele* answers "how did the games
go"; *Rangliste* answers "who actually scored", which is a competition-wide
ranking with no relationship to the grouping-by-kick-off the fixtures are built
around. Stacking them would have meant one heading sitting above two lists that
disagree about what they are ordered by.

The view is a **path segment**, as on the squad and duel-detail pages, so each
is linkable and survives a refresh. `?day=` and `?pos=` ride along on the tab
links, so switching views keeps both the matchday you were looking at and the
[position chip](#the-position-chips-are-five-lists--made-two-different-ways)
you had picked.

## The matchday lives in the URL

`?day=` in the query string, not in component state, exactly as on
[Duels](duels.md): a weekend can be linked to, shared with the league, and
survives a refresh. The control is the shared
[`MatchdayPicker`](../../src/components/MatchdayPicker.tsx) — a step either
side, a drawer of all 34 behind the label — and **both views carry it**, on the
one `?day=`, so stepping back a matchday keeps whichever view you were reading.

The requested day is **validated against the real schedule** before it is used.
A hand-edited `?day=99` falls back to the competition's current matchday rather
than selecting nothing and rendering as an empty page.

> The picker moved out of `components/duels/` when this page was built. It was
> never duel-specific; it just had one caller.

## Grouped by kick-off

```
SA, 5. SEP. · 15:30
  [crest] FC Bayern     2:1   Dortmund [crest]
                        ● 67'
  [crest] Leverkusen    0:0   Union    [crest]
                        ● 67'

SA, 5. SEP. · 18:30
  [crest] Leipzig      –:–    Freiburg [crest]
                       18:30
```

A Bundesliga matchday is not nine matches, it is a Friday evening, five o'clock
on Saturday, the late one, and two on Sunday — so the list is grouped by
distinct kick-off with the date and time as the heading. A flat list sorted by
time says the same thing while making the reader work out where the breaks are,
and the heading means no row has to repeat the date.

The groups come out of a `Map` keyed by kick-off, filled in list order. The list
is already sorted by kick-off, so insertion order *is* render order — no second
sort, and the groups cannot disagree with the rows about the sequence.

## A row is two crests, a score and a clock

[`MatchCard`](../../src/components/matchday/MatchCard.tsx). Home on the left,
away on the right, the score between them — the arrangement every fixture list
in football uses, and the reason
[`MatchdayMatch`](../../src/api/models.ts) keeps home and away where they are
instead of resolving an "opponent" the way a player's fixture does.

**Crest *and* label**, which departs from the app's usual wordless
[`FixtureBadge`](../../src/components/squad/FixtureBadge.tsx). That badge
answers "who is my player up against", where the crest is a reminder of
something already known. Here both clubs are equally unknown and two crests at
30px are a guessing game.

The score column is a **fixed width** so the numbers line up down the list: a
column of centred `2:1`s that shifts by a character whenever a club's name is
longer reads as a broken table.

[`MatchClock`](../../src/components/matchday/MatchClock.tsx) is the third state
carrier, and the only thing on the page that moves:

| State | Drawn as |
| ----- | -------- |
| Not kicked off | the kick-off **time** — `18:30`, and `–:–` for the score |
| Running | a **pulsing dot** and the minute, both in accent, plus a tinted card edge |
| Over | *Beendet*, quietly |

A running match also gets an accent border on the card, so a matchday half
played reads as "these three are on" in one look rather than one dot at a time.

## Data

| What | Where from | Cost |
| ---- | ---------- | ---- |
| The fixtures | `useMatchdayMatches(cid, day)` → `/competitions/{cid}/matchdays` | **Nothing new** — a third `select` on the season payload the squad page, the duel picker and the player pages already share |
| The live score and minute | `useLiveMatches(matches)` → `/matches/{mi}/details` × N | One request per **started** match; a finished one is fetched once and held, only a running one polls |
| The ranking, matchday being played | `useMatchdayRanking(…)` → `/competitions/{cid}/players` | **One request per position chip**, cached per chip, and only on the Rangliste view — the Spiele view is the front door and does not pay for a list it never renders |
| The ranking, any earlier matchday | `useMatchdayRanking(…)` → `data/rankings/{cid}/matchday-{day}.json` | **One static file**, cached forever, holding every player who scored that day — the position chips are slices of it rather than four more fetches |
| The clubs in it | `useTeamDirectory(cid)` → `/competitions/{cid}/table` | Shared cache entry with the [Saison](season.md) page; club names for the ranking's second line |
| Who owns them | `useRanking(id)` + `useMatchdayLineups(id, day, managerIds)` | One cached request for the managers, then **one per manager** — the same fan-out and the same cache entries the [match lineup](match-detail.md) uses |

So an upcoming matchday costs **zero** requests beyond the cached season list,
and a matchday with one late kick-off still running costs one request a tick
rather than nine. The live rate is **10 s**, one constant in
[`polling.ts`](../../src/api/polling.ts), gated per running match.

**The list goes live on its own.** The fixture-list query starts polling ten
minutes before the current matchday's first kick-off rather than only once
something is running — without that head start nothing re-read the clock, and a
page left open since the morning kept showing `–:–` through the whole afternoon.
The reasoning is on `isMatchdayLive()` in
[`useMatchday`](../../src/api/hooks/useMatchday.ts) and in more detail under
[match detail](match-detail.md#getting-from-upcoming-to-live-without-a-reload).

`useLiveMatches` used to take the team-keyed fixture map and now takes any
sequence of things carrying a match id, a kick-off and a finished flag — which
is what lets a fixture *list* drive it as naturally as a player's fixtures do.

## Rangliste

```
  ‹   2. Spieltag ⌄                      ›
      5.–7. Sep. · Beendet
  ─────────────────────────────────────────

  ( Alle )  ( TW )  ( ABW )  ( MF )  ( ANG )

  1  [img] Maza                    319
        MF · Leverkusen
  2  [img] Vagnoman        (ᴍ)     290
        ABW · Stuttgart
  3  [img] Grüll                   290
        MF · Bremen

  Kickbase liefert die besten 25 je Kategorie.
```

The competition's **best players**, points descending, each row a link to that
player. Rank, portrait, name over position and club, score on the right —
deliberately the club page's *Punktesammler* row, because the same question in
a different scope should not look like a different kind of list. The second
line differs: there it is position and market value, here it is position and
**club**, since a competition-wide list is the one place where "who does he
play for" is not already answered by the surrounding screen.

### Two sources, one list

Kickbase serves exactly one ranking and it is always the **current** matchday's.
So an earlier matchday is answered from
[`data/rankings/`](../../data/README.md) instead — the app's own files, built
from per-player performance histories by
[`scripts/build-matchday-rankings.mjs`](../../scripts/build-matchday-rankings.mjs)
and committed to the repo.

| Selection | Source | Rows | Position chips |
| --------- | ------ | ---- | -------------- |
| The matchday being played | Kickbase, live | 25 | a request each |
| Any earlier matchday | `data/`, ours | 100 | slices of one file |

[`useMatchdayRanking`](../../src/api/hooks/useMatchdayRanking.ts) is the seam,
and the only place in the app that knows there are two sources — everything
downstream of it sees one shape.

**The row counts differ, and are left differing.** 25 is Kickbase's cap and no
parameter raises it; our own files hold every player who scored, so 100 is a
display choice with room above it. Padding one list or trimming the other would
invent a consistency the data does not have, so a footnote under the rows says
which you are reading instead.

**A matchday with no file yet says so**, and names the command that makes one.
That is an ordinary state — every matchday is in it until the script runs — so
it gets a sentence and a way out, not an error box with a retry that cannot
help.

### The picker is the page heading

*2. Spieltag*, a chevron, the dates and the state — in the place the page title
used to be, on **both views**, with a rule under it doing the separating a
heading's whitespace used to.

The title was doing nothing the control below it was not already doing better:
**Spieltag** over a control reading **2. Spieltag** is the same word twice with
the useful half in the smaller type. The picker's own doc comment had claimed
since it was written that *the heading of the page is itself the control*; this
is that, finally drawn. It renders as an `h1` **wrapping** the trigger — a
heading is flow content and a button may only hold phrasing, so nesting them
the intuitive way is invalid markup and the accordion pattern is not.

`variant="heading"` also takes the tiles off the step arrows. Three bordered
boxes across the top of a page read as a toolbar; two ghost arrows either side
of a title read as a title.

> **There was a *Spieltag* | *Saison* toggle here** for a day, `?scope=season`
> onto the endpoint's `sorting=1`. It moved to
> [Saison](season.md#rangliste), where it is a sibling of the league table
> rather than a second scope bolted onto a screen built around one selected
> matchday. Same component, same chips, one parameter's difference — see
> [`PlayerRankingTab`](../../src/components/ranking/PlayerRankingTab.tsx),
> which is now shared between the two pages.

The top three carry the accent colour and nothing else does. A podium reads as
a podium without medal glyphs, and three tinted rows in twenty-five stay
legible where three icons would just be more to look at.

### The owner badge is the point

`(ᴍ)` above is the **owning manager's avatar** — the same
[`OwnerBadge`](../../src/components/matchday/OwnerBadge.tsx) the
[match lineup](match-detail.md#ownership-is-the-point) uses, with the viewer's
own players taking the accent ring. Every badge is drawn at full opacity — a
player somebody owned but left out is told apart by its wording, not by a fade
that only made a 16px face harder to recognise.

That slot carried the player's **club crest** first, which was redundant on
sight: the club is already named on the line below. The manager's avatar turns
a list of strangers into a list about the league — *two of the top ten are
somebody's, and one of them is mine* — which is the only thing on the screen
that a Kickbase table does not already tell you.

**An unowned player gets nothing there**, not a crest fallback. A column that
held "either a club or a manager" would take a moment's reading to tell which,
where an empty slot reads instantly as *nobody has him*. The slot keeps its
width either way so the scores stay in a column. In most leagues most of the
twenty-five will be unowned, and that is exactly what makes the filled rows
worth looking at.

Ownership costs the league standings — one cached request, shared with every
page that names a manager — plus the
[matchday-lineup fan-out](../../src/api/hooks/useMatchdaySquad.ts), one request
per manager. The same fan-out the match lineup pays, sharing the same cache
entries, and it is scoped by the view: the component only exists while the
Rangliste is open, so nothing is asked for until it is.

### It costs one request

`/competitions/{cid}/players` returns the ranking **already sorted**, so this
view is a single small response. That is the only reason it is cheap enough to
sit behind a tab anyone might tap: per-player matchday points otherwise come
from [`useMatchdayPoints`](../../src/api/hooks/useMatchdayPoints.ts), which
fans out one request per player and would have meant several hundred across
nine fixtures. It polls at the live rate while the matchday runs.

### Twenty-five is the API's number

Not a `.slice()` taken here. The endpoint returns exactly that many, and no
parameter raises the cap — `max`, `limit`, `start`, `count`, `size`, `top`,
`page`, `offset` and `n` were each probed and each answered the identical rows.
It holds for every position, which is why the footnote names the source rather
than the screen promising a count in the heading: the number is 25 or 100
depending on where the rows came from.

### The position chips are five lists — made two different ways

*Alle · TW · ABW · MF · ANG*, above the rows.

**Live, each chip is a request**, and has to be. `?position=` is the other
parameter the endpoint honours and the twenty-five cap applies to **each
filtered list separately**, so *ABW* is not the defenders out of the overall
twenty-five but the top twenty-five defenders — most of whom the *Alle* list
has no room for. Between them the chips reach **93 distinct players** where the
unfiltered call reaches 25. A `.filter()` over the rows already in hand would
have shown four or five names per position and called it a ranking.

**In the archive each chip is a filter**, for the mirror-image reason: the file
holds every player who scored that matchday, so there is no cap to get past and
four more fetches would buy nothing that is not already in memory.

Live, each chip is its own cache entry: one looked at once comes straight back,
and only the one on screen polls. Where the chips sit is deliberate either way:
**inside the ranking, above the rows they change** — not up beside the matchday
picker, which changes what the whole screen is about rather than which slice of
it you see.

**A short list is not a truncated one.** *TW* comes back with 18 rows on a live
nine-fixture matchday, because that is every keeper who played rather than a
slice of them. The archive says 18 there too, for the same reason and from a
different source.

The chip lives in the URL as `?pos=`, beside `?day=` and for the same reasons —
*2. Spieltag, Torwarte* is worth linking to, and it survives a refresh and a
trip to the fixtures and back. An unrecognised value falls back to *Alle*.

### The picker is on both views now

The endpoint takes a position but **no matchday at all** — `dayNumber`,
`matchId`, `mi` and six more spellings were each probed and each answered the
identical rows. While that was the whole story the picker was *hidden* on this
view: a control that visibly does nothing is worse than its absence, because it
would imply the list below had followed.

With [`data/rankings/`](../../data/README.md) behind it the control does
something, so it is the same [`MatchdayPicker`](../../src/components/MatchdayPicker.tsx)
on the same `?day=` as the fixtures — step a matchday and the ranking follows;
switch views and you keep the day you were on.

**The two views do not offer the same matchdays.** The fixtures exist for all
34; a ranking exists from kick-off onwards. So the Rangliste is handed a
schedule narrowed to the matchdays that have one — steps and drawer alike — and
a `?day=` pointing at an unplayed matchday falls back to the newest that does,
rather than drawing a picker whose label is not in its own list. Before the
season's first kick-off there is no picker at all, just a line saying so.

### The owner badge across matchdays

On an **archived matchday it is historically correct**, which is worth saying
because nothing else on the screen is fetched per matchday: the fan-out reads
`teamcenter?dayNumber=`, the lineup *as it stood*, so a row from matchday 1
shows who fielded him on matchday 1.

It is the one thing on the screen that could quietly have been *now* instead of
*then*, which is why it is worth stating: the badge answers "who fielded him
that weekend", not "who owns him today".

The matchday number travels **with the list** (`day` on the response) rather
than being read off the season schedule, so the page shows the endpoint's own
answer to "which matchday is this" and a disagreement between the two would be
visible rather than silent.

## The score is the live one wherever there is one

The season fixture list carries goals as well (`t1g`/`t2g`), and it is cached
for an hour because it is the whole season. On a running match that would put an
hour-old number next to a pulsing dot. So the match's own payload wins, and the
fixture stays the fallback — which is exactly right the moment a match is over
and nothing can change, and it is all there is for the second before the live
answer lands.

## States

| State | Rendering |
| ----- | --------- |
| Schedule loading | Heading + `SkeletonList rows={9}` |
| Schedule error | `ErrorState` with retry |
| Matchday with no fixtures | `EmptyState` — the shape allows it, the API has not been seen to return it |
| Ranking loading | `SkeletonList rows={10}` |
| Ranking, nobody has scored yet | `EmptyState` — what an upcoming matchday looks like before kick-off |
| Ranking, a past matchday picked | `EmptyState` naming the current matchday, with a tap to switch to it |

Live scores arriving late never block the rows: a match renders with the
fixture's own score and refreshes in place, which is what keeps a live page from
flashing a skeleton every minute.

## Possible extensions

- **The league's players on a fixture row.** A count of how many owned players
  are involved in each match would say where a matchday is going to be decided
  before you tap in. It needs the ownership fan-out the
  [detail page](match-detail.md#ownership-is-the-point) does per match, which is
  too much for nine of them at once — unless a bulk ownership source turns up.
- **A team page** behind each crest, which the `TODO` in
  [`litbase.specs.md`](../../litbase.specs.md) already names.
