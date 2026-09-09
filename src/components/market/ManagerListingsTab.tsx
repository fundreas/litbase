import { Users } from 'lucide-react'

import type { MarketListing, TeamFixture } from '@/api/models'
import { MarketRow } from '@/components/market/MarketRow'
import { EmptyState } from '@/components/ui/States'

/**
 * **What the league is selling**: every listing put up by another manager, and
 * nothing Kickbase put up itself.
 *
 * The two kinds of listing arrive in one array and read as one list, but they
 * are not the same purchase. A computer listing **settles by itself** at a
 * fixed instant, to the highest bid standing then — so it is urgent, and the
 * [market list](../../pages/MarketPage.tsx) is ordered by exactly that. A
 * manager's listing has **no expiry at all**: it stands until he withdraws it
 * or accepts something, and there is nothing to be urgent about. Mixed into an
 * ordering built on urgency they could only sort last, which is a heap at the
 * bottom of the page saying "these are different" without saying how.
 *
 * So they get their own view, and their own ordering — the one that fits a
 * listing you can think about for a week.
 *
 * ## Ordered by the ask against the market value
 *
 * Cheapest **relative** to what the player is worth first, not cheapest
 * outright: an ask of two million is a bargain on one player and robbery on
 * another, and the figure that tells the two apart is the premium over the
 * market value. That is also the manager's own decision made visible — he
 * picked the number, unlike Kickbase, which charges the market value flat — so
 * it is the first thing worth knowing about his listing and the list is built
 * on it.
 *
 * The premium is **drawn in the row**, right under the price it qualifies, in
 * the line a computer listing spends on the overnight move: an ordering the
 * reader cannot see is a mystery, and this one is the point. What a manager's
 * listing does with the panel at the end of the row — the countdown's place,
 * since it has no countdown — is wear **his face**, which answers "whose
 * listing is this?" faster than the name it replaces and is the picture the
 * standings already taught you. See [`MarketRow`](./MarketRow.tsx).
 *
 * **Your own listings are not here.** They are the *Gebote* tab's subject —
 * see [`OwnListingsTab`](./OwnListingsTab.tsx) — and a row built for buying
 * would be the wrong thing to do with them anyway.
 */
export function ManagerListingsTab({
  listings,
  leagueId,
  fixtureByTeamId,
  onOffer,
}: {
  /** Other managers' listings, in any order — this view imposes its own. */
  listings: MarketListing[]
  leagueId: string
  fixtureByTeamId: Map<string, TeamFixture> | undefined
  onOffer: (playerId: string) => void
}) {
  if (listings.length === 0) {
    return (
      <EmptyState
        icon={<Users size={22} />}
        title="Kein Manager bietet einen Spieler an"
        description="Sobald jemand aus der Liga einen Spieler auf den Markt stellt, steht er hier."
      />
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {byPremium(listings).map((listing) => (
        <MarketRow
          key={listing.id}
          listing={listing}
          leagueId={leagueId}
          fixture={fixtureByTeamId?.get(listing.teamId)}
          // No 24-hour move and no countdown: on a manager's listing the row
          // prints the premium under the price and his face at the end, so
          // neither the overnight figure nor the clock is ever read.
          now={0}
          onOffer={() => {
            onOffer(listing.id)
          }}
        />
      ))}
    </ul>
  )
}

/**
 * Cheapest against the market value first — the *ratio*, not the difference,
 * so the ordering means the same thing at half a million as at fifteen.
 *
 * A market value of zero has never been seen on the wire and would divide by
 * it; such a listing sorts last rather than to infinity or `NaN`, where it
 * would take the whole comparison with it.
 */
function byPremium(listings: MarketListing[]): MarketListing[] {
  const ratio = (listing: MarketListing) =>
    listing.marketValue > 0
      ? listing.price / listing.marketValue
      : Number.POSITIVE_INFINITY

  return [...listings].sort((a, b) => ratio(a) - ratio(b))
}
