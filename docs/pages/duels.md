# Duels — "Duelle"

[← Back to index](../README.md) · Route `/leagues/:leagueId/duels?day=N` ·
[`src/pages/DuelsPage.tsx`](../../src/pages/DuelsPage.tsx)

Every manager's head-to-head for one matchday. **Duel leagues only** — see
[Availability](#availability).

## Layout

```
  Duelle
  Live-Punkte, minütlich aktualisiert

  ┌────────────────────────────────────────────┐
  │ 2. Spieltag                    Live     ▾  │   ← the whole block is
  │ Fr, 4. Sep. – So, 6. Sep.                  │     the matchday picker
  └────────────────────────────────────────────┘

  ┌────────────────────────────────────────────┐
  │ (A) Peterpan007    ⚔     Danger du     (A) │  ← accent border: your duel
  │     978 Pkt                    834 Pkt     │
  ├────────────────────────────────────────────┤
  │ (A) Max            ⚔          Olaf     (A) │
  │     ✓ 948 Pkt                  906 Pkt     │
  └────────────────────────────────────────────┘
```

A duel card is **two mirrored halves** around a divider — avatar outside, text
turned to face the middle. That is what makes it read as a duel rather than as
two list rows that happen to share a border. Both names truncate: a phone at
360px leaves roughly 110px per side, and manager names are not short.

**The whole card is a link** to [Duel detail](duel-detail.md), carrying the
selected matchday with it — not a chevron in the corner, because a duel row on
a phone is a big target and every part of it means "this duel".

**Your own duel is pulled to the front** and outlined in `border-accent/50`.
It is the one the page was opened for; making it findable by scanning rather
than reading is the whole point on a phone. The rest keep the hook's order,
which is by the better-placed of the two managers, so the top of the duel table
comes first.

## The subtitle switches on kick-off

This is the page's one real rule:

| Matchday | Subtitle under each name |
| -------- | ------------------------ |
| Started (live or finished) | `978 Pkt` — that matchday's points, live while it runs |
| Not started | `4. Platz` — the manager's current standing |

Before kick-off every score is `0`, and printing "0 Pkt" ten times would say
nothing at all. The standing is what is actually known at that moment, so that
is what is shown. The placement is the **duel table** position (`hhpl`) where
there is one — in a duel league that *is* the league's table — falling back to
the points placement (`spl`).

### Marking who is ahead

Once the matchday has started the leading side's points are set in
`font-semibold text-ink` against the other's `text-muted`, and a finished duel
adds a green `CircleCheck`. Never colour alone: the
[ranking page](ranking.md#duel-outcome) settled that colour is not a cue
everyone gets. What the emphasis *means* is spelled out for screen readers
("– gewonnen" / "– in Führung"), which would otherwise get a bare number and no
way to tell who is winning.

The leader is decided by comparing the two managers' matchday points, exactly
as `duelResultOf()` does on the ranking page — not by reading `hhmp`. See
[Which field is the duel points](ranking.md#which-field-is-the-duel-points).
Before kick-off both sides are level at `0`, so `duelLeader()` returns nothing
and the card must gate on `hasStarted` before reading "level" as a draw.

## The matchday picker

The heading block *is* the control: tapping it opens a drawer listing all 34
matchdays. A separate "Spieltag wählen" button beside a static label would
spend a second row of a phone screen saying the same thing twice.

The drawer opens from the **right**. Left belongs to the app's navigation, and
two drawers arriving from the same edge read as the same surface.

Each row carries the matchday number, its date range and a state chip —
**Beendet** / **Live** (with a pulsing dot) / **Offen**. The competition's
current matchday is tagged `aktuell`. The selected row scrolls itself into view
on open, via a ref callback: the drawer mounts when it opens, 34 matchdays do
not fit on a screen, and opening the list at matchday 1 in April would be
useless.

### Which matchday is "current"

**The default comes from the competition, not from the ranking.** The two
disagree:

| Source | Field | With matchday 1 played and 2 not yet kicked off |
| ------ | ----- | ----------------------------------------------- |
| `/v4/competitions/{id}/matchdays` | `day` | `2` — the upcoming one |
| `/v4/leagues/{id}/ranking` | `day` | `1` — the last **scored** one |

The spec asks for "the current one from the competition", which is the first —
and it is also the right default for a picker, because it is the matchday
people are about to watch.

### Has it started?

From the fixtures' kick-off times, not from a flag. Fixtures carry `st`, but
only `0` (upcoming) and `2` (finished) have ever been observed, so a matchday
*in progress* is not distinguishable from `st` alone.
[`matchdayState()`](../../src/api/models.ts) therefore reads:

- `finished` — every fixture reports `st === 2`
- `live` — the earliest kick-off has passed
- `upcoming` — otherwise

It is a **function, not a stored flag**, deliberately. The matchday list is
cached for an hour, so a boolean computed at map time would go stale inside its
own cache window.

While a matchday is `live` the duel query polls once a minute
(`refetchInterval`), and its `staleTime` drops to zero. A settled matchday
cannot change and is held for five minutes.

## Availability

A league that does not play duels has no duels page:

- **The drawer entry is hidden.** `navigation.ts` marks it
  `requiresDuelMode: true` and `NavContent` filters on `useRanking`'s
  `isDuelMode`. See [Navigation](../routing-and-layout.md#navigation).
- **The route redirects** to the dashboard. It has to be registered
  unconditionally — the route table is built at module load, before any league
  is known — so the page itself is what makes the URL a dead end.

`isDuelMode` is detected from the data (`hhpl` present), not from a flag; the
reasoning is in [Ranking](ranking.md#duel-mode). The page reads it off its
*own* response rather than issuing a second `useRanking`, so the guard costs no
extra request.

## The matchday lives in the URL

`?day=N`, not component state, so a duel weekend can be linked to and survives
a refresh — the same reason the league id is in the path. Selecting a matchday
uses `replace`, so the back button means "leave the page" rather than walking
back through every matchday that was looked at.

An absent or nonsensical `day` **falls back to the competition's current
matchday** rather than erroring. That is not politeness: the ranking endpoint
answers `200` for `dayNumber=0`, `35` or `99` with every per-matchday field
quietly missing, so an unvalidated `day` would render a page of empty duels
instead of an error. The page checks the requested day against the real
schedule before asking for it.

## Data

One hook, one request:
[`useDuels(leagueId, day, { isLive })`](../../src/api/hooks/useDuels.ts) →
`/v4/leagues/{leagueId}/ranking?dayNumber={day}`.

**There is no duel endpoint.** `?dayNumber=` on the standings is the whole
source — probed, with `/duels`, `/duels/{day}`, `/ranking/{day}`,
`/matchdays/{day}`, `/battles`, `/h2h` and `/ranking/duels` all answering 404.
See [API layer](../api-layer.md#endpoints-probed-but-unused).

With the parameter, the same standings payload comes back scoped to that
matchday: `hhoui` names **that matchday's** opponent and `mdp` holds that
matchday's points. Confirmed on a live league — days 1 and 2 return different
pairings for the same ten managers.

[`useSeasonSchedule(competitionId)`](../../src/api/hooks/useMatchday.ts)
supplies the picker. It shares a cache entry with `useCurrentMatchday` — same
query key, two `select` functions — so the squad page having been visited makes
this page's schedule free, and vice versa. Both selectors are **module-level
constants**: React Query memoises `select` on the function's identity, and an
arrow created during render would re-map on every render.

### Pairing

`hhoui` is mutual, and verified so: on a real matchday every manager's opponent
named them back, and ten managers resolved to exactly five duels with none left
over. `mapDuels()` is still defensive — each manager is consumed once, and one
whose opponent is missing from the payload lands in `byes` rather than in a
half-empty card or silently dropped. `byes` renders as an "Ohne Gegner" section
below the duels and is normally empty; an odd-sized league is the case it
exists for.

Within a duel the sides are ordered by table position, so the better-placed
manager is always on the left. The duel's `id` is both manager ids sorted and
joined, which keeps React keys stable no matter which side the loop reached
first.

## States

| State | Rendering |
| ----- | --------- |
| Loading (schedule or duels) | `PageHeading` plus `SkeletonList rows={6}` |
| Error | `ErrorState` with retry, whichever query failed |
| Not a duel league | `<Navigate>` to the dashboard |
| No pairings for the matchday | `EmptyState` — "Für diesen Spieltag sind noch keine Paarungen ausgelost." |

## Unconfirmed

- **Whether `hhpl` / `hhsp` are as-of-the-matchday or current.** They come back
  identical for every `dayNumber`, but with a single matchday scored that
  proves nothing. The page treats them as *current* standing, which is what the
  pre-kick-off subtitle claims to show; if they turn out to be historical, the
  subtitle on a past matchday is showing history and reads correctly anyway.
- **`hhmp`'s draw value.** A win is `3` and a loss `0` — confirmed across all
  five duels of a played matchday against `mdp`. A draw is presumably `1`, and
  none has been observed. Nothing on this page depends on it.

## Possible extensions

- Show the running duel-point total (`hhsp`) per side — already mapped as
  `duelPoints` and currently unrendered.
- Previous/next matchday arrows flanking the picker, for stepping through a
  season without opening the drawer.
