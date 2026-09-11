# Manager

[← Back to index](../README.md) · Route `/leagues/:leagueId/managers/:managerId` ·
[`src/pages/ManagerDetailPage.tsx`](../../src/pages/ManagerDetailPage.tsx)

One manager of the league, in four views — in the bar's order, **Details ·
Kader · Aufstellung · Verlauf** (rearranged 2026-09-08: the manager first, then
their squad, then one matchday of it, then the season's events):

| Route | View | Costs |
| ----- | ---- | ----- |
| `…/details` | Details | the manager's performance history — one request |
| `…/squad` | Kader | one request, shared with the Aufstellung's squad lookup, plus a per-player detail fan-out for the lineup probability |
| `/leagues/:leagueId/managers/:managerId` | Aufstellung, `?day=N` | the matchday snapshot + the per-player points fan-out |
| `…/events` | Verlauf | the league's event feed, paged |

The bare route is still the Aufstellung — the order is how the bar reads, not
where a tapped name lands; see [`managerTabs`](../../src/components/manager/managerTabs.ts).

The page itself is **three requests**, all of them shared: the season standings
(the same entry the [Rangliste](ranking.md), the [event feed](events.md) and the
nav drawer read), the season's fixture list (an hour-long cache most pages have
filled), and the selected matchday's standings (the entry the
[Duels](duels.md) page fills for the same `?day=`). The Verlauf adds only the
feed most readers already have; the other three each fetch, as the table says.

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
| Where does he stand? | `ranking` | placement, both point totals, the team value |

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
the [breakdown](player-detail.md#the-match-breakdown) behind the number. For a
match that has not kicked off that one figure is what he is
**[expected](squad.md#erwartete-punkte)** to score — the target glyph and the
figure, orange for the model's prediction and accent green for a guess the
reader entered himself — which is the
whole point of looking at somebody else's eleven *before* the weekend rather
than after it. The bench rows carry the same figure as a chip beside the
armchair. What
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

**Under it, where this eleven is heading:** `⌖ 1.240`, which is
`SUM(coalesce(real points, your guess, the model's prediction))` over the
fielded eleven — [`projectedPointsTotal()`](../../src/lib/expectedPoints.ts).
The scored total is a fact about the past and says nothing about the four
matches still to kick off, which is exactly the gap that makes somebody else's
eleven worth looking at on a Friday. It is accent green as soon as any part of
the projection is a guess the reader entered himself, orange while it is all
the model's, and **absent once every match is settled** — a projection over a
finished matchday is the scored total again in a different colour. What it is
made of (`4 gespielt, 5 Prognose, 2 eigene Schätzungen`) rides along as the
tooltip and the screen-reader text; no empty-slot penalty is modelled, because
this figure has to agree with the portraits it is drawn over. The full-screen
bar carries the same pair on one line.

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

Rows are the [squad page](squad.md)'s design, and by now they are that row
almost exactly: the **24-hour change** in euros under the market value, arrow
and amount; the **lineup probability** badge under the name with the
**[expected-points chip](squad.md#erwartete-punkte)** beside it; and the
**fixture crest** at the end, which is the way into the sheet. Both figures on
that second line are estimates about the same coming matchday, and the pair is
what a rival's eleven is judged on.

**The season line is gone.** `p`/`ap` used to sit under the name — "what has
this cost him all season" — and it was a fact about the past holding the place
of the two things that say what happens next. It is not lost: the player's own
page has a whole tab of it.

The change and the probability were missing until 2026-09-08 — the change
because the model claimed `tfhmvt` was not on this payload (it is, on every
player probed; see [Squad and lineup](../api/squad-and-lineup.md)), the
probability because nobody fetched it. What stays off is what Kickbase only
tells you about your own players: the offer count, and the shirt rail is a
**marker** rather than a control. Every row opens the player.

**The probability is a detail request per player**, the same gap-filling
[`useStartProbabilities`](../../src/api/hooks/useStartProbabilities.ts) the squad
page runs for its own rows — `prob` is not on this payload, and the hook is
written so it becomes a no-op if that changes. Fifteen requests, once per half
hour, into the `playerDetail` cache entries the player pages read, so opening a
player from here finds his page already loaded.

The domain model is [`ManagerSquadMember`](../../src/api/models.ts), a smaller
shape than `SquadMember` on purpose: filling the missing profit with a zero
would draw a grey `±0` under every player, and that is a claim.

### Expected points, on somebody else's players

The **fixture crest at the end of each row** opens the same
[expected-points sheet](squad.md#erwartete-punkte) one's own Kader opens from
its own crest, and files the guess under the same
`matchday → playerId → points` map on this device. The figure it enters reads
beside the probability up in the row — his own guess, or the
[model's prediction](squad.md#woher-die-prognose-kommt) in orange until he
makes one, off the same cached file the Kader reads. A rival's squad is one of
the two places you most want to make those guesses — a duel is your eleven
against his — and it is the reason the feature is not confined to the page
that introduced it.

**A crest rather than a target.** These rows carried a plain target glyph while
they had no fixture panel of their own; now they have one, for the same reason
the squad page does — it is the only part of the row about the coming matchday,
so the question *what will he score on Saturday* belongs on it. A rival's row
and your own are the same row now, which is the point: the two are meant to be
compared, and a difference in how they are drawn is a difference the reader has
to think about.

The row is now **a link plus a button** rather than one link — HTML has no
nested interactive elements — with the card's border and its accent hover
moved onto the `li` (`has-[a:hover]:`) so nothing about the row's appearance
changed.

A **fourth tile** appears over the list as soon as one of his *fielded* players
carries a figure — in a Bundesliga league, as soon as the prediction file
lands: `Erwartet 1.640 · 11 von 11 · 3 geschätzt`, or `Prognose · 11 von 11`
while none of them is the reader's own. It is summed the way the chip over
one's own pitch is summed, and it says how many of the figures are guesses
because that is the difference between a comparison the reader made and a
model's opinion of one. The row of tiles goes from three columns to two so four
tiles do not leave a ragged second row, and the tile is absent entirely until
there is something in it — a nought there would read as a prediction of
nothing.

The matchday it files under comes from
[`useCurrentMatchday`](../../src/api/hooks/useMatchday.ts), the **same cache
entry** this page already reads for its matchday picker, so the tab pays no
request for it. It is always the *current* matchday, never the one the picker
is showing: the Kader is today's squad, and a guess is about the next match.

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

The standings row, unpacked, and **every matchday of the current season the
manager has played**.

```
  ┌────────────┬────────────┬────────────┐
  │ KICKBASE…  │ DUELLPUNK… │ TEAMWERT   │
  │ 612        │ 12         │ 41,2 Mio.  │
  │ 2. Platz   │ 2. Platz   │            │
  ├────────────┼────────────┼────────────┤
  │ Ø/SPIELTAG │ BESTER …   │ SPIELTAGS… │
  │ 306        │ 410        │ 1          │
  │ 2 Spieltage│ 1. Spieltag│            │
  └────────────┴────────────┴────────────┘
  ┌ Spieltage ───────────────────────────┐
  │ 2. ████████████████████     🏆 410  │  → …?day=2
  │ 1. ███████                      120  │
  └──────────────────────────────────────┘
```

**Where the matchdays come from — and where they do not.** Until 2026-09-08
this list was drawn from the standings' `lp`, believed to be points per
matchday. It is not: `lp` is the **fielded eleven's player ids by lineup slot**,
verified against `/managers/{id}/squad` where every fielded player's `lo`
indexes his own `pi`. Eleven entries, so the tab showed eleven "matchdays" —
on matchday 2, nine of them in the future, each scoring a player id. The list
now reads
[`useManagerPerformance`](../../src/api/hooks/useManagerPerformance.ts) →
`/managers/{id}/performance`, the one endpoint that carries a manager's
matchdays, keeps the **running season** (the last entry, oldest first) and
drops every matchday without an `mdp` — the ones still to come. See
[Leagues](../api/leagues.md#get-v4leaguesleagueidmanagersmanageridperformance).

The same payload supplies the season tiles honestly: `ap` is Kickbase's own
average, `mdw` the matchday wins (a new tile), and the best matchday is the
maximum of what remains. They read `…` until the history lands rather than
being faked from the standings, which know the total but not how many
matchdays it took.

Each row **opens that matchday's Aufstellung**, which is the question the row
raises: 410 points, from whom? The list is newest first and every row carries
its own matchday number — the payload starts where the manager joined, not at
matchday 1, so nothing is derived from an index. Bars are scaled against the
manager's **own best** matchday: this is a portrait of one season, and the
comparison against other managers already exists one tap away. A matchday the
manager **won** carries a small gold trophy (`tw`). A matchday sat out is a
`0`, drawn as one — zero is something that can happen to a team that played. A
negative matchday draws no bar; an axis for one row in a season is not worth
it.

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
| [`useRanking`](../../src/api/hooks/useRanking.ts) | `ranking` | identity, season figures, duel mode |
| [`useManagerPerformance`](../../src/api/hooks/useManagerPerformance.ts) | `managers/{uid}/performance` | the Details tab's matchdays and season tiles |
| [`useSeasonSchedule`](../../src/api/hooks/useMatchday.ts) | `competitions/{id}/matchdays` | the matchday picker and the clock |
| [`useMatchdayStandings`](../../src/api/hooks/useDuels.ts) | `ranking?dayNumber=` | the day's points, and the day's duel |
| [`useManagerRoster`](../../src/api/hooks/useManagerRoster.ts) | `users/{uid}/teamcenter`, `managers/{uid}/squad`, `playercenter`, `players/{pid}` | the eleven and its points |
| [`useManagerSquadMembers`](../../src/api/hooks/useManagerRoster.ts) | `managers/{uid}/squad` | the Kader — same cache entry as above |
| [`useStartProbabilities`](../../src/api/hooks/useStartProbabilities.ts) | `players/{pid}` | the Kader's lineup-probability badges, one request per player |
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
- **A form guide in the header** from the performance history. The Details
  tab draws the whole season; a sparkline above it would be the same data
  twice — and it would cost the header a request the other tabs do not need.
