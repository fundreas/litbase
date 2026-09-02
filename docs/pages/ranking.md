# Ranking — "Rangliste"

[← Back to index](../README.md) · Route `/leagues/:leagueId/ranking` ·
[`src/pages/RankingPage.tsx`](../../src/pages/RankingPage.tsx)

Full standings for every manager in the league.

## Layout

```
  Rangliste
  4 Manager

  ┌──────────────────────────────────────┐
  │ 1.  (A) elias                  755   │
  │         103,1 Mio. € Teamwert     —  │
  │         · 88 am Spieltag             │
  ├──────────────────────────────────────┤
  │ 3.  (A) Danger  du             588   │  ← accent border
  │         194,4 Mio. € Teamwert   ↗ 2  │
  │         · 71 am Spieltag             │
  └──────────────────────────────────────┘
```

## Ordering

The list is rendered **in the order the API returns it**. `/leagues/{id}/ranking`
already sorts by placement, so no client-side sort is applied — and adding one
would risk disagreeing with Kickbase's own tie-breaking.

`seasonPlacement` is displayed from the payload rather than derived from the
array index, so ties render correctly if Kickbase ever reports two managers at
the same place.

## Row anatomy

| Element | Source |
| ------- | ------ |
| Placement | `seasonPlacement`, formatted `3.` by `placement()` |
| Avatar | `image` (`uim`), initials fallback |
| Name | `name`, with a `du` tag in accent colour when `id === user?.id` |
| Secondary line | Team value and matchday points |
| Points | `seasonPoints`, bold, right-aligned |
| Change | `placementChange` (`ppc`) |

**Your own row is outlined** in `border-accent/50` instead of the usual
`border-line`, which makes it findable by scanning rather than reading — the
point of a standings list on a phone.

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

| State | Rendering |
| ----- | --------- |
| Loading | `PageHeading` plus `SkeletonList rows={8}` |
| Error | `ErrorState` with retry |

There is no empty state. A league always has at least the signed-in manager,
so an empty ranking would mean something is broken — and the error state is
the honest response to that.

## Data

[`useRanking(leagueId)`](../../src/api/hooks/useRanking.ts) →
`/v4/leagues/{leagueId}/ranking`, mapped to `RankedManager[]`.

Note this is the **same query** the [Dashboard](dashboard.md) uses for its
top-three preview and its Punkte/Platz/Teamwert tiles. Navigating dashboard →
ranking is therefore free: the cache is already warm and the list renders
instantly.

## Unmapped fields available

`RankingUser` in [`types.ts`](../../src/api/types.ts) carries more than the
page shows:

- **`lp`** — points per matchday, oldest first, `null` for matchdays not
  played. Already mapped as `pointsPerMatchday`. This is the richest unused
  data in the app.
- `mdpl` — matchday placement, mapped as `matchdayPlacement`, displayed only
  as points today.
- `adm` — league admin flag, mapped as `isAdmin`, not rendered.
- `hhsp` / `hhmp` / `hhpl` — head-to-head figures, not yet mapped.

## Possible extensions

- **A sparkline per manager from `pointsPerMatchday`** — no new request needed,
  and it turns a static table into a form guide.
- Toggle between season and matchday standings (`mdpl` / `mdp` are both
  already mapped).
- Tap a manager to open their squad. Kickbase exposes other managers' squads,
  but the endpoint is not in [`endpoints.ts`](../../src/api/endpoints.ts) yet
  and has not been probed.
- Mark the league admin using `isAdmin`.
