import { ChevronRight } from 'lucide-react'

import type { PlayerListingOffer } from '@/api/models'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'
import { money, moneyDelta } from '@/lib/format'

/**
 * **One bid somebody has made on your player**: who made it, what it is, and
 * how it compares to the market value.
 *
 * Shared by the two places the seller's side is shown — the
 * [player page's owner panel](../player/PlayerOwnerActions.tsx) and the market
 * page's [Gebote tab](./OwnListingsTab.tsx) — which want the identical row,
 * down to the chevron, and had no business owning two copies of it.
 *
 * **The whole row is the target**, rather than an *Annehmen* button on it. The
 * row opens a dialog that has to be held before it accepts anything, so there
 * is nothing here to fire by accident, and a button per row would put four
 * identical calls to action on a list whose only real question is which of the
 * figures is the largest.
 *
 * **Over the market value is green.** This is the seller's side: being paid
 * over the odds is the good outcome, which is the opposite of what the same
 * sign means on a purchase — see `premiumTone` on the transfers tab.
 */
export function ReceivedOfferRow({
  offer,
  marketValue,
  onOpen,
}: {
  offer: PlayerListingOffer
  marketValue: number
  onOpen: () => void
}) {
  const premium = offer.amount - marketValue

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3 text-left',
        'transition-colors hover:bg-surface-2/60',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
      )}
    >
      <Avatar src={offer.managerImage} name={offer.managerName} size={32} />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
        {offer.managerName ?? 'Unbekannt'}
      </span>
      <span className="shrink-0 text-right">
        <span className="nums block text-sm font-semibold text-ink">
          {money(offer.amount)}
        </span>
        <span
          className={cn(
            'nums block text-xs',
            premium > 0 && 'text-positive',
            premium < 0 && 'text-negative',
            premium === 0 && 'text-faint',
          )}
        >
          {moneyDelta(premium)}
        </span>
      </span>
      <ChevronRight
        size={16}
        aria-hidden="true"
        className="shrink-0 text-faint"
      />
    </button>
  )
}
