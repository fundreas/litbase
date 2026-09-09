# Ranking — "Rangliste"

[← Back to index](../README.md) · Routes `/leagues/:leagueId/ranking` and
`/leagues/:leagueId/ranking/battles` ·
[`src/pages/RankingPage.tsx`](../../src/pages/RankingPage.tsx)

Full standings for every manager in the league — the season table, and the
same field re-sorted by one of the league's side competitions.

## Two views

| View | Segment | What it ranks |
| ---- | ------- | ------------- |
| *Rangliste* | `ranking` | the league as it stands — points, or the duel table |
| *Battles* | `ranking/battles` | one of Kickbase's side competitions, `?battle=<type>` — [Battles](#battles) |

Switched by a [`BottomTabBar`](../../src/components/ui/BottomTabBar.tsx), the
view in the **path segment** as on the [market](market.md), squad and
[season](season.md) pages, so each is linkable and survives a refresh.

The bar is **unconditional**, unlike the market's: whether a league runs
battles is in a payload no route can see, and the battles view says so itself
rather than having its tab quietly appear and disappear.

The **sort toggle belongs to the table**, not to the page — it sorts the
season standings and means nothing over a battle's own ranking, so it is not
drawn in the battles view.

## Layout

```
  Rangliste                          ┌───┬───┐
  4 Manager · Duell-Modus            │ ⚔ │ Σ │   ← sort toggle
                                     └───┴───┘
  ┌────────────────────────────────────────────┐
  │ 1. (A)  robidfl                         9  │
  │         410 Pkt am Spieltag        612 Pkt │
  │         ✓ Gewonnen vs. Danger              │
  ├────────────────────────────────────────────┤
  │ 2. (A)  Danger  du                      6  │  ← accent border
  │ ↗2      120 Pkt am Spieltag        588 Pkt │
  │         ✗ Verloren vs. robidfl             │
  └────────────────────────────────────────────┘
```

The row is a name over **two subtitles**: what the manager actually scored this
matchday, then how the duel that fed into went. Team value used to sit here but
was displaced — it is a standing figure that says nothing about the current
round. It was on the dashboard until that page became the
[event feed](events.md); this table is now the only place it is shown.

The placement number and the avatar form their own tight group, so the row's
gap separates them from the text rather than pushing the number away from the
face it belongs to. The placement's movement sits beneath the number and
appears **only when it changed**; a lone dash for "unchanged" was a whole line
saying nothing.

Outside a duel league the third line is absent entirely and the row is two
lines tall.

**The whole row is a link to that manager** —
[Manager](manager-detail.md), with their eleven, their squad, their transfers and
their whole per-matchday season. Every part of the row is about the one manager,
so there is nothing else a tap could mean, and a list row on a phone is the
biggest target the page can offer. Until that page existed this table was a name
and two numbers with no way to ask what was behind them.

## Ordering

**The API does not return managers in placement order.** A real response led
with a manager sitting 6th, so the array order is meaningless for display and
the client sorts explicitly on the placement field.

Which placement applies depends on the mode — see [Duel mode](#duel-mode).
Ties break on the points that decide the table, so the order stays stable and
meaningful if Kickbase ever reports two managers at the same place.

An earlier version trusted the array order on the assumption that the endpoint
was pre-sorted. It is not.

## Duel mode

Leagues can be played as duels ("Duell"). This page shows the resulting
*table*; the pairings themselves, for any matchday of the season, are the
[Duels](duels.md) page — which reuses `isDuelMode` from this very hook to
decide whether it exists at all.

Here the table is head-to-head rather than raw points:

| | Normal | Duel |
| --- | --- | --- |
| Sorted and numbered by | `spl` | `hhpl` |
| Headline figure (bold) | `sp` | `hhsp` |
| Figure beneath it | — | `sp`, the Kickbase total |
| Under the name | Team value · `mdp` | Team value · `hhmp` |

Stacking two figures on the right is what makes the ordering
self-explaining: the bold one is what the table is sorted by, the muted one is
the Kickbase total that does **not** decide it. Without that, a duel table
looks wrong — a manager on 755 raw points sitting below one on 612 has no
visible reason to be there.

In a normal league those would be the same number, so only the total is shown.

### The sort toggle

A duel league has **two legitimate tables**, so the heading carries a toggle on
the right: **Duell** (the default) or **Punkte**.

It switches the whole view at once — order, placement number *and* headline
figure. Listing duel placements in points order would look broken, so the
points view renumbers the rows by `spl` and promotes `sp` to the bold figure,
with the duel total moving to the muted line. The toggle is not rendered
outside duel mode, where both options would mean the same thing.

The two buttons are **icon-only**: crossed swords (`Swords`) for the
head-to-head table, a summation sign (`Sigma`) for the points total. Labels
would need truncating next to the heading on a phone, so the meaning rides on
`title` plus `sr-only` text instead.

Only the non-default view re-sorts: the hook already returns the league's own
table.

### Duel outcome

The second subtitle reads *icon · outcome · opponent* — for example
"✓ Gewonnen vs. Danger". The outcome is **spelled out** rather than left to the
icon's colour, which would otherwise be the only cue, and colour alone is not a
cue everyone gets. The opponent's name comes from the same `byId` map the
result is computed with, so it costs nothing extra.

Note the figure there is the manager's **real Kickbase points for the
matchday** (`mdp`), not their duel points. Those are what the duel was decided
on; the icon says how it went, so printing the duel points as well would be
redundant.

**The result is computed, not read off a scoring scale.** `hhoui` names the
opponent and every manager is in the same payload, so
`duelResultOf()` compares the two matchday totals directly. Checked that both
sides of a duel always agree (one `won` ↔ one `lost`, or both `drawn`), and
that a missing or out-of-league opponent yields no icon rather than a wrong
one.

`hhmp` has since been confirmed to award **3 for a win and 0 for a loss** —
across all five duels of a played matchday the manager with the higher `mdp`
carried `3`. The comparison is kept anyway: it needs no assumption about a
league's scoring at all, and a draw's value (presumably `1`) still has not been
observed.

**Detection is from the data, not a flag.** `hhpl` is present only in duel
leagues; a normal league carries no `hhpl` at all. The response's top-level
`gpm` was checked and rejected for this — it distinguishes
classic/arena/beginner/high-management and says nothing about duels. `hhsp`
alone is not enough either: it appears as `0` in normal leagues.

### Which field is the duel points

`hhsp` is treated as the headline and `hhmp` as the matchday figure, following
the convention the rest of the API uses without exception — `sp`/`spl` for
season, `mdp`/`mdpl` for matchday, so `hh` + `sp` is the head-to-head season
total. `hhpl` being a *season* table position is the corroborating evidence.

This could not be confirmed against live data: no accessible duel league had
`hhsp` and `hhmp` diverge (in the one real sample both read `3`, consistent
with a single duel won). Both figures are therefore shown and labelled, so an
inverted reading would be visible immediately rather than silent.

## Row anatomy

| Element | Source |
| ------- | ------ |
| Placement | `seasonPlacement` or `duelPlacement`, formatted `3.` by `placement()` |
| Placement change | `placementChange` (`ppc`), under the placement — hidden when `0` |
| Avatar | `image` (`uim`), initials fallback — with one **gold star per league title** on its rim, see [Title stars](#title-stars) |
| Name | `name`, with a `du` tag in accent colour when `id === user?.id` |
| Admin | not here — the crown is on the [manager page](manager-detail.md#the-header)'s header, from `isAdmin` |
| Subtitle 1 | Matchday Kickbase points (`mdp`) |
| Subtitle 2 | Duel outcome + opponent name — omitted outside duel leagues |
| Points | `seasonPoints`, bold, right-aligned |
| Change | `placementChange` (`ppc`) |

**Your own row is outlined** in `border-accent/50` instead of the usual
`border-line`, which makes it findable by scanning rather than reading — the
point of a standings list on a phone.

### Title stars

A manager who has **won this league** carries one small gold star per title,
astride the top rim of the avatar — half above the circle, half over it, the
points of neighbouring stars tucked under each other so five still fit on a
44px face. More than five shows five, with the exact count in the tooltip
(`3 Meistertitel`). Nothing is drawn for a manager without a title, and nothing
while the count is loading, so a row never flashes a badge it then takes back.

The avatar is
[`ManagerAvatar`](../../src/components/manager/ManagerAvatar.tsx), which the
[duel cards, the byes and the matchday Rangliste](duels.md#title-stars) share —
a champion looks like one wherever their face appears.

The count is **`swc` on the standings payload** — see
[Leagues](../api/leagues.md#how-often-has-a-manager-won-the-league) — mapped to
`titles` on `RankedManager` and carried onto `DuelSide`, so every face the app
draws already knows its stars and no extra request is made. Kickbase omits the
field at zero, so it is read as `swc ?? 0`. It is **this league's** titles: the
field sits on a league-scoped response, and the API has no cross-league view.

## Battles

The league's **side competitions**, as rankings: most transfers, most points
scored with defenders, most matchdays won. The
[Liga](league.md#wettkämpfe-seven-faces-and-a-way-into-each-table) page names
whoever *leads* each one — that is all its payload knows — and every row of
that card opens the table here.

It lives on this page rather than on Liga because it **is** a standings list:
the same managers, the same rows, one figure swapped, one tap from the table it
is a variation of.

```
  Rangliste                          ← no sort toggle in this view
  5 Manager

  ┌ ♛ Spieltagsdominator ┐ ┌ ⇄ Transferkönig ┐ ┌ ✋ Saubermann ┐ →
      (active)                                                     ← scrolls

  Die meisten Transfers der Saison             ← the battle's own `d`

  ┌────────────────────────────────────────────┐
  │ 1. (A)  Danger  du                     12  │  ← accent border
  │                                  Transfers │
  ├────────────────────────────────────────────┤
  │ 2. (A)  robidfl                         9  │
  │                                  Transfers │
  └────────────────────────────────────────────┘
```

[`BattleRankingTab`](../../src/components/ranking/BattleRankingTab.tsx).

### The chip row

**One [`FilterChip`](../../src/components/ui/FilterChip.tsx) per battle**, in
the order the API lists them, exactly the *Alle · TW · ABW · MF · ANG* control
of the [player rankings](season.md#rangliste) — a horizontally scrolling row,
because seven battle names will not wrap onto a phone. Each chip carries the
type's icon as its `leading`, the same glyph the Liga row it was opened from
used, so the tap lands somewhere recognisable.

The chips cost **no request**: the battle list comes from `useLeagueDetails`,
the ten-minute overview entry [Liga](league.md) and
[Transfermarkt](market.md) already hold, so the row is there on first paint and
only the table under it is fetched.

**The swipe had to be fixed for the phone.** Seven German battle names are
about two phone-widths of chips, and the row — the ordinary
`-mx-3 overflow-x-auto` one, with `shrink-0` chips — was reported as not
scrolling on a device while scrolling correctly in a browser at the same
width. Nothing was wrong with the box: the gesture was not reaching it. A
horizontal drag where the page has nothing to scroll horizontally is a
*navigation* gesture (back on Android; back/forward in an iOS home-screen app,
which is how this one is meant to be installed), and a scroll container hands
the swipe on as soon as it runs out of content — or, in a standalone iOS app,
before it starts. So the row now carries `overscroll-x-contain`, which stops
that chaining, and `touch-pan-x`, which stops a slightly diagonal swipe being
resolved as a vertical page scroll and locked out of the row for the rest of
the drag. Both live in
[`CHIP_ROW`](../../src/components/ui/FilterChip.tsx), shared with the
[player rankings](season.md#rangliste)' filter and
[Liga beitreten](join-league.md)'s two rows, so the three cannot drift apart.
The cost is that a vertical drag begun on those 36px does not scroll the page,
which is what a carousel costs anywhere.

**The active chip is scrolled into view.** `?battle=` can name the seventh of
seven — a hand-off from a Liga *Wettkämpfe* row does exactly that — and a row
sitting at its left end would then have its own selection off-screen. Only the
row moves (`inline: 'nearest'`, `block: 'nearest'`), never the page.

Exactly one chip is active, and they render **above whatever the list is
doing** — returning early past them would make the control vanish on the tap
that changes it and come back when the request lands, which reads as the page
having lost the filter rather than as it fetching one.

### `?battle=<type>`

The selected battle is in the **query string**, the same arrangement
[Saison](season.md) uses for `?pos=`:

```
/leagues/13145405/ranking/battles?battle=2
```

So a link can preselect a battle — which is what the Liga hand-off is — and
back or refresh keep it. Tapping a chip **replaces** the history entry rather
than pushing one, so back leaves the page instead of walking through every chip
that was tapped. Switching to the table and back carries `?battle=` along on
the tab link, so the battle that was open is the battle that comes back.

**With no `?battle=`, or one naming a battle the league does not run, the
first battle is shown.** A URL is a thing people edit, share and keep, so that
failure has to be a view rather than an error page explaining that `?battle=99`
is not a thing. The parameter is never written back for the implicit case: an
unparameterised URL keeps meaning "the first one".

### Row anatomy, and the unit

The [season table's row](#row-anatomy) with one figure instead of two:

| Element | Source |
| ------- | ------ |
| Placement | `pl`, formatted `3.` by `placement()` — Kickbase's own place, with the row index standing in only if it ever arrives as `0` |
| Avatar | `uim`, with the [title stars](#title-stars) — see below |
| Name | `n`, with a `du` tag in accent colour for the viewer |
| Figure | `v`, **parsed** — it arrives as a string and can be negative |
| Unit | `BATTLE_UNIT[type]`, under the figure |
| Header | the battle's `d`, above the list |

**The whole row links to [that manager](manager-detail.md)**, and the viewer's
own row takes the accent outline — both for the reasons the season table does
it, and so that switching tabs feels like sorting one table by something else
rather than arriving on another page.

The **unit is the app's only piece of copy here.** `v` is a bare figure and the
response says nothing about what it counts, so `BATTLE_UNIT` in
[`models.ts`](../../src/api/models.ts) supplies *Transfers* (type `2`),
*Siege* (`1`) and *Pkt* (`4`–`8`). A code with no entry — `3`, or whatever
Kickbase adds next — prints the number alone: a wrong unit is worse than none.

Everything else is **the API's own wording**, in German off the
`Accept-Language` the [client](../../src/api/client.ts) sends: the chip label
is `n`, the line above the list is `d`. Same rule as Liga, and the reason both
screens read like the Kickbase app rather than like this codebase. Only the
icon is ours — [`BATTLE_ICON`](../../src/components/league/battles.ts), shared
by the two screens, with a medal for an unknown code.

The **stars are lifted off the standings.** `swc` is on the `/ranking` payload
and nowhere else — the battle response has no such field — so the page hands
the battles view a map of titles by manager id out of the query it makes
anyway. No extra request, and a champion looks like one on both tabs. While
that query is in flight nothing is drawn, so a row never flashes a badge it
then takes back.

### Everyone is in it, including the managers on nothing

The endpoint returns the **whole league re-sorted**, not the managers who have
scored — a battle four matchdays in is a full table with a run of zeroes at the
bottom. That is what makes the Liga page's *noch offen* rows links too: a
battle nobody leads yet still has a ranking.

Ties are **not shared**. Kickbase placed four managers on `0` as 2, 3, 4, 5,
and the tiebreak looks like user-id order. The place printed is `pl`, not a
number counted here, so the table says what the app says even where that is
arbitrary.

### States

| State | Rendering |
| ----- | --------- |
| Battle list loading | a row of chip-shaped placeholders plus `SkeletonList rows={6}` — the control does not pop in |
| Battle list failed | `ErrorState` with retry |
| League runs no battles | `EmptyState` — *Keine Wettkämpfe* |
| Standings loading | chips and description stay, `SkeletonList rows={6}` under them |
| Standings failed | chips stay, `ErrorState` with retry under them |
| Battle unknown to Kickbase | `EmptyState` — *Keine Wertung*. The endpoint answers `200` for **any** code and only omits `n`, so a missing title is the only signal there is |

The standings query's states gate **the table only**, not the page: a failed
season table must not take the battles tab down with it, and the battles view's
own failures leave the chips in place.

### From Liga

Every row of the *Wettkämpfe* card is
`/leagues/:leagueId/ranking/battles?battle=<type>`. It used to link to the
**leader's** manager page, with leaderless rows not linking anywhere at all,
which was right only while the leader was the one thing behind a battle. The
subject of that line is the competition, and the manager is one tap further on
from here.

## Placement change

A small subcomponent, `PlacementChange`, renders the movement since the
previous matchday:

| Value | Rendering |
| ----- | --------- |
| `0` | Grey `—` |
| `> 0` | Green ↗ with the absolute number |
| `< 0` | Red ↘ with the absolute number |

The sign convention follows the API's `ppc`: positive means *moved up*. The
absolute value is displayed because the arrow already carries the direction —
`↘ 2` reads better than `↘ -2`.

## States

The table's states, that is — the battles view has
[its own](#states-1), and neither gates the other.

| State | Rendering |
| ----- | --------- |
| Loading | `SkeletonList rows={8}`, under the heading and above the tab bar |
| Error | `ErrorState` with retry |

There is no empty state. A league always has at least the signed-in manager,
so an empty ranking would mean something is broken — and the error state is
the honest response to that.

The heading and the tab bar are drawn **whatever either query is doing**, so a
failed table still has its way over to the battles and back.

## Data

[`useRanking(leagueId)`](../../src/api/hooks/useRanking.ts) →
`/v4/leagues/{leagueId}/ranking`, mapped to `RankedManager[]`.

Note this is the **same query** the [Events](events.md) page uses to put a face
on its transfer rows and to decide whether the league plays duels. Arriving
here from it is therefore free: the cache is already warm and the list renders
instantly.

The battles view adds two more, neither of them on the critical path:

| Hook | Endpoint | staleTime |
| ---- | -------- | --------- |
| [`useLeagueDetails(leagueId)`](../../src/api/hooks/useLeague.ts) | `/overview?includeManagersAndBattles=true` | 10 min — the chips, shared with [Liga](league.md) and [Transfermarkt](market.md) |
| [`useBattleRanking(leagueId, type)`](../../src/api/hooks/useBattleRanking.ts) | [`/battles/{type}/users`](../api/leagues.md#get-v4leaguesleagueidbattlestypeusers) | 5 min — one entry per battle |

`useRanking` stays unconditional in both views: the battles view reads it for
the [title stars](#row-anatomy-and-the-unit), and it is the cache entry half
the app shares anyway.

**One request per battle opened.** There is no call that answers for every
battle at once — `/battles`, `/battles/{type}` and `/ranking?battle=` were all
tried and are 404 or ignored — so only the active chip's table is fetched, and
each type is its own cache entry, which makes going back to a battle already
looked at instant.

## Unmapped fields available

`RankingUser` in [`types.ts`](../../src/api/types.ts) carries more than the
page shows:

- **`lp`** — **the fielded eleven's player ids by lineup slot**, `null` for an
  empty one. This bullet called it "points per matchday" and "the richest
  unused data in the app" until 2026-09-08, when the manager page's matchday
  list built on it turned out to show eleven matchdays scoring player ids; see
  [Manager › Details](manager-detail.md#details). Mapped as `lineupPlayerIds`,
  unused — the matchday snapshot is the better source of a lineup.
- `hhmp` — the duel points awarded this matchday (3 for a win, 0 for a loss).
  Mapped, but unused now that the result is derived from the matchday
  comparison.
- `mdpl` — matchday placement, mapped as `matchdayPlacement`, displayed only
  as points today.
- `adm` — league admin flag, mapped as `isAdmin`, not rendered.

## Possible extensions

- Toggle between season and matchday standings (`mdpl` / `mdp` are both
  already mapped) — the duel/points toggle is the pattern to follow.

Four earlier entries are **done**, all of them on the
[manager page](manager-detail.md) rather than on this table — a row of a
standings list has no room for a season's shape, and the tap that opens it now
leads somewhere that does:

- ~~a sparkline per manager from `pointsPerMatchday`~~ → the whole season, as a
  bar per matchday, on [Details](manager-detail.md#details);
- ~~tap a manager to open their squad~~ → [Kader](manager-detail.md#kader), and
  the matchday's eleven besides. The endpoints are in
  [`endpoints.ts`](../../src/api/endpoints.ts) and probed;
- ~~show the duel opponent's name per row~~ → the row already says it in the
  outcome line, and the [manager page's header](manager-detail.md#the-header)
  draws the duel as a scoreline;
- ~~mark the league admin using `isAdmin`~~ → a crown on that header.
