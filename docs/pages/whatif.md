# Was wäre wenn — the purchase calculator

[← Back to index](../README.md) · Route
`/leagues/:leagueId/whatif/:playerId` ·
[`src/pages/WhatIfPage.tsx`](../../src/pages/WhatIfPage.tsx)

**Status: implemented.**

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
changes the XI. The figure that ties them together sits **above all three
tabs** — the budget as it would stand once the transfer went through.

Reached from the **calculator button** (*Durchrechnen*) in the bid dialog,
which navigates with `replace`, so the page it opens is what a back press
leaves rather than the sheet it was opened from. The player is in the path and
**required**: there is no scenario without a target.

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

The **target is in this list too**, because he is part of the scenario — but
tapping him does nothing: he is what is being bought, not something to sell.
His row carries one placeholder figure, a profit of `±0`, because there is no
purchase price to be up or down on yet.

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
that is the sandbox: there is nothing to save.

## Not built

**The scenario is not shareable and does not survive a refresh.** The target is
in the URL; the sales and the arranged XI are not. Putting them there would
mean a query string long enough to be its own bug, and the page is a decision
taken in one sitting.

**Team value does not move with the sales.** The 33 % ceiling is computed from
team value as it stands, which is the honest thing for a *rule*, but it means
the ceiling shown does not reflect a scenario that sells half the squad. That
is the same conservatism the rules paragraph above describes, noted here
because it is the one figure a manager might expect the scenario to move.
