# Liga

[← Back to index](../README.md) · Route `/leagues/:leagueId/league` ·
[`src/pages/LeaguePage.tsx`](../../src/pages/LeaguePage.tsx)

**The league itself** — what it is called, when it started, the rules it plays
by, who is in it, and the side competitions running inside it.

Everything else in the app is about a *thing in* the league: a player, a
manager, a matchday, the market. This is the page about the league, and until
it existed the app never answered "what are the rules here?" — the squad cap,
the club cap, the starting budget and the underpay rule were all in a payload
the app had held from the first day and shown to nobody.

## Getting there

**Tapping the league card at the top of the drawer or the sidebar.** That card
is the one thing on every screen that names the league, and it went nowhere.
It now carries a chevron and lights up while the page is open.

That card also **used to print the manager's budget** under the name. It is
gone, and its removal is half of what this page is: the budget is the
*manager's* money, printed where the **league** is named, already shown on
[Transfermarkt](market.md) where it is spent — it made the league's identity
read as an account balance.

There is **no drawer entry**, on the same grounds as the
[player](player-detail.md), [club](team.md) and [manager](manager-detail.md)
pages: the way in is the thing that names it. Nothing in the drawer is lit
while this page is open except the card itself.

## Layout

```
  ⬛  MADMASSCREM Sunday Leauge                    ┌───────┐
      Bundesliga · Klassisch · seit 12. Jan 2024   │ Admin │
                                                   └───────┘
  ┌──────────────────────────────────────────────────────────┐
  │ „Wer verliert, zahlt die Runde."                         │  ← only if written
  └──────────────────────────────────────────────────────────┘

  ┌───────────────┬───────────────┬───────────────┐
  │ MANAGER       │ STARTBUDGET   │ KADER         │
  │ 6             │ 50 Mio. €     │ 18            │
  │ von 18        │ pro Manager   │ Spieler max.  │
  ├───────────────┼───────────────┼───────────────┤
  │ PRO KLUB      │ UNTERBIETEN   │ SPIELMODUS    │
  │ 3             │ Erlaubt       │ Klassisch     │
  │ Spieler max.  │ bis 90 % …    │ Bundesliga    │
  └───────────────┴───────────────┴───────────────┘

  ┌── Wettkämpfe ───────────────────── wer gerade führt ─────┐
  │ ♛  Spieltagssieger                     robidfl  (A)      │
  │    Die meisten Spieltagssiege                            │
  ├──────────────────────────────────────────────────────────┤
  │ ⇄  Transferkönig                        Danger  (A)      │
  │    Die meisten Transfers der Saison                      │
  ├──────────────────────────────────────────────────────────┤
  │ ✋  Torwart-Wertung                   noch offen         │
  │    Die meisten Punkte mit Torhütern                      │
  └──────────────────────────────────────────────────────────┘

  ┌── Manager ───────────────────────────────────────────────┐
  │ (A) robidfl   (A) Danger du   (A) Sebbo   (A) …          │
  └──────────────────────────────────────────────────────────┘
```

The **crest and the name come from the league context**, not from the request:
the URL already resolved to a league, so the header is right on first paint and
the page never flashes a nameless title. Only the meta line under it waits for
the payload.

## Everything here is one request

[`useLeagueDetails`](../../src/api/hooks/useLeague.ts) →
[`/leagues/{id}/overview?includeManagersAndBattles=true`](../api/leagues.md#get-v4leaguesleagueidoverview),
a ten-minute cache entry that [Market](market.md) and
[Was wäre wenn](whatif.md) already hold for `upe` alone. So opening this page
after visiting the market usually costs **nothing at all**.

The query parameter is new and unconditional. It is declared required by the
published spec and is not — the app omitted it for months — but with it the
response also carries the members' **names** (`us`; the thin `m` list has ids
and avatars only) and the **battles** (`btls`). Both are free: same endpoint,
same round trip.

## Wettkämpfe: seven faces, and that is the data

Kickbase runs side competitions inside a league — *Spieltagssieger*,
*Transferkönig*, one per position, one for the biggest single matchday. The
payload names, for each, **only the manager currently ahead**: no standings, no
runner-up, and not even the figure that decided it. Confirmed live on
2026-09-09.

> A chip-per-battle ranking was designed first — chips like
> [Saison → Rangliste](season.md#rangliste)'s *Alle · TW · ABW · MF · ANG*, one
> per battle, with a table under them. It was abandoned on that reading: there
> is no second row to draw. Seven captioned faces is not a reduced version of
> that page, it is the whole of what the API has.

Each row's **wording is the API's own**, in German off the `Accept-Language`
the [client](../../src/api/client.ts) sends — so *Transferkönig* reads exactly
as it does in the Kickbase app rather than as this codebase would have worded
it. Only the **icon** is ours, mapped from the type code, with a fallback
medal: the codes are the spec's, one of them (`3`) has never been seen, and a
battle Kickbase adds next season should still draw as a battle. See
[Battle type](../api/codes.md#battle-type-t-on-btls).

**A battle nobody leads yet keeps its row** and says *noch offen*. Dropping it
would make a league four matchdays old look as though it had fewer
competitions than it has. Those rows are **not links** — a link to nowhere is
worse than no link — where a led battle makes the whole row the way to
[that manager's page](manager-detail.md), because the name is the only thing on
the line that leads anywhere.

## Manager: faces, not a table

The [Rangliste](ranking.md) is the table — placements, points, the duel
column, the movement marks. Repeating it here with the numbers stripped off
would be a worse copy of a page one tap away, so the members are a wrap of
faces with names on them: who is in this league, at a glance, each one a way
into [their page](manager-detail.md). The viewer's own chip is marked in the
accent colour.

How full the league is — `mgc` against `mgm`, *6 von 18* — is a **tile**
rather than a caption on this card, because it is the one fact the Rangliste
does not carry: how much room is left. A league with no cap prints the count
and *ohne Limit*.

## The rules, and the two zeros

`mppu` (squad cap) and `mpst` (players from one club) both use **`0` for "no
limit"**, and that number must never reach the screen: a league advertising
*0 Spieler* reads as one nobody may play in. Both tiles print *ohne Limit*
instead.

*Unterbieten* spells out its consequence rather than saying *Erlaubt* and
stopping, because "allowed" is not the whole rule: the floor moves to 90 % of
the market value, it does not disappear. See
[`offerRules.ts`](../../src/lib/offerRules.ts) and
[Market](market.md#what-kickbase-refuses).
