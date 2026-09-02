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
```

## Data

Three queries, each loading independently so one slow request never blocks the
rest of the page:

| Query | Supplies |
| ----- | -------- |
| [`useLeagueManager(leagueId)`](../../src/api/hooks/useLeague.ts) | Budget, squad size |
| [`useLeagueDetails(leagueId)`](../../src/api/hooks/useLeague.ts) | Competition name, manager count, founding date — the subtitle |
| [`useRanking(leagueId)`](../../src/api/hooks/useRanking.ts) | Team value, points, placement, and the top three |

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

## States

- **Loading**: the tile grid is replaced by four `Skeleton` blocks and the
  ranking card by three, each section independently. The heading renders
  immediately since the league name comes from context, not a query.
- **Error**: only `managerQuery` failing takes over the page — it is the one
  query without which nothing meaningful remains. `detailsQuery` failing just
  drops the subtitle; `rankingQuery` failing leaves the tiles' points and
  placement blank (`–`, from the formatters' null handling).

That asymmetry is deliberate: a partial dashboard beats an error page.

## Possible extensions

- The `lp` array on each ranking user is points-per-matchday, oldest first,
  with `null` for matchdays not played — enough for a sparkline without any
  new request.
- `useLeagueManager` also returns `tpc`, per-team player counts in the squad,
  with club crest paths. A "your clubs" strip would need no new endpoint.
- `unreadCount` is already mapped on both the manager and league models but is
  not surfaced anywhere yet.
