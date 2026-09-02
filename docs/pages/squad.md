# Squad — "Mein Team"

[← Back to index](../README.md) · Route `/leagues/:leagueId/squad` ·
[`src/pages/SquadPage.tsx`](../../src/pages/SquadPage.tsx)

The signed-in manager's own players, in two tabs:

| Tab | Content |
| --- | ------- |
| **Kader** | The full squad as a grouped list (below) |
| **Aufstellung** | The interactive lineup on a pitch ([see below](#lineup-tab)) |

Both read the same `useSquad` query, so switching tabs costs no request. The
list lives in [`PlayerListTab`](../../src/components/squad/PlayerListTab.tsx)
and the lineup in [`LineupTab`](../../src/components/squad/LineupTab.tsx); the
page itself only owns loading, error and empty states plus the tab shell.

## Kader tab — layout

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
- `stl` — an additional status list beyond `st`.
- `lo` — lineup slot order, now mapped as `lineupOrder` and used to seed the
  [lineup tab](#lineup-tab).
- `iotm` — player of the match.

## Lineup tab

An interactive lineup: a pitch with the fielded players, a scrolling bench
below, and formation rules enforced on every tap.

### Persistence

Every change is written to Kickbase with
`POST /v4/leagues/{leagueId}/lineup`, via
[`useSaveLineup`](../../src/api/hooks/useLineup.ts). The body is

```json
{ "type": "4-4-2", "players": ["1235", "…"] }
```

— the formation label plus the starting eleven. The endpoint **replaces the
lineup wholesale** rather than applying a delta, which is what makes the
client's job tractable: every request is the complete intended state.

The docs do not say whether `players` is positional. Nothing suggests a slot
encoding, so the ids are sent grouped in formation reading order — keeper,
defence, midfield, attack — which is the only ordering that reads consistently
alongside `type`. Worth revisiting if the app ever shows the lineup in an
unexpected order.

A save failure surfaces as a red banner above the pitch and leaves the local
lineup untouched, so the user can retry by making another change rather than
losing their work.

#### Only a complete eleven can be sent

`POST /lineup` rejects a partial lineup, and there is no formation string that
describes one anyway — every one of the ten formations totals eleven. So there
are exactly three states:

| Lineup | Action |
| ------ | ------ |
| Eleven players | `POST /lineup` with `{ type, players }` |
| Nobody | `POST /lineup/clear` (no body — the plain endpoint wants a formation) |
| One to ten | **Held.** Nothing is sent; the header shows *nicht gespeichert* |

Holding is deliberate rather than a silent failure. The alternative is firing a
request on every tap that is known to come back an error. The consequence — the
server keeps the last complete eleven while a partial lineup is being
assembled — is stated in the UI rather than hidden.

**This is the remaining open question.** The Kickbase app clearly *can* store an
incomplete lineup: a real `lineup/overview` response shows slots `0,1,2,4,…,9`
with slot 3 empty. How it writes that is not documented — neither the OpenAPI
spec nor the Postman collection shows a padding convention for empty slots, and
the documented example bodies are placeholders (`players: ["1235"]`). Resolving
it needs either the exact error the API returns for a short `players` array, or
a capture of what the real app sends.

#### Coalescing and ordering

Two problems come with "save on every change", and both are handled in
[`LineupTab`](../../src/components/squad/LineupTab.tsx):

- **Debounced (600 ms).** Building an eleven from scratch is eleven taps;
  naively that is eleven requests, each immediately superseded.
- **Serialised.** Since each payload is the whole lineup, an out-of-order
  response would leave the server holding a stale eleven. A queued save awaits
  the in-flight one before sending, so the last request to arrive is always
  the last edit made.

Verified by simulation: eleven rapid taps produce one request carrying the
final payload; spaced edits produce one request each, in order; a slow save
never overlaps the next and order still holds; a failed save does not block
the following one; and mounting without editing sends nothing.

#### The identity trap

The save effect keys off a **string** built from the payload, not the payload
object.

This is not a micro-optimisation. A successful save invalidates the squad
query, so `squad` refetches, `lineup` becomes a new array, and an effect
depending on that object would fire again — save, invalidate, refetch, save,
for ever. Refetch-on-window-focus would do the same. An intermediate version
of this code had exactly that loop.

Keying on content makes an unchanged lineup a no-op no matter how often its
objects are rebuilt, and `payload` is memoised on the same key so the effect's
dependency list stays honest instead of being suppressed.

### Seeding, and the goalkeeper bug

`lo` is a **0-based slot index, present only for fielded players.** Confirmed
against real squad payloads: a fielded eleven carries `lo` `0…10` and benched
players carry no `lo` at all. Slot 0 is the goalkeeper, so the index alone
encodes the formation:

```
lo:  0    1   2   3   4    5   6   7   8    9  10   │  (none) (none)
    GK  DEF DEF DEF DEF  MID MID MID MID  FWD FWD   │   GK     DEF
    └────────────── a 4-4-2 ────────────────────┘   └── bench ──┘
```

**Membership must therefore be `lo !== undefined`, never `lo > 0`.** The first
version of this used `(lo ?? 0) > 0`, which collapses "benched" (no `lo` →
`0`) and "goalkeeper" (`lo === 0`) into the same case — so the keeper was
dropped on every reload and a saved eleven came back as ten. That is exactly
the reported symptom, and it reproduces on the real payload shape: the old
filter yields 10 players with no keeper, the fix yields 11.

Seeded players are still re-validated against the formation rules one at a
time, so unexpected server data drops the players that do not fit rather than
rendering an illegal lineup. Seeding does not mark the state dirty, so it never
triggers a write.

The same slot layout confirms the send order: `orderPlayerIds()` groups keeper,
defence, midfield, attack, which reproduces `lo` `0…10` exactly. That ordering
was a guess when the POST was first wired; it is now verified.

### The rules

From Kickbase's help pages: a lineup is **11 players**, every formation needs
**at least 1 goalkeeper, 3 defenders, 2 midfielders and 1 forward**, and there
are **ten** formations. Those constraints plus a five-defender maximum leave
exactly ten combinations, which match the known list:

```
3-4-3   3-5-2   3-6-1
4-2-4   4-3-3   4-4-2   4-5-1
5-2-3   5-3-2   5-4-1
```

The list is therefore *derived* rather than transcribed — worth spot-checking
in the app if a formation ever looks wrong.

### No formation picker

The formation is **inferred from the players on the pitch** instead of chosen.
A partial lineup is legal whenever *some* formation could still absorb it:
four defenders are fine (4-4-2 and others), five are fine (5-3-2), six are not
because no formation plays six.

That is what makes "clicking a player automatically adds them" work — the
lineup reshapes itself, and a picker would only get in the way.

The displayed formation is the feasible one whose **shape** is closest to the
selection, by squared distance per position. Total slack cannot be used: every
formation fields ten outfield players, so `(def+mid+fwd) − selected` is
identical for all of them and would silently collapse to "first in list
order".

### Interaction

| Action | Result |
| ------ | ------ |
| Tap a bench player with room | Added; the formation label updates |
| Tap a bench player with no room | Swap dialog opens |
| Tap a player on the pitch | Removed |
| Any change | Saved after 600 ms; a spinner shows while in flight |
| Bench player already fielded | `disabled`, dimmed, accent-tinted border |

#### The swap dialog

Selecting and confirming are **separate steps**: tapping a row only selects
it, and the dialog's own *Tauschen* button performs the swap. A mis-tap in a
scrolling list therefore costs nothing, and the button stays disabled until
something is chosen. *Abbrechen* dismisses without changing anything.

The rows are a `role="radiogroup"` of `role="radio"` buttons with
`aria-checked`, so the single-choice nature is announced rather than only
implied by the accent border and check mark.

Selection resets per visit by comparing the incoming player during render
rather than clearing it in an effect — so a freshly opened dialog never paints
with the previous visit's choice highlighted.

The dialog offers **only the players whose removal would actually make room** —
`removalCandidates()` tests each one by simulating the removal. From a full
4-4-2, fitting a fifth defender offers all ten outfield players (drop a
defender → 4-4-2 again, a midfielder → 5-3-2, a forward → 5-4-1) but **never
the keeper**, since 5-4-2 is not a formation. Fitting a second keeper offers
only the keeper.

Offering "everyone" would have been misleading, which is why the set is
computed rather than assumed.

### Pitch rendering

[`Pitch`](../../src/components/squad/Pitch.tsx) is inline SVG — no image
request, no scaling artefacts, and the line colours can use theme values. It
is drawn **vertically** (own goal at the bottom, attacking upward), which is
how a lineup reads on a phone, with a turf gradient, mown bands, centre circle
and both penalty areas.

Rows run attack-first down the page: FWD, MID, DEF, GK. Every slot the
formation allows is rendered, so unfilled ones show as dashed circles labelled
with the position rather than the row just being short.

Each fielded player shows their image with a white ring, a name label on a
dark plate beneath (legible over grass), and a red dot when not match-fit.

### Verified

The rule engine was checked against generated cases: all ten formations total
11 and meet the documented minimums, none duplicated, every formation is
reachable one player at a time and displays as itself, a second keeper /
sixth defender / seventh midfielder / fifth forward are all rejected, a full
lineup rejects everything, and the removal candidates are position-relevant.

The logic is pure and takes no React dependency, so it is ready for real tests
once a runner is added — see [Infrastructure](../infrastructure.md#not-yet-done).

## Possible extensions

- Show `startProbability` as a pip row or coloured dot; it is the single most
  useful pre-matchday signal.
- Surface `offerCount` so pending offers are visible without opening the
  market.
- A lineup/formation view using `lo` instead of the flat grouped list.
- Sort control (points, average, value, trend) — the grouping is currently
  fixed.
- **Save partial lineups**, once the padding convention for empty slots is
  known. See above.
- **Read from `GET /v4/leagues/{id}/lineup/overview`** rather than deriving the
  lineup from the squad's `lo`. That endpoint returns `lp[]` with `lo` *and*
  `lst` (a per-slot validity flag — `0` for players who cannot play, e.g.
  `st: 128`), which the squad payload does not expose.
- **`POST /lineup/fill`** auto-fills a lineup. Note its body uses different
  field names to `POST /lineup`: `{ lud, pls }` rather than `{ type, players }`.
- Drag and drop between bench and pitch, in addition to tapping.
- Use `startProbability` to flag risky picks while building the lineup.
