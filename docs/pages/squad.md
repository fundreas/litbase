# Squad — "Mannschaft"

[← Back to index](../README.md) · Routes `/leagues/:leagueId/squad` and
`/leagues/:leagueId/squad/lineup` ·
[`src/pages/SquadPage.tsx`](../../src/pages/SquadPage.tsx)

The signed-in manager's own players, in two views that are **separate routes**,
switched by a [bottom tab bar](#the-bottom-bar):

| Route | View | Content |
| ----- | ---- | ------- |
| `/squad` | **Kader** | The full squad, as a grouped list or a grid (below) |
| `/squad/lineup` | **Aufstellung** | The interactive lineup on a pitch ([see below](#lineup-tab)) |

**The pitch is nested under the squad**, not a sibling at `/lineup`. It always
was the squad seen another way, the URL now says so, and the drawer's prefix
match in `isNavItemActive` lights *Mannschaft* for both without a special case.
The old `/lineup` is kept as a redirect — a route `loader` returning
`redirect()` rather than a relative `<Navigate>`, because how `..` counts a
pathless layout route is a subtlety that fails silently.

Both routes render the same component; the active view is derived from the last
path segment rather than held in local state, so each is linkable, survives a
refresh, and can be opened straight from the nav drawer. The bar navigates with
`replace`, so flicking between them does not fill the history stack — back
leaves the page instead of walking through every visit.

Both read the same `useSquad` query, so switching costs no request. The
list lives in [`PlayerListTab`](../../src/components/squad/PlayerListTab.tsx)
and the lineup in [`LineupTab`](../../src/components/squad/LineupTab.tsx); the
page itself only owns loading, error and empty states plus the shell.

**Both views edit the same lineup.** The state and every mutation live in
[`useLineupEditor`](../../src/components/squad/useLineupEditor.ts), held by an
inner `SquadViews` component and passed to both — a hook cannot sit behind the
page's loading and error returns, and the squad it seeds from only exists after
them. The swap dialog is rendered once at that level too, since either tab can
open it. Two copies of this state would let the views disagree; the list
previously dodged that by reading the server's `lo` instead, which lagged by a
save round trip.

## The bottom bar

[`BottomTabBar`](../../src/components/ui/BottomTabBar.tsx), shared with the
[player detail page](player-detail.md#why-this-page-has-a-bottom-bar).

This is not a return of the global bottom tab bar that
[Navigation](../routing-and-layout.md#navigation) describes removing — that one
duplicated the drawer and cost a row of height on every screen. This one
switches between two views of the page you are already on, exists only while
that page is open, and sits where a thumb already is. It is `sticky` rather
than `fixed`, the mirror of the header's `sticky top-0`, so at `lg` and up it
stays inside the content column instead of lying across the sidebar.

Each tab is a real `<Link>`, so both views are linkable and middle-clickable.

**The page owes the bar a full-height column.** Sticky only pins an element
that would otherwise be off-screen, so the content between the heading and the
bar sits in a `min-h-0 flex-1` box. Without it the bar appeared to *move*
between the two views: the lineup already grew to fill the well and pinned the
bar properly, while a short Kader list left it sitting directly under the last
row, halfway up the screen.

The bar also carries `bleed-pb-safe`, which cancels the content well's own
`pb-safe`. Both have bottom padding for the notch, and stacked they let the bar
lift by that padding at the very end of the scroll — the one point where sticky
hands back to static positioning.

## Header — Kader only

| Element | Source | Notes |
| ------- | ------ | ----- |
| Title | — | *Mannschaft* |
| Subtitle | `useSquad` | `20 Spieler · 194,4 Mio. € Gesamtwert` |
| Budget chip | `useLeagueManager` | **Green at or above zero, red below** |
| Legend button | — | Opens `SquadLegendDialog` |

**The lineup view has no header at all.** The pitch is the page there, and a
title, a squad count, a total value and a budget were four lines of height
taken from it on exactly the screens where it has least — for facts that are
either obvious (you are looking at your own team) or belong beside the transfer
decisions they inform, which is the Kader view. The legend button was the one
thing worth keeping and moves to the [bench heading](#lineup-tab).

The **budget chip** is its own small query (`/leagues/{id}/me`), which the
dashboard has usually filled already. Kickbase lets a budget go negative — an
overdrawn manager pays interest — so the sign is a state worth seeing without
reading the number, and it belongs next to the squad because every transfer
decision starts here.

Tapping it opens the [sale calculator](#sale-calculator).

## Sale calculator

*"What would I have if I sold these?"* — a mode, not a panel.

Tap the budget chip and the page header is **replaced** by the calculator:
tapping a player now marks him for sale instead of opening him, the lineup rail
disappears from the rows, and the bar keeps a running total. An ✕ leaves.

```
┌────────────────────────────────────────┐
│ ⌂  Mannschaft                    ☰  ⏻ │   the app header
├────────────────────────────────────────┤
│ 🧮  75,5 Mio. €                     ✕ │   pinned at --header-total
│     3 Spieler · 24,5 Mio. € Erlös      │
└────────────────────────────────────────┘
```

| Shown | From |
| ----- | ---- |
| The figure | `budget + Σ marketValue` of the selected players — green, or red if still negative |
| Subtitle | how many are marked and what they add up to; before anything is, the prompt to tap |

**Header-height and sticky.** The bar is `h-(--header-h)` — the same height as
the app header — and pins at `--header-total`, the header plus whatever the
notch adds, which is the offset the sidebar already uses. Scrolling a squad of
twenty looking for the next player to mark must not take the total off screen;
a total you have to scroll back up to read is one you stop consulting.

One figure, not three. The projected budget is the answer, the count and
proceeds are the working and go underneath at subtitle size, and the budget as
it stands is gone — it is one tap away, on the chip this bar replaced.

The bar is replaced rather than added to because the rows quietly change
what they do: a heading still reading *Mannschaft · 20 Spieler* over rows that
now select instead of navigate would be the wrong kind of quiet.

**The rows themselves look exactly as they always do**, lineup rail included —
whether a player is in your eleven is precisely what you weigh while deciding
to sell him, so hiding it took away the fact the mode is for. What changes is
only what a tap *does*: the whole row becomes one target that marks the player,
and the rail renders as a plain `<span>` with the same classes, because a
button cannot nest inside a button. One target, one meaning; a row that kept
two live controls would make every tap a question about which one you meant.

**Nothing here is a transaction.** The figures are arithmetic on the squad's
own market values and no request is sent. Kickbase's real sale price is
whatever the market pays, which equals the market value only for a sale back to
the computer — hence *Rechner*, and hence an ✕ to leave rather than anything
that reads like a confirm button.

Selection is an accent **border and ring**, no fill and no checkbox: the row
and the tile are already dense, tinting the whole surface would fight
everything on them, and a checkbox would add a second target to a card that is
itself the target.

State is one `ReadonlySet<string> | null` — `null` is "off" — so the mode and
the selection cannot disagree, and leaving drops the selection by
construction. Switching to the lineup view clears it: that view has no header
to show the total in.

## Kader — two layouts

A **list** or a **grid**, chosen by a single icon-only toggle above them.

```
  Mannschaft                    [51,0 Mio. €] [i]
  20 Spieler · 194,4 Mio. € Gesamtwert

                                      [≡] [▦]
  TW · 2                     ┌─────┬─────┬─────┐
  ┌────────────────────────┐ │ ✚[] │  [] │  []★│
  │▮[img] Nübel  10,5 Mio.€│ │ img │ img │ img │
  │       ★        +2,2 Mio│ │Nübel│Atu. │Bau. │
  └────────────────────────┘ └─────┴─────┴─────┘
```

The choice is remembered in `localStorage` through the app's safe wrapper, so
it survives a reload and silently falls back to the list where storage is
blocked. It is deliberately **not** in the URL: a layout is a preference, not a
place, and a shared link should open in the reader's own.

The toggle is **one button carrying both symbols**. Two buttons said the same
thing with twice the target area and an `aria-pressed` state each, for a choice
with two outcomes and no cost to getting wrong. Keeping both glyphs on the one
button is what makes it legible: a lone icon has to answer "is this where I am
or where I would go?", which a single glyph cannot. The lit one is the current
view, the faint one is a tap away.

### Tiles

Portrait, last name, position abbreviation, and the two marks that say whether
you can count on the player this week — availability top-left, lineup
probability top-right, as on the pitch portraits.

The portrait is **square**, which is both shorter and better framed than the
4:5 box it started as. The source images are 1100×800 **landscape** (checked
across three players), so a portrait box has to scale them by height and throw
the sides away: 4:5 discarded about 42% of the width, a square discards about
27%. Shortening the tile therefore costs no crop — it buys some back, and saves
roughly 30px a row on a phone.

They are **inset rather than straddling the frame**: the pitch's
`StartProbabilityCorner` hangs slightly outside its circle, which reads well on
a portrait floating over grass but not here, because the tile clips its
overflow to keep its rounded corners and was cutting the badge in half.

No lineup rail and no money: the grid is for taking in a whole squad at once,
and a third-of-a-screen tile cannot hold a market value, its change *and* a shirt
rail without becoming a worse version of the row. Tapping opens the player; the
list is where the lineup gets edited.

### Grouping differs between the two

The **list keeps its position headings**; the **grid is one flat run**. Once a
tile names its own position, four headings across a three-column grid buy
little and cost a lot — ragged part-rows, and twenty players turned into a page
you scroll. The order is unchanged either way (keeper → defence → midfield →
attack, most valuable first within each), so the grid reads as it always did
with the headings simply gone. A row carries no position of its own and rows
stack in one column, where a heading costs nothing.

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
| Lineup rail | `editor.isFielded()` | Full-height **button**, accent-tinted with a solid shirt when fielded, faint outline when not |
| Image | `player.image` (`pim`) | Full-bleed portrait via `Avatar fill` — no padding, flush against the rail, inner edge masked |
| Name | `player.lastName` | Last name only — first names rarely fit |
| Status mark | `player.status !== 0` | `PlayerStatusBadge` — red card when suspended, white cross in a red disc otherwise, tooltip from `stxt` |
| Probability | `startProbability` (`prob`) | Glyph only, on its own line under the name |
| Market value | `marketValue` | Compact euros, tabular figures |
| 24-hour change | `marketValueChangeDay` (`tfhmvt`) | Signed, coloured green/red, with a ↗/↘ mark; `–` when flat or unknown |
| Fixture panel | `useCurrentMatchday` | Full-height panel on the right, house/aeroplane + opponent crest |

The lineup rail is **always rendered** and only tinted when the player is
fielded, so rows stay aligned either way. It is also the row's lineup control:

| Rail tapped on | What happens |
| -------------- | ------------ |
| A benched player, position has room | Fielded immediately, saved |
| A benched player, position full | The **swap dialog** opens — same one the pitch uses |
| A fielded player | A **confirmation** first: *"Spieler aus der Aufstellung nehmen?"* |

**Adding is immediate; removing asks first.** The asymmetry is deliberate. The
rail is small, sits at the very edge of the row, and the rows scroll under a
thumb — a mis-tap on a fielded player would quietly bench him and cost 100
points, with nothing on this screen showing what had happened. A mis-tap that
*adds* someone is visible and free to undo, so it needs no dialog. On the pitch
a portrait is a large, deliberate target and the removal shows itself, so that
path stays immediate.

Membership comes from the shared editor, not from the server's `lo`, so an edit
made here is on the pitch the moment you switch across. An earlier version read
`lo` directly and showed stale rows for about a second after every edit, until
the save round trip and refetch landed.

The bottom-right figure is the **market-value change over the last 24 hours** —
`tfhmvt`, signed and coloured, with a trend arrow in front of it.

It used to be `profitLoss` (`mvgl`), the gain or loss *against the purchase
price*. That is a fact about a trade made months ago and it never moves on its
own, whereas what this page gets read for is what changed overnight: who is
climbing, who is bleeding value and belongs on the market. Profit still lives
on `SquadMember` and is rendered on the [player's own page](player-detail.md),
next to the purchase price that gives it meaning.

`tfhmvt` is **not documented on the squad endpoint**, so the model types it as
optional and an absent value renders as `–` rather than a false `0 €`. Its
sibling `sdmvt` (the same measure over seven days) is declared and unused.

The arrow is `TrendingUp`/`TrendingDown` derived from the sign of that same
figure — not `marketValueTrend` (`mvt`). An `mvt` arrow sat here once, in front
of the profit figure, and was removed: the two were different signals, so the
arrow read as if it qualified a number it had nothing to do with. Derived from
the amount it precedes, it cannot contradict it. `mvt` stays on the model for
anywhere it can stand on its own.

`moneyDelta()` formats the signed value and uses a real minus sign (U+2212)
rather than a hyphen, so negative figures align with positive ones in tabular
figures.

**Points and average are no longer on the row.** They read `412 Pkt · ⌀ 39`
under the name until the [player detail page](player-detail.md) gave season
scoring a whole tab of its own — per matchday, with minutes and events. This
page is about who is fit, who is likely to start and what they are worth, and
the row is quieter for keeping to that.

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
- `stl` — an additional status list beyond `st`. See [Availability (`st`)](#availability-st).
- `lo` — lineup slot order, now mapped as `lineupOrder` and used to seed the
  [lineup tab](#lineup-tab).
- `iotm` — player of the match.

## Lineup probability (`prob`)

Ligainsider's **Startelf-Wahrscheinlichkeit** is rendered on both tabs: as a
small circled glyph on the stats line of each squad row, and as a corner badge
on the player portraits on the pitch, in the drag ghost and on the bench cards.

An earlier attempt at this was removed, and the reason it failed is worth
keeping: it rendered **`plpim`**, which is not a per-player value at all.

### `plpim` is a team poster, not a player icon

Probed live on 2026-09-03 against
`GET /v4/competitions/1/players/{playerId}`. `plpim` is a **1280×1809
Ligainsider graphic of a club's whole projected XI** — a pitch diagram with
portraits, kick-off time and a substitution list. Every player at the same club
carries the **identical** hash: all five sampled Bayern players returned
`0355b790…`, all five Augsburg players `ca9b9b4a…`. `GET
/v4/base/predictions/teams/{competitionId}` serves the very same hashes keyed
by `tid`, which settles it.

So the old badge was a team poster crushed into a 14px circle, twenty-five
times over, showing at most one distinct image per club. The community docs
describing it as one of five per-player tier icons are wrong, and so was the
note that used to be in this file.

### `prob` is the per-player tier

The same response carries an undocumented **`prob`**: an integer **1–5, where
lower is more likely**. The tiers were confirmed by reading the badges
Ligainsider draws inside the poster and matching them against the field for the
whole Bayern roster — `prob: 1` is exactly the set with a blue star (Neuer,
Kimmich, Kane, Olise, Díaz), `prob: 2` exactly the green checks (Upamecano,
Pavlović), and so on.

| `prob` | Poster badge | App label | Rendered as |
| ------ | ------------ | --------- | ----------- |
| 1 | blue star | Sicher dabei | blue ★ |
| 2 | green check | Wahrscheinlich | green ✓ |
| 3 | orange ? | Fraglich | amber ? |
| 4 | red ! | Unrealistisch | red ! |
| 5 | black ✕ | Ausgeschlossen | near-black ✕ |

`toStartProbability()` in [`models.ts`](../../src/api/models.ts) narrows the
wire value to a `StartProbability` union and **degrades an unrecognised value
to `undefined`** rather than rendering an unstyled sixth badge — Ligainsider
can add a tier, and a squad page is not where that should surface.

The five tiers are told apart by **glyph as well as colour**. Five steps is more
than hue alone can carry, and roughly one man in twelve cannot separate the red
from the green.

### Where it comes from, and what it costs

`prob` is declared on `SquadPlayer` but **undocumented on the squad payload**,
so whether it actually arrives there is a question about a live response rather
than about the types.
[`useStartProbabilities`](../../src/api/hooks/useStartProbabilities.ts) is
written to survive either answer: players who already carry `prob` cost nothing
and only the rest are fetched, one
[`endpoints.leagues.player`](../../src/api/endpoints.ts) request each. If
Kickbase serves it on the squad, the hook fires zero requests and becomes a
no-op; if not, it is ~25 cached requests once every 30 minutes.

Rows render before the answers land, and never show an error. Absence is the
**normal** case and is indistinguishable on the wire from a failure — see
below — so a missing badge is simply a missing badge.

### Fallbacks

`prob` is absent for an account without Membership, in the off-season, and for
a player nobody has assessed yet. The three are identical on the wire.

`stxt` carries the reason behind a non-zero `st` when there is one, e.g.
*"Neurological dysfunction - individual training, misses DFB-Pokal match"*. It
is the tooltip on the [status mark](#availability-st), fetched by
[`useStatusReasons`](../../src/api/hooks/useStatusReasons.ts) for the
unavailable players only. Plenty of statuses carry no text, so the mark falls
back to a generic *"Nicht einsatzbereit"*.

Once `GET /v4/matches/{matchId}/details` reports `il: true` the lineup is
official and `t1lp`/`t2lp` (the XI) plus `t1nlp`/`t2nlp` supersede the estimate
with a hard in/out.

## Availability (`st`)

`st` is **a code, not a boolean**. `0` is fit; every other value is some flavour
of unavailable, and `stl` carries the same information as a list. This section
used to say the individual numbers had never been pinned down. They have been —
by pulling `/v4/competitions/1/teams/{tid}/teamprofile` for **all 18 Bundesliga
clubs (467 players)** and reading each distinct code's German `stxt` back off
the player detail:

| `st` | Count | `stxt` observed on it | Meaning |
| ---- | ----- | --------------------- | ------- |
| `0` | 398 | *(none)* | Fit |
| `1` | 22 | "Schulterverletzung – fällt 2-3 Wochen aus" | Injured |
| `2` | 30 | "Nach muskulären Problemen – verpasst M05 (H)" | Angeschlagen |
| `4` | 15 | "Nach Fußverletzung – absolviert erste Laufeinheit" | Aufbautraining |
| `8` | 2 | *(none)* | **Suspended** |

`8` carries no text, so it was pinned indirectly: both players holding it had a
red card (`MATCH_EVENT.RED_CARD`) in their club's most recent fixture. That is
also the one case the previous, deliberately-vague badge was designed to avoid
getting wrong.

The **power-of-two reading was right**. The observed run is 1, 2, 4, 8, and the
`128` seen earlier on `lineup/overview` fits the same ladder, which is why
`stl` exists as a list at all. `16`, `32` and `64` have not been seen and are
left unmapped.

The `5` once noted on `/v4/competitions/{id}/players` is **a different axis**,
now identified: that endpoint returns a matchday's performers and its `st` is
the *per-match* status (`PLAYER_MATCH_STATUS.STARTED`), not availability. See
[Player detail](player-detail.md#per-match-status-st).

**What the UI does with that.**
[`PlayerStatusBadge`](../../src/components/squad/PlayerStatusBadge.tsx) draws a
**red card** for `8` and the white-cross-in-a-red-disc for everything else. The
scale is deliberately not opened up further: injury, knock and rehab differ in
severity but not in what the manager has to do about them, and three shades of
red disc is a legend nobody reads. The tooltip still carries `stxt` verbatim,
and now falls back to the code's own label rather than a generic one.

`stxt` arrives in **German** because the client sends
`Accept-Language: de-DE` — without it Kickbase serves "Training deficit -
misses DFB-Pokal match" into an otherwise German UI. See
[API layer](../api-layer.md).

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

Its heading is the **only chrome this view has**, so it carries two things: an
armchair glyph beside the word *Bank* on the left, and the legend button on the
right, orphaned when the page header went. The heading used to read *"Bank ·
tippen zum Aufstellen"*; the instruction taught the tap once and then repeated
itself forever, and the portraits already look like buttons.

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

The pitch is a **`grid-rows-4`: four equal bands, one per position**, running
attack-first down the page — FWD, MID, DEF, GK — and all four are always
rendered.

The grid claims its height with **`flex-1`, not `h-full`**. That distinction
was a real bug: as a flex item, `height: 100%` resolved against the grid's own
content rather than its parent, so it sat at its natural 394px inside a 479px
pitch and left a band of empty grass under the keeper — measured in the
browser, not guessed. Growing into the space fills it reliably.

Distributing however many rows happened to exist (`justify-around`) made the
geometry depend on the lineup: a team with no striker sat its midfield at a
different height from one that had a striker, which was obvious on a wide
screen. Fixed bands keep every player where the position says they belong.
Every band always has content, because the mandatory minimums below guarantee
at least one avatar or placeholder in each. A crowded band — five defenders on
a narrow phone — wraps and scrolls inside its own band rather than pushing the
others out of their share.

#### Players scale with the pitch

A fixed 44px portrait looked right on a phone and lost on a 1280px screen. The
whole card now scales — portrait, name, fixture badge and the remove overlay
are all derived from one number by `playerMetrics()`, so nothing is left
half-sized. Measured: 54px avatars with 10px names at 390px wide, 71px with
14px names at 1280px.

The name plate spans the portrait exactly and rides up over its lower edge by
15%, so the two read as one object rather than a caption floating under a
circle.

The size comes from a `ResizeObserver` on the grid, then `fitAvatar()` takes
the largest size that satisfies **both** limits: the width the busiest band can
give each player, and the height a band has after the plate. It searches
downward rather than solving, because the font size and crest are clamped and
the height is therefore piecewise.

**Fitting exactly is what makes it stable**, and getting there took three
attempts worth recording:

1. Dividing the row width by the player count overshot — each button is wider
   than its avatar and the gaps need room too — so five defenders **wrapped**
   on a phone.
2. Wrapping turned width pressure into height, which fed back into the height
   limit: wider avatars → wrap → taller band → the formula allowed a wider
   avatar. That loop settled with an 854px pitch on an 844px screen. Rows are
   now `flex-nowrap` with `overflow-hidden`, so width can never become height.
3. Taking a flat 54% of the band overshot by ~2px. The card pushed the pitch
   taller, the page gained a scrollbar, the scrollbar narrowed the row, and the
   size oscillated between two values forever. Hence solving for a card that
   provably fits.

All three were caught by measuring in a real browser at 390×844 and 1280×900,
including re-measuring after a delay to prove the layout settles.

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
dark plate beneath (legible over grass), the status mark in the top-left corner
when not match-fit, and their next fixture.

### Verified

The rule engine was checked against generated cases: all ten formations total
11 and meet the documented minimums, none duplicated, every formation is
reachable one player at a time and displays as itself, a second keeper /
sixth defender / seventh midfielder / fifth forward are all rejected, a full
lineup rejects everything, and the removal candidates are position-relevant.

The logic is pure and takes no React dependency, so it is ready for real tests
once a runner is added — see [Infrastructure](../infrastructure.md#not-yet-done).

## Possible extensions

- Sort or filter by [lineup probability](#lineup-probability-prob) — the tier is
  a number now, so "hide everyone who is `4` or worse" is a one-line filter.
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
- **Confirm what the `st` codes mean** and give each kind its own mark — a
  plaster for an injury, a card for a suspension. See
  [Availability (`st`)](#availability-st): the values have never been observed
  systematically, so one mark stands for all of them today.
- Show `stxt` in the bench card's text as well, alongside the
  [probability badge](#lineup-probability-prob) already on its avatar. The
  bench card carries no status mark at all yet.
- Warn on save when the lineup contains players at tier `4` or `5`: the badge
  is passive, and an eleven with three excluded players is worth interrupting.
