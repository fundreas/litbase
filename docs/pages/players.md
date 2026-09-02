# All players

[← Back to index](../README.md) · Route `/leagues/:leagueId/players` ·
[`src/pages/PlayersPage.tsx`](../../src/pages/PlayersPage.tsx)

**Status: stub.** The query is wired and proven; the UI is not built.

Every player in the competition — the scouting view, as opposed to
[Squad](squad.md) (yours) or [Market](market.md) (for sale).

## What it does today

Renders [`PagePlaceholder`](../../src/components/PagePlaceholder.tsx) with the
row count from the live query. Expect several hundred.

## Scope: competition, not league

Like [Bundesliga table](table.md), this reads `competitionId` from
`useActiveLeague()`, so its cache is shared across leagues in the same
competition and survives a league switch.

## Data ready to use

[`useCompetitionPlayers(competitionId)`](../../src/api/hooks/useCompetition.ts)
→ `/v4/competitions/{competitionId}/players`, mapped to
`CompetitionPlayerSummary[]`:

| Field | Meaning |
| ----- | ------- |
| `id` | Player id (`pi` on the wire — note: **not** `i`, unlike the squad payload) |
| `lastName` | Last name |
| `teamId` | Club id |
| `position` | `'gk' \| 'def' \| 'mid' \| 'fwd'` |
| `points` | Season points |
| `minutesPlayed` | Minutes |
| `goals`, `assists` | Goals and assists |
| `isInjured` | Injury flag (`il`) |
| `image` | Player image, CDN-relative |

`staleTime` is **1 hour**, the longest in the app — this is a large payload
that barely moves within a matchday.

## The one real constraint: size

This is the biggest response the app touches. Rendering it as a plain mapped
list will produce hundreds of DOM nodes and a visible jank on a phone.
Whatever the design, it needs one of:

- **Virtualisation** — only render the visible window. No virtualisation
  library is currently a dependency; `@tanstack/react-virtual` would pair
  naturally with the existing `@tanstack/*` chunk.
- **Filtering first** — require a position or club filter, or a search box,
  before rendering anything. Cheaper to build and arguably better UX for
  scouting, which is rarely "show me everyone".

The second is the pragmatic starting point.

## Fields the model does not expose

`CompetitionPlayer` in [`types.ts`](../../src/api/types.ts) also documents:

- `mi` — match id of the next or current fixture.
- `ot` — the opponent club for that fixture, with a crest path. This is
  genuinely useful for scouting ("who plays a weak side next?") and is **not
  currently mapped** into the model.
- `st` — status code, mapped but unused; `isInjured` covers the common case.
- `pes` — meaning unconfirmed, flagged as a guess in `types.ts`.
- `cs` — clean sheets.

Adding `ot` to `CompetitionPlayerSummary` is a small change in
[`useCompetition.ts`](../../src/api/hooks/useCompetition.ts) and would make
the page considerably more useful.

## Note on market value

This endpoint does **not** return market values — the competition player list
carries performance data only. Values live on the league-scoped squad and
market payloads. A "cheap players with good points" view would need either a
different endpoint (unprobed) or a join against
[`useMarket`](../../src/api/hooks/useMarket.ts), which only covers currently
listed players.

Worth probing before designing around it.

## Suggested layout

Search box plus position filter chips at the top, then rows showing name,
club crest, points, and a points-per-minute or points-per-game figure —
`points` and `minutesPlayed` are both present, and the derived rate is more
informative than either alone for spotting under-priced players.
