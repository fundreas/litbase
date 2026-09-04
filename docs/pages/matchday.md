# Matchday

[← Back to index](../README.md)

`/leagues/:leagueId/matchday`

Every match of one matchday, live while they are being played, and the way into
[one match in detail](match-detail.md).

This is the only screen in the app that is about **football** rather than about
Kickbase. Nothing on it depends on the league except the URL it lives under —
which is deliberate, because the league is how you got here and the crest under
your finger is why you stayed.

## The matchday lives in the URL

`?day=` in the query string, not in component state, exactly as on
[Duels](duels.md): a weekend can be linked to, shared with the league, and
survives a refresh. The control is the shared
[`MatchdayPicker`](../../src/components/MatchdayPicker.tsx) — a step either
side, a drawer of all 34 behind the label.

The requested day is **validated against the real schedule** before it is used.
A hand-edited `?day=99` falls back to the competition's current matchday rather
than selecting nothing and rendering as an empty page.

> The picker moved out of `components/duels/` when this page was built. It was
> never duel-specific; it just had one caller.

## Grouped by kick-off

```
SA, 5. SEP. · 15:30
  [crest] FC Bayern     2:1   Dortmund [crest]
                        ● 67'
  [crest] Leverkusen    0:0   Union    [crest]
                        ● 67'

SA, 5. SEP. · 18:30
  [crest] Leipzig      –:–    Freiburg [crest]
                       18:30
```

A Bundesliga matchday is not nine matches, it is a Friday evening, five o'clock
on Saturday, the late one, and two on Sunday — so the list is grouped by
distinct kick-off with the date and time as the heading. A flat list sorted by
time says the same thing while making the reader work out where the breaks are,
and the heading means no row has to repeat the date.

The groups come out of a `Map` keyed by kick-off, filled in list order. The list
is already sorted by kick-off, so insertion order *is* render order — no second
sort, and the groups cannot disagree with the rows about the sequence.

## A row is two crests, a score and a clock

[`MatchCard`](../../src/components/matchday/MatchCard.tsx). Home on the left,
away on the right, the score between them — the arrangement every fixture list
in football uses, and the reason
[`MatchdayMatch`](../../src/api/models.ts) keeps home and away where they are
instead of resolving an "opponent" the way a player's fixture does.

**Crest *and* label**, which departs from the app's usual wordless
[`FixtureBadge`](../../src/components/squad/FixtureBadge.tsx). That badge
answers "who is my player up against", where the crest is a reminder of
something already known. Here both clubs are equally unknown and two crests at
30px are a guessing game.

The score column is a **fixed width** so the numbers line up down the list: a
column of centred `2:1`s that shifts by a character whenever a club's name is
longer reads as a broken table.

[`MatchClock`](../../src/components/matchday/MatchClock.tsx) is the third state
carrier, and the only thing on the page that moves:

| State | Drawn as |
| ----- | -------- |
| Not kicked off | the kick-off **time** — `18:30`, and `–:–` for the score |
| Running | a **pulsing dot** and the minute, both in accent, plus a tinted card edge |
| Over | *Beendet*, quietly |

A running match also gets an accent border on the card, so a matchday half
played reads as "these three are on" in one look rather than one dot at a time.

## Data

| What | Where from | Cost |
| ---- | ---------- | ---- |
| The fixtures | `useMatchdayMatches(cid, day)` → `/competitions/{cid}/matchdays` | **Nothing new** — a third `select` on the season payload the squad page, the duel picker and the player pages already share |
| The live score and minute | `useLiveMatches(matches)` → `/matches/{mi}/details` × N | One request per **started** match; a finished one is fetched once and held, only a running one polls |

So an upcoming matchday costs **zero** requests beyond the cached season list,
and a matchday with one late kick-off still running costs one request a tick
rather than nine. The live rate is **10 s**, one constant in
[`polling.ts`](../../src/api/polling.ts), gated per running match.

**The list goes live on its own.** The fixture-list query starts polling ten
minutes before the current matchday's first kick-off rather than only once
something is running — without that head start nothing re-read the clock, and a
page left open since the morning kept showing `–:–` through the whole afternoon.
The reasoning is on `isMatchdayLive()` in
[`useMatchday`](../../src/api/hooks/useMatchday.ts) and in more detail under
[match detail](match-detail.md#getting-from-upcoming-to-live-without-a-reload).

`useLiveMatches` used to take the team-keyed fixture map and now takes any
sequence of things carrying a match id, a kick-off and a finished flag — which
is what lets a fixture *list* drive it as naturally as a player's fixtures do.

## The score is the live one wherever there is one

The season fixture list carries goals as well (`t1g`/`t2g`), and it is cached
for an hour because it is the whole season. On a running match that would put an
hour-old number next to a pulsing dot. So the match's own payload wins, and the
fixture stays the fallback — which is exactly right the moment a match is over
and nothing can change, and it is all there is for the second before the live
answer lands.

## States

| State | Rendering |
| ----- | --------- |
| Schedule loading | Heading + `SkeletonList rows={9}` |
| Schedule error | `ErrorState` with retry |
| Matchday with no fixtures | `EmptyState` — the shape allows it, the API has not been seen to return it |

Live scores arriving late never block the rows: a match renders with the
fixture's own score and refreshes in place, which is what keeps a live page from
flashing a skeleton every minute.

## Possible extensions

- **The league's players on a fixture row.** A count of how many owned players
  are involved in each match would say where a matchday is going to be decided
  before you tap in. It needs the ownership fan-out the
  [detail page](match-detail.md#ownership-is-the-point) does per match, which is
  too much for nine of them at once — unless a bulk ownership source turns up.
- **A team page** behind each crest, which the `TODO` in
  [`litbase.specs.md`](../../litbase.specs.md) already names.
