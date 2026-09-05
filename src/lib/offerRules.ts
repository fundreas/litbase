import { moneyExact } from '@/lib/format'

/**
 * What Kickbase will and will not accept as a bid.
 *
 * Three rules, all of them probed against the live API on 2026-09-05 and all
 * of them exact to the euro — see
 * [docs/pages/market.md](../../docs/pages/market.md#what-kickbase-refuses).
 * They are worth checking here rather than letting the server say no, because
 * two of the three depend on numbers the page already has on screen (the
 * market value, the budget) and the third depends on the *sum* of every bid
 * standing elsewhere, which nobody can hold in their head.
 *
 * The server remains the authority: every rule below is also mapped in
 * [`errors.ts`](../api/errors.ts), so a bid that slips through — a market
 * value recalculated between the render and the tap — still fails legibly.
 */

/**
 * The share of the market value a bid may not fall below, **in a league that
 * allows underpaying at all**.
 *
 * The floor is `floor(marketValue × 0.9)`, and the rounding is not academic:
 * on a player worth 1 973 756 the API took 1 776 380 and refused 1 776 379.
 */
export const UNDERPAY_FLOOR = 0.9

/**
 * How far past the budget the sum of one's standing bids may reach: **33 % of
 * team value**, floored.
 *
 * Kickbase lets a manager borrow — a bid above the budget is fine, and the
 * budget goes negative when it wins. This is where the borrowing stops.
 */
export const DEBT_CEILING = 0.33

/** Everything a verdict needs beyond the amount and the listing itself. */
export interface OfferRules {
  /**
   * Whether the league allows bids below the market value — `upe` on the
   * league overview.
   *
   * `undefined` while the overview is still loading, and then **no** underpay
   * rule is enforced client-side: refusing a bid on a guess is worse than
   * letting the server refuse it a moment later.
   */
  allowsUnderpay: boolean | undefined
  /** The manager's budget, in €. */
  budget: number
  /** Team value, in € — the base of the 33 % ceiling. `undefined` skips it. */
  teamValue: number | undefined
  /**
   * The manager's standing bids on **other** listings, summed.
   *
   * Every one of them counts against the ceiling at once. A bid on the listing
   * being edited must *not* be in here: re-bidding on the same player replaces
   * the previous offer rather than adding to it (probed — a bid at the exact
   * ceiling was accepted while the same player already held one).
   */
  committedElsewhere: number
}

/** The smallest amount this listing will take, or `undefined` if unknown. */
export function minimumOffer(
  marketValue: number,
  allowsUnderpay: boolean | undefined,
): number | undefined {
  if (allowsUnderpay === undefined) return undefined
  return allowsUnderpay ? Math.floor(marketValue * UNDERPAY_FLOOR) : marketValue
}

/** The largest amount the ceiling leaves, or `undefined` if unknown. */
export function maximumOffer(rules: OfferRules): number | undefined {
  if (rules.teamValue === undefined) return undefined
  return (
    rules.budget +
    Math.floor(rules.teamValue * DEBT_CEILING) -
    rules.committedElsewhere
  )
}

export interface OfferVerdict {
  /** Whether *Bieten* may be pressed. */
  isAllowed: boolean
  /** Why not, in German — set only when {@link isAllowed} is false. */
  problem?: string
  /**
   * A bid that is **allowed but borrows**: it takes the budget below zero once
   * every standing bid is counted. Kickbase permits this, so it is said rather
   * than prevented.
   */
  note?: string
}

/**
 * Judge one bid.
 *
 * The figures in the messages are exact rather than compact: `1,8 Mio. €` as a
 * *minimum* rounds the wrong way as often as not, and a bound the reader
 * cannot type back verbatim is not a bound.
 */
export function checkOffer(
  amount: number,
  marketValue: number,
  rules: OfferRules,
): OfferVerdict {
  // Nothing typed yet, or nonsense. No message: an empty field is not an
  // error, it is an unfinished sentence.
  if (!Number.isFinite(amount) || amount <= 0) return { isAllowed: false }

  const minimum = minimumOffer(marketValue, rules.allowsUnderpay)
  if (minimum !== undefined && amount < minimum) {
    return {
      isAllowed: false,
      problem:
        rules.allowsUnderpay === true
          ? `Mindestens 90 % des Marktwerts — ${moneyExact(minimum)}.`
          : `Unter dem Marktwert bieten ist in dieser Liga nicht erlaubt — mindestens ${moneyExact(minimum)}.`,
    }
  }

  const maximum = maximumOffer(rules)
  if (maximum !== undefined && amount > maximum) {
    return {
      isAllowed: false,
      problem:
        rules.committedElsewhere > 0
          ? `Zusammen mit deinen anderen Geboten mehr als 33 % deines Teamwerts im Minus — höchstens ${moneyExact(maximum)}.`
          : `Mehr als 33 % deines Teamwerts im Minus — höchstens ${moneyExact(maximum)}.`,
    }
  }

  const remaining = rules.budget - rules.committedElsewhere - amount
  return {
    isAllowed: true,
    note:
      remaining < 0
        ? `Budget nach allen Geboten ${moneyExact(remaining)}.`
        : undefined,
  }
}
