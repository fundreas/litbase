# Dashboard

[← Back to index](../README.md) · Route `/leagues/:leagueId/dashboard` ·
[`src/pages/DashboardPage.tsx`](../../src/pages/DashboardPage.tsx)

The league's landing page, and the **reference implementation** for the query
pattern every other data page should follow.

## Layout

```
  MADMASSCREM Sunday Leauge
  Bundesliga · 4 Manager · seit 11. Aug. 2026

  ┌──────────────┬──────────────┐
  │ BUDGET       │ TEAMWERT     │
  │ -23,8 Mio. € │ 194,4 Mio. € │
  ├──────────────┼──────────────┤
  │ PUNKTE       │ PLATZ        │
  │ 2.074        │ 3.           │
  │ Spieltag: 88 │ 20 Spieler…  │
  └──────────────┴──────────────┘

  ┌─────────────────────────────┐
  │ Rangliste            Alle › │
  │ 1.  (A) elias         755   │
  │ 2.  (A) robidfl       612   │
  │ 3.  (A) Danger  du    588   │
  └─────────────────────────────┘

  ┌─────────────────────────────┐
  │ Aktivitäten                 │
  │ (P) Tom Bischof steht zum   │
  │     Verkauf      vor 5 Min. │
  │     18,7 Mio. €             │
  │ (P) leo abi kauft Adeline   │
  │     5,6 Mio. €    vor 3 Std.│
  │ (🏳) Spieltag 2 ist beendet │
  │     Du wurdest 1.           │
  │ (🏆) Erfolg: Tormaschine    │
  │ …                           │
  │         ── lädt weiter ──   │
  └─────────────────────────────┘
```

## Data

Four queries, each loading independently so one slow request never blocks the
rest of the page:

| Query | Supplies |
| ----- | -------- |
| [`useLeagueManager(leagueId)`](../../src/api/hooks/useLeague.ts) | Budget, squad size |
| [`useLeagueDetails(leagueId)`](../../src/api/hooks/useLeague.ts) | Competition name, manager count, founding date — the subtitle |
| [`useRanking(leagueId)`](../../src/api/hooks/useRanking.ts) | Team value, points, placement, and the top three |
| [`useActivities(leagueId)`](../../src/api/hooks/useActivities.ts) | The event log, 25 entries a page |

The signed-in user's own row is found by matching `manager.id` against
`user?.id` from `useAuth()`, since `/leagues/{id}/me` does not itself carry
points or team value — those only exist in the ranking payload.

## Stat tiles

Four [`StatTile`](../../src/components/ui/Card.tsx) instances in a
`grid-cols-2`. Two columns rather than four: at 390px wide, four tiles would
truncate every value.

| Tile | Value | Sub-line | Tone |
| ---- | ----- | -------- | ---- |
| Budget | `money(budget)` | — | Red when negative, green otherwise |
| Teamwert | `money(teamValue)` | — | Neutral |
| Punkte | `points(seasonPoints)` | Matchday points | Neutral |
| Platz | `placement(seasonPlacement)` | Squad size | Neutral |

Budget being negative is normal in Kickbase (managers borrow against team
value), so it is tinted rather than flagged as an error.

All figures use the `nums` utility for tabular figures, so digits line up
between the two columns. Money is compact — `-23,8 Mio. €` rather than
`-23.771.190 €` — because the full form does not fit a phone column. See
[`lib/format.ts`](../../src/lib/format.ts).

## Ranking preview

The top three from the same `useRanking` data, so opening the dashboard and
then the full [Ranking](ranking.md) page costs one request, not two. The *Alle*
link routes to `/leagues/:leagueId/ranking`, and the user's own row is tagged
`du` in the accent colour.

## Aktivitäten

The league's event log, below the ranking — Kickbase's own *Aktivitäten* tab.
[`ActivityFeed`](../../src/components/dashboard/ActivityFeed.tsx) reads
[`GET /leagues/{id}/activitiesFeed`](../api/leagues.md#get-v4leaguesleagueidactivitiesfeed)
and renders one row per entry, newest first:

| Type | Row | Detail line | Leading |
| ---- | --- | ----------- | ------- |
| Listing | *Tom Bischof* steht zum Verkauf | Market value | Portrait → player page |
| Transfer | **leo abi** kauft *Adeline* · **yo-yo** verkauft *Güther* | Fee, green for a buy, red for a sale | Portrait → player page |
| Joined / left | **Marvin** ist der Liga beigetreten · hat die Liga verlassen | — | Avatar, or a person icon |
| Matchday | **Spieltag 2** ist beendet | *Du wurdest 1.* — when you took part | Flag |
| Achievement | Erfolg: **Tormaschine** | Kickbase's description | Trophy, accent |
| Login bonus | **Auflaufprämie** kassiert | Amount · day | Gift, accent — from the spec, never seen live |
| Founded | Liga **JSG Königslutter** gegründet | — | Tag |

Every row carries the time on the right — `vor 5 Min.`, `vor 3 Std.`,
`gestern`, then the weekday and date — from
[`relativeTime`](../../src/lib/format.ts). Types the app has not decoded are
dropped rather than shown as a code.

The player's name and portrait link to his page; nothing else on a row is
tappable. Managers, matchdays and achievements have no page to go to.

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

- **Loading**: the tile grid is replaced by four `Skeleton` blocks, the
  ranking card by three and the activity card by four, each section
  independently. The heading renders immediately since the league name comes
  from context, not a query.
- **Error**: only `managerQuery` failing takes over the page — it is the one
  query without which nothing meaningful remains. `detailsQuery` failing just
  drops the subtitle; `rankingQuery` failing leaves the tiles' points and
  placement blank (`–`, from the formatters' null handling); the activity card
  shows its own error state with a retry, inside the card.

That asymmetry is deliberate: a partial dashboard beats an error page.

## Possible extensions

- The `lp` array on each ranking user is points-per-matchday, oldest first,
  with `null` for matchdays not played — enough for a sparkline without any
  new request.
- `useLeagueManager` also returns `tpc`, per-team player counts in the squad,
  with club crest paths. A "your clubs" strip would need no new endpoint.
- `unreadCount` is already mapped on both the manager and league models but is
  not surfaced anywhere yet.
- A matchday row could expand into the **whole matchday table**:
  [`GET …/activitiesFeed/{activityId}`](../api/leagues.md#get-v4leaguesleagueidactivitiesfeedactivityid)
  answers every manager's placement and points for a type-`17` entry.
