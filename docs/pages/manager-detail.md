# Manager

[← Back to index](../README.md) · Route `/leagues/:leagueId/managers/:managerId` ·
[`src/pages/ManagerDetailPage.tsx`](../../src/pages/ManagerDetailPage.tsx)

One manager of the league, in four views:

| Route | View | Costs |
| ----- | ---- | ----- |
| `/leagues/:leagueId/managers/:managerId` | Aufstellung, `?day=N` | the matchday snapshot + the per-player points fan-out |
| `…/squad` | Kader | one request, shared with the Aufstellung's squad lookup |
| `…/events` | Verlauf | the league's event feed, paged |
| `…/details` | Details | — |

The page itself is **three requests**, all of them shared: the season standings
(the same entry the [Rangliste](ranking.md), the [event feed](events.md) and the
nav drawer read), the season's fixture list (an hour-long cache most pages have
filled), and the selected matchday's standings (the entry the
[Duels](duels.md) page fills for the same `?day=`). Three of the four tabs add
nothing to that; only the Aufstellung fetches.

Four routes, one component, the tab read out of the segment — the arrangement
[Squad](squad.md), [Player detail](player-detail.md), [Club](team.md),
[Duel detail](duel-detail.md) and [Match detail](match-detail.md) all use, and
for the same reasons: every view is linkable and survives a refresh.

## Why the page exists

Before it, a rival manager was **a face and two numbers in a table**. Their
eleven was visible only if you happened to be drawn against them, only for the
matchday you were drawn on, and only as one half of a
[duel pitch](duel-detail.md). Their squad was visible nowhere. What they had
bought and sold was visible nowhere. The three things a league actually argues
about — *who has he got up front, what is that squad worth, what did he pay for
him* — had no address.

The API had all of it the whole time:

| Question | Endpoint | Note |
| -------- | -------- | ---- |
| What did he field on matchday *n*? | `users/{uid}/teamcenter?dayNumber=` | works for **any** manager — see [Duel detail](duel-detail.md#the-squad-it-shows-is-the-matchdays) |
| What has he got now? | `managers/{uid}/squad` | today's squad, values and `lo` |
| What has he done? | `activitiesFeed` | the league's log, filtered here — see [Verlauf](#verlauf) |
| Where does he stand? | `ranking` | `lp` carries **every matchday he has played** |

So the page is mostly a matter of pointing existing hooks at a manager who
is not your opponent.

## Getting there

There is **no drawer entry**, for the reason the player and club pages have
none: a manager is a detail page, and its way in is the thing that names them.
The entry it *lights* is **Rangliste** — the list every manager came out of —
via `alsoMatches: ['managers']` in
[`navigation.ts`](../../src/components/layout/navigation.ts). The prefix rule
alone would not do it: this page sits beside `/ranking`, not under it.

Every place the app names a manager is now a way in:

| Where | What is the link |
| ----- | ---------------- |
| [Rangliste](ranking.md) | the whole row |
| [Matchday standings](duels.md#rangliste) — also the sheet on a settled matchday in the [feed](events.md) | the **left half** of the row (placement, face, name); the figures on the right still open the duel |
| [Duel detail](duel-detail.md) | each half of the scoreline, and the manager chip in each corner of the pitch |
| [Duel detail — Rangliste](duel-detail.md#rangliste) | the heading above each manager's list |
| [Player detail](player-detail.md#ownership) | the Manager card's left half |
| [Event feed](events.md) | the name on a *joined* / *left* row |

**The `?day=` rides along** wherever the source screen is about a matchday, so
tapping a manager out of matchday 2's standings opens matchday 2's eleven rather
than the current one.

### What is deliberately *not* a link

**Ownership badges on a pitch.** The little manager avatar on a portrait —
[match lineup](match-detail.md), the [squad's live view](squad.md#live-tab), the
[matchday's player ranking](matchday.md#rangliste) — stays a wordless marker.
The portrait it sits on is already a control (it opens the player's points
breakdown), HTML has no nested links, and hijacking the portrait for the *owner*
would take away the answer the pitch is read for. The badge keeps its tooltip;
the manager is one hop away through the player.

**A duel card** on the [Duels](duels.md) page keeps linking to the duel. Its
subject is the pairing, not either manager, and the scoreline one tap in carries
both manager links.

**A bid on a player** ([seller panel](player-detail.md#what-the-owner-can-do))
keeps opening the accept dialog. The row exists to be accepted, and it is a
`<button>` that holds — a link inside it is not markup HTML allows.

## The header

Above all four tabs, so switching them never moves it:

```
  ┌──────────────────────────────────────────────┐
  │ (A)  robidfl  du  ♛                          │
  │      2. Platz · 12 Duellpkt  ↗2              │
  │      41,2 Mio. € Teamwert · 612 Pkt          │
  ├──────────────────────────────────────────────┤
  │ ⚔ (D) Danger                         410:120 │  ← the matchday's duel
  │       2. Spieltag · Live               ✓ …   │
  └──────────────────────────────────────────────┘
```

**The figures are the season's**, whatever matchday the tabs below show: the
placement the league is actually ranked by (the duel table where there is one,
Kickbase points otherwise), the points behind it, and the team value. A
placement that moved when you stepped a matchday would read as the table itself
having moved.

**The strip underneath is the part that moves.** It is the counterpart of the
club page's [fixture strip](team.md#the-header) — that one carries a club's most
immediate match, this one the manager's duel on the matchday in view — and it
opens [that duel](duel-detail.md). It is absent outside duel leagues, and absent
for a manager the matchday left without an opponent (an odd-sized league), where
it would be a row saying nothing. The scoreline reads from **this** manager's
side, and the outcome is only claimed once the matchday is over: level at `0` in
the third minute is not a draw.

The crown marks the league admin — `adm`, mapped as `isAdmin` and until now
never rendered anywhere.

## Aufstellung

The reason the page exists: **one manager's eleven for one matchday**, on a
pitch, with everyone they left out under it.

```
  ┌ Spieltag 2 ────────────────────── ▾ ┐   ← MatchdayPicker
  ┌──────────────────────────────────────┐
  │ 291 Pkt              ⛶               │
  │ 1 laufend · 2 offen                  │
  │            (91)                      │
  │      (34)  (77)  (12)                │
  │   (18) (44)  (25) (9)                │
  │            (60)                      │
  └──────────────────────────────────────┘
   🪑 Bank 4
   ┌────────────┬────────────┬───────────┐
   │ (·) Kimmich│ (·) Grimaldo│ (·) Undav│
   └────────────┴────────────┴───────────┘
```

**The same cards as the duel's**, from the shared
[roster pieces](../../src/components/roster/RosterPitch.tsx): a portrait, one
points figure, a team-sheet corner while the sheet is news, and a tap that opens
the [breakdown](player-detail.md#the-match-breakdown) behind the number. What
differs is the arrangement — four bands and a full-width bench where a duel has
eight bands and two columns — so the cards are bigger here, and the bench rows
are **controls**: a benched player's points are exactly as unexplained as a
fielded one's.

**The corner plate is the matchday total**, not a name. The header already says
whose page this is; what the pitch cannot otherwise say is what these eleven are
worth on the day, and how much of it is still to come (`n laufend · n offen` —
forty points behind with four matches to play is winning). The figure is
Kickbase's own `mdp` for the matchday, not the sum of the portraits, so it cannot
disagree with the standings while the rows fill in.

The pitch opens [full screen](duel-detail.md#full-screen) from its corner, and
both layers live in the hash — `#fullscreen`, `#player:<id>`, stacking as
`#fullscreen/player:4711`.

### Where the eleven comes from

[`useManagerRoster`](../../src/api/hooks/useManagerRoster.ts), which is the duel
page's roster logic extracted to work for **one** manager: the matchday snapshot
where its lineup can be believed, today's `lo` where it cannot, the points
fan-out with the snapshot's own running scores handed over so a live matchday
costs one request a tick. All of that reasoning is a fact about *a* manager's
matchday rather than about a duel, which is why the duel hook is now two of
these — see the hook, and
[Duel detail](duel-detail.md#the-squad-it-shows-is-the-matchdays) for how the
snapshot was found.

A player nobody owns any more can be missing a position (no current squad knows
it), and the pitch cannot place him. He is **counted in a line under the pitch**
rather than dropped in silence.

### Matchdays before the manager joined

The snapshot answers `200` with both lists empty for a matchday it has nothing
for — one before the league existed, or before this manager joined it. That is
not an error and not an empty team, so it gets its own message rather than a
blank pitch.

## Kader

Every player the manager owns **as it stands now**, grouped by position, most
valuable first, with three tiles over it: how many players, what the lot is
worth, how many are fielded.

**Today, not the selected matchday** — `managers/{uid}/squad` takes no
`dayNumber` and silently ignores one, so today is all it can answer. That is the
honest division between the two tabs: the Aufstellung is a *matchday*, the Kader
is a *squad*, and a player bought yesterday is in the second and not the first.

Rows are the [squad page](squad.md)'s design minus everything Kickbase only tells
you about your own players — no daily change (`tfhmvt` is not on this payload),
no lineup probability, no offer count, and the shirt rail is a **marker** rather
than a control. What they add is a points line (`p`/`ap`), because "what has this
cost him all season" is half the reason to look at somebody else's squad. Every
row opens the player.

The domain model is [`ManagerSquadMember`](../../src/api/models.ts), a smaller
shape than `SquadMember` on purpose: filling the four missing fields with zeros
would draw a grey `±0` profit under every player, and that is a claim.

## Verlauf

The league's [event feed](events.md), narrowed to this manager — their
transfers, and their joining or leaving.

**There is no server-side filter for this.** `userId`, `managerId`, `from`, `to`
and a dozen other spellings all answer the unfiltered feed (see
[the endpoint note](../api/leagues.md#get-v4leaguesleagueidactivitiesfeed)), so
the rows are picked out of the pages that have been loaded. Two consequences the
tab lives with:

- **The list pages itself forward.** A page of 25 entries may hold nothing about
  this manager, and the sentinel is then still on screen and asks for the next
  one — so opening the tab walks the feed until it finds rows or reaches the end
  of the league's history. That is the cost of a filter the API does not have,
  and it is bounded by the feed's own length.
- **Transfers are matched by name**, because that is all a transfer entry
  carries: `byr`/`slr` are display names, not ids. Two managers sharing a display
  name in one league would share a history, and nothing here can tell them
  apart. *Joining* and *leaving* are the one kind of entry that names a manager
  by id.

The **personalised** entries — an achievement, the login bonus, a settled
matchday's placement — are the *viewer's* whoever else is on screen, so they
appear on the viewer's own page and nobody else's. Attributing the reader's own
week to a rival would be worse than omitting it.

## Details

The standings row, unpacked, and **every matchday the manager has played**.

```
  ┌────────────┬────────────┬────────────┐
  │ KICKBASE…  │ DUELLPUNK… │ TEAMWERT   │
  │ 612        │ 12         │ 41,2 Mio.  │
  │ 2. Platz   │ 2. Platz   │            │
  ├────────────┼────────────┼────────────┤
  │ Ø/SPIELTAG │ BESTER …   │ 2. SPIELT… │
  │ 306        │ 410        │ 410        │
  │ 2 Spieltage│ 1. Spieltag│ 1. Platz   │
  └────────────┴────────────┴────────────┘
  ┌ Spieltage ───────────────────────────┐
  │ 2. ████████████████████        410  │  → …?day=2
  │ 1. ███████                      120  │
  └──────────────────────────────────────┘
```

The tiles restate the header and the Rangliste. **`lp` says something neither
does**: the shape of a season — the manager who is third on two big weekends and
nothing else, the one grinding out sixties. It was called "the richest unused
data in the app" in [Ranking](ranking.md#unmapped-fields-available) for months;
this is where it is finally read.

Each row **opens that matchday's Aufstellung**, which is the question the row
raises: 410 points, from whom? The list is newest first (the array is oldest
first, and the index is the matchday number — reversing without keeping it would
link every row at the wrong day). Bars are scaled against the manager's **own
best** matchday: this is a portrait of one season, and the comparison against
other managers already exists one tap away. A `null` is a matchday they did not
play and draws a dash rather than a zero — zero is something that can happen to
a team that played. A negative matchday draws no bar; an axis for one row in a
season is not worth it.

For the viewer's own page there is one link out: **Eigene Aufstellung
bearbeiten** → [`/squad/lineup`](squad.md#lineup-tab). It is the one thing this
page cannot do, and it is offered only to the viewer — everybody else's team is
read-only by construction.

## The viewer's own page is not special-cased

Tapping your own row opens your own manager page, marked *du*, rather than
redirecting to *Mannschaft*. A link that goes somewhere else for one row of a
table is a surprise, and the two pages answer different questions: this is the
read-only portrait every manager gets, that is where a lineup is **edited**. The
Details tab carries the one link across.

## States

| State | Rendering |
| ----- | --------- |
| Standings or schedule loading | `SkeletonList rows={6}` |
| Either failing | `ErrorState` with retry for both |
| Manager id not in the standings | `EmptyState` with a link to the [Rangliste](ranking.md) |
| Roster loading | `SkeletonList rows={8}` |
| No snapshot for the matchday | `EmptyState` — "vermutlich lag er vor seinem Beitritt" |
| Squad empty | `EmptyState` — a manager who has left keeps a season but not a squad |

A manager who has **left the league** disappears from the standings, so their
page becomes the not-found state. Their name still appears in the feed's history,
and that link then lands on it; the alternative would be a page built out of a
name with no numbers behind it.

## Data sources, in one table

| Hook | Endpoint | Used for |
| ---- | -------- | -------- |
| [`useRanking`](../../src/api/hooks/useRanking.ts) | `ranking` | identity, season figures, `lp`, duel mode |
| [`useSeasonSchedule`](../../src/api/hooks/useMatchday.ts) | `competitions/{id}/matchdays` | the matchday picker and the clock |
| [`useMatchdayStandings`](../../src/api/hooks/useDuels.ts) | `ranking?dayNumber=` | the day's points, and the day's duel |
| [`useManagerRoster`](../../src/api/hooks/useManagerRoster.ts) | `users/{uid}/teamcenter`, `managers/{uid}/squad`, `playercenter`, `players/{pid}` | the eleven and its points |
| [`useManagerSquadMembers`](../../src/api/hooks/useManagerRoster.ts) | `managers/{uid}/squad` | the Kader — same cache entry as above |
| [`useActivities`](../../src/api/hooks/useActivities.ts) | `activitiesFeed` | the Verlauf |

## Not built

- **A comparison.** Two managers side by side, squad value against squad value,
  is the obvious next screen and it is not this one: a duel already compares two
  managers for a matchday, and a general comparison wants a picker this page has
  no room for.
- **Transfer totals** — what a manager has spent and taken in over the season.
  The feed carries every fee, so it is a sum over the Verlauf's rows; what stops
  it is that the sum would be over *the pages that happen to be loaded*, and a
  number that grows as you scroll is worse than no number.
- **A form guide in the header** from `lp`. The Details tab draws the whole
  season; a sparkline above it would be the same data twice.
