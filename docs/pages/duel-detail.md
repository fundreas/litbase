# Duel detail — "Duell"

[← Back to index](../README.md) ·
Routes `/leagues/:leagueId/duels/:duelId?day=N` and `…/:duelId/ranking` ·
[`src/pages/DuelDetailPage.tsx`](../../src/pages/DuelDetailPage.tsx)

One duel from the [Duels](duels.md) list, opened: both elevens and a combined
player ranking.

## Layout

```
  (A) Danger du        :        GOATstaller (A)
      834                              824
      4 laufend · 2 offen      3 laufend · 1 offen
  1. Spieltag · Live                      [👕|≡]

  ┌──────────────────────────────────────────┐
  │ (A) Danger du            ← whose half    │
  │                (Raab)                    │   keeper, top
  │                  9                       │
  │      (Anton) (Koch) (Tah) (Kimmich)      │   defence
  │        158     44    31      88          │
  │  ⋯                                       │
  │             (Kane)  (Sané)               │   attack
  │              215      12                 │
  │ ─────────────────────────────────────────│   halfway line
  │           (Guirassy) (Olise)             │   attack, facing back
  │               76        41               │
  │  ⋯                                       │
  │                (Nübel)                   │   keeper, bottom
  │                  64                      │
  │ (A) GOATstaller                          │
  └──────────────────────────────────────────┘

  DANGER DU 🪑           GOATSTALLER 🪑
  ┌────────────────┐     ┌────────────────┐
  │ (a) Karaman  🪑│     │ (a) Führich 92 │
  │ (a) Burkardt 4 │     │ (a) Grimaldo 🪑│
  └────────────────┘     └────────────────┘
```

**One pitch, two elevens facing each other.** The first manager's keeper is at
the top and the second's at the bottom, so the two attacks meet at the halfway
line the way a real fixture is drawn. It is **eight bands**, not four: the top
half runs keeper → defence → midfield → attack downwards (`ROW_ORDER_MIRRORED`)
and the bottom half runs the usual way up (`ROW_ORDER`). The card sizing in
[`pitchMetrics`](../../src/components/squad/pitchMetrics.ts) has to be told
`rows: 8`, or every portrait is budgeted twice the height it has and the lot
gets clipped.

**Portraits carry a picture and one figure, nothing else.** With 22 players on
a 360px screen a name under each is unreadable and a fixture badge is noise.
That figure is the points, or the **kick-off time** while the match is still to
come — see [the one figure a player gets](#the-one-figure-a-player-gets) — and
it is tinted accent while that player's match is running. The plate is sized
for one line
(`plate: 'points'`), which is also what lets the avatar floor drop to 26px on a
phone.

**Telling the sides apart** takes two things: the ring around each portrait
(white on top, accent below) and a small manager chip in each half's corner.
The chips exist because the header pairs the managers *left and right* while
the pitch has to stack them *top and bottom* — something has to bridge those
two arrangements, and a legend would cost a row of height the pitch cannot
spare.

### This replaced two stacked lists

The lineup view used to be two `RosterCard`s: a header per manager over eleven
rows, each with a fixture, a status word and a position. Those rows carried
more per player and still lost what a duel is about — the shape of two teams
against each other, and where the points are coming from. The pitch answers
that in one look, and the [Rangliste](#the-ranking-tab) is one tap away for
the per-player detail, so nothing is actually gone.

### The bench: two columns, left and right

Below the pitch, one column per manager — **first manager left, second
right**, matching the header rather than the pitch. Stacked rows rather than a
sideways-scrolling strip, because two benches side by side are meant to be
*compared*: rows at matching heights read against each other, and nothing hides
off the edge waiting to be swiped into view. A row has the width for a name
where a portrait on the pitch does not, so these carry one.

Bench players are dimmed as a set — the column heading says what they are, and
repeating "Bank" down every row is noise. A manager with a full eleven and
nothing spare gets *Alle Spieler aufgestellt* rather than an empty box.

### Header

The scoreline is unchanged except that **`n laufend · n offen` moved into it**,
under the manager it belongs to. It used to sit inside each roster card, which
the pitch replaced; it reads better here anyway, since it qualifies the total
directly above it — 40 points behind with four matches to play is winning. The
line is simply absent until the rosters land, rather than claiming
`0 laufend · 0 offen`.

**There is no back link.** It cost a row at the top of a page whose content
wants to be a pitch, to duplicate what the browser's back gesture and the nav
drawer already do.

## The routes are the views

```
/leagues/:leagueId/duels/:duelId          → Aufstellung (the pitch)
/leagues/:leagueId/duels/:duelId/ranking  → Rangliste
```

Two routes, one component, the view derived from the segment — the same
convention as the [squad page](squad.md), for the same reason: each is linkable
and survives a refresh. Switching uses `replace`, so back leaves the page
rather than walking through every visit.

**The control is a one-button, two-glyph toggle**, not a tab bar — the same
control the Kader view uses for list/grid, for the same reasons: two triggers
take twice the width to say one thing, and a lone glyph cannot answer "is this
where I am or where I would go?". It sits on the right of the matchday line,
and it still navigates, which is what keeps the two views linkable. `Tabs` is
gone from this page.

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
| `bench` | The manager did not field them | the snapshot's `nlp` list |
| `open` | Fielded, their club has not kicked off | fixture kick-off in the future |
| `playing` | Fielded, match in progress | kick-off passed, not reported finished |
| `finished` | Fielded, match over | fixture `st === 2` |
| `substituted` | Taken off | **nothing produces this yet** — see below |

**These are hardly ever words on screen any more.** A row shows the match's
own [scoreline](#a-row-is-two-marks-and-two-numbers) instead, which says the
same thing and more — "Läuft" cannot tell you it is 2:1 — and the bench is the
[armchair](../../src/components/player/BenchMark.tsx). On the **pitch** the
state is a tint: a running player's points are accent-coloured and everything
else is white, because there is no room for anything else under a portrait.

The union keeps its German labels for tooltips and screen-reader text, where a
mark needs spelling out.

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

## The one figure a player gets

Every player has exactly one slot for a number — the plate under a portrait,
or the right-hand column of a row — and four things can go in it.
`playerFigure()` in [`models.ts`](../../src/api/models.ts) decides which, in
this order:

| Shown | When | Why this order |
| ----- | ---- | -------------- |
| **Points** | they are known | The most informative thing available, benched players included — a bench that outscored the eleven is why benches are on screen at all |
| **The armchair** ([`BenchMark`](../../src/components/player/BenchMark.tsx)) | benched, no points | A kick-off time would mislead: his match starting changes nothing, because his points will never count |
| **Kick-off** (`20:30`) | fielded, match still to come | Answers the question the dash left hanging. On a Friday evening most of a lineup has not kicked off |
| **`–`** | nothing to say | No fixture that matchday, or a match under way whose points have not arrived |

**Points are never `0` for a player who has not scored.** That distinction is
why `DuelPlayer.points` is optional: printing `0` would claim they played and
failed to score. A player who genuinely did not feature carries `hp: false` in
the API and also stays `undefined` — and `0` really does render as `0`, for
someone who played and scored nothing.

The kick-off is the **time alone**, in the reader's own timezone. A matchday
page covers one weekend and the row or plate already says which fixture it is;
on a pitch plate the width is the portrait's, which is about five characters on
a phone. A Sunday match seen on Friday therefore reads `17:30` with no day
attached, which is the one thing this trades away.

**The bench is a mark, not a word.** The armchair — the same glyph the squad
page's bench section is headed with — replaces *Bank* wherever a player is
labelled as benched: in the figure column, and as the status on a row. It had
to compete for width with a name, a fixture and a score, and a mark says it in
a tenth of the space; the word rides along as screen-reader text and as the
tooltip. **And the status mark is dropped when the figure is already that
mark** — a benched player with no points would otherwise carry two armchairs
across one row. One who *did* score keeps both, because there the figure is a
number and the mark is what says it did not count.

A real score is drawn at full contrast and a placeholder stays quiet, so the
eye finds the numbers first.

## The squad it shows is the matchday's

Both rosters come from the **matchday snapshot**,
`GET /v4/leagues/{leagueId}/users/{userId}/teamcenter?dayNumber={n}`, read
through [`useMatchdaySquad`](../../src/api/hooks/useMatchdaySquad.ts). `lp` is
the eleven that was fielded that matchday and `nlp` the rest, for **any**
manager in the league — so a matchday from four weeks ago lists the players who
played it, not today's squad.

### The one thing the snapshot cannot do, and the fallback for it

**`lp` is empty until the matchday starts.** Probed six hours before kick-off:
the snapshot returned `lp: []` with all fifteen players in `nlp`, while
`/squad` plainly had eleven fielded with `lo` `0…10`. So it fills at or after
the first kick-off, and before then there is nothing in it to draw.

`canUseMatchdaySquad()` in [`models.ts`](../../src/api/models.ts) decides,
per manager:

| Snapshot | Matchday | Source |
| -------- | -------- | ------ |
| no lineup in it | any | today's squad and its `lo` |
| has a lineup | settled (`st === 2` on every fixture) | **the snapshot**, whatever the count — a manager who fielded nine really did field nine |
| has a lineup | still running | **the snapshot**, once it holds at least as many players as are fielded today |
| empty both lists | any | today's squad — this is a matchday before the league existed |

The third row is the guard that matters. If `lp` turns out to fill *per match*
rather than all at once, a half-filled lineup would otherwise be drawn as the
whole team, with the rest wrongly on the bench and an empty-slot penalty to
match. Comparing against today's fielded count catches exactly that, because
Kickbase locks the lineup at kick-off — so during a matchday `lo` is both
complete and current, and the right yardstick.

**An earlier version gated on the matchday being *finished*.** That was safe
and too crude by half: a live matchday fell back to today's squad, and so did
every matchday under `dev:live`, since the simulation marks the replayed one
unfinished on purpose. The data was sitting there and the app refused it.
Testing completeness rather than the clock fixed both.

`isSettled` deliberately reads the API's own `st === 2` rather than comparing
kick-offs to the clock, so a [simulated clock](../infrastructure.md#development-profiles)
cannot make a matchday look settled when it is not.

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

### Positions, and the sold players that went missing

The snapshot does not reliably carry `pos` — it is present on
`teamcenter/myeleven`'s entries and absent from the day-scoped variant's — so
it is back-filled from two sources, in order:

1. **Today's squad** (`useManagerSquad`), which is read anyway as the
   live-matchday roster source, so this costs no request.
2. **The player's own detail**, which
   [`useMatchdayPoints`](../../src/api/hooks/useMatchdayPoints.ts) already
   fetches for the points and which carries `pos`. It hands back a
   `positionByPlayerId` map as a by-product.

The second source exists because of a bug worth remembering. A player
**transferred away since** the matchday is in the snapshot but in nobody's
current squad, so his position was `undefined` — and the pitch places players
by filtering each band on `position`, so he matched no band and was **silently
dropped**. The ranking view listed him correctly all along, which is what made
it look like a data problem rather than a rendering one: same rosters, same
points, one view showing him and the other not.

So the fan-out now takes a `needsPosition` flag per player and fetches him even
when his match cannot have produced points yet — the answer does not depend on
any match having started. On a settled matchday every player is fetched for the
points anyway, so this adds requests only for a sold player on a matchday still
to be played.

`DuelPlayer.position` stays optional even so: if neither source answers, a row
renders `–` for the label and the pitch leaves the player out rather than
guessing. `toPosition()`'s midfield default would have put a stranger in the
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
`users/{uid}/teamcenter?dayNumber=` ([above](#the-squad-it-shows-is-the-matchdays)) serves any
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

## A row is two marks and two numbers

Every player row — in the [Rangliste](#the-ranking-tab), in the bench columns,
and in the squad page's live list, since they are all
[`DuelPlayerRow`](../../src/components/duels/DuelPlayerRow.tsx) — reads:

```
(portrait)  Anton
            🏠 (crest)  2:1                    158
```

The second line **used to be `ABW @ ELF`**: a position abbreviation, a `vs`/`@`
and the opponent's three-letter symbol, plus a status word. It now carries

- the opponent's **crest**, with a house or an aeroplane beside it
  ([`FixtureBadge`](../../src/components/squad/FixtureBadge.tsx), the app's
  wordless fixture — a crest is recognised faster than three letters), and
- the match's own **scoreline**
  ([`MatchStateBadge`](../../src/components/player/MatchStateBadge.tsx)):
  a faint `–:–` before kick-off, a **pulsing dot** with the running score and
  the **minute** while it is on, the final score once it is over, and
- what the player **did** — goals, own goals, assists, cards — as the same
  glyphs the [player page](player-detail.md) draws, from the match's own event
  feed.

Three pieces of text became two marks and a number, and the row gained the one
thing it never had: how that match is actually going. The score is read from
the player's own side of the fixture, so `2:1` always means his club is
winning.

**The position went with them.** It is the least useful thing about a player in
a list ranked by points, and it is one tap away on his own page. The scoreline
and the crest are wordless, so both carry the state and the kick-off as their
tooltip and as screen-reader text.

### Where the live numbers come from

[`useLiveMatches`](../../src/api/hooks/useLiveMatches.ts) →
`GET /v4/matches/{matchId}/details`, **one request per match** (nine for a
matchday) rather than per player, polled once a minute only while a match is
running and fetched once and held for a finished one.

The score used to come from the fixture list, which is the whole season and
cached for an hour — an hour-old number beside a pulsing "live" dot. The
fixture is still the fallback, which is right the moment a match is over and
nothing can change, and it is still the source of every match's *state*: that
payload now goes stale at once and polls while the current matchday is under
way, since `st` is what says a matchday is finished.

The score is read from the player's **own side** (`liveScoreFor`), so `2:1`
always means his club is winning, and the minute reads `90+'` past ninety
rather than the API's raw `95`.

The events are the same `ke` codes as the player page's `k`, verified on a
finished 5:1 whose feed decoded to four goals plus an own goal one way and one
goal the other — which is that scoreline exactly. Substitutions are in the feed
and deliberately not drawn: `toEventTallies()` drops them, because they say
where a player was rather than what he did.

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
| Rosters loading | The header and toggle render; `SkeletonList` in place of the pitch |
| Error | `ErrorState` with retry |
| Pairing not on this matchday | `EmptyState` with a link back to the list |
| Matchday the API has no squads for | `EmptyState` — `isEmpty`, not an error; see [above](#the-squad-it-shows-is-the-matchdays) |

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
