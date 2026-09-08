# Events

[← Back to index](../README.md) · Route `/leagues/:leagueId/events` ·
[`src/pages/EventsPage.tsx`](../../src/pages/EventsPage.tsx)

**The league's event log, and nothing else** — the landing page of a league.

## What this page used to be

It was the *Dashboard*: four stat tiles (budget, team value, points, placement)
over a top-three preview of the standings, with the feed added underneath. All
of it came off on 2026-09-07, because none of it was the only place to read
what it said:

| What it showed | Where it already was |
| -------------- | -------------------- |
| Budget, team value | The app header, on every page |
| Points, placement | [Rangliste](ranking.md), in full and for everyone |
| Squad size | A number nobody arrives asking for |
| Top three | [Rangliste](ranking.md), one tap away |

What was left was a summary of pages that summarise themselves. The feed is the
one thing here that exists nowhere else: what has happened in the league since
you last looked. So it *is* the page.

The old URL `/leagues/:leagueId/dashboard` still resolves — it redirects, since
it is what bookmarks and shared links point at. The drawer entry is
*Aktivitäten*.

## Layout

```
  MADMASSCREM Sunday Leauge
  Was in der Liga passiert ist

  ┌─────────────────────────────┐
  │ (🏆) Tormaschine            │
  │      +250.000 €  vor 5 Min. │
  │ (🏳) Spieltag 2 ist beendet │
  │      Du wurdest 1.          │
  │ ▌P▌ Adeline      → (L)      │
  │     5,6 Mio. €    vor 3 Std.│
  │ ▌P▌ Güther       ← (Y)      │
  │     2,4 Mio. €       gestern│
  │ …                           │
  │         ── lädt weiter ──   │
  └─────────────────────────────┘
```

The heading is the **league's name**, not "Aktivitäten": this is the league's
front door, and the drawer entry beside it already says what kind of page it
is.

## Data

| Query | Supplies |
| ----- | -------- |
| [`useActivities(leagueId)`](../../src/api/hooks/useActivities.ts) | The event log, 25 entries a page |
| [`useRanking(leagueId)`](../../src/api/hooks/useRanking.ts) | Manager avatars for the transfer rows, by name; and whether the league plays duels |
| [`useAchievement(leagueId, type)`](../../src/api/hooks/useAchievements.ts) | Per achievement row: what it paid, how often it was earned |
| [`useMatchdayStandings(leagueId, day)`](../../src/api/hooks/useDuels.ts) | The ranking sheet a matchday row opens |
| [`usePlayerOffers(leagueId, playerId)`](../../src/api/hooks/usePlayerOffers.ts) | Your own bid, when a purchase sheet is opened |

Only the first two load with the page. The other three are opened on demand, by
a row or by the sheet it opens.

## The rows

| Type | Row | Detail line | Leading | Tap |
| ---- | --- | ----------- | ------- | --- |
| Transfer | **Adeline** | Fee | The player's cutout, flush, as on the [market](market.md); on the right the dealing manager's avatar behind an arrow — **green, rightwards** on a buy, **red, leftwards** on a sale | **Buy**: a sheet — see below. **Sale**: player page |
| Joined / left | **Marvin** ist der Liga beigetreten · hat die Liga verlassen | — | Avatar, or a person icon | — |
| Matchday | **Spieltag 2** ist beendet | *Du wurdest 1.* — when you took part | **The manager who won the matchday, in a crown.** Flag until it lands | A sheet with the matchday's manager ranking, in **every** league — see below |
| Achievement | **Tormaschine** | `+250.000 €` in green, when it paid anything | Trophy, accent | A sheet: description, reward, how often earned |
| Login bonus | **Auflaufprämie** kassiert | Amount · day | Gift, accent — from the spec, never seen live | — |
| Founded | Liga **JSG Königslutter** gegründet | — | Tag | — |

**Listings are left out.** A player going up for sale is nine feed entries in
ten — Kickbase lists one about every hour — and the market page is where those
belong. The hook sends the API's `filter` with every *other* decoded type, so
the pages that arrive are the rows that render; filtering client-side would
have produced empty pages that stopped the scroll while the feed went on.

Every row carries the time on the right — `vor 5 Min.`, `vor 3 Std.`,
`gestern`, then the weekday and date — from
[`relativeTime`](../../src/lib/format.ts). Types the app has not decoded are
dropped rather than shown as a code.

**A comment count sits left of the timestamp** when there is one: a speech
bubble and a number, from `coc` on the entry. Kickbase's feed carries comment
threads and this app has no view for them, so the badge says a thing is being
talked about rather than offering to open it. It is absent at zero, which is
what all 620 entries across two leagues have read — see
[the API note](../api/leagues.md#get-v4leaguesleagueidactivitiesfeed).

### What a transfer row knows, and what it does not

The feed names the dealing manager but carries **no id and no avatar** for
them, so the row looks the name up in the standings for a face; a manager who
has since left keeps initials. A sale is always *to Kickbase* — the API has
never shown a manager-to-manager sale — so there is one manager per row.

**A purchase opens a sheet** with the player, the fee, the manager who won him,
**what you bid** when the API still knows, and **the comment thread**. The bid
is why the sheet exists: it is the only thing about a transfer that is not
already on the row, and the question a feed of other people's purchases raises.

**The player's face and name are the link to his page.** There was a *Zum
Spieler* row at the foot of the sheet, which put the way out as far as possible
from the thing it was about and spent a line saying what a tap on a portrait
says for free. Everywhere else in the app a player's picture is how you reach a
player.

**The sheet has no close button** — see
[`InfoDialog`](../../src/components/ui/InfoDialog.tsx). A sheet that asks
nothing has nothing to dismiss: tapping outside closes it, so does Escape, so
does the back gesture.

The bid comes from
[`usePlayerOffers`](../../src/api/hooks/usePlayerOffers.ts) reading
`/players/{id}/transfers` — **note the spelling**, a different endpoint to the
`transferHistory` the player page uses. It is the only place a bid is exposed
per player: `uop` is what you offered. Established on 2026-09-07 by placing an
offer on the test account and withdrawing it again, since with no bid the
response carries `ofs: []` and no `uop` at all.

The request is made **when the sheet opens**, not per row — it is one per
player, and a feed of transfers would otherwise fan out over every one of them.

> **Whether a *losing* bid survives the sale is unverified.** Every completed
> transfer probed answered `ofs: []`, but the account had bid on none of them,
> and producing a lost bid takes a listing's full run. So the line renders when
> there is an answer and is silently absent otherwise — the sheet never claims
> you did not bid.

A **sale** opens the player's page instead. It was a sale to Kickbase, so there
was no contest and no bid of yours to report.

### The comment thread

Kickbase's feed carries a chat thread per entry and the app has never shown one.
The purchase sheet does now: the comments, and a box that posts on Enter.

**It is fetched only when the entry says it has comments.** `coc` reads `0` on
all 620 entries across both probed leagues, so fetching on open would be one
request per sheet to be told "none" every time. Writing one turns it on for that
sheet, because by then there is something to read.

> **The comment's shape is a guess, and the app says so when the guess misses.**
> Nobody has ever commented in either league and the published spec leaves the
> item schema empty (`items: {}`), so there are two sources and neither knows.
> [`toActivityComment`](../../src/api/hooks/useActivityComments.ts) reads the
> spellings this API uses for the same things elsewhere — `comm` for the text,
> because that is what the `POST` body calls it, then `c` and `cmt`, with
> `unm`/`uim`/`dt` for the author and the time. A field that matches nothing is
> simply not drawn, so a miss costs a line rather than the sheet; and when rows
> arrive whose text it could not find, the thread says that in words instead of
> showing a column of blanks. **One real comment settles all of it.**

**The `POST` has never been fired.** `{ comm }` is Kickbase's own published body,
not a measurement, and it stayed that way deliberately: a comment lands in a
real league in front of real people, `OPTIONS` answers `allow: GET, POST`, and
there is no `DELETE` and no single-comment route — a probe would have been
permanent. So the first real exercise of it is somebody writing a comment they
meant to write, which is the only honest test it was ever going to get.

Posting invalidates the feed, because the entry's own `coc` moves with it.

### The crowned face on a matchday row

The feed entry names nobody — it carries the matchday and your own placement
and stops. But the question a settled matchday raises in a league is who took
it, so the row leads with **the winning manager, wearing a crown**.

It is free. The standings come from `/ranking?dayNumber=`, which is the **same
cache entry** the sheet that row opens reads, and the same one the
[duels page](duels.md) fills. So the row pays for a request the sheet would
have made anyway, and opening the sheet afterwards costs nothing.

The flag stays when nobody scored: a matchday every manager sat out sorts
alphabetically, and crowning the first name in the alphabet would be inventing
a winner.

### The sheet a matchday row opens

**Every league gets it.** A duel league used to have the row navigate straight
to `/duels?day=N` instead — which meant the one mode where a settled matchday
raises the most questions was the mode that never got its answer in place: the
feed was left behind for a page, and the ranking was another tap after that.

So the row always opens the ranking, and the link that *was* the row's whole
behaviour now sits beside the sheet's title:

| League | Head link | Goes to |
| ------ | --------- | ------- |
| Duels | **Duelle** › | `/duels?day=N` — the pairings for the matchday the sheet is about |
| Any other | **Rangliste** › | `/ranking` — the season table, the only league-wide ranking a normal league has |

Following it closes the sheet: it is a view of the page being opened, and left
stacked it would put an overlay over the answer.

The rows are [`ManagerRankingTab`](../../src/components/ranking/ManagerRankingTab.tsx),
the same ones the [duels page](duels.md)'s Rangliste draws — so in a duel
league **each row also says how that manager's duel went**: won, drawn or lost,
as an icon *and* the word, over the opponent's name, linking to the duel in
detail. The outcome is resolved against the opponent named in `hhoui` on this
same response, and `hhoui` is per-`dayNumber` — so it is the pairing of the
matchday the sheet is about, not of the current one.

That line is gated on the matchday being finished, because level at `0` in the
third minute is not a draw. Here the gate is hard `true`: the feed only ever
names a matchday that is over.

> [!NOTE]
> A matchday you sat out arrives with no day at all, and `?dayNumber=0` answers
> a ranking with every per-matchday field stripped — ten managers on nought
> points. There is nothing to open, so that row is not a button.

### Your placement comes from the standings, not the feed

`pl` on a matchday entry counts **from zero**, where every other placement in
this API counts from one. Nothing in the payload says so, and it cost a wrong
number on this row until it was caught against a real league.

Rather than trust a `+1`, the row reads `mdpl` out of the standings it is
already loading for the crown. That is Kickbase's own placement and it is
exactly what the sheet shows, so the row and the sheet can no longer disagree.
The zero-based `pl` survives only as the fallback for the moment before the
standings land.

### The achievement's money is a second request

The feed entry names and describes an achievement but says nothing about the
reward, and neither does the list endpoint. Only
[`/user/achievements/{type}`](../api/README.md#what-the-app-does-not-use)
carries `er`, so each achievement row asks for its own type through
[`useAchievement`](../../src/api/hooks/useAchievements.ts) — a handful of
requests in a feed of hundreds, held for an hour. The sheet the row opens reads
the same entry for the count, so opening it costs nothing more.

### It loads as you scroll

The feed runs back to the league's founding, so it is paged: **25 entries a
request**, the API's own default, fetched with `start`/`max` through a TanStack
**infinite query**. A sentinel under the last row asks for the next page when
it comes within 200 px of the viewport, and shows a spinner while it lands. A
page shorter than 25 is the end — the response carries neither a total nor a
cursor, so that is the only signal.

The sentinel is also a **Mehr laden** button: it is what a keyboard user or a
browser without `IntersectionObserver` gets, and it is what a *failed* page
falls back to — it reads *Erneut versuchen* and waits to be tapped, rather
than retrying itself from a sentinel that never left the screen.

### Why there is no filter on it

The API's `filter` parameter takes event-type codes and nothing else — no
manager, no date window; see
[the API notes](../api/leagues.md#what-filter-can-and-cannot-do). A type
filter (chips for *Transfers* · *Spieltage* · *Erfolge*) would be one query
key per selection and is the obvious next step; a manager or period filter
would have to be done client-side over the pages already fetched, which is a
different — and less honest — feature. Neither is built.

### The feed is about you

Two types are **personalised** by Kickbase: the matchday entry carries *your*
placement (and an empty payload if you sat the matchday out), and the
achievement entries are *your* achievements — another manager's never appear.
So *Du wurdest 1.* is the API's word, not a lookup, and the card reads
differently for every member of the same league.

## States

The whole page is one card, so its states are the feed's:

- **Loading**: four `Skeleton` rows. The heading renders immediately — the
  league name comes from context, not from a query.
- **Error**: an `ErrorState` with a retry, inside the card. Nothing else on the
  page can fail, since nothing else on the page loads.
- **Empty**: *Noch nichts passiert*. A league founded minutes ago genuinely has
  one entry, and after the type filter it can have none.

The manager avatars are the deliberate soft edge: `useRanking` failing costs
the transfer rows their faces and falls back to initials, and the feed reads
correctly without it.

## Possible extensions

- A **type filter** — chips for *Transfers* · *Spieltage* · *Erfolge* — maps
  straight onto the API's `filter` parameter and would be one query key per
  selection. The obvious next step, and the reason `FEED_TYPES` is a list
  rather than a constant string.
- A matchday row could expand into the **whole matchday table** without
  `/ranking`:
  [`GET …/activitiesFeed/{activityId}`](../api/leagues.md#get-v4leaguesleagueidactivitiesfeedactivityid)
  answers every manager's placement and points for a type-`17` entry.
- **Comment threads.** `coc` is rendered as a count and the threads behind it
  are readable and writable — see
  [the API notes](../api/leagues.md#get-v4leaguesleagueidactivitiesfeed).
  Nothing in the app opens one.
- `unreadCount` is mapped on both the manager and league models and is still
  not surfaced anywhere.
