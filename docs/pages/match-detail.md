# Match detail

[← Back to index](../README.md)

```
/leagues/:leagueId/matchday/:matchId          → Verlauf
/leagues/:leagueId/matchday/:matchId/lineup   → Aufstellung
```

One match: the scoreline, everything that happened in it, and both team sheets
with **the league's own managers marked against the players they own**.

Two routes, one component — the active tab is read out of the segment, so each
view is linkable and survives a refresh, the same convention the
[squad](squad.md), [duel detail](duel-detail.md) and
[player](player-detail.md) pages follow. The tabs are a
[`BottomTabBar`](../../src/components/ui/BottomTabBar.tsx), which is the app's
control for switching between views of one page.

## The URL carries a match id and nothing else

The matchday is looked up from the season's fixture list —
`useSeasonMatch(cid, matchId)`, one more `select` on the payload that is already
cached — and everything matchday-scoped on the page hangs off that answer: the
fixtures the points hook measures against, and the `ph[day - 1]` index itself.

A link to a match therefore needs no `?day=` and **cannot carry a wrong one**. A
match id that is not in the fixture list gets an `EmptyState` with a way back,
which is the honest reading of a hand-edited URL.

## Opening a match costs no request

`GET /v4/matches/{matchId}/details` is keyed `qk.matchDetails(matchId)` and the
**raw response** is what sits in the cache. Two hooks read it:

- [`useLiveMatches`](../../src/api/hooks/useLiveMatches.ts) reduces it to a
  score, a minute and per-player event tallies — what a *player row* needs, on
  the [matchday list](matchday.md) and on both duel pages.
- [`useMatchDetails`](../../src/api/hooks/useMatchDetails.ts) maps the whole
  thing: the club names, both real-world team sheets and the full event feed.

Because the mapping happens in `select` rather than in the `queryFn`, tapping a
match on the list issues **nothing** — the list already fetched it for the
score. That is the same treatment the season fixture list gets, for the same
reason.

The polling rules are the list's plus one it does not need:

| Match state | `staleTime` | Poll |
| ----------- | ----------- | ---- |
| Running | 0 | 60 s |
| Finished | `Infinity` | — |
| Not kicked off | 5 min | — |

`useLiveMatches` skips an upcoming match entirely, because there is no score in
it. This page wants it anyway, for the team sheets — Kickbase publishes those
about an hour before kick-off, and five minutes is short enough to catch them.

**The state comes from the fixture list, not from `mst`.** `st` on the season's
fixtures is what the whole app treats as the truth about whether a match is on,
and it is what [`npm run dev:live`](../infrastructure.md#development-profiles)
rewrites. `mst` on the match payload is the server's own word and would
disagree with a simulated matchday — a replayed match reports itself finished
while the app is deliberately treating it as live. So `fixtureState(match)`
decides the state and the match payload supplies the minute, which the fixture
list has no notion of.

## The header

[`MatchScoreHeader`](../../src/components/matchday/MatchScoreHeader.tsx). Crests
over names, the score at 3xl between them, and one line underneath:

| State | The line under the score |
| ----- | ------------------------ |
| Not kicked off | `Sa, 5. Sep. · 18:30` — the full kick-off |
| Running | a **pulsing dot**, *Live*, the minute, and the matchday |
| Over | *Beendet*, and the matchday |

One shape for all three, so switching tabs or watching a match tick over does
not shift the page under the reader. The club **names** only exist on the match
payload (`t1n`/`t2n`), so the header shows the fixture list's three-letter
symbols for the moment before it lands.

## Verlauf — the timeline

[`MatchTimelineTab`](../../src/components/matchday/MatchTimelineTab.tsx),
ordered by [`matchTimeline()`](../../src/api/models.ts).

**Newest first.** The case that matters is the live one: what just happened
belongs where the eye lands, not at the bottom of a list that has been growing
for two hours. So the final whistle heads the list once it has blown and the
kick-off closes it.

**Two sides around a spine.** The home club's events swing left and the away
club's right, mirrored, with the minute on the vertical rule between them:

```
      Musiala  ⚽ │67'│
Tor · Kimmich     │   │
                  │63'│ ⇄  Sané
                  │   │    Wechsel · für Olise
        Kimmich  🟨 │58'│
```

The glyph sits nearest the centre and the names run outward, so the two columns
face each other rather than reading as one list indented twice — one
`flex-row-reverse` on the home half, not two orderings of the same markup.

The reason it earns the width is that **the side replaces the crest**. Which
club an event belongs to is answered by where the row sits, in the same
left/right arrangement the header above it already established, so nothing has
to be read to know whose goal it was. The narrow-screen cost is real and paid
deliberately: each side gets a little under half of ~350px, so a long name
truncates where a single full-width column would have fitted it. Two lines per
event keep that manageable — the player on the first, what he did on the second.

The spine is drawn **once behind the whole list**, not per row: a segment per row
would break at every gap and at every marker, and it has to line up with the
minute column in all of them. `left-1/2` is exact because the row grid is
`1fr auto 1fr` — the centre column is centred by construction. The minute sits
on an opaque `bg-canvas` chip so the rule does not run through the digits.

An event the feed attributes to **no club** — not observed, but the payload
allows it — spans the whole width rather than being guessed onto a side.

The marks are the app's shared
[`EventGlyph`](../../src/components/player/statGlyphs.tsx)s, so a ball here
means the same thing as a ball on a player's match row and in his season grid.
**Substitutions get an arrow pair of their own**: they are excluded from the
glyph scale on purpose, because on a *player* a swap says where he was rather
than what he did — but on a match timeline it is one of the events the reader
came for.

### The second name on a row

The feed folds a related player into an entry as `rev`: the assist behind a
goal, the player coming off in a swap. It is rendered as a **name only and never
a link**, because `rev.pi` is `"0"` even when `rev.pn` names somebody — there is
no id to navigate to. A 5:1 whose feed held five goal events and no assist
events is what established that assists arrive this way rather than as entries
of their own.

### The structural markers

Anpfiff, Halbzeit and Abpfiff are **derived from the match's state, not read
from the feed**, and drawn as full-width dividers rather than as events.

The feed does carry match-level entries — they are the ones with `pi: "0"` — but
their `ke` codes are **not on the player scale and have not been identified**.
Guessing them would put a mislabelled marker in the middle of an otherwise real
timeline, which is a worse failure than not having them: a reader cannot tell a
wrong *Halbzeit* from a right one.

All three moments are implied by data the app already trusts:

- **Anpfiff** — the match has started at all, and the kick-off time comes from
  the fixture. Always the last row.
- **Halbzeit** — between the last event at or before minute 45 and the first
  after it, and only once the match has actually reached half-time (finished, or
  past minute 45). A second half in which nothing has happened yet still gets
  the divider.
- **Abpfiff** — the fixture reports finished. Always the first row.

> **Open probe.** One request against a live or finished match, reading the `ke`
> of the entries with `pi: "0"`, would settle whether the API's own markers are
> worth reading instead. It is a one-line change to `mapMatchDetail` if they
> are — the shape is already there, the codes are the only unknown.

Before kick-off the timeline is empty and says so, with the kick-off time.

## Aufstellung — both team sheets

[`MatchLineupTab`](../../src/components/matchday/MatchLineupTab.tsx). One pitch,
home at the top attacking down, away at the bottom attacking up — the
[duel](duel-detail.md#layout) arrangement, for the same reason: two
elevens stacked as lists lose the shape of a fixture, and the shape is most of
what a lineup is for. **Eight bands**, four per half, and the card sizing has to
be told so or every portrait is budgeted twice the height it has.

Each portrait carries three things and no more:

- the **points** on the plate — `–` rather than `0` while they are unknown,
  because a match that has not kicked off is not a blank performance;
- the **owning manager**, top-left;
- a **down arrow**, top-right, once the player has been taken off — the one
  thing that changes what his number means, because it is now final.

No names and no event badges. At twenty-two portraits on a phone a name under
each is unreadable and a row of badges beside a 30px avatar is worse. The
tooltip and the accessible name carry the lot — name, score, owner, every event
and the swap — which is the one place the width is free, and it is where
`MatchPlayer.events` earns its keep.

The **substitutes** go underneath as two columns, home left and away right,
matching the header's arrangement (the pitch has to stack the teams to make
them face each other; the corner labels bridge the two). Rows rather than
portraits, so each gets a name. These are the club's real substitutes, not a
Kickbase bench, and they are worth the space three times over: a manager's own
player among them answers "why did he score nothing", the ones who came on carry
an arrow and a real figure, and each row shows its **owning manager** as its own
inline avatar.

Inline, not as a corner badge — that is the one place the pitch's treatment does
not transfer. A 26px badge on a 60px portrait is legible; the same badge on a
24px bench avatar is 12px of mush, which is precisely how the
[lineup-probability icon failed](squad.md#lineup-probability-prob) on the squad
pitch. A row has width for a second avatar, so it gets one.

### The corner labels

Crest, three-letter symbol, and **what that club's players scored in this
match** — the sum of every known figure in the team sheet, substitutes included.
A substitute who came on and scored did so for this club; one who never left the
bench contributes nothing, because his points are `undefined` rather than `0`.
The total is `–` until the first figure lands and then climbs as the fan-out
arrives, which is also what the spinner under the pitch is saying.

It answers the question the score cannot: *where in this fixture were the
points*. Nothing else on the screen adds up the two teams.

The corner used to carry the **formation** (`ts1`/`ts2`, e.g. `4-2-3-1`) and
that is gone: a dashed run of digits at 10px reads as a date, and the shape of
the bands underneath is already a rough answer to the same question. The wire
field stays documented in
[`types.ts`](../../src/api/types.ts) if it is ever wanted again; nothing maps it.

### Ownership is the point

`OwnerBadge` — the manager's own avatar, on the player's portrait. This is the
whole reason the screen is worth more than a link to kicker.de: a Bundesliga
eleven means nothing to a manager until they can see which of those players are
*someone's*, and whose.

An avatar rather than a name or a colour. Twenty-two portraits leave no room for
a name, and a colour key would have to be learned — while a manager's avatar is
already how they are identified in the drawer, the standings and every duel. The
signed-in user's own players take the **accent ring**, so "which of these are
mine" is answered without reading anything at all.

### It is the matchday's lineup, not today's squad

The badge asks **who had this player in his lineup on this matchday** — and that
is a different question from who owns him now.

The source is `us` on the matchday snapshot,
[`useMatchdayLineups`](../../src/api/hooks/useMatchdaySquad.ts): alongside the
addressed manager's own `lp`/`nlp`, `GET /leagues/{id}/users/{uid}/teamcenter?dayNumber=`
carries **every member of the league with the players *they* fielded that
matchday**. One request answers ownership for all of them. It is the same cache
entry `useMatchdaySquad` fills, read through a second `select`, and the same
entry the squad page's live view already holds for the current matchday — so
that case is free.

The first version of this read **`oui` on the player detail**, which the points
fan-out is fetching anyway. That was wrong, and quietly: `oui` is who owns the
player *today*, so a matchday from three weeks ago badged everyone transferred
since with his **new** manager and reassigned the points they scored. The
snapshot is the matchday's own record.

`oui` survives as the **fallback for a matchday with no lineups yet** — before
the first kick-off, where the snapshot is measurably empty and today's owner is
the right answer in any case, because nobody has fielded anybody. Each badge
carries which of the two it came from
([`OwnerSource`](../../src/api/models.ts)) and the wording follows: *In der
Aufstellung von X an diesem Spieltag* against *Gehört X*. Two different claims
should not share a sentence.

Two consequences worth knowing:

- **Fielded players only.** `us` has no per-manager bench (`lp` and `lpi`, no
  `nlp`), so a player somebody owned and left out gets no badge. For a matchday
  view that is the more useful half — the question is who *played* him — and the
  alternative is one request per manager in the league.
- `oui` is the *string* `"0"` rather than an absent field when nobody owns the
  player, a trap that now lives in exactly one place, `toOwnerId()`: read
  naively it is a truthy id matching no manager, and every free agent would show
  as owned.

A manager the standings do not list keeps the snapshot's own `unm` as a name and
loses only the avatar. A bare id is never rendered — better no badge than an
unreadable one.

### What the lineup costs

**Roughly 36 requests plus two** — twenty-two starters and both benches, one per
player, via [`useMatchdayPoints`](../../src/api/hooks/useMatchdayPoints.ts), on
top of the matchday snapshot and the standings. There is no bulk source of
per-player matchday points: `/leagues/{id}/players`, `?ids=` and every other
shape answer 404. See
[duel detail](duel-detail.md#points-cost-one-request-per-player), which pays the
same price for thirty.

Ownership, by contrast, **is** available in bulk, which is the whole reason the
snapshot won that job — one request rather than a field scavenged from
thirty-six.

Three things keep it honest:

1. **The tab pays for itself.** The fan-out lives in a component that only
   mounts on `/lineup`, so the timeline never fetches a lineup nobody is looking
   at — the same split the squad page uses for its live view.
2. **The cache is shared.** These are the `qk.playerDetail(leagueId, playerId)`
   entries every other page fills, and they are not matchday-scoped, so a player
   already looked at this session is free and stepping between matchdays
   re-reads nothing.
3. **Only running players poll.** A settled player is fetched once and held for
   the session; the minute-poll is attached per player, so a finished match
   costs nothing to keep open.

The one rule this page **overrides** is "no points yet, so do not ask":
`needsOwner` fetches a player before his match has kicked off. That is now
purely for the pre-kick-off ownership fallback — the snapshot has no lineups
that early, and a team sheet with no badges at all on the Friday evening would
be the view failing at the one thing it is for.

### Who came off

The feed states the **incoming** player outright — a substitution event carries
his id, and observed payloads hold one per substitution with no outgoing
counterpart at all — so *came on* is a fact.

The player going the other way is only ever a **name** in `rev`. He is matched
by last name against the starting eleven of the same club, and **only when that
name is unique in it**: two starters sharing a surname make the match ambiguous
and neither gets an arrow, because an arrow on the wrong player is worse than
none. If Kickbase ever emits the outgoing code, it is honoured directly and the
name matching never gets the chance to be wrong.

This is also, incidentally, the first real source for the state
[duel detail](duel-detail.md#unverified-ausgewechselt) has wanted all along.

### When there is no lineup yet

Kickbase publishes team sheets around an hour before kick-off; until then the
payload's lineup arrays are simply empty. That is not an error and not a team of
nobody, so the pitch says so in a sentence rather than drawing two empty
halves. `il` on the payload claims the sheets are *official* rather than
predicted, but it reads `false` on matches played weeks ago — closer to a flag
set around kick-off than a durable fact — so it is mapped and not yet trusted
with anything.

Players the pitch **cannot place** — no `pos` on the match payload and no detail
response yet — are counted in a line under it. Dropping them silently is how
sold players once went missing from the duel lineup, and defaulting them into
midfield would put a stranger in the middle of the park and look deliberate.

## States

| State | Rendering |
| ----- | --------- |
| Fixture list loading | `SkeletonList rows={8}` |
| Match id not in the season | `EmptyState` with a link back to the matchday |
| Match payload loading | Header renders; `SkeletonList` in its place |
| Match payload error | `ErrorState` with retry |
| Points still arriving | The pitch renders; a spinner and *Punkte werden geladen …* under it |

## Possible extensions

- **Read the API's own markers** once the `pi: "0"` codes are known — see the
  probe above.
- **The per-event points breakdown.** `/v4/live/eventtypes` names 621 scoring
  events (*Fernschusstor (Bonus)*, *Pass des Todes*) on a much larger scale than
  `ke`. It is what a "why did he get 158?" view would need, and nothing reads it
  yet — see [API layer](../api-layer.md#endpoints-probed-but-unused).
- **A team page** behind each crest, which the matchday list wants too.
