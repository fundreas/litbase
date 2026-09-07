# Duels — "Duelle"

[← Back to index](../README.md) ·
Routes `/leagues/:leagueId/duels?day=N` · `/leagues/:leagueId/duels/ranking?day=N` ·
[`src/pages/DuelsPage.tsx`](../../src/pages/DuelsPage.tsx)

One matchday of the league, two ways: every manager's head-to-head, and the
same managers ranked by what they scored. **Duel leagues only** — see
[Availability](#availability).

## Two views

A bottom tab bar, the same
[`BottomTabBar`](../../src/components/ui/BottomTabBar.tsx) the matchday, squad
and detail pages dock:

| Tab | What |
| --- | ---- |
| **Duelle** | The pairings — everything below |
| **Rangliste** | The [matchday's standings](#rangliste): every manager, best first |

Two questions, not one page scrolled twice. *Duelle* answers "how is my duel
going"; *Rangliste* answers "who won the weekend", which the pairings answer
only two managers at a time. The second **re-orders the whole field**, which is
exactly what the first does not do, so stacking them would have put one heading
above two lists that disagree about what they are sorted by.

The view is a **path segment**, as on the matchday, squad and duel-detail
pages, so each is linkable and survives a refresh. `?day=` rides along on both
tab links, so switching views keeps the matchday you were looking at rather
than snapping back to the current one.

They do not offer the **same** matchdays — see
[The Rangliste stops at kick-off](#the-rangliste-stops-at-kick-off).

## Layout

```
  ‹   2. Spieltag ⌄                      ›     ← the picker IS the page
      Fr, 4. Sep. – So, 6. Sep. · Live           heading, on both views
  ─────────────────────────────────────────

  ┌────────────────────────────────────────────┐
  │ (A) Peterpan007    ⚔     Danger du     (A) │  ← accent border: your duel
  │     978 Pkt                    834 Pkt     │
  │     ● 8 im Einsatz        ● 3 im Einsatz   │  ← only while a match runs
  ├────────────────────────────────────────────┤
  │ (A) Max            ⚔          Olaf     (A) │
  │     ✓ 948 Pkt                  906 Pkt     │
  └────────────────────────────────────────────┘

  ┌───────────────────┬───────────────────┐
  │   ⚔  Duelle       │  ☰  Rangliste     │       ← fixed to the viewport
  └───────────────────┴───────────────────┘
```

A duel card is **two mirrored halves** around a divider — avatar outside, text
turned to face the middle. That is what makes it read as a duel rather than as
two list rows that happen to share a border. Both names truncate: a phone at
360px leaves roughly 110px per side, and manager names are not short.

**The whole card is a link** to [Duel detail](duel-detail.md), carrying the
selected matchday with it — not a chevron in the corner, because a duel row on
a phone is a big target and every part of it means "this duel".

**Your own duel is pulled to the front** and outlined in `border-accent/50`.
It is the one the page was opened for; making it findable by scanning rather
than reading is the whole point on a phone. The rest keep the hook's order,
which is by the better-placed of the two managers, so the top of the duel table
comes first.

## The subtitle switches on kick-off

This is the page's one real rule:

| Matchday | Subtitle under each name |
| -------- | ------------------------ |
| Started (live or finished) | `978 Pkt` — that matchday's points, live while it runs |
| Not started | `4. Platz` — the manager's current standing |

Before kick-off every score is `0`, and printing "0 Pkt" ten times would say
nothing at all. The standing is what is actually known at that moment, so that
is what is shown. The placement is the **duel table** position (`hhpl`) where
there is one — in a duel league that *is* the league's table — falling back to
the points placement (`spl`).

### Marking who is ahead

Once the matchday has started the leading side's points are set in
`font-semibold text-ink` against the other's `text-muted`, and a finished duel
adds a green `CircleCheck`. Never colour alone: the
[ranking page](ranking.md#duel-outcome) settled that colour is not a cue
everyone gets. What the emphasis *means* is spelled out for screen readers
("– gewonnen" / "– in Führung"), which would otherwise get a bare number and no
way to tell who is winning.

The leader is decided by comparing the two managers' matchday points, exactly
as `duelResultOf()` does on the ranking page — not by reading `hhmp`. See
[Which field is the duel points](ranking.md#which-field-is-the-duel-points).
Before kick-off both sides are level at `0`, so `duelLeader()` returns nothing
and the card must gate on `hasStarted` before reading "level" as a draw.

## Players on the pitch

While a match is actually being played, each manager gets a third line under
their score: **`● 8 im Einsatz`**, in accent, behind the same pulsing dot every
live surface in the app uses.

It answers the question a live duel list raises and the score alone cannot: 40
points behind with eight players still on the pitch is not the same position as
40 behind with none. The [detail page](duel-detail.md) says the same thing
about *matches* (`n laufend · n offen`); here it is about **players**, because
that is the finer-grained figure and the list has room for exactly one line of
it.

**Only managers with somebody playing get the line.** A `0` is not news, and a
column of zeroes between the blocks would be noise — which is also why the
line disappears entirely once every match of the moment has finished.

It sits *under* the points rather than beside them: at 360px a card leaves
roughly 110px per side, and `978 Pkt · 8 im Einsatz` does not fit in that.

### What it costs

[`useActivePlayerCounts(leagueId, competitionId, day, userIds)`](../../src/api/hooks/useActivePlayerCounts.ts)
→ one `managers/{userId}/squad` per manager. There is no bulk source of who is
fielded, so a page of five duels is ten requests — and the gate is what makes
that acceptable:

- **Nothing is fetched unless a fixture is actually running.** Not "the
  matchday is live": between the Saturday blocks every match is either
  finished or still to come, nothing is on the pitch, and the answer is zero
  for everybody without asking.
- **The squads are held, not polled.** Kickbase locks a lineup at the first
  kick-off, so `lo` cannot change while the matchday runs. Five minutes, the
  same as [`useManagerSquad`](../../src/api/hooks/useDuelRosters.ts) — and the
  *same query key*, so opening a duel from this list finds both managers'
  squads in cache already.

A player counts when he is **fielded** (`lo !== undefined`, tested against
`undefined` because `0` is the goalkeeper) and his club is in a running
fixture. Bench players are in the stadium too but cannot move the duel. Which
fixtures are running comes from the matchday list the picker already loaded,
via `fixtureState()` against the clock — so a match kicking off starts counting
at the next of the page's once-a-minute renders, with no extra request.

A manager whose squad has not arrived yet is **absent from the map**, not zero,
so the card shows nothing rather than briefly claiming he has nobody playing.

The "Ohne Gegner" managers do not get the line — they have no duel for the
number to qualify.

## The matchday picker

The heading block *is* the control: tapping it opens a drawer listing all 34
matchdays. A separate "Spieltag wählen" button beside a static label would
spend a second row of a phone screen saying the same thing twice.

### It is the page heading

`variant="heading"` — the [shared picker](../../src/components/MatchdayPicker.tsx)
takes the `h1`'s size and weight, on **both views**, exactly as on
[Spieltag](matchday.md#the-picker-is-the-page-heading). **There is no page title
above it and no subtitle beside it.** A title reading *Duelle* over a control
reading *2. Spieltag* spent a row of a phone screen on the word already lit in
the drawer, and everything either view shows is about the one selected matchday.

The old subtitle — *Live-Punkte, minütlich aktualisiert* / *Endstand des
Spieltags* / *Noch nicht angepfiffen* — said the same thing the picker's own
caption already says: the date range, then **Live** / **Beendet** / **Offen**
from [`matchdayState()`](#has-it-started). One line instead of two, and the
state now sits next to the matchday it describes.

### The Rangliste stops at kick-off

Pairings are drawn for the whole season, so *Duelle* offers all 34 matchdays. A
**ranking** of a matchday nobody has played is a column of zeroes presented as
a result, so the Rangliste is handed a schedule narrowed to the matchdays that
have kicked off — `matchdayState(entry) !== 'upcoming'` — and the steps and the
drawer both read that narrowed list, so they cannot disagree about what is
reachable.

`?day=` is shared between the views, and it *can* name an unplayed matchday.
Arriving on the Rangliste with one selected falls back to the **newest matchday
that does have a ranking**, rather than rendering a picker whose label is not
in its own list. Same rule and same reasoning as the matchday page's own
[Rangliste](matchday.md#the-picker-is-on-both-views-now).

Before the season's first kick-off there is nothing to pick: the Rangliste
renders a plain *Rangliste* heading and an empty state, because a picker over
an empty range would be a heading reading "undefined. Spieltag".

The drawer opens from the **right**. Left belongs to the app's navigation, and
two drawers arriving from the same edge read as the same surface.

Each row carries the matchday number, its date range and a state chip —
**Beendet** / **Live** (with a pulsing dot) / **Offen**. The competition's
current matchday is tagged `aktuell`. The selected row scrolls itself into view
on open, via a ref callback: the drawer mounts when it opens, 34 matchdays do
not fit on a screen, and opening the list at matchday 1 in April would be
useless.

### A step either side

`‹` and `›` flank the label, from
[`StepButton`](../../src/components/ui/StepButton.tsx). Stepping to the
neighbouring matchday is what this control is used for nearly every time, and
routing that through a drawer of 34 rows was three taps and a scroll to see
last week.

They are **disabled, not hidden**, at matchday 1 and 34: an arrow that vanishes
takes the layout with it and shifts the label sideways as you walk the season.
Each one names its **destination** rather than its direction — "3. Spieltag",
not "zurück" — since that is both the tooltip and the accessible name.

The neighbours are read out of the schedule by index rather than computed as
`selectedDay ± 1`, so a gap in the fixture list can never step onto a matchday
that does not exist.

The same control flanks the season picker on the
[player's performance tab](player-detail.md#the-season-picker), which had the
identical problem.

### Which matchday is "current"

**The default comes from the competition, not from the ranking.** The two
disagree:

| Source | Field | With matchday 1 played and 2 not yet kicked off |
| ------ | ----- | ----------------------------------------------- |
| `/v4/competitions/{id}/matchdays` | `day` | `2` — the upcoming one |
| `/v4/leagues/{id}/ranking` | `day` | `1` — the last **scored** one |

The spec asks for "the current one from the competition", which is the first —
and it is also the right default for a picker, because it is the matchday
people are about to watch.

### Has it started?

From the fixtures' kick-off times, not from a flag. Fixtures carry `st`, but
only `0` (upcoming) and `2` (finished) have ever been observed, so a matchday
*in progress* is not distinguishable from `st` alone.
[`matchdayState()`](../../src/api/models.ts) therefore reads:

- `finished` — every fixture reports `st === 2`
- `live` — the earliest kick-off has passed
- `upcoming` — otherwise

It is a **function, not a stored flag**, deliberately. The matchday list is
cached for an hour, so a boolean computed at map time would go stale inside its
own cache window.

While a matchday is `live` the duel query polls at the shared live rate
(`refetchInterval`), and its `staleTime` drops to zero. A settled matchday
cannot change and is held for five minutes.

## Rangliste

```
  ‹   2. Spieltag ⌄                      ›
      Fr, 4. Sep. – So, 6. Sep. · Beendet
  ─────────────────────────────────────────

  1.  (A) Peterpan007                  978
          ✓ Gewonnen vs. Danger du   3 Duellpkt
  2.  (A) Max                          948
          ✓ Gewonnen vs. Olaf        3 Duellpkt
  3.  (A) Olaf                         906
          ✗ Verloren vs. Max         0 Duellpkt
```

[`ManagerRankingTab`](../../src/components/ranking/ManagerRankingTab.tsx) —
every manager of the league, ordered by the points they scored **on the
selected matchday** (`mdp`). The counterpart of the matchday page's
[`PlayerRankingTab`](matchday.md#rangliste): that one ranks the competition's
*players* for a matchday, this one ranks the league's *managers* for it.

**Not the same table as [Rangliste](ranking.md).** That page is the league as
it stands — cumulative, duel-table-ordered, unaffected by which matchday you
were looking at. This is one matchday in isolation, which is the reading this
page is already about.

**The row is the duel.** Each one names the opponent, says how the duel went,
and links to [that duel in detail](duel-detail.md) carrying `?day=` — the id is
rebuilt from the pair with `duelIdOf()`, the same string
[`mapDuels`](../../src/api/hooks/useDuels.ts) produces, so no lookup table is
needed. A manager without an opponent (an odd-sized league) is a plain row:
there is nothing to open. The outcome is resolved by `duelResultOf()`, on the
matchday points both managers actually scored — see
[Which field is the duel points](ranking.md#which-field-is-the-duel-points).

**The outcome is only claimed once the matchday is over.** *Gewonnen* is past
tense, and a duel under way has not been won by anybody — level at `0` in the
third minute would read as *Remis*, which is the one thing it is not. While the
matchday runs a row names the opponent and stops there; who is ahead is what
the list's own order says, and the duel card on the other tab is where a live
duel is meant to be read.

The **duel points earned** (`hhmp`, 3 or 0) sit under the score as the second
figure, and the matchday's own points are the headline, because that is what
the list is ranked by.

### The placement is Kickbase's where there is one

`mdpl` is the API's own placement for the matchday, so it is preferred over
counting rows: two managers level on points then share a place instead of being
told apart by the sort. It reads `0` for a matchday nobody has scored in yet —
the first minutes of a live one, most of all — and the row index stands in
there, which keeps a ranking of zeroes numbered `1…10` rather than `0…0`.

## Availability

A league that does not play duels has no duels page:

- **The drawer entry is hidden.** `navigation.ts` marks it
  `requiresDuelMode: true` and `NavContent` filters on `useRanking`'s
  `isDuelMode`. See [Navigation](../routing-and-layout.md#navigation).
- **The route redirects** to the events page. It has to be registered
  unconditionally — the route table is built at module load, before any league
  is known — so the page itself is what makes the URL a dead end.

`isDuelMode` is detected from the data (`hhpl` present), not from a flag; the
reasoning is in [Ranking](ranking.md#duel-mode). The page reads it off its
*own* response rather than issuing a second `useRanking`, so the guard costs no
extra request.

## The matchday lives in the URL

`?day=N`, not component state, so a duel weekend can be linked to and survives
a refresh — the same reason the league id is in the path. Selecting a matchday
uses `replace`, so the back button means "leave the page" rather than walking
back through every matchday that was looked at.

An absent or nonsensical `day` **falls back to the competition's current
matchday** rather than erroring. That is not politeness: the ranking endpoint
answers `200` for `dayNumber=0`, `35` or `99` with every per-matchday field
quietly missing, so an unvalidated `day` would render a page of empty duels
instead of an error. The page checks the requested day against the real
schedule before asking for it.

## Data

One request builds **both views**:
[`useDuels(leagueId, day, { isLive })`](../../src/api/hooks/useDuels.ts) →
`/v4/leagues/{leagueId}/ranking?dayNumber={day}`. The only thing on top of it
is the per-manager squad fan-out behind
[`n im Einsatz`](#players-on-the-pitch), which stays asleep unless a match is
being played — and which the Rangliste asks for **nobody**, since the line it
feeds is on the duel card.

### One response, two readings

The pairings and the ranking are the same `us` array. So the **response** is
what sits in the cache and each hook maps it in `select` — the arrangement
[`useSeasonSchedule`](../api-layer.md#query-hooks) and `useMatchDetails`
already use, and the reason switching tabs issues no request at all:

| Hook | Reading | Sorted by |
| ---- | ------- | --------- |
| `useDuels` | Pairings, via `hhoui` | the better-placed of the two |
| `useMatchdayStandings` | Managers, one row each | `mdp`, that matchday's points |

Both map a manager with the *same* [`toRankedManager`](../../src/api/hooks/useRanking.ts)
the season table uses, so a field added for one page cannot be missing on the
other. Only the sort differs.

Each selector is **memoised on the matchday**: React Query memoises `select` on
the function's identity, and an inline arrow would re-map on every render and
hand back fresh objects — which this page holds across renders and fans out
over.

The Rangliste's hook is left **idle on the Duelle tab**, passed `undefined` for
its league id, which is how every hook in the app waits. The mapping is not
free and nothing renders it there.

**There is no duel endpoint.** `?dayNumber=` on the standings is the whole
source — probed, with `/duels`, `/duels/{day}`, `/ranking/{day}`,
`/matchdays/{day}`, `/battles`, `/h2h` and `/ranking/duels` all answering 404.
See [API layer](../api-layer.md#endpoints-probed-but-unused).

With the parameter, the same standings payload comes back scoped to that
matchday: `hhoui` names **that matchday's** opponent and `mdp` holds that
matchday's points. Confirmed on a live league — days 1 and 2 return different
pairings for the same ten managers.

[`useSeasonSchedule(competitionId)`](../../src/api/hooks/useMatchday.ts)
supplies the picker. It shares a cache entry with `useCurrentMatchday` — same
query key, two `select` functions — so the squad page having been visited makes
this page's schedule free, and vice versa. Both selectors are **module-level
constants**: React Query memoises `select` on the function's identity, and an
arrow created during render would re-map on every render.

### Pairing

`hhoui` is mutual, and verified so: on a real matchday every manager's opponent
named them back, and ten managers resolved to exactly five duels with none left
over. `mapDuels()` is still defensive — each manager is consumed once, and one
whose opponent is missing from the payload lands in `byes` rather than in a
half-empty card or silently dropped. `byes` renders as an "Ohne Gegner" section
below the duels and is normally empty; an odd-sized league is the case it
exists for.

Within a duel the sides are ordered by table position, so the better-placed
manager is always on the left. The duel's `id` is both manager ids sorted and
joined, which keeps React keys stable no matter which side the loop reached
first.

## States

| State | Rendering |
| ----- | --------- |
| Loading (schedule or duels) | A picker-shaped placeholder plus `SkeletonList rows={6}` — the heading *is* the picker, so a title about to be replaced by something else would be the wrong placeholder |
| Error | `ErrorState` with retry, whichever query failed |
| Not a duel league | `<Navigate>` to the events page |
| No pairings for the matchday | `EmptyState` — "Für diesen Spieltag sind noch keine Paarungen ausgelost." |
| Rangliste before the first kick-off | `EmptyState` — "Noch kein Spieltag gespielt", under a plain `Rangliste` heading |
| Rangliste with no points in the payload | `EmptyState` — "Für diesen Spieltag liefert Kickbase keine Punkte." |

## Unconfirmed

- **Whether `hhpl` / `hhsp` are as-of-the-matchday or current.** They come back
  identical for every `dayNumber`, but with a single matchday scored that
  proves nothing. The page treats them as *current* standing, which is what the
  pre-kick-off subtitle claims to show; if they turn out to be historical, the
  subtitle on a past matchday is showing history and reads correctly anyway.
- **`hhmp`'s draw value.** A win is `3` and a loss `0` — confirmed across all
  five duels of a played matchday against `mdp`. A draw is presumably `1`, and
  none has been observed. Nothing on this page depends on it.

## Possible extensions

- Show the running duel-point total (`hhsp`) per side — already mapped as
  `duelPoints` and currently unrendered.
