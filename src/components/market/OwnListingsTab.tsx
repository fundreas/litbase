import { Tag } from 'lucide-react'
import { useState } from 'react'

import { useRanking } from '@/api/hooks/useRanking'
import {
  POSITION_LABEL,
  type MarketListing,
  type PlayerListingOffer,
  type RankedManager,
} from '@/api/models'
import { ReceivedOfferRow } from '@/components/market/ReceivedOfferRow'
import {
  AcceptOfferDialog,
  ListPlayerDialog,
  type SaleSubject,
} from '@/components/player/PlayerSaleDialogs'
import { Avatar } from '@/components/ui/Avatar'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { money, moneyExact } from '@/lib/format'

/**
 * **The seller's side of the market**: every player you have up, and what the
 * league has bid for each of them.
 *
 * The market page's other two views are the buying side — Kickbase's listings
 * ordered by how soon they close, and
 * [the league's](./ManagerListingsTab.tsx) by what they cost over the market
 * value. Neither has any use for a player of yours: a row built for buying
 * would offer to bid on him. What a seller wants is the third cut of the same
 * data — *my* players, each with its bids underneath, in one place — so the
 * page grows this view, `/market/offers`, reached from the
 * [bottom bar](../ui/BottomTabBar.tsx) whenever there is anything to put in
 * it, with a badge saying how many bids are waiting there.
 *
 * **It costs no request.** Own listings arrive in the market payload like every
 * other, identified by `u.i` being the signed-in manager, and the bids come
 * with them in `ofs` — see {@link MarketListing.offers}. The page's
 * thirty-second poll is what keeps this tab live, and the same poll was already
 * running for the market list.
 *
 * ## Two things to tap, and they are the two decisions
 *
 * The **player** opens the price dialog — the same
 * [`ListPlayerDialog`](../player/PlayerSaleDialogs.tsx) the player page's
 * Transfers tab opens, so re-pricing and taking him off the market are here
 * too, and there is no second implementation of either. A **bid** opens the
 * [accept-or-decline dialog](../player/PlayerSaleDialogs.tsx), the same one
 * again.
 *
 * Both are addressed **by id and resolved against the current listings**, not
 * held as the object that was tapped: the market refetches every half minute
 * while this is open, and a dialog must act on the bid as it stands now or not
 * at all. A listing that has since been withdrawn, or a bid the manager pulled,
 * closes its dialog rather than settling against a snapshot.
 *
 * **Faces come from the standings.** `ofs` names the bidders (`unm`) and does
 * not picture them (no `uim`), the reverse of the transfer history's problem
 * and the same fill — see the player page's `withManagersOnOffers`.
 */
export function OwnListingsTab({
  listings,
  leagueId,
}: {
  /** The signed-in manager's own listings, in the market's own order. */
  listings: MarketListing[]
  leagueId: string
}) {
  // Only for the bidders' pictures, and only fetched on this view: the page's
  // views are separate routes, so nothing here mounts until `/market/offers`
  // does.
  // Cached and shared with the ranking page, which pays for it anyway.
  const ranking = useRanking(leagueId)

  /**
   * Which dialog is open, as ids. Local state rather than the market page's
   * `#offer:` hash: that hash names *a bid of one's own on somebody else's
   * listing*, and two dialogs answering to one key would open each other. The
   * view itself is in the path, so what a refresh restores is the list.
   */
  const [dialog, setDialog] = useState<
    { kind: 'price' | 'offer'; playerId: string; offerId?: string } | undefined
  >(undefined)

  const target =
    dialog === undefined
      ? undefined
      : listings.find((listing) => listing.id === dialog.playerId)
  const targetOffer =
    dialog?.kind === 'offer'
      ? withFaces(target?.offers ?? [], ranking.data?.managers).find(
          (offer) => offer.id === dialog.offerId,
        )
      : undefined

  if (listings.length === 0) {
    return (
      <EmptyState
        icon={<Tag size={22} />}
        title="Du bietest keinen Spieler an"
        description="Stelle einen Spieler aus deinem Kader auf den Markt — die Gebote der Liga stehen dann hier."
      />
    )
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            managers={ranking.data?.managers}
            onOpenPrice={() => {
              setDialog({ kind: 'price', playerId: listing.id })
            }}
            onOpenOffer={(offerId) => {
              setDialog({ kind: 'offer', playerId: listing.id, offerId })
            }}
          />
        ))}
      </div>

      {dialog?.kind === 'price' && target !== undefined && (
        <ListPlayerDialog
          player={subjectOf(target)}
          askingPrice={target.price}
          leagueId={leagueId}
          onClose={() => {
            setDialog(undefined)
          }}
        />
      )}

      {dialog?.kind === 'offer' &&
        target !== undefined &&
        targetOffer !== undefined && (
          <AcceptOfferDialog
            player={subjectOf(target)}
            offer={targetOffer}
            leagueId={leagueId}
            onClose={() => {
              setDialog(undefined)
            }}
            onAccepted={() => {
              setDialog(undefined)
            }}
          />
        )}
    </>
  )
}

/**
 * One listed player, with his bids under him.
 *
 * The header is the player and the ask; the rows below are the answers to it.
 * A card rather than a flat list with headings, because the grouping *is* the
 * content here — a bid means nothing without the player it is for, and the
 * amount it should be read against sits directly above it.
 */
function ListingCard({
  listing,
  managers,
  onOpenPrice,
  onOpenOffer,
}: {
  listing: MarketListing
  managers: RankedManager[] | undefined
  onOpenPrice: () => void
  onOpenOffer: (offerId: string) => void
}) {
  const offers = withFaces(listing.offers, managers)
  const best = offers[0]

  return (
    <Card className="overflow-hidden">
      {/* The whole header is the price dialog's target: on a card whose other
          rows are all bids, "the player" is the one thing left to tap, and it
          is also where the figure those bids are answering is printed. */}
      <button
        type="button"
        onClick={onOpenPrice}
        aria-label={`Preis von ${listing.lastName} ändern`}
        className={cn(
          'flex w-full items-center gap-3 border-b border-line px-3 py-2.5 text-left',
          'transition-colors hover:bg-surface-2/60',
          'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        )}
      >
        <Avatar src={listing.image} name={listing.lastName} size={40} />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">
            {listing.lastName}
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
            <span className="shrink-0 tracking-wide uppercase">
              {POSITION_LABEL[listing.position]}
            </span>
            <span aria-hidden="true" className="text-faint">
              ·
            </span>
            {/* The count is the tab's whole reason for existing, so it is on
                the header rather than left to be counted off the rows. */}
            <span className="nums truncate">
              {offers.length === 0
                ? 'keine Gebote'
                : `${String(offers.length)} ${offers.length === 1 ? 'Gebot' : 'Gebote'}`}
            </span>
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span className="nums flex items-center justify-end gap-1 text-sm font-semibold text-ink">
            <Tag size={12} aria-hidden="true" className="shrink-0 text-faint" />
            {money(listing.price)}
          </span>
          <span className="nums block text-xs text-faint">
            MW {money(listing.marketValue)}
          </span>
        </span>
      </button>

      {offers.length === 0 ? (
        /* Not an error and not a dash: the ask is out there and nobody has
           answered it yet. What it cannot promise is that nobody *has* — see
           {@link MarketListing.offers}. */
        <p className="px-4 py-3 text-xs text-muted">
          Noch kein Manager hat geboten.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {offers.map((offer) => (
            <li key={offer.id}>
              <ReceivedOfferRow
                offer={offer}
                marketValue={listing.marketValue}
                onOpen={() => {
                  onOpenOffer(offer.id)
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {/* What the best bid would actually pay, against the price asked. The
          rows above compare each bid with the market value; this is the other
          comparison, and the one the ask was set by. */}
      {best !== undefined && (
        <p className="flex items-baseline justify-between gap-2 border-t border-line px-4 py-2 text-xs">
          <span className="text-faint">Höchstes Gebot</span>
          <span className="nums font-semibold text-ink">
            {moneyExact(best.amount)}
            <span
              className={cn(
                'ml-1 font-normal',
                best.amount >= listing.price ? 'text-positive' : 'text-muted',
              )}
            >
              {best.amount >= listing.price
                ? 'auf dem Preis'
                : `${money(listing.price - best.amount)} darunter`}
            </span>
          </span>
        </p>
      )}
    </Card>
  )
}

/** The dialogs want a player, and a listing is one under another name. */
function subjectOf(listing: MarketListing): SaleSubject {
  return {
    id: listing.id,
    name: `${listing.firstName ?? ''} ${listing.lastName}`.trim(),
    marketValue: listing.marketValue,
  }
}

/**
 * Bidders' pictures, from the standings.
 *
 * `ofs` carries a name per bid and no image at all, so without this every row
 * is initials. A manager who has **left the league** is not in the standings
 * any more and keeps what the payload gave him, which is the honest answer.
 */
function withFaces(
  offers: PlayerListingOffer[],
  managers: RankedManager[] | undefined,
): PlayerListingOffer[] {
  if (managers === undefined || offers.length === 0) return offers

  const byId = new Map(managers.map((manager) => [manager.id, manager]))
  return offers.map((offer) => {
    const manager = byId.get(offer.managerId)
    if (manager === undefined) return offer
    return {
      ...offer,
      managerName: offer.managerName ?? manager.name,
      managerImage: offer.managerImage ?? manager.image,
    }
  })
}
