import { AlertTriangle } from 'lucide-react'
import { useCallback, useState, type ReactNode } from 'react'

import {
  useListPlayer,
  useWithdrawListing,
  useAcceptOffer,
  useDeclineOffer,
} from '@/api/hooks/useMarketListing'
import { useSellPlayers } from '@/api/hooks/useSellPlayers'
import type { PlayerListingOffer } from '@/api/models'
import { Avatar } from '@/components/ui/Avatar'
import { AmountRoundUp, AmountSteps } from '@/components/ui/AmountSteps'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { HoldButton } from '@/components/ui/HoldButton'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/cn'
import { money, moneyDeltaExact, moneyExact } from '@/lib/format'
import { checkAskingPrice } from '@/lib/offerRules'

/**
 * The three ways a player leaves a squad, as dialogs.
 *
 * One file, because they are one decision seen from three sides — sell him to
 * Kickbase at the market value, ask the league for a price of your own, or take
 * what somebody has bid — and because two of the three are the same shell with
 * a different figure in it.
 *
 * **Two of them are held, not tapped.** Selling and accepting cannot be undone:
 * the player is gone, and buying him back costs whatever the market then
 * charges. That is what [`HoldButton`](../ui/HoldButton.tsx) exists for, and it
 * is the same treatment the [squad's sale dialog](../squad/SellDialog.tsx)
 * gives a multiple sale. Listing is a plain tap — it commits nothing and is
 * withdrawn from the same dialog.
 */

/** The player a dialog is about — as little of him as the copy needs. */
export interface SaleSubject {
  id: string
  /** Displayed name, and what a failure is reported by. */
  name: string
  marketValue: number
}

/**
 * Sell to Kickbase, at the market value, for good.
 *
 * The squad page sells a **selection** and lists it by name; here there is one
 * player and the page behind the dialog is already about him, so the figure is
 * the whole content. `useSellPlayers` is the same mutation either way — a
 * one-element list is a list.
 */
export function SellToKickbaseDialog({
  player,
  leagueId,
  onClose,
  onSold,
}: {
  player: SaleSubject
  leagueId: string
  onClose: () => void
  onSold: () => void
}) {
  const sell = useSellPlayers(leagueId)

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open && !sell.isPending) onClose()
      }}
      title={`${player.name} verkaufen`}
      description={
        <span>
          Erlös <span className="nums">{moneyExact(player.marketValue)}</span>
        </span>
      }
      confirmLabel="Verkaufen"
      onConfirm={onClose}
      error={sell.error?.message ?? null}
      confirmSlot={
        sell.isPending ? (
          <Button fullWidth isLoading>
            Verkaufen
          </Button>
        ) : (
          <HoldButton
            label="Halten zum Verkaufen"
            onComplete={() => {
              sell.mutate([{ id: player.id, name: player.name }], {
                onSuccess: onSold,
              })
            }}
          />
        )
      }
    >
      <FinalWarning>
        Verkauf an Kickbase zum Marktwert. Das lässt sich nicht rückgängig
        machen.
      </FinalWarning>
    </ConfirmDialog>
  )
}

/**
 * Put him up for a price of your own — or take the listing back down.
 *
 * The amount starts at the standing asking price, or at the market value when
 * there is no listing yet, so the default action is "offer him at what he is
 * worth". The [shortcut rows](../ui/AmountSteps.tsx) are the market's, down to
 * the hold-to-repeat, with a
 * [round-up row](../ui/AmountSteps.tsx) above them: an asking price is a number
 * the seller picks out of the air, and the ones people pick are round.
 *
 * **Re-listing is how a price is changed.** Kickbase re-prices a standing
 * listing on a second `POST` rather than refusing it, so *Preis ändern* is the
 * same call as *Auf den Markt* and there is no withdraw-then-relist dance.
 *
 * **What Kickbase refuses here is almost nothing** — see
 * [`checkAskingPrice`](../../lib/offerRules.ts). The 90 % floor and the 33 %
 * ceiling are rules about *bidding*; a seller may ask what he likes, and a
 * price under the market value gets a note rather than a block, because
 * underselling to a particular manager is a real move in a league that trades.
 *
 * **Withdrawing is a second, quieter action** at the foot of the dialog rather
 * than a third button on the page. It belongs to the listing, it only exists
 * while there is one, and standing bids go with it.
 */
export function ListPlayerDialog({
  player,
  askingPrice,
  leagueId,
  onClose,
}: {
  player: SaleSubject
  /** The price he stands at now, or `undefined` when he is not listed. */
  askingPrice: number | undefined
  leagueId: string
  onClose: () => void
}) {
  const list = useListPlayer(leagueId)
  const withdraw = useWithdrawListing(leagueId)

  // Text, not a number: a controlled number input that coerces on every
  // keystroke cannot be cleared to retype, which is exactly what someone
  // adjusting a seven-digit figure wants to do.
  const [amount, setAmount] = useState(() =>
    String(askingPrice ?? player.marketValue),
  )

  // Functional and stable: a held shortcut installs one interval, and a delta
  // applied to the amount captured at press time would add the same step to
  // the same number for as long as the finger stayed down.
  const stepBy = useCallback((delta: number) => {
    setAmount((current) => {
      const parsed = Number(current)
      return String(Math.max(0, (Number.isFinite(parsed) ? parsed : 0) + delta))
    })
  }, [])

  // A destination rather than a delta, so it reads the field instead of adding
  // to it: the next whole million or hundred thousand at or above the figure
  // standing there. Stable for the same reason `stepBy` is.
  const roundUpTo = useCallback((unit: number) => {
    setAmount((current) => {
      const parsed = Number(current)
      const from = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
      return String(Math.ceil(from / unit) * unit)
    })
  }, [])

  const value = Number(amount)
  const verdict = checkAskingPrice(value, player.marketValue)
  const isBusy = list.isPending || withdraw.isPending
  const error = list.error ?? withdraw.error

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open && !isBusy) onClose()
      }}
      title={player.name}
      description={
        <span>
          Marktwert{' '}
          <span className="nums">{moneyExact(player.marketValue)}</span>
        </span>
      }
      confirmLabel={askingPrice === undefined ? 'Anbieten' : 'Preis ändern'}
      onConfirm={() => {
        if (!verdict.isAllowed) return
        list.mutate(
          { playerId: player.id, price: value },
          { onSuccess: onClose },
        )
      }}
      isBusy={isBusy}
      isConfirmDisabled={!verdict.isAllowed}
      error={error?.message ?? null}
    >
      <div className="flex flex-col gap-2">
        <Input
          label="Preis in €"
          // `inputMode` rather than `type="number"`: the numeric keypad
          // without the spinner arrows, which step by one and are useless at
          // this scale.
          inputMode="numeric"
          className="nums"
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value.replace(/\D/g, ''))
          }}
          error={verdict.problem}
          hint={
            verdict.note !== undefined ? (
              <span className="nums text-warning">{verdict.note}</span>
            ) : (
              <span className="nums">
                Andere Manager bieten mit, mindestens 90 % des Marktwerts.
              </span>
            )
          }
        />

        <AmountRoundUp onRoundUp={roundUpTo} />

        <AmountSteps onStep={stepBy} />

        {askingPrice !== undefined && (
          <Button
            variant="secondary"
            fullWidth
            disabled={isBusy}
            onClick={() => {
              withdraw.mutate({ playerId: player.id }, { onSuccess: onClose })
            }}
          >
            Vom Markt nehmen
          </Button>
        )}
      </div>
    </ConfirmDialog>
  )
}

/**
 * Take one manager's bid.
 *
 * The same shell as the sale to Kickbase, because it is the same act with a
 * different counterparty: the figure is what *they* offered rather than the
 * market value, the manager is named, and the line under it says how the two
 * compare — which is the only question worth asking before accepting.
 *
 * **Above the market value is green here.** On the [transfer
 * list](./PlayerTransfersTab.tsx) the colour follows the acting manager's side,
 * and the acting manager is the seller: being paid over the odds is the good
 * outcome.
 *
 * **Two answers, and they are not the same weight.** Accepting is held;
 * declining is a plain button that asks a second question. Nothing changes
 * hands when a bid is turned down — the player stays yours and the listing
 * stays up — so a hold would be theatre, but it is still somebody's bid being
 * thrown away, which is more than a single tap should be able to do by
 * accident.
 *
 * **The second question takes the action row over.** Once *Ablehnen* is
 * pressed, the accept and the cancel go and the row asks the one thing that is
 * now open — see [`actionsSlot`](../ui/ConfirmDialog.tsx). Leaving them in
 * place would put three conclusions on screen for a yes-or-no question, and
 * *Annehmen* is the last one that should be within reach of a thumb aiming at
 * *Ablehnen*. Backing out returns to the bid, rather than closing the dialog:
 * the answer to "are you sure?" is about the decline, not about being here.
 *
 * Neither success path has **ever been fired** against a real bid — see
 * [`useAcceptOffer`](../../api/hooks/useMarketListing.ts). The hold is the
 * right control for accepting on its own merits, and doubly so while the
 * request is the one thing here nobody has watched work.
 */
export function AcceptOfferDialog({
  player,
  offer,
  leagueId,
  onClose,
  onAccepted,
}: {
  player: SaleSubject
  offer: PlayerListingOffer
  leagueId: string
  onClose: () => void
  onAccepted: () => void
}) {
  const accept = useAcceptOffer(leagueId)
  const decline = useDeclineOffer(leagueId)
  // Whether the second question is on screen. Not a separate dialog: the bid
  // it is about — who made it, and how it compares — is what the reader needs
  // in front of them to answer it.
  const [isDeclining, setIsDeclining] = useState(false)
  const premium = offer.amount - player.marketValue
  const isBusy = accept.isPending || decline.isPending

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open && !isBusy) onClose()
      }}
      title={`${player.name} verkaufen`}
      description={
        <span className="flex flex-col gap-0.5">
          <span>
            Gebot <span className="nums">{moneyExact(offer.amount)}</span>
          </span>
          <span>
            Marktwert{' '}
            <span className="nums">{moneyExact(player.marketValue)}</span>{' '}
            <span
              className={cn(
                'nums',
                premium > 0 && 'text-positive',
                premium < 0 && 'text-negative',
                premium === 0 && 'text-faint',
              )}
            >
              ({moneyDeltaExact(premium)})
            </span>
          </span>
        </span>
      }
      confirmLabel="Annehmen"
      onConfirm={onClose}
      error={(accept.error ?? decline.error)?.message ?? null}
      confirmSlot={
        accept.isPending ? (
          <Button fullWidth isLoading>
            Annehmen
          </Button>
        ) : (
          <HoldButton
            label="Halten zum Annehmen"
            onComplete={() => {
              accept.mutate(
                { playerId: player.id, offerId: offer.id },
                { onSuccess: onAccepted },
              )
            }}
          />
        )
      }
      actionsSlot={
        isDeclining ? (
          <div className="flex flex-col gap-3">
            {/* The line is the point at which the dialog stopped being about
                the bid and started being about one answer to it. */}
            <span aria-hidden="true" className="h-px bg-line" />
            <p className="text-sm leading-snug text-ink">
              Gebot von{' '}
              <span className="font-semibold">
                {offer.managerName ?? 'diesem Manager'}
              </span>{' '}
              wirklich ablehnen?
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                fullWidth
                disabled={decline.isPending}
                onClick={() => {
                  setIsDeclining(false)
                }}
              >
                Abbrechen
              </Button>
              <Button
                variant="danger"
                fullWidth
                isLoading={decline.isPending}
                onClick={() => {
                  decline.mutate(
                    { playerId: player.id, offerId: offer.id },
                    { onSuccess: onClose },
                  )
                }}
              >
                Ablehnen
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-card border border-line bg-surface-2/40 px-3 py-2.5">
          <Avatar src={offer.managerImage} name={offer.managerName} size={28} />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
            {offer.managerName ?? 'Unbekannt'}
          </span>
          <span className="nums shrink-0 text-sm font-semibold text-ink">
            {money(offer.amount)}
          </span>
        </div>

        {/* Declining is the quieter of the two answers, so it sits below the
            bid rather than in the action row — the same place the listing
            dialog keeps *Vom Markt nehmen*. Pressed, it takes the row over,
            and takes its own trigger with it: the question underneath is the
            only thing left to answer. */}
        {!isDeclining && (
          <Button
            variant="ghost"
            fullWidth
            disabled={accept.isPending}
            onClick={() => {
              setIsDeclining(true)
            }}
          >
            Gebot ablehnen
          </Button>
        )}
      </div>
    </ConfirmDialog>
  )
}

/** The line above a hold button, saying what cannot be taken back. */
function FinalWarning({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs leading-snug text-warning">
      <AlertTriangle size={14} aria-hidden="true" className="mt-px shrink-0" />
      <span>{children}</span>
    </p>
  )
}
