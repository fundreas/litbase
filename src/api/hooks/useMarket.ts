import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import { toPosition, toTrend, type MarketListing } from '@/api/models'
import { qk } from '@/api/queryKeys'
import type { MarketResponse } from '@/api/types'
import { nowMs } from '@/lib/clock'

function mapMarket(data: MarketResponse): MarketListing[] {
  // One reading for the whole response, so listings fetched together share an
  // origin and cannot disagree about how much time is left between them.
  const fetchedAt = nowMs()

  return (data.it ?? []).map((listing) => ({
    id: listing.i,
    firstName: listing.fn,
    lastName: listing.n,
    teamId: listing.tid,
    position: toPosition(listing.pos),
    marketValue: listing.mv,
    marketValueTrend: toTrend(listing.mvt),
    price: listing.prc,
    expiresAt:
      listing.exs === undefined ? undefined : fetchedAt + listing.exs * 1000,
    listedAt: listing.dt,
    seller:
      listing.u === undefined
        ? undefined
        : { id: listing.u.i, name: listing.u.n, image: listing.u.uim },
    status: listing.st,
    offerCount: listing.ofc ?? 0,
    ownOffer: listing.uop,
    ownOfferId: listing.uoid,
    image: listing.pim,
  }))
}

/**
 * Transfer market listings, **soonest to expire first**.
 *
 * The order is the page's whole argument: a listing you cannot bid on for much
 * longer is worth more of your attention than one that runs another two days.
 * Manager listings sort last — they carry no expiry at all (see
 * {@link MarketListing.expiresAt}), so there is nothing to be urgent about.
 *
 * Kept on a short leash — prices and expiry countdowns are the most
 * time-sensitive data in the app.
 */
export function useMarket(
  leagueId: string | undefined,
): UseQueryResult<MarketListing[]> {
  return useQuery({
    queryKey: qk.market(leagueId ?? 'none'),
    enabled: leagueId !== undefined,
    staleTime: 30_000,
    // The one polled query in the app. A market page is a page you leave open
    // while a listing runs out, and nothing else would take the settled ones
    // off it. React Query pauses the interval while the tab is in the
    // background, so it costs nothing when nobody is looking.
    refetchInterval: 30_000,
    queryFn: async () => {
      const listings = mapMarket(
        await get<MarketResponse>(endpoints.leagues.market(leagueId as string)),
      )
      return listings.sort(
        (a, b) =>
          (a.expiresAt ?? Number.POSITIVE_INFINITY) -
          (b.expiresAt ?? Number.POSITIVE_INFINITY),
      )
    },
  })
}
