import { Calculator } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { usePlaceOffer, useWithdrawOffer } from '@/api/hooks/useMarketOffers'
import { offerBaseline, type MarketListing } from '@/api/models'
import {
  OfferAmountField,
  OfferListingFacts,
} from '@/components/market/OfferFields'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { checkOffer, type OfferRules } from '@/lib/offerRules'

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
 * **The fields are shared** with the what-if page's first tab, which asks the
 * same question with the whole squad behind it — see
 * [`OfferFields`](./OfferFields.tsx). *Durchrechnen* is the door to it: it
 * hands over the amount as `?bid=` so a half-typed figure survives the trip,
 * and navigates with `replace`, because the page it opens is where the
 * decision is now being made — the way back out of it should be the market,
 * not this sheet again.
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
  const navigate = useNavigate()

  // Text, not a number: a controlled number input that coerces on every
  // keystroke cannot be cleared to retype, which is exactly what someone
  // adjusting a seven-digit figure wants to do.
  const [amount, setAmount] = useState(() => String(offerBaseline(listing)))

  const value = Number(amount)
  const verdict = checkOffer(value, listing.marketValue, rules)
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
        <OfferListingFacts
          listing={listing}
          marketValueChange={marketValueChange}
        />
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
        <OfferAmountField
          listing={listing}
          rules={rules}
          amount={amount}
          setAmount={setAmount}
          verdict={verdict}
          isBusy={isBusy}
          /* Withdrawing sits **on the field it undoes**, at the end of the
             amount it would erase. It is not one of the dialog's two
             conclusions — it is what you do to the offer itself — and it only
             exists while there is an offer to take back. */
          onWithdraw={
            ownOfferId === undefined
              ? undefined
              : () => {
                  withdrawOffer.mutate(
                    { playerId: listing.id, offerId: ownOfferId },
                    { onSuccess: onClose },
                  )
                }
          }
        />

        {/* **The same bid, with the squad behind it.** A bid is only ever
            affordable relative to what you would sell to fund it and useful
            relative to who he would replace, and neither question fits in a
            sheet this size. `replace` so the market — not this dialog — is
            what a back press finds. */}
        {leagueId !== undefined && (
          <Button
            variant="ghost"
            fullWidth
            leadingIcon={<Calculator size={16} aria-hidden="true" />}
            onClick={() => {
              // The figure travels with the tap: whatever is in the field is
              // where the page starts, so crossing over is not a retype. It
              // rides in the query rather than in state because the
              // destination is a URL — see `?bid=` on the what-if page.
              const bid = amount === '' ? '' : `?bid=${amount}`
              void navigate(`/leagues/${leagueId}/whatif/${listing.id}${bid}`, {
                replace: true,
              })
            }}
          >
            Durchrechnen
          </Button>
        )}
      </div>
    </ConfirmDialog>
  )
}
