# Bundesliga table

[← Back to index](../README.md) · Route `/leagues/:leagueId/table` ·
[`src/pages/TablePage.tsx`](../../src/pages/TablePage.tsx)

**Status: stub.** The query is wired and proven; the UI is not built.

The real-world league table, as opposed to the fantasy
[Ranking](ranking.md) of managers.

## What it does today

Renders [`PagePlaceholder`](../../src/components/PagePlaceholder.tsx) with the
row count from the live query — 18 for the Bundesliga.

## Scope: competition, not league

This is the one page whose data is **not league-scoped**. It reads
`competitionId` from `useActiveLeague()`, not `leagueId`:

```ts
const { competitionId } = useActiveLeague()
const query = useCompetitionTable(competitionId)
```

That matters for caching. The key is `['competition', cid, 'table']`, outside
the `['league', leagueId]` namespace, so switching leagues does **not** drop
it — see [API layer](../api-layer.md#query-keys). Two leagues in the same
competition share one cached table, which is correct.

`"1"` is the Bundesliga competition id.

## Data ready to use

[`useCompetitionTable(competitionId)`](../../src/api/hooks/useCompetition.ts) →
`/v4/competitions/{competitionId}/table`, mapped to `TableRow[]`:

| Field | Meaning |
| ----- | ------- |
| `teamId` | Club id |
| `teamName` | Short club name, e.g. `Bayern`, `Stuttgart` |
| `teamImage` | Crest, CDN-relative — **an SVG**, not a raster image |
| `placement` | Current position |
| `previousPlacement` | Position before the last matchday |
| `points` | League points |
| `matchesPlayed` | Games played |
| `goalDifference` | Goal difference, already signed |
| `kickbasePoints` | Total Kickbase points scored by that club's players |

`staleTime` is 10 minutes — a real table only changes on matchdays.

## Things worth knowing

**`kickbasePoints` is the interesting column.** A plain Bundesliga table is
available anywhere; the reason to have one *here* is that it can sit beside
the fantasy points each club's players have produced. That is the column that
makes this page worth building.

**Placement movement is derivable** from `placement` vs `previousPlacement` —
the same up/down/flat treatment as `PlacementChange` in
[Ranking](ranking.md#placement-change), which is worth extracting into a
shared component rather than writing twice.

**Crests are SVGs.** `Avatar` with `square` renders them fine, but they are
vector so they scale cleanly — no need for a large size to avoid blur.

**Goal difference is pre-signed** by the API (`gd: -4`), so use `delta()` from
[`lib/format.ts`](../../src/lib/format.ts) for the `+0`/`−4` display rather
than formatting the sign by hand.

## Suggested layout

A compact table is legitimate here even on a phone — this is the one screen
where a real tabular layout beats cards, because readers scan columns. Keep it
inside an `overflow-x-auto` container so it can scroll horizontally rather
than forcing the page to.

Columns that fit a 390px viewport: placement, crest, short name, matches,
goal difference, points. Kickbase points would need either a second row per
club or a horizontal scroll.
