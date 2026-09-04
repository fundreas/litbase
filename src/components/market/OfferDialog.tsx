import { X } from 'lucide-react'
import { useState } from 'react'

import { usePlaceOffer, useWithdrawOffer } from '@/api/hooks/useMarketOffers'
import { offerBaseline, type MarketListing } from '@/api/models'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/cn'
import { money, moneyExact } from '@/lib/format'

/**
 * The steps the shortcut row offers, coarsest first so the two rows line up
 * column by column.
 *
 * A hundred thousand is the unit market values actually move in overnight; a
 * thousand is haggling range; one euro exists because a tie goes to the higher
 * bid, and outbidding someone by a single euro is a real move.
 */
const STEPS = [100_000, 1_000, 1] as const

/** `+100k`, `−1k`, `+1` — compact enough for a six-button grid. */
function stepLabel(amount: number, sign: 1 | -1): string {
  const prefix = sign > 0 ? '+' : '−'
  if (amount >= 1_000) return `${prefix}${String(amount / 1_000)}k`
  return `${prefix}${String(amount)}`
}

/**
 * Bid on a listing, or take a standing bid back.
 *
 * The amount starts at {@link offerBaseline} — the asking price, or your own
 * offer if one already stands — so the default action is "buy it at the number
 * on the row", and everything else is an adjustment from there.
 *
 * **Three ways out, and they are genuinely different.** *Abbrechen* closes the
 * dialog and changes nothing. *Bieten* writes the amount in the field. The
 * **X** beside the title withdraws the offer that is already standing, and
 * only appears when there is one — it is destructive, and sits deliberately
 * away from the thumb path of the other two.
 *
 * Mount it with `key={listing.id}`: the amount is seeded once, at mount, and a
 * component per listing is what keeps a market refetch — every thirty seconds,
 * on a page whose rows are all moving — from overwriting a half-typed figure.
 */
export function OfferDialog({
  listing,
  leagueId,
  budget,
  onClose,
}: {
  listing: MarketListing
  leagueId: string | undefined
  /** The manager's budget, for the affordability check. */
  budget: number
  onClose: () => void
}) {
  const placeOffer = usePlaceOffer(leagueId)
  const withdrawOffer = useWithdrawOffer(leagueId)

  // Text, not a number: a controlled number input that coerces on every
  // keystroke cannot be cleared to retype, which is exactly what someone
  // adjusting a seven-digit figure wants to do.
  const [amount, setAmount] = useState(() => String(offerBaseline(listing)))

  const value = Number(amount)
  const isValid = Number.isFinite(value) && value > 0
  const isAffordable = value <= budget
  const isBusy = placeOffer.isPending || withdrawOffer.isPending
  const error = placeOffer.error ?? withdrawOffer.error
  const { ownOffer, ownOfferId } = listing

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={`${listing.firstName ?? ''} ${listing.lastName}`.trim()}
      description={
        <span className="flex flex-col gap-0.5">
          <span>
            Marktwert{' '}
            <span className="nums">{moneyExact(listing.marketValue)}</span>
          </span>
          <span>
            {ownOffer === undefined
              ? `Aufgerufen ${moneyExact(listing.price)}`
              : `Dein Gebot ${moneyExact(ownOffer)}`}
          </span>
        </span>
      }
      confirmLabel={ownOffer === undefined ? 'Bieten' : 'Gebot ändern'}
      onConfirm={() => {
        if (!isValid || !isAffordable) return
        placeOffer.mutate(
          { playerId: listing.id, price: value },
          { onSuccess: onClose },
        )
      }}
      isBusy={isBusy}
      isConfirmDisabled={!isValid || !isAffordable}
      error={error?.message ?? null}
      headerAction={
        ownOfferId === undefined ? undefined : (
          <button
            type="button"
            disabled={isBusy}
            title="Gebot zurückziehen"
            aria-label="Gebot zurückziehen"
            onClick={() => {
              withdrawOffer.mutate(
                { playerId: listing.id, offerId: ownOfferId },
                { onSuccess: onClose },
              )
            }}
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
              'border border-negative/30 bg-negative/10 text-negative',
              'transition-colors hover:bg-negative/25',
              'disabled:pointer-events-none disabled:opacity-50',
            )}
          >
            <X size={18} aria-hidden="true" />
          </button>
        )
      }
    >
      <div className="flex flex-col gap-2">
        <Input
          label="Gebot in €"
          // `inputMode` rather than `type="number"`: the numeric keypad
          // without the spinner arrows, which step by one and are useless at
          // this scale.
          inputMode="numeric"
          className="nums"
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value.replace(/\D/g, ''))
          }}
          error={isAffordable ? undefined : 'Mehr als dein Budget.'}
          hint={<span className="nums">Budget {money(budget)}</span>}
        />

        <div className="grid grid-cols-3 gap-2">
          {([1, -1] as const).map((sign) =>
            STEPS.map((step) => (
              <button
                key={`${String(sign)}-${String(step)}`}
                type="button"
                onClick={() => {
                  setAmount(
                    String(
                      Math.max(
                        0,
                        (Number.isFinite(value) ? value : 0) + sign * step,
                      ),
                    ),
                  )
                }}
                /* Direction is carried by the border, not by a fill: six
                   solid green and red blocks would read as six warnings, and
                   these are the least consequential controls in the dialog —
                   nothing is written until *Bieten*. A tinted edge and the
                   sign are enough to tell the rows apart at a glance. */
                className={cn(
                  'nums h-10 rounded-xl border text-sm font-semibold',
                  'bg-surface transition-colors',
                  sign > 0
                    ? 'border-positive/40 text-positive hover:border-positive hover:bg-positive/10'
                    : 'border-negative/40 text-negative hover:border-negative hover:bg-negative/10',
                )}
              >
                {stepLabel(step, sign)}
              </button>
            )),
          )}
        </div>
      </div>
    </ConfirmDialog>
  )
}
