# Duel detail — "Duell"

[← Back to index](../README.md) ·
Routes `/leagues/:leagueId/duels/:duelId?day=N` and `…/:duelId/ranking` ·
[`src/pages/DuelDetailPage.tsx`](../../src/pages/DuelDetailPage.tsx)

One duel from the [Duels](duels.md) list, opened: both elevens and a combined
player ranking.

## Layout

```
  ‹ Duelle
  (A) Danger du        :        GOATstaller (A)
      834                              824
              1. Spieltag · Beendet

  ┌──────────────────────────────────────────┐
  │  Aufstellung  │        Rangliste         │
  └──────────────────────────────────────────┘

  ┌──────────────────────────────────────────┐
  │ (A) Danger du              834           │
  │     0 laufend · 0 offen                  │
  ├──────────────────────────────────────────┤
  │ (a) Raab      TW  vs SGE  Beendet     9  │
  │ (a) Anton     ABW vs HSV  Beendet   158  │
  │ …                                        │
  ├─ BANK ───────────────────────────────────┤
  │ (a) Karaman   ANG @ FCA   Bank        –  │
  └──────────────────────────────────────────┘
```

**The two teams are stacked, not side by side.** Parallel columns were the
obvious layout and the wrong one: two elevens on a 360px screen leaves ~170px
per player, which does not fit a name, a fixture and a score. Stacked, each
roster gets the full width, and the comparison is carried by the header figures
rather than by the eye travelling sideways.

Each roster header shows the manager's total and, beneath it, **`n laufend ·
n offen`** — how many of their eleven are playing right now and how many have
not kicked off. That is the question a live duel actually raises: a manager 40
points behind with four matches still to come is winning.

## The routes are the tabs

```
/leagues/:leagueId/duels/:duelId          → Aufstellung
/leagues/:leagueId/duels/:duelId/ranking  → Rangliste
```

Two routes, one component, tab derived from the segment — the same convention
as the [squad page](squad.md), for the same reason: each view is linkable and
survives a refresh. Switching tabs uses `replace`, so back leaves the page
rather than walking through every tab visit.

`duelId` is **both manager ids sorted and joined with `-`** — the same string
the list page uses as a React key, so the URL needs no lookup table and a link
resolves for anyone in the league. `?day=` rides along exactly as on the list;
the pairing is read from the very same `useDuels` query the list ran, so
arriving here costs nothing for the duel itself.

A duelId whose pairing does not exist on the selected matchday — a link kept
from another week, where the two managers are not drawn against each other —
renders an `EmptyState` with a way back, not an error.

## Player status

| Status | Means | Source |
| ------ | ----- | ------ |
| `Bank` | The manager did not field them | `lo` absent on the squad row |
| `Offen` | Fielded, their club has not kicked off | fixture kick-off in the future |
| `Läuft` | Fielded, match in progress | kick-off passed, not reported finished |
| `Beendet` | Fielded, match over | fixture `st === 2` |
| `Ausgewechselt` | Taken off | **nothing produces this yet** — see below |

Only `Läuft` is coloured loudly (accent). It is the one state that is going to
change, and the only one worth scanning a live page for; if all five were
tinted, eleven rows would read as a warning light.

**Points render as `–`, never `0`, while unknown.** That distinction is why
`DuelPlayer.points` is optional: a player whose match has not started has *no*
score, and printing `0` would claim they played and failed to score. A player
who genuinely did not feature carries `hp: false` in the API and also stays
`undefined`.

### Unverified: `Ausgewechselt`

Nothing in any observed payload distinguishes a player taken off from one still
on the pitch. The manager squad carries only availability (`st`: 0 fit, 2 out,
with `stxt` naming the injury), and the per-player live fields are absent
outside a running matchday — every probe here was run between matchday 1
finishing and matchday 2 kicking off.

The status is therefore **in the union, labelled and styled, but never
returned**. Wiring it up is a change to
[`duelPlayerStatus()`](../../src/api/models.ts) alone once the field is
identified during a live matchday. Candidates to check then: `st`/`mst` on
`teamcenter/myeleven` (which carries per-player match state but only for the
signed-in user), and `st` on `/v4/competitions/{id}/players`, where a value of
`5` appears on players who completed a match.

## What a past matchday shows

**This is the page's one real compromise, it is visible in the UI, and as of
2026-09-04 it is fixable — see [the snapshot endpoint](#the-snapshot-endpoint)
below.**

`/v4/leagues/{id}/managers/{uid}/squad` serves a squad only **as it stands
now** — `?dayNumber=` is accepted and ignored. So for any matchday before the
current one, the page lists *today's* eleven with that matchday's points beside
each player. The per-player figures are real; the set of players is not the one
that was fielded.

Measured on a real league, matchday 1: one manager's current eleven scores
**1434** on a matchday they actually took **824** from — they have rebuilt the
team since. The other manager, who changed little, came out 32 apart.

Two things follow:

1. **The manager totals come from the standings, not from summing the rows.**
   `DuelRoster.totalPoints` is Kickbase's own `mdp`, which is correct for every
   matchday. Summing the rows would produce that 1434.
2. **The page says so.** Any matchday earlier than the competition's current
   one renders a notice above the tabs explaining that the lineup is today's
   and that the rows will not add up to the total.

The current matchday — the default, and the case the feature exists for — has
no such gap: the lineup on screen *is* the lineup being played.

### The snapshot endpoint

**`GET /v4/leagues/{leagueId}/users/{userId}/teamcenter?dayNumber={n}` returns
the squad and lineup as they stood on that matchday**, for any manager in the
league. Verified 2026-09-04 against a league with played matchdays: `dayNumber`
is honoured, `lp` is the eleven that was fielded and `nlp` the rest.

This page and the [squad page's live view](squad.md#live-tab) were both built
on the assumption that no such endpoint existed, and both say so in prose. The
assumption was wrong, and the reason is worth recording: the earlier probing
covered `managers/{uid}/squad?dayNumber=` (ignored) and `teamcenter/myeleven`
(own user only) plus eighteen 404s, but never the spelling that works — which
differs on *both* segments, `users/…/teamcenter` rather than `managers/…/squad`.
`users/{uid}/squad` is genuinely a 404, which made the whole `users/…` branch
look dead.

**Not wired up yet.** What it changes when it is: this page becomes honest for
every matchday rather than only the current one, the notice above can go, and
the totals could be summed from the rows as a cross-check.

## Points cost: one request per player

There is **no bulk source of per-player matchday points**. `ph` on
`/v4/leagues/{id}/players/{pid}` is the only one — `/leagues/{id}/players`,
`?ids=` and every other shape answer 404 — so
[`useMatchdayPoints`](../../src/api/hooks/useMatchdayPoints.ts) fans out one
request per player, and this page hands it **both** squads as one list so the
whole duel is a single fan-out. Three rules keep that affordable:

1. **Only players who can have points are fetched.** A player whose club has
   not kicked off is skipped entirely; there is nothing to read. An upcoming
   matchday therefore issues **zero** player requests.
2. **A settled player is fetched once.** Their match is over and their points
   cannot change, so `staleTime: Infinity` for the rest of the session.
3. **Only players on the pitch are polled.** The minute-poll is attached *per
   player*, not to the page, so a matchday with one late kick-off costs one
   request a minute rather than twenty-two.

`ph` is indexed as `ph[day - 1]`. That is safe because it is **dense**: there
is an entry for every matchday played so far, and a player who missed one gets
`{ hp: false }` with no `p` rather than being skipped — verified against an
injured player. Entries stop at the current matchday, so a future one reads
`undefined`.

The cache key is `qk.playerDetail(leagueId, playerId)` with **no matchday** in
it: one response carries every matchday's points, so all matchdays share the
entry and stepping through a season re-reads nothing.

The hook is shared with the squad page's [live view](squad.md#live-tab), which
is the same job for one manager instead of two. Everything above holds there
too — the rules are the hook's, not this page's.

## Data

| Query | Endpoint | Shared with |
| ----- | -------- | ----------- |
| `useDuels` | `/leagues/{id}/ranking?dayNumber=` | [Duels](duels.md) — already warm |
| `useManagerSquad` ×2 | `/leagues/{id}/managers/{uid}/squad` | — |
| `useMatchdayFixtures` | `/competitions/{id}/matchdays` | squad page, duel picker |
| `useMatchdayPoints` ×N | `/leagues/{id}/players/{pid}` | [Squad — live tab](squad.md#live-tab) |

`useManagerSquad` is how the app reads another manager's lineup today. It is
**not** the only way, though this file said so until 2026-09-04:
`users/{uid}/teamcenter?dayNumber=` ([above](#the-snapshot-endpoint)) serves any
manager's team for any matchday. `teamcenter/myeleven` really is own-user-only —
`userId`, `uid`, `u` and `dayNumber` are all silently ignored there, and 18
other path spellings answer 404, which is what the old claim was based on.

`useManagerSquad` does carry a `mu` block naming both duel managers, which is
how the current pairing could be read without the standings — the app uses the
standings anyway, because those work for every matchday.

`useMatchdayFixtures` reads the same cache entry as `useCurrentMatchday` and
`useSeasonSchedule` through a third `select`. Its selector closes over `day`,
so it is memoised with `useCallback` rather than being a module constant — the
other two selectors are constants precisely because they close over nothing.

### Deliberately not memoised

The rosters and the points map are rebuilt on every render. `useQueries`
returns a fresh array each time, so neither can be memoised on its own input
without inventing a surrogate key — and a signature-string memo is harder to
trust than the thirty object allocations it saves. Nothing here is on a hot
path: the page re-renders on a once-a-minute poll and on a tab switch.

## The ranking tab

Every player from both sides in one list, best first, each row carrying the
**owning manager's avatar** next to the score — the only thing distinguishing
otherwise identical rows, and the whole point of the view: seeing whose players
occupy the top of a combined table says more than two separate lists do.

**Bench players are included**, tagged `Bank`. They scored what they scored, it
just did not count, and omitting them would make this tab disagree with the
lineup tab about who exists. Players with no points yet sort **last** rather
than as zero — not knowing is not the same as nothing.

## States

| State | Rendering |
| ----- | --------- |
| Schedule or duel loading | `SkeletonList rows={8}` |
| Rosters loading | Tabs render; `SkeletonList` in place of the content |
| Error | `ErrorState` with retry |
| Pairing not on this matchday | `EmptyState` with a link back to the list |
| Past matchday | Notice above the tabs — see [above](#what-a-past-matchday-shows) |

Points arriving late do **not** block the rows: a player renders with `–` and
fills in, which is what keeps a live page from flashing a skeleton every minute.

## Possible extensions

- Sum the fielded rows and show the difference against the official total on
  the current matchday — a live sanity check that would have caught the
  historical-lineup gap immediately.
- Use `stxt` from the player detail (already fetched) to explain an unavailable
  player: "Hip bruise – misses FCA (A)".
- Goals and assists per player; the player detail carries `g` and `a`.
