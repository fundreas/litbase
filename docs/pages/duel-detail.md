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
| `Bank` | The manager did not field them | the snapshot's `nlp` list |
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

## A settled matchday shows what was actually fielded

| Matchday | Roster source |
| -------- | ------------- |
| **Finished** (every fixture `st === 2`) | the **matchday snapshot**, `users/{uid}/teamcenter?dayNumber=` |
| **Live or upcoming** | `managers/{uid}/squad` and its `lo`, as before |

The snapshot is the historical source: `lp` is the eleven that was fielded that
matchday and `nlp` the rest, for **any** manager in the league — so a matchday
from four weeks ago lists the players who played it, not today's squad. It is
read through [`useMatchdaySquad`](../../src/api/hooks/useMatchdaySquad.ts).

### Why the source depends on the matchday's state

**`lp` is empty until the matchday starts.** Measured on a real payload: for a
matchday six hours from kick-off, `teamcenter?dayNumber=` returned `lp: []` and
`nlp:` all fifteen players, while `squad` plainly showed eleven of them fielded
with `lo` `0…10`. So `lp` fills at or after the first kick-off, and a page that
read it mid-matchday would draw a partial eleven, bench the rest as *Bank*, and
— on the squad page — invoice the manager 100 points for slots that are not
empty.

`lo` has the opposite profile: it is complete and authoritative while the
matchday runs (Kickbase locks the lineup at kick-off) and wrong afterwards,
because the squad keeps changing. Each source is used exactly where it is
right, and `isSettled` — every fixture reporting `st === 2`, the API's own
word — is the switch.

**One probe would collapse the two branches into one.** During a running
matchday, check whether `lp` holds all eleven or only the players whose match
has kicked off:

```bash
KB "/v4/leagues/$L/users/$U/teamcenter?dayNumber=$CURRENT" | jq -c '{lp:(.lp|length), nlp:(.nlp|length)}'
```

`lp: 11` means the snapshot can be the only source everywhere, and `lo` drops
out of this page entirely. Fewer than eleven means the split above is
permanent.

### What this replaced, and why it is worth remembering

Until 2026-09-04 this page had a visible compromise, and the reasoning behind
it was sound but built on a wrong premise. `managers/{uid}/squad` serves a
squad only as it stands now (`?dayNumber=` is accepted and ignored), and the
notes concluded that nothing else existed — so a past matchday listed *today's*
eleven with that matchday's points beside each player, under a banner
explaining the mismatch.

It was not a small error. Measured on a real league, matchday 1: one manager's
current eleven scored **1434** on a matchday they actually took **824** from,
having rebuilt the team since.

The premise was wrong because the earlier probing missed one spelling. It
covered `managers/{uid}/squad?dayNumber=` and `teamcenter/myeleven` (own user
only) plus eighteen 404s — but not `users/{userId}/teamcenter`, which differs
on *both* segments. `users/{uid}/squad` really is a 404, which made the whole
`users/…` branch look dead. The lesson generalises: in this API a route's
spelling is not predictable from its neighbours, so a 404 on one shape says
nothing about a sibling.

`HistoricalNotice` and the `isHistorical` check are gone from the page — a
settled matchday now shows the truth rather than an apology. What remains
true:

1. **The manager totals still come from the standings.**
   `DuelRoster.totalPoints` is Kickbase's own `mdp`. Now that the rows are the
   real ones the two *should* agree, up to the 100-point-per-empty-slot
   penalty — which makes summing the rows a genuine cross-check, and a
   worthwhile [extension](#possible-extensions).
2. **Empty is not zero.** The endpoint answers 200 with both lists empty for a
   matchday it has nothing for — one before the league existed, or out of
   range. `MatchdaySquad.isEmpty` carries that, and the page renders an
   `EmptyState` saying so rather than two blank teams.

### Positions come from today's squad

The snapshot does not reliably carry `pos` — it is present on
`teamcenter/myeleven`'s entries and absent from the day-scoped variant's — so
`useManagerSquad` is read for that one field and passed to `useMatchdaySquad`
as a back-fill. It is needed anyway as the live-matchday roster source, so this
costs no extra request.

A player **transferred away since** that matchday is in the snapshot but in no
current squad, so his position can be unknown. `DuelPlayer.position` is
therefore optional: a row renders `–` for the label, and the squad page's live
pitch says how many players it could not place rather than inventing a
position. `toPosition()`'s midfield default would have put a stranger in the
middle of the park and looked deliberate.

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
| `useMatchdaySquad` ×2 | `/leagues/{id}/users/{uid}/teamcenter?dayNumber=` | [Squad — live tab](squad.md#live-tab) |
| `useManagerSquad` ×2 | `/leagues/{id}/managers/{uid}/squad` | positions only — see [above](#positions-still-come-from-todays-squad) |
| `useMatchdayFixtures` | `/competitions/{id}/matchdays` | squad page, duel picker |
| `useMatchdayPoints` ×N | `/leagues/{id}/players/{pid}` | [Squad — live tab](squad.md#live-tab) |

`useManagerSquad` is how the app reads another manager's lineup today. It is
**not** the only way, though this file said so until 2026-09-04:
`users/{uid}/teamcenter?dayNumber=` ([above](#a-settled-matchday-shows-what-was-actually-fielded)) serves any
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
| Matchday the API has no squads for | `EmptyState` — `isEmpty`, not an error; see [above](#a-settled-matchday-shows-what-was-actually-fielded) |

Points arriving late do **not** block the rows: a player renders with `–` and
fills in, which is what keeps a live page from flashing a skeleton every minute.

## Possible extensions

- Sum the fielded rows and compare against the official `mdp`. Now that the
  rows are the real ones the two should agree up to the empty-slot penalty, so
  a mismatch means something is wrong — and this is the check that would have
  caught the historical-lineup gap years earlier than reading the docs did.
- **Read points from the snapshot.** A `p` field on its player entries would
  collapse the per-player fan-out below to one request per manager. Unconfirmed
  on a played matchday, hence unused — see
  [`TeamcenterPlayer`](../../src/api/types.ts).
- Use `stxt` from the player detail (already fetched) to explain an unavailable
  player: "Hip bruise – misses FCA (A)".
- Goals and assists per player; the player detail carries `g` and `a`.
