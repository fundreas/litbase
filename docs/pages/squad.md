# Squad — "Mein Team"

[← Back to index](../README.md) · Route `/leagues/:leagueId/squad` ·
[`src/pages/SquadPage.tsx`](../../src/pages/SquadPage.tsx)

The signed-in manager's own players.

## Layout

```
  Mein Team
  20 Spieler · 194,4 Mio. € Gesamtwert

  TW · 2
  ┌────────────────────────────────────┐
  │ [img] Nübel            10,5 Mio. € │
  │       412 Pkt · ⌀ 39   ↗ +2,2 Mio. │
  └────────────────────────────────────┘

  ABW · 6
  ┌────────────────────────────────────┐
  │ [img] Fernández ●       6,8 Mio. € │
  │       39 Pkt · ⌀ 39    ↘ −1,1 Mio. │
  └────────────────────────────────────┘
  …
```

## Grouping and ordering

Players are grouped by position in fixed football order — **TW → ABW → MF →
ANG** — and within each group sorted by market value descending, so the most
valuable player leads.

The order comes from a `POSITION_ORDER` constant rather than from the API,
which returns players in lineup-slot order. Empty groups are filtered out, so
a squad with no forwards shows no ANG heading.

Position codes and their German labels are centralised in
[`models.ts`](../../src/api/models.ts) (`toPosition`, `POSITION_LABEL`), not
duplicated here.

## Row anatomy

| Element | Source | Notes |
| ------- | ------ | ----- |
| Image | `player.image` (`pim`) | Rounded square via `Avatar square`, falls back to initials |
| Name | `player.lastName` | Last name only — first names rarely fit |
| Status dot | `player.status !== 0` | Red `●` with `title="Nicht einsatzbereit"` |
| Points | `totalPoints`, `averagePoints` | `412 Pkt · ⌀ 39` |
| Market value | `marketValue` | Compact euros, tabular figures |
| Profit / loss | `profitLoss` (`mvgl`) | Signed, coloured green/red, `–` when flat |
| Trend arrow | `marketValueTrend` (`mvt`) | ↗ up, ↘ down, — flat |

Two distinct signals sit side by side on the bottom-right and are easy to
confuse when reading the code:

- **`profitLoss`** — how much has been gained or lost *against the purchase
  price*. Drives the colour.
- **`marketValueTrend`** — which way the value moved *recently*. Drives the
  arrow icon.

A player can be up overall (green) while trending down (↘).

`moneyDelta()` formats the signed value and uses a real minus sign (U+2212)
rather than a hyphen, so negative figures align with positive ones in tabular
figures.

## Header total

`Gesamtwert` is computed client-side by summing `marketValue` across the
squad — the API does not return a squad total on this endpoint. The league
selection payload has a `tv` field, but it is the *team value* used for
ranking and does not always equal the sum of current market values, so it is
deliberately not reused here.

## States

| State | Rendering |
| ----- | --------- |
| Loading | `PageHeading` plus `SkeletonList rows={8}` |
| Error | `ErrorState` with a retry that refetches |
| Empty | *Kein Spieler im Kader* — buy players on the market |

Unlike [Dashboard](dashboard.md), this page has a single query, so an error
takes over the whole page. There is no partial view to preserve.

## Data

[`useSquad(leagueId)`](../../src/api/hooks/useSquad.ts) →
`/v4/leagues/{leagueId}/squad`, mapped to `SquadMember[]`. Default `staleTime`
of 2 minutes; the query refetches on window focus, so returning to the tab
picks up value changes.

## Unmapped fields available

`SquadPlayer` in [`types.ts`](../../src/api/types.ts) documents more than the
model currently exposes:

- `prob` — start probability 1–5, already mapped to `startProbability` but not
  rendered.
- `ofc` — offer count, mapped as `offerCount`, not rendered. Useful for
  showing "3 Angebote" on a listed player.
- `lo` — lineup slot order, and `stl` — an additional status list.
- `iotm` — player of the match.

## Possible extensions

- Show `startProbability` as a pip row or coloured dot; it is the single most
  useful pre-matchday signal.
- Surface `offerCount` so pending offers are visible without opening the
  market.
- A lineup/formation view using `lo` instead of the flat grouped list.
- Sort control (points, average, value, trend) — the grouping is currently
  fixed.
