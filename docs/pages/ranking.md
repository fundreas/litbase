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

**The API does not return managers in placement order.** A real response led
with a manager sitting 6th, so the array order is meaningless for display and
the client sorts explicitly on the placement field.

Which placement applies depends on the mode — see [Duel mode](#duel-mode).
Ties break on the points that decide the table, so the order stays stable and
meaningful if Kickbase ever reports two managers at the same place.

An earlier version trusted the array order on the assumption that the endpoint
was pre-sorted. It is not.

## Duel mode

Leagues can be played as duels ("Duell"), where the table is head-to-head
rather than raw points:

| | Normal | Duel |
| --- | --- | --- |
| Sorted and numbered by | `spl` | `hhpl` |
| Headline points | `sp` | `hhsp` |
| Secondary line | Team value · matchday points (`mdp`) | Season points (`sp`) · matchday duel points (`hhmp`) |

**Detection is from the data, not a flag.** `hhpl` is present only in duel
leagues; a normal league carries no `hhpl` at all. The response's top-level
`gpm` was checked and rejected for this — it distinguishes
classic/arena/beginner/high-management and says nothing about duels. `hhsp`
alone is not enough either: it appears as `0` in normal leagues.

### Which field is the duel points

`hhsp` is treated as the headline and `hhmp` as the matchday figure, following
the convention the rest of the API uses without exception — `sp`/`spl` for
season, `mdp`/`mdpl` for matchday, so `hh` + `sp` is the head-to-head season
total. `hhpl` being a *season* table position is the corroborating evidence.

This could not be confirmed against live data: no accessible duel league had
`hhsp` and `hhmp` diverge (in the one real sample both read `3`, consistent
with a single duel won). Both figures are therefore shown and labelled, so an
inverted reading would be visible immediately rather than silent.

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
- `hhoui` — the current duel opponent's user id. Not mapped; would let a duel
  league show "vs. <opponent>" per row.
- `mdpl` — matchday placement, mapped as `matchdayPlacement`, displayed only
  as points today.
- `adm` — league admin flag, mapped as `isAdmin`, not rendered.

## Possible extensions

- **A sparkline per manager from `pointsPerMatchday`** — no new request needed,
  and it turns a static table into a form guide.
- Toggle between season and matchday standings (`mdpl` / `mdp` are both
  already mapped).
- Tap a manager to open their squad. Kickbase exposes other managers' squads,
  but the endpoint is not in [`endpoints.ts`](../../src/api/endpoints.ts) yet
  and has not been probed.
- Mark the league admin using `isAdmin`.
