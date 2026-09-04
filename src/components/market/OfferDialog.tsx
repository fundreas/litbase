import { TrendingDown, TrendingUp, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { usePlaceOffer, useWithdrawOffer } from '@/api/hooks/useMarketOffers'
import { offerBaseline, type MarketListing } from '@/api/models'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/cn'
import { money, moneyDelta, moneyExact } from '@/lib/format'

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

/** How long a button must be held before it starts repeating, and how fast. */
const HOLD_DELAY_MS = 400
const REPEAT_MS = 60

/**
 * Press-and-hold to repeat, the way a held keyboard key behaves.
 *
 * `+1` exists to outbid someone by a euro, but reaching a five-figure
 * adjustment a euro per tap is not a thing anyone should be asked to do — so
 * holding the button keeps it firing. The pause before the repeat starts is
 * what keeps a single deliberate tap from becoming three.
 *
 * The step is read through a ref: the interval is installed once per press,
 * and the closure it captured would otherwise keep adding to the amount the
 * field held when the finger went down.
 */
function useHoldRepeat(onStep: () => void) {
  const step = useRef(onStep)
  useEffect(() => {
    step.current = onStep
  })

  const timers = useRef<{
    delay?: ReturnType<typeof setTimeout>
    repeat?: ReturnType<typeof setInterval>
  }>({})
  // A pointer press already fired on `pointerdown`; the `click` that follows
  // it must not fire again. Keyboard activation has no pointer event, so the
  // same `click` is exactly how Enter and Space get their turn.
  const wasPointer = useRef(false)

  const stop = useCallback(() => {
    clearTimeout(timers.current.delay)
    clearInterval(timers.current.repeat)
    timers.current = {}
  }, [])

  useEffect(() => stop, [stop])

  const start = useCallback(() => {
    wasPointer.current = true
    step.current()
    timers.current.delay = setTimeout(() => {
      timers.current.repeat = setInterval(() => {
        step.current()
      }, REPEAT_MS)
    }, HOLD_DELAY_MS)
  }, [])

  return {
    onPointerDown: start,
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onClick: () => {
      if (wasPointer.current) {
        wasPointer.current = false
        return
      }
      step.current()
    },
  }
}

/** One shortcut button. Its own component so the hold-repeat state is its own. */
function StepButton({
  amount,
  sign,
  onStep,
}: {
  amount: number
  sign: 1 | -1
  onStep: (delta: number) => void
}) {
  const handlers = useHoldRepeat(() => {
    onStep(sign * amount)
  })

  return (
    <button
      type="button"
      {...handlers}
      /* Direction is carried by the border, not by a fill: six solid green and
         red blocks would read as six warnings, and these are the least
         consequential controls in the dialog — nothing is written until
         *Bieten*. A tinted edge and the sign are enough to tell the rows
         apart at a glance. */
      className={cn(
        'nums h-10 rounded-xl border text-sm font-semibold select-none',
        'bg-surface transition-colors',
        // Holding is a gesture, and a text cursor mid-hold looks like a bug.
        'touch-none',
        sign > 0
          ? 'border-positive/40 text-positive hover:border-positive hover:bg-positive/10'
          : 'border-negative/40 text-negative hover:border-negative hover:bg-negative/10',
      )}
    >
      {stepLabel(amount, sign)}
    </button>
  )
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
 * **X** at the end of the field withdraws the offer that is already standing,
 * and only appears when there is one — it acts on the amount it sits next to,
 * which is why it belongs there rather than among the two conclusions.
 *
 * Mount it with `key={listing.id}`: the amount is seeded once, at mount, and a
 * component per listing is what keeps a market refetch — every thirty seconds,
 * on a page whose rows are all moving — from overwriting a half-typed figure.
 */
export function OfferDialog({
  listing,
  leagueId,
  budget,
  marketValueChange,
  onClose,
}: {
  listing: MarketListing
  leagueId: string | undefined
  /** The manager's budget, for the affordability check. */
  budget: number
  /** Market-value move over the last 24 hours, if it has landed. */
  marketValueChange: number | undefined
  onClose: () => void
}) {
  const placeOffer = usePlaceOffer(leagueId)
  const withdrawOffer = useWithdrawOffer(leagueId)

  // Text, not a number: a controlled number input that coerces on every
  // keystroke cannot be cleared to retype, which is exactly what someone
  // adjusting a seven-digit figure wants to do.
  const [amount, setAmount] = useState(() => String(offerBaseline(listing)))

  // Functional, and stable across renders: a held button installs one interval
  // and fires it repeatedly, so a delta applied to the amount captured at
  // press time would add the same step to the same number for as long as the
  // finger stayed down.
  const stepBy = useCallback((delta: number) => {
    setAmount((current) => {
      const parsed = Number(current)
      return String(Math.max(0, (Number.isFinite(parsed) ? parsed : 0) + delta))
    })
  }, [])

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
          <span className="flex flex-wrap items-center gap-x-2">
            <span>
              Marktwert{' '}
              <span className="nums">{moneyExact(listing.marketValue)}</span>
            </span>
            <MarketValueChange amount={marketValueChange} />
          </span>
          {/* The asking price only earns a line when it is **not** the market
              value. On a computer listing the two are always the same number,
              and printing it twice under two names invites the reader to look
              for a difference that is not there. */}
          {listing.price !== listing.marketValue && (
            <span>
              Aufgerufen{' '}
              <span className="nums">{moneyExact(listing.price)}</span>
            </span>
          )}
          {ownOffer !== undefined && (
            <span className="text-accent">
              Dein Gebot <span className="nums">{moneyExact(ownOffer)}</span>
            </span>
          )}
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
          /* Withdrawing sits **on the field it undoes**, at the end of the
             amount it would erase. It is not one of the dialog's two
             conclusions — it is what you do to the offer itself — and it only
             exists while there is an offer to take back. */
          trailing={
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
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                  'border border-negative/30 bg-negative/10 text-negative',
                  'transition-colors hover:bg-negative/25',
                  'disabled:pointer-events-none disabled:opacity-50',
                )}
              >
                <X size={18} aria-hidden="true" />
              </button>
            )
          }
        />

        <div className="grid grid-cols-3 gap-2">
          {([1, -1] as const).map((sign) =>
            STEPS.map((step) => (
              <StepButton
                key={`${String(sign)}-${String(step)}`}
                amount={step}
                sign={sign}
                onStep={stepBy}
              />
            )),
          )}
        </div>
      </div>
    </ConfirmDialog>
  )
}

/** The overnight move, beside the market value it moved. */
function MarketValueChange({ amount }: { amount: number | undefined }) {
  if (amount === undefined || amount === 0) return null
  const Icon = amount < 0 ? TrendingDown : TrendingUp

  return (
    <span
      className={cn(
        'nums inline-flex items-center gap-0.5',
        amount > 0 ? 'text-positive' : 'text-negative',
      )}
      title="Marktwertänderung in den letzten 24 Stunden"
    >
      <Icon size={12} aria-hidden="true" />
      {moneyDelta(amount)}
      <span className="sr-only"> in den letzten 24 Stunden</span>
    </span>
  )
}
