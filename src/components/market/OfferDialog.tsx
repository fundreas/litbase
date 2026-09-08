import { TrendingDown, TrendingUp, X } from 'lucide-react'
import { useCallback, useState } from 'react'

import { usePlaceOffer, useWithdrawOffer } from '@/api/hooks/useMarketOffers'
import { offerBaseline, type MarketListing } from '@/api/models'
import { AmountSteps } from '@/components/ui/AmountSteps'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/cn'
import { money, moneyDelta, moneyDeltaExact, moneyExact } from '@/lib/format'
import {
  checkOffer,
  maximumOffer,
  minimumOffer,
  type OfferRules,
} from '@/lib/offerRules'

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
 * **What Kickbase would refuse, the button refuses first.** The three rules in
 * [`offerRules.ts`](../../lib/offerRules.ts) — the league's underpay setting,
 * the 90 % floor, the 33 % debt ceiling — are checked against every keystroke:
 * the reason appears under the field and *Bieten* goes dead. Two of them are
 * arithmetic on numbers already on screen, and the third counts every bid
 * standing on every other listing, which is not something anyone tracks. A
 * bid that was legal at render time and is not by the time it is sent still
 * comes back as a mapped server error — see [`errors.ts`](../../api/errors.ts).
 *
 * Mount it with `key={listing.id}`: the amount is seeded once, at mount, and a
 * component per listing is what keeps a market refetch — every thirty seconds,
 * on a page whose rows are all moving — from overwriting a half-typed figure.
 */
export function OfferDialog({
  listing,
  leagueId,
  rules,
  marketValueChange,
  onClose,
}: {
  listing: MarketListing
  leagueId: string | undefined
  /** Budget, team value and the league's underpay setting. */
  rules: OfferRules
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
  const verdict = checkOffer(value, listing.marketValue, rules)
  const bounds = boundsLabel(
    minimumOffer(listing.marketValue, rules.allowsUnderpay),
    maximumOffer(rules),
  )
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
        if (!verdict.isAllowed) return
        placeOffer.mutate(
          { playerId: listing.id, price: value },
          { onSuccess: onClose },
        )
      }}
      isBusy={isBusy}
      isConfirmDisabled={!verdict.isAllowed}
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
          error={verdict.problem}
          /* Under the field, in order of what the reader needs: what they
             have, then either the borrowing this bid commits them to — which
             Kickbase allows, so it is said rather than prevented — or the
             window the two rules leave. The bounds are exact figures: a
             minimum rounded to `1,8 Mio. €` is a minimum you cannot type. */
          hint={
            <span className="flex flex-col gap-0.5">
              <span className="nums">Budget {money(rules.budget)}</span>
              {verdict.note !== undefined ? (
                <span className="nums text-warning">{verdict.note}</span>
              ) : (
                bounds !== undefined && <span className="nums">{bounds}</span>
              )}
            </span>
          }
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

        <MarketValueDelta
          offer={amount === '' ? undefined : value}
          marketValue={listing.marketValue}
        />

        <AmountSteps onStep={stepBy} />
      </div>
    </ConfirmDialog>
  )
}

/**
 * The window the rules leave, for the line under the field.
 *
 * Either bound can be unknown — the league overview is still loading, or the
 * market response carried no team value — and then only the other one is named
 * rather than inventing a range.
 */
function boundsLabel(
  minimum: number | undefined,
  maximum: number | undefined,
): string | undefined {
  if (minimum !== undefined && maximum !== undefined) {
    return `Erlaubt ${moneyExact(minimum)} – ${moneyExact(maximum)}`
  }
  if (minimum !== undefined) return `Mindestens ${moneyExact(minimum)}`
  if (maximum !== undefined) return `Höchstens ${moneyExact(maximum)}`
  return undefined
}

/**
 * **How far the bid sits from the market value**, under the field that sets it.
 *
 * The one figure the dialog could not previously answer without arithmetic. The
 * market value is in the description at the top and the bid is in the field, and
 * the gap between them is the whole question a bid is — but they are seven-digit
 * numbers ten lines apart, and nobody subtracts those in their head while a
 * listing is counting down.
 *
 * **It is not in the field's `hint`, deliberately.** That line is replaced by the
 * error when a bid breaks one of the [rules](../../lib/offerRules.ts) — and a bid
 * rejected for being under the 90 % floor is exactly when *how far under* is the
 * thing you want to read. So it gets its own row and is always there.
 *
 * Exact to the euro, like the bounds above it: the bottom row of the keypad
 * steps by one, and a compact figure would round that into no change at all.
 *
 * **The sign carries the meaning and the colour reinforces it** — the rule
 * every other two-way mark in the app follows, because a green/red pair alone
 * is unreadable to about one man in twelve. Green above the market value, red
 * below; a bid *at* it is neither and stays quiet.
 *
 * `offer` is `undefined` while the field is empty, which happens constantly —
 * clearing it to retype is the natural way to change a seven-digit number. The
 * row keeps its place and shows a dash rather than reading `−4.500.000 €` at a
 * reader who is mid-keystroke.
 */
function MarketValueDelta({
  offer,
  marketValue,
}: {
  offer: number | undefined
  marketValue: number
}) {
  const delta =
    offer === undefined || !Number.isFinite(offer)
      ? undefined
      : offer - marketValue

  return (
    <p className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-faint">Differenz zum Marktwert</span>
      <span
        className={cn(
          'nums font-semibold',
          delta === undefined || delta === 0
            ? 'text-muted'
            : delta > 0
              ? 'text-positive'
              : 'text-negative',
        )}
      >
        {delta === undefined ? '–' : moneyDeltaExact(delta)}
      </span>
    </p>
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
