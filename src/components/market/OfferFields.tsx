import { TrendingDown, TrendingUp, X } from 'lucide-react'
import { useCallback, type Dispatch, type SetStateAction } from 'react'

import type { MarketListing } from '@/api/models'
import { AmountSteps } from '@/components/ui/AmountSteps'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/cn'
import { money, moneyDelta, moneyDeltaExact, moneyExact } from '@/lib/format'
import {
  maximumOffer,
  minimumOffer,
  type OfferRules,
  type OfferVerdict,
} from '@/lib/offerRules'

/**
 * **Everything a bid is typed into**, shared by the two places that ask for
 * one.
 *
 * The [dialog](./OfferDialog.tsx) on the market row and the
 * [what-if page](../../pages/WhatIfPage.tsx)'s first tab ask the identical
 * question — what will you pay, and is that allowed — and used to be one
 * implementation and one copy of it. The parts are here; each caller supplies
 * its own frame, its own buttons and its own state.
 *
 * Nothing here holds the amount: it is the one piece of state the callers
 * genuinely differ over. A dialog's is its own and dies with it, while the
 * page's is shared with two other tabs and has to outlive every one of them.
 */

/**
 * The bid, as digits, and the three ways to change it.
 *
 * **Text, not a number.** A controlled number input that coerces on every
 * keystroke cannot be cleared to retype, which is exactly what someone
 * adjusting a seven-digit figure wants to do — so the value is a string of
 * digits and the non-digits are stripped on the way in.
 *
 * `setAmount` is the caller's `useState` setter, passed whole: the
 * [step shortcuts](../ui/AmountSteps.tsx) hold a button down and fire an
 * interval, so their update has to be functional or it would add the same step
 * to the value captured at press time for as long as the finger stayed down.
 */
export function OfferAmountField({
  listing,
  rules,
  amount,
  setAmount,
  verdict,
  label = 'Gebot in €',
  onWithdraw,
  isBusy = false,
}: {
  listing: MarketListing
  /** Budget, team value and the league's underpay setting. */
  rules: OfferRules
  amount: string
  setAmount: Dispatch<SetStateAction<string>>
  /** What the rules make of the current figure — the caller already has it. */
  verdict: OfferVerdict
  label?: string
  /**
   * Withdraw the standing bid, as an **✗ at the end of the field**. Omitted
   * where the caller would rather say it in words — a page has room for a
   * labelled button, a dialog does not.
   */
  onWithdraw?: () => void
  isBusy?: boolean
}) {
  const value = Number(amount)
  const bounds = boundsLabel(
    minimumOffer(listing.marketValue, rules.allowsUnderpay),
    maximumOffer(rules),
  )

  // Functional, and stable across renders: see the note on `setAmount` above.
  const stepBy = useCallback(
    (delta: number) => {
      setAmount((current) => {
        const parsed = Number(current)
        return String(
          Math.max(0, (Number.isFinite(parsed) ? parsed : 0) + delta),
        )
      })
    },
    [setAmount],
  )

  return (
    <>
      <Input
        label={label}
        // `inputMode` rather than `type="number"`: the numeric keypad without
        // the spinner arrows, which step by one and are useless at this scale.
        inputMode="numeric"
        className="nums"
        value={amount}
        onChange={(event) => {
          setAmount(event.target.value.replace(/\D/g, ''))
        }}
        error={verdict.problem}
        /* Under the field, in order of what the reader needs: what they have,
           then either the borrowing this bid commits them to — which Kickbase
           allows, so it is said rather than prevented — or the window the two
           rules leave. The bounds are exact figures: a minimum rounded to
           `1,8 Mio. €` is a minimum you cannot type. */
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
        trailing={
          onWithdraw === undefined ? undefined : (
            <button
              type="button"
              disabled={isBusy}
              title="Gebot zurückziehen"
              aria-label="Gebot zurückziehen"
              onClick={onWithdraw}
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
    </>
  )
}

/**
 * **The listing, in figures**: what he is worth, what he moved overnight, what
 * is being asked, and what you have already bid.
 *
 * The dialog puts this in its description, above the field; the page puts it
 * in the same place by its own arrangement. Either way it is what the number
 * in the field is being decided against.
 *
 * The **asking price only earns a line when it is not the market value**. On a
 * computer listing the two are always the same, and printing one figure under
 * two names invites the reader to look for a difference that is not there.
 */
export function OfferListingFacts({
  listing,
  marketValueChange,
}: {
  listing: MarketListing
  /** Move over the last 24 hours, if it has landed. */
  marketValueChange: number | undefined
}) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="flex flex-wrap items-center gap-x-2">
        <span>
          Marktwert{' '}
          <span className="nums">{moneyExact(listing.marketValue)}</span>
        </span>
        <MarketValueChange amount={marketValueChange} />
      </span>
      {listing.price !== listing.marketValue && (
        <span>
          Aufgerufen <span className="nums">{moneyExact(listing.price)}</span>
        </span>
      )}
      {listing.ownOffer !== undefined && (
        <span className="text-accent">
          Dein Gebot{' '}
          <span className="nums">{moneyExact(listing.ownOffer)}</span>
        </span>
      )}
    </span>
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
 * The one figure neither screen could answer without arithmetic. The market
 * value is above and the bid is in the field, and the gap between them is the
 * whole question a bid is — but they are seven-digit numbers ten lines apart,
 * and nobody subtracts those in their head while a listing is counting down.
 *
 * **It is not in the field's `hint`, deliberately.** That line is replaced by
 * the error when a bid breaks one of the [rules](../../lib/offerRules.ts) — and
 * a bid rejected for being under the 90 % floor is exactly when *how far under*
 * is the thing you want to read. So it gets its own row and is always there.
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
