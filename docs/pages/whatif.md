# Was wäre wenn — the transfer calculator

[← Back to index](../README.md) · Routes
`/leagues/:leagueId/whatif/:playerId` and `/leagues/:leagueId/squad/whatif` ·
[`src/pages/WhatIfPage.tsx`](../../src/pages/WhatIfPage.tsx)

**Status: implemented.**

## Two scenarios, one page

The path picks which:

| Route | Question | Tabs | Reached from |
| ----- | -------- | ---- | ------------ |
| `/whatif/:playerId` | *What if I bought him?* | Gebot · Kader · Aufstellung | the [bid dialog](market.md#the-bid-dialog)'s *Durchrechnen* |
| `/squad/whatif` | *What if I sold them?* | Kader · Aufstellung | **⚗ Szenario** on the [Kader toolbar](squad.md#was-wäre-wenn--the-sale-scenario) |

**The second is the first minus its target.** One component, one set of state,
one subtraction: no player on the bench who is not yet yours, no *Gebot* tab,
no bid term in the projection. Everything else — marking players as sold, the
sandbox pitch the sales empty, the swap dialog, the legend, the ✗ — is the same
code with one fewer thing in it. The sale scenario is written up at the
[end of this page](#the-sale-scenario); everything between here and there
describes the purchase, which is the fuller of the two.

## What it does

One player, and the squad rearranged around buying him.

A bid is three questions, and the [bid dialog](market.md#the-bid-dialog) could
only ask the first:

| Question | Where it is answered |
| -------- | -------------------- |
| What will I pay? | *Gebot* — the dialog's own fields, on a page |
| Can I afford it? | *Kader* — mark the players you would sell to fund it |
| Is he worth it? | *Aufstellung* — put him in the eleven and see who leaves |

The answers move each other, which is why they are on one page: a sale raises
the budget the bid is spent from, and a purchase only earns its fee if it
changes the XI. The figure that ties them together sits **above the tabs** —
the budget as it would stand once the transfer went through — on every view
except the pitch, which wants the height and changes nothing about the money.

**It pins.** A squad of twenty is a page you scroll, and the answer has to stay
legible while you are marking the eleventh player at the bottom of it; a total
you have to scroll back up to read is one you stop consulting. It sticks at
`--header-total`, the same offset as the squad page's
[sale calculator](squad.md#sale-calculator) bar and for the same reason. The
block bleeds `-mx-3` to the column's edges and carries a canvas band of its own
so that nothing shows through the card's rounded corners as rows pass behind
it; the band's `pb-4` is cancelled by `-mb-4`, so it takes up exactly the
height it did before it pinned.

The header carries the **player's portrait**, flush on the left over its full
height with the wash and the fading inner edge every list in the app draws a
player with: a page about buying one man should show which one, and a name in a
subtitle is the weakest way to do it. It is why the heading is a bordered block
rather than the app's plain `PageHeading` — a portrait bled to an edge needs an
edge to bleed to.

Reached from the **calculator button** (*Durchrechnen*) in the bid dialog,
which navigates with `replace`, so the page it opens is what a back press
leaves rather than the sheet it was opened from. The player is in the path and
**required**: there is no scenario without a target.

**`?bid=` carries the figure over.** Whatever was already typed into the dialog
seeds the field here, so crossing to the page is not a retype. It is an initial
value and nothing more — the field takes it at mount and the query is never
written again, because a URL that tracked every keystroke would put a history
entry behind each one. Absent or not a number, the amount falls back to the
listing's baseline exactly as the dialog's does.

## The bids already standing

A manager with three live bids does not have the budget the app prints for him.
He has that budget minus three purchases that could all land tonight — so the
scenario counts them, and says so on a switch in the header:

```
┌──────┬──────────────────────────────────┐
│      │ Was wäre wenn                [✕] │
│ img  │ Kevin Behrens                    │
├──────┴──────────────────────────────────┤
│ ⚖  3 offene Gebote angenommen  −12,4 Mio│ ●───
└─────────────────────────────────────────┘
```

**On by default**, because that is the honest reading of *what if*; switchable,
because the opposite reading is honest too — bids are lost far more often than
they are won, and a scenario that insisted on counting them would be a
different kind of wrong. The row is absent entirely when no bid is standing,
which is most of the time.

It moves **two things**:

- the **projection**, which loses `Σ ownOffer` and says so in its working:
  *3 offene Gebote −12,4 Mio.*, a separate term from the *Gebot* being typed on
  the offer tab;
- the **squad**, because the players would arrive. They go to the
  [Aufstellung](#aufstellung) tab's bench — benched, like the target, since a
  bid that has not been accepted has not picked itself — and **not** to the
  [Kader](#kader) list, whose every row is a player you could sell and none of
  these is yours yet.

They are built from the **market listing** rather than a detail request each. A
market row already carries the name, the portrait, the club, the availability
mark and the lineup probability, which is everything the pitch draws; what it
cannot say is points, and the pitch never asks.

**It does not move the rules.** `committedElsewhere` — what the offer tab's
ceiling is measured against — stays the full sum whatever the switch says,
because Kickbase counts every live bid against the 33 % ceiling whether or not
this page is imagining them accepted. A rule that moved with a checkbox would
be a rule about the checkbox. Same principle as
[the rules are the real ones](#nothing-happens-here-except-the-bid) below.

The switch lives in the **header** rather than in the budget block it is
mostly arithmetic for, because it is the only control every tab is subject to —
and the budget block is not drawn on the pitch, which is where its players
appear.

## Nothing happens here, except the bid

The sales are **hypothetical**. Nobody is sold, no `POST` is sent, the squad
and the budget are untouched. Marking a player is a set of ids in memory.

The lineup is hypothetical too, and it is the one that needed saying in code:
the editor runs as a **sandbox** — `useLineupEditor({ persist: false })`, see
[`useLineupEditor`](../../src/components/squad/useLineupEditor.ts) — because an
eleven built around a player you do not own is not a lineup any server would
accept. Without that flag the page would quietly post the scenario over the
manager's real lineup on a 600 ms debounce.

The **bid is real** and is the only thing on the page that is. *Bieten* /
*Gebot ändern* fires `POST …/offers` and *Gebot zurückziehen* fires the
`DELETE`, both the market's own mutations, unchanged. The asymmetry is the
point: the scenario exists to be *decided*, and the decision is the bid.

**The overdraft is named, not implied.** Kickbase lends against team value and
charges interest on the overdraft, so a negative budget is a normal state and
the projection takes **three** colours rather than two: green while the
purchase fits, amber while it borrows, red past `floor(teamValue × 0.33)` where
the bid would be refused outright. Under the figure sits the allowance itself —
*Minus möglich bis −32,9 Mio. (33 % vom Teamwert)* — and beside it what the
ceiling leaves for this player once every other standing bid is counted. Same
rule from the two ends a manager thinks about it from: how deep may I go, and
what may I write in the field. Both lines are absent when team value is
unknown, which is the only honest thing to say then.

The same allowance line is now under the field in the
[bid dialog](market.md#the-bid-dialog) too, for the reader who never opens this
page: *Erlaubt … – 34.000.000 €* on a budget of two million is unreadable
without it.

**The rules are the real ones.** The 90 % floor, the league's underpay setting
and the 33 % ceiling — see [what Kickbase refuses](market.md#what-kickbase-refuses)
— are checked against the budget and team value **as they stand**, not as the
scenario imagines them. Kickbase would refuse a bid funded by a sale that has
not happened, and a submit button that let one through would be lying about
which of the two figures on screen the server reads. So both are visible: the
projected budget is what the manager is planning with, and the field's own hint
is what the server will allow.

## One scenario, three tabs

**Head tabs**, not the bottom bar the [squad](squad.md) and
[market](market.md#the-selling-side-when-there-is-one--gebote) pages use. Those
switch between views of data that is simply there; these three are steps in one
piece of work, and the state they share *is* the work. They also sit directly
under the figure they all change.

Radix unmounts the tab that is not showing, so none of the state can live in a
tab. Three pieces of it, held by the page:

- the **bid**, typed on one tab and felt on the budget line above the others;
- the **sales**, marked on the Kader and paid into that same line;
- the **lineup**, which the sales take players out of and the purchase adds one
  to.

### Gebot

The bid dialog's contents, on a page:
[`OfferFields`](../../src/components/market/OfferFields.tsx) is shared between
the two so there is one implementation of the field, its bounds, the
market-value difference and the ± shortcuts. What differs is the frame and the
buttons — and where the withdraw lives: the dialog puts it as an ✗ on the field
it undoes, the page has room for a labelled *Gebot zurückziehen*.

**Every exit is a back press.** *Bieten*, *Gebot zurückziehen* and *Abbrechen*
all `navigate(-1)`, landing on the market the dialog was opened from, as does
the ✗ in the page heading. The scenario is memory only, so a forward press
builds a **fresh** one out of whatever the squad and the market then say — the
sales it imagined are not waiting to be re-imagined.

### Kader

The squad page's own list ([`PlayerListTab`](../../src/components/squad/PlayerListTab.tsx))
in **calculator mode, permanently**: `forSale` is never `null` here, so the
mode never has to be entered — the page *is* the mode. A tap on any row marks
that player as sold in this scenario; the row takes the accent outline the sale
calculator uses.

The **target is not in this list.** Every row here is a player you could sell,
and he is the one you are buying — he appears where that means something, on
the bench of the third tab. (He carries one placeholder figure wherever he is
drawn, a profit of `±0`, because there is no purchase price to be up or down on
yet.)

### Aufstellung

The pitch ([`LineupTab`](../../src/components/squad/LineupTab.tsx)), seeded from
the real `lo` slots — so it opens on the eleven that is actually fielded — and
fed the squad **minus** whoever the Kader tab has sold. Two consequences, both
of them the reason the tabs are on one page:

- a player marked for sale **leaves the pitch** the moment he is marked, and is
  not on the bench either;
- the **target is available**, benched, and can be brought on like anyone else
  — including through the swap dialog when his position is full.

The formation rules, the incomplete-lineup penalty and the swap dialog are the
squad page's, unchanged. The one thing missing is the *Speichern …* line, and
that is the sandbox: there is nothing to save. The projected-budget block is
gone from this tab as well — the pitch sizes itself down to the window, and
those were four lines of height taken from the view that has least of it.

## The sale scenario

`/leagues/:leagueId/squad/whatif`. **Nothing is being bought, so nothing on the
page is real** — which makes it the one version of this page with no `POST` on
it anywhere. The only conclusions are the ✗ and the back gesture.

It exists because the [sale calculator](squad.md#sale-calculator) on the squad
page answers half the question. *What would I have* is arithmetic it can do in
its own header bar. *Who would I be fielding* needs the pitch, a bench the sold
players have left, and a lineup editor that saves nothing — and that is a page
rather than a mode, which is why the flask is a link.

What differs from the purchase, and nothing else does:

- **No *Gebot* tab**, and the scenario opens on the Kader rather than on it.
- **The header carries no portrait.** A sale scenario is about the squad, and
  the squad has no one face; the subtitle reads *Verkäufe, durchgerechnet*.
- **The projection loses its bid.** The label is *Budget nach den Verkäufen*,
  the working is the budget and the proceeds, and the overdraft lines are gone
  with the bid — selling only ever moves a budget upwards, so there is no floor
  to warn about. Before anything is marked the working says *Spieler zum
  Verkaufen antippen*, the same nudge the sale calculator puts under its own
  total, so a figure that equals the budget does not read as a page that failed
  to load.
- **Unless bids are standing**, which is the one thing that spends money here.
  With the [offers switch](#the-bids-already-standing) on, the label becomes
  *Budget nach den Transfers* and the overdraft allowance comes back — the
  *Gebot höchstens* half of that line does not, since there is no bid to bound.
- **The market is not waited for.** The listing and the team value are the
  purchase's business; this scenario needs the squad and the budget, which it
  already has, so it renders as soon as they land.

The Kader tab is the same permanently-on calculator, the Aufstellung tab the
same sandbox pitch, and a player marked on the one leaves the other the moment
he is marked. That last sentence is the whole feature.

## Not built

**The scenario is not shareable and does not survive a refresh.** The target is
in the URL and so is the opening bid; the sales and the arranged XI are not. Putting them there would
mean a query string long enough to be its own bug, and the page is a decision
taken in one sitting.

**Team value does not move with the sales.** The 33 % ceiling is computed from
team value as it stands, which is the honest thing for a *rule*, but it means
the ceiling shown does not reflect a scenario that sells half the squad. That
is the same conservatism the rules paragraph above describes, noted here
because it is the one figure a manager might expect the scenario to move.
