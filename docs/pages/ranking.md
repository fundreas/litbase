# Ranking — "Rangliste"

[← Back to index](../README.md) · Route `/leagues/:leagueId/ranking` ·
[`src/pages/RankingPage.tsx`](../../src/pages/RankingPage.tsx)

Full standings for every manager in the league.

## Layout

```
  Rangliste                          ┌───┬───┐
  4 Manager · Duell-Modus            │ ⚔ │ Σ │   ← sort toggle
                                     └───┴───┘
  ┌────────────────────────────────────────────┐
  │  1.  (A)  robidfl                       9  │
  │           194,4 Mio. € Teamwert    612 Pkt │
  │           410 Pkt ✓ vs. Danger             │
  ├────────────────────────────────────────────┤
  │  2.  (A)  Danger  du                    6  │  ← accent border
  │  ↗2       103,1 Mio. € Teamwert    588 Pkt │
  │           120 Pkt ✗ vs. robidfl            │
  └────────────────────────────────────────────┘
```

The row is a name over **two subtitles** — team value, then the matchday
result — because three separate facts were previously crammed onto one line
and truncated on a phone. The placement's movement sits under the placement
number and appears **only when it changed**; a lone dash for "unchanged" was a
whole line saying nothing.

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
| Headline figure (bold) | `sp` | `hhsp` |
| Figure beneath it | — | `sp`, the Kickbase total |
| Under the name | Team value · `mdp` | Team value · `hhmp` |

Stacking two figures on the right is what makes the ordering
self-explaining: the bold one is what the table is sorted by, the muted one is
the Kickbase total that does **not** decide it. Without that, a duel table
looks wrong — a manager on 755 raw points sitting below one on 612 has no
visible reason to be there.

In a normal league those would be the same number, so only the total is shown.

### The sort toggle

A duel league has **two legitimate tables**, so the heading carries a toggle on
the right: **Duell** (the default) or **Punkte**.

It switches the whole view at once — order, placement number *and* headline
figure. Listing duel placements in points order would look broken, so the
points view renumbers the rows by `spl` and promotes `sp` to the bold figure,
with the duel total moving to the muted line. The toggle is not rendered
outside duel mode, where both options would mean the same thing.

The two buttons are **icon-only**: crossed swords (`Swords`) for the
head-to-head table, a summation sign (`Sigma`) for the points total. Labels
would need truncating next to the heading on a phone, so the meaning rides on
`title` plus `sr-only` text instead.

Only the non-default view re-sorts: the hook already returns the league's own
table.

### Duel result icon

The second subtitle reads *matchday Kickbase points · result icon · opponent* —
a green check for a win, a grey dash for a draw, a red cross for a loss,
followed by "vs. <name>". The opponent's name comes from the same `byId` map
the result is computed with, so it costs nothing extra.

Note the figure there is the manager's **real Kickbase points for the
matchday** (`mdp`), not their duel points. Those are what the duel was decided
on; the icon says how it went, so printing the duel points as well would be
redundant.

**The result is computed, not read off a scoring scale.** `hhoui` names the
opponent and every manager is in the same payload, so
`duelResultOf()` compares the two matchday totals directly. Reading `hhmp` as
3/1/0 would instead be an inference about how Kickbase awards duel points, and
a league scoring them differently would mislabel every row silently. Checked
that both sides of a duel always agree (one `won` ↔ one `lost`, or both
`drawn`), and that a missing or out-of-league opponent yields no icon rather
than a wrong one.

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
| Placement | `seasonPlacement` or `duelPlacement`, formatted `3.` by `placement()` |
| Placement change | `placementChange` (`ppc`), under the placement — hidden when `0` |
| Avatar | `image` (`uim`), initials fallback |
| Name | `name`, with a `du` tag in accent colour when `id === user?.id` |
| Subtitle 1 | Team value |
| Subtitle 2 | Matchday Kickbase points (`mdp`), duel result icon, opponent name |
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
- `hhmp` — the duel points awarded this matchday. Mapped, but unused now that
  the result is derived from the matchday comparison; the scale (3/1/0?) is
  still unconfirmed.
- `mdpl` — matchday placement, mapped as `matchdayPlacement`, displayed only
  as points today.
- `adm` — league admin flag, mapped as `isAdmin`, not rendered.

## Possible extensions

- **A sparkline per manager from `pointsPerMatchday`** — no new request needed,
  and it turns a static table into a form guide.
- Toggle between season and matchday standings (`mdpl` / `mdp` are both
  already mapped) — the duel/points toggle is the pattern to follow.
- Show the duel opponent's name per row; `hhoui` is mapped as
  `duelOpponentId` and the whole field is already addressable by id.
- Tap a manager to open their squad. Kickbase exposes other managers' squads,
  but the endpoint is not in [`endpoints.ts`](../../src/api/endpoints.ts) yet
  and has not been probed.
- Mark the league admin using `isAdmin`.
