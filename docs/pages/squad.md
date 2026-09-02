# Squad — "Mein Team"

[← Back to index](../README.md) · Routes `/leagues/:leagueId/squad` and
`/leagues/:leagueId/lineup` ·
[`src/pages/SquadPage.tsx`](../../src/pages/SquadPage.tsx)

The signed-in manager's own players, in two tabs that are **separate routes**:

| Route | Tab | Content |
| ----- | --- | ------- |
| `/squad` | **Kader** | The full squad as a grouped list (below) |
| `/lineup` | **Aufstellung** | The interactive lineup on a pitch ([see below](#lineup-tab)) |

Both routes render the same component; the active tab is derived from the last
path segment rather than held in local state, so each view is linkable,
survives a refresh, and can be opened straight from the nav drawer. Switching
tabs navigates with `replace`, so flicking between them does not fill the
history stack — back leaves the page instead of walking through every visit.

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
| Lineup rail | `player.lineupOrder` | Full-height rail, accent-tinted with a shirt icon when fielded |
| Image | `player.image` (`pim`) | Rounded square via `Avatar square`, falls back to initials |
| Name | `player.lastName` | Last name only — first names rarely fit |
| Status dot | `player.status !== 0` | Red `●` with `title="Nicht einsatzbereit"` |
| Points | `totalPoints`, `averagePoints` | `412 Pkt · ⌀ 39` |
| Market value | `marketValue` | Compact euros, tabular figures |
| Profit / loss | `profitLoss` (`mvgl`) | Signed, coloured green/red, `–` when flat |
| Trend arrow | `marketValueTrend` (`mvt`) | ↗ up, ↘ down, — flat |
| Fixture panel | `useCurrentMatchday` | Full-height panel on the right, house/aeroplane + opponent crest |

The lineup rail is **always rendered** and only tinted when the player is
fielded, so rows stay aligned either way. Membership comes from the server's
`lo` slot index — presence, not truthiness, since slot 0 is the keeper.

Reading it from the server rather than from `LineupTab`'s state is correct
here: Radix unmounts the inactive tab, so the lineup tab's local state is
already discarded on every tab switch and re-seeded from `lo`. `lo` is
effectively the store. The one visible consequence is that switching tabs
during the save debounce can show the previous membership for about a second,
until the refetch lands.

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

#### The `players` array is positional

None of this is documented — the published spec shows only
`{ "type": "4-4-2", "players": ["1235"] }`. It was established by experiment
against a real account:

| Sent | Result |
| ---- | ------ |
| Fewer than 11 entries | `LineupNotEnoughPlayers` (err 4020, HTTP **500**) |
| `type` not a real formation (`5-3-1`, `2-1-0`, `""`) | Same error — rejected |
| `""` at index *n* | **Slot *n* left empty.** Saves fine |
| `null`, `"NULL"`, `"null"` at index *n* | Also read as empty |
| `"0"` or `"-1"` at index *n* | `LineupInvalid` (err 4030) — parsed as a player id |
| A player in a slot of the wrong position | **HTTP 200, and he is silently dropped** |
| All 11 entries empty | HTTP 200, but a **no-op** — the old lineup survives |

So the rules are:

1. `players` always has **exactly 11 entries**; the index *is* the slot that
   comes back as `lo`.
2. `type` must be one of the **ten real formations**, and it defines the slot
   layout — slot 0 keeper, then `def` defender slots, then `mid`, then `fwd`.
3. Empty slots are `""`.
4. Players must be grouped to match that layout, or they vanish without an
   error.

**A partial lineup is therefore perfectly saveable** — it just has to be posted
inside a legal formation big enough to hold it, with the unused slots empty.
That is the difference between
[`containerFormation()`](../../src/lib/lineup.ts) (what gets *declared*) and
`effectiveFormation()` (what the user is *shown*). Saving four players might
send `type: "4-3-3"` with eight empty slots while the header reads `2-1-0`.

Emptying the lineup still goes through `/lineup/clear`, because an all-empty
array does nothing.

Verified end-to-end: payloads built by the app's own `containerFormation()` +
`buildSlots()` were posted for 1, 4, 7, 10 and 11 players; every one returned
200 and persisted exactly the intended players in the intended slots.

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

The label in the header is the **effective shape** — literally the counts on
the pitch, so a half-built lineup reads `2-1-0`. Once eleven players are
fielded it is provably one of the ten formations: the rules only admit counts
that fit *some* formation, and since every formation has ten outfield players,
a selection of ten that fits one must equal it exactly. That is also the label
sent to the API on save, so the stored formation is what the user actually
built rather than a guess.

An earlier version instead picked the nearest legal formation and drew empty
slots for the difference. Showing the effective shape is both simpler and more
honest.

### The incomplete warning

An incomplete lineup is legal and it saves — but **every empty slot costs 100
points**, so the banner quotes the actual figure. Nine players is not "two
empty places", it is *minus 200*, which is a bigger swing than most transfer
decisions. `emptySlotPenalty()` lives in
[`lib/lineup.ts`](../../src/lib/lineup.ts) beside the rest of the rules.

Whenever fewer than eleven players are fielded, the header itself carries the
warning:

```
9/11 aufgestellt  ⚠ −200                        4-4-0
└─ warning colour ┘└─ warning chip ┘
```

The `x/11 aufgestellt` label turns warning-coloured, and a warning-styled chip
beside it shows the points at stake with a triangle icon. There is no banner:
it occupied a full row above the pitch to say what two glyphs say, and the
pitch is the thing that should have the height.

The visible glyphs are `aria-hidden` and the **full sentence rides along as
`sr-only` text**, so assistive tech still gets everything the banner said —
including the different wording for the two causes:

| Situation | Screen-reader / tooltip text |
| --------- | ---------------------------- |
| Squad has ≥ 11, fewer fielded | *"2 leere Plätze kosten dich 200 Punkte."* |
| Squad itself has < 11 | *"Dein Kader hat nur 9 von 11 nötigen Spielern. 2 leere Plätze kosten dich 200 Punkte. Kaufe Spieler auf dem Transfermarkt."* |

Telling someone to pick more players when they only own nine is useless, so
that case names the real cause. Singular reads naturally (*"Ein leerer Platz
kostet dich 100 Punkte."*), and figures are `de-DE` grouped, so an empty
lineup reads *−1.100*.

**Known trade-off:** the same text is on the chip's `title`, which shows
nothing on touch. So on a phone the "buy players on the transfer market" hint
for an undersized squad is no longer visible — only the figure is. The
[placeholders](#placeholders-stand-for-mandatory-places-only) on the pitch
carry some of that meaning, but not the market pointer.

### Interaction

| Action | Result |
| ------ | ------ |
| Tap a bench player with room | Added; the formation label updates |
| Tap a bench player with no room | Swap dialog opens |
| Tap a player on the pitch | Removed |
| Any change | Saved after 600 ms; a spinner shows while in flight |
| Bench player with no room | Same appearance as any other — the tap opens the dialog |

#### The bench ("Bank")

The bench holds **only players who are not fielded** — a player moves between
the pitch and the bench rather than appearing in both. It groups by position
(keeper, defence, midfield, attack) and sorts by market value within each
group, scrolling sideways.

**No bench card is ever dimmed or disabled.** Every one is tappable: if that
position is already full, the tap opens the swap dialog instead of adding
directly. Fading those cards would signal "unavailable" for something that
always does something.

When every player is fielded it says so instead of rendering an empty strip.

#### Next fixture

Bench cards, pitch players and the swap dialog all show who the player's club
faces this matchday, from
[`useCurrentMatchday`](../../src/api/hooks/useMatchday.ts) →
`GET /v4/competitions/{id}/matchdays`.

That endpoint returns the whole season plus a top-level `day` naming the
current matchday, and within a matchday **each team appears exactly once**
(verified: 18 teams across 9 fixtures, no repeats). So it inverts into a
`teamId → fixture` map, which is what lets any player be annotated from
nothing but their `tid` — the squad payload itself carries no fixture data at
all.

`t1` is the home team and `t2` the away team; both sides are inserted, each
from its own perspective, so `isHome` and the opponent are already resolved
before rendering.

[`FixtureBadge`](../../src/components/squad/FixtureBadge.tsx) is
**wordless** — a **house** for home or an **aeroplane** for away, plus the
opponent's crest. It used to print the short symbol (`FCB`) too, but that ate
the width that makes the crest legible, and a crest is recognised faster than
three letters. Because nothing is spelled out visually, the whole badge is a
labelled `role="img"`, so assistive tech still gets "Heimspiel gegen FCB".

Three variants, by `size` and `layout`:

| Where | Variant | Notes |
| ----- | ------- | ----- |
| Pitch plate | `sm`, inline, `onPitch` tone | Second line under the name, light colours for legibility over grass |
| Bench card | `md`, inline | **Replaces** the average-points line — only one secondary fact fits, and the opponent is the one that decides whether to field a player |
| Squad list, swap dialog | `lg`, stacked | Full-height panel on the right, icon above crest |

A team with no fixture that matchday renders `–` rather than breaking.

Cached for an hour: one payload for the season, and it only shifts weekly.

#### The swap dialog

Selecting and confirming are **separate steps**: tapping a row only selects
it, and the dialog's own *Tauschen* button performs the swap. A mis-tap in a
scrolling list therefore costs nothing, and the button stays disabled until
something is chosen. *Abbrechen* dismisses without changing anything.

The rows are a `role="radiogroup"` of `role="radio"` buttons with
`aria-checked`, so the single-choice nature is announced rather than only
implied visually.

There is **no check mark**: the whole row carries the selected state via an
accent border plus a ring, which frees the right-hand side for a full-height
fixture panel. The border is always 2px so selecting cannot nudge the row's
height — the extra visual weight comes from a `ring`, which is drawn outside
the box and costs no layout.

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

**The pitch fills the available height.** `AppShell`'s `main` is a flex column,
and a `flex-1` + `min-h-0` chain runs from the page through the tabs into
`LineupTab` and `Pitch`. The `min-h-0` at each level is the load-bearing part:
a flex child defaults to `min-height: auto` and would refuse to shrink below
its content, so the pitch would overflow rather than fit. The bench below is
`shrink-0`, keeping its natural height, and the pitch absorbs whatever is
left — with a `min-h-72` floor so a short viewport scrolls instead of
collapsing.

Rows run attack-first down the page: FWD, MID, DEF, GK, spread with
`justify-around` so the pitch reads as a pitch at any height rather than a
cluster of players at the top.

#### Placeholders stand for mandatory places only

A position short of the minimum every formation requires shows a dashed slot
labelled with the position and *offen*. With no striker fielded, one striker
placeholder appears; an empty pitch shows seven (1 keeper, 3 defenders, 2
midfielders, 1 forward).

The distinction matters. `POSITION_MINIMUMS` is **derived from `FORMATIONS`**
— the per-position minimum across all ten — so it cannot drift from the
formation list, and it comes out as exactly the 1/3/2/1 Kickbase documents.
Those are formation-*independent* facts, which is what makes them safe to
draw.

An earlier version filled out the remaining slots of an *assumed* formation
instead. That was removed because it implied a shape the user had not chosen —
a lineup of four defenders would sprout two more dashed defender slots purely
because 4-4-2 happened to be the closest match. Minimums have no such problem:
a complete eleven shows no placeholders in any of the ten formations, and
nothing is ever suggested that every legal formation does not require.

Placeholders are not interactive. A tap could not do anything unambiguous, and
the bench below is where players are picked.

That follows from showing the *effective* formation rather than a nearest legal
one: placeholders would have to be drawn against some assumed formation, which
would imply a shape the user has not chosen.

Each fielded player shows their image with a white ring, a name label on a
dark plate beneath (legible over grass), a red dot when not match-fit, and
their next fixture.

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
- **Read from `GET /v4/leagues/{id}/lineup/overview`** rather than deriving the
  lineup from the squad's `lo`. That endpoint returns `lp[]` with `lo` *and*
  `lst` (a per-slot validity flag — `0` for players who cannot play, e.g.
  `st: 128`), which the squad payload does not expose.
- **`POST /lineup/fill`** auto-fills a lineup. Note its body uses different
  field names to `POST /lineup`: `{ lud, pls }` rather than `{ type, players }`.
- Drag and drop between bench and pitch, in addition to tapping.
- Use `startProbability` to flag risky picks while building the lineup.
