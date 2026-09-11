# Spieler suchen

[← Back to index](../README.md)

```
/leagues/:leagueId/players?q=<term>
```

[`PlayersPage`](../../src/pages/PlayersPage.tsx) — **find a player by name**,
anywhere in the competition, owned or not.

Every other list of players in this app is a list somebody else assembled: a
[squad](squad.md), the [market](market.md), a
[top-25](matchday.md#rangliste), a [club's roster](team.md). Each answers a
question *about* a set of players; none of them answers *where is this
player*, and until this page there was no answer at all — a player in nobody's
squad and on no market could only be reached by knowing his id.

The page hands off immediately: every row is a link to his
[own page](player-detail.md), which is where the scoring history, the
market-value chart and the ownership detail already live. A search result is a
way in, not a place to stay.

## Getting there

The **magnifier in the header**, left of the avatar. Not the drawer: search is
wanted *from* a page, mid-thought, while reading about somebody else, and a
search two taps deep is a search nobody makes. It sits next to the avatar for
the same reason [Einstellungen](preferences.md) sits behind it — the
right-hand corner of the bar is the reader's own, and the drawer lists the
league's pages.

Like that page it therefore has **no entry in `NAV_ITEMS`**. It does light
*Mannschaft*, because `alsoMatches: ['players']` on that entry covers
`/players/:playerId` — the player detail page, which has no entry of its own —
and the prefix cannot tell the two apart. See
[`navigation.ts`](../../src/components/layout/navigation.ts).

## What it replaced

This route was the **All players** stub: a `PagePlaceholder` over
`/v4/competitions/{id}/players`, designed around a payload of "every player in
the competition" that does not exist. That endpoint serves the current
matchday's **twenty-five best**, which is why the stub's plans — virtualise
hundreds of rows, filter by position before rendering — were solving a problem
the API never posed. The stub's own note said where to look first:
`/players/search`, then unprobed. This is that page.

## The term lives in the URL

`?q=` carries the settled term, written with `replace`:

- a result list is **linkable and survives a reload**, and the box is seeded
  from the parameter on arrival;
- the **back button leaves the page** rather than walking back through half a
  name, which is what a history entry per keystroke would do.

The input itself is ordinary React state. It is deliberately **not** bound to
the query string in both directions — a field that read itself back from the
URL every render would fight the debounce.

## The debounce, and the two states it creates

500 ms after the last keystroke, the trimmed term settles and the request
goes. A name typed at speed costs one request instead of eight, and a reader
who has stopped to think does not notice the wait.

Terms shorter than **two characters are not sent** at all: one letter matches
a sizeable slice of the competition and answers a list nobody scrolls.

Two things are therefore true at once while typing, and the page shows them as
one: the box has a term the results do not answer to yet (`draft !== term`),
or a request for the settled term is in flight. Either way the **magnifier in
the field turns into a spinner** — to the reader they are the same fact, *what
is on screen is not the answer to what I have typed*.

The previous term's rows **stay on screen** while the next term loads
(`placeholderData: keepPreviousData`), so typing through a name refines a list
rather than flashing an empty one at every letter. Each term caches for two
minutes, which is what makes backspacing instant: the shorter term was fetched
on the way in.

## No heading, no chrome

The page is a field and a list, in that order and with nothing above them. A
title over a search box says what the reader has just tapped a magnifier to
do, and costs a line between the tap and the keyboard — so the
[`PageHeading`](../../src/components/PageHeading.tsx) every other page starts
with is deliberately absent here. The field's label survives for screen
readers via `hideLabel` on [`Input`](../../src/components/ui/Input.tsx), which
have no magnifier to have tapped.

## The row

```
┌──────┬──────────────────────────┬─────┬──────────────┐
│      │ Kane             ✚  🏷    │     │  65,8 Mio. € │
│  👤  │ [FCB]  ANG               │ (A) │  ↘ −390 Tsd. │
└──────┴──────────────────────────┴─────┴──────────────┘
   who            him              whose    what he costs
```

What tells two players of the same name apart: **club, position, whose he is,
and what he is worth today against yesterday**. No filters, no sorting, no
position chips — a name search returns a handful of rows, the reader already
knows which one they meant, and chips over a five-row list are furniture, in
the space the heading is not taking either.

- **The owner is a face in a column of its own**, not a *Gehört X* on the
  second line. A long manager name pushed the club and the position out of the
  line that identifies the player, and read as a sentence where every other
  list in the app shows a portrait. A column of
  [`OwnerBadge`](../../src/components/matchday/OwnerBadge.tsx)s answers *what
  is still free here* in one sweep, and the reader's own players carry the
  accent ring they carry everywhere else. **A free player keeps the column's
  width** with a dashed outline, so *frei* is a shape rather than a gap.
- **The face is a lookup.** The payload names the owner and carries neither an
  id nor an avatar, so the name is joined against the league's member list
  (`useLeagueDetails` — one cached request the [Liga](league.md) page has
  usually paid for). A miss still draws the badge: the avatar falls back to
  initials, which beats an empty column.
- **Under the market value is the overnight move** — `tfhmvt`, the same
  24-hour figure and the same arrow the [market](market.md) rows draw, because
  a value without its direction is half a fact on a page about finding
  somebody to buy. It lives **only on a player's own detail**, so it is one
  request per row: [`useMarketValueChanges`](../../src/api/hooks/useMarketValueChanges.ts)
  fans out over the **top 25 rows only**, a two-letter term being bounded by
  nothing. A row without a figure shows no second line at all — a dash would
  read as *no change*.
- **The crest is resolved, not served.** Rows carry `tid` only, so the club
  comes from [`useTeamDirectory`](../../src/api/hooks/useCompetition.ts) — one
  cached request the [Saison](season.md) page has usually paid for already.
  Rows render without it rather than waiting for it.
- **The availability mark** is the same one a club's Kader draws, worded from
  the code: this payload has no `stxt`.
- **A small store glyph** marks a player who is on the transfer market right
  now, which is the one piece of "you could act on this" the payload offers.

## Data

[`usePlayerSearch(competitionId, leagueId, term)`](../../src/api/hooks/usePlayerSearch.ts)
→ [`/v4/competitions/{competitionId}/players/search`](../api/competitions.md#get-v4competitionscompetitionidplayerssearch),
mapped to `PlayerSearchResult[]`:

| Field | Meaning |
| ----- | ------- |
| `id` | Player id |
| `name` | Last name — all the endpoint serves |
| `teamId` | Club id; the crest is looked up |
| `position` | `'gk' \| 'def' \| 'mid' \| 'fwd'` |
| `marketValue` | In € |
| `availability` | `st`; `0` is fit |
| `owner` | The owning manager's **name**, or `undefined` when nobody holds him. The face is looked up from it |
| `isListed` | He is on the market right now |
| `image` | Portrait, CDN-relative |

The cache key hangs under the **league**, not the competition: the endpoint
takes a `leagueId` and the owner it names is league-specific.

## ⚠ Built on the spec, not on a probe

The endpoint's shape comes from the published Apidog document and its one
captured example (`query=Kane`) — it has **not** been checked against a live
league. Four things are consequently unknown and handled defensively:

- whether the match is a **prefix or a substring**, and whether it reaches
  **first names** (the rows carry only a last name, which proves nothing
  either way);
- whether an **empty result** is `it: []` or a missing `it`;
- whether `onm` is **omitted** for an unowned player rather than reading
  `"Kickbase"` — both are treated as *frei*;
- what an **empty or one-character query** answers, which the two-character
  floor makes moot in the UI.

The open questions are kept with the endpoint, in
[Competitions](../api/competitions.md#what-is-not-known). Resolving them is
one live search away and should delete this section.
