import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import { toPosition, toTrend, type MarketListing } from '@/api/models'
import { qk } from '@/api/queryKeys'
import type { MarketResponse } from '@/api/types'

function mapMarket(data: MarketResponse): MarketListing[] {
  return (data.it ?? []).map((listing) => ({
    id: listing.i,
    firstName: listing.fn,
    lastName: listing.n,
    teamId: listing.tid,
    position: toPosition(listing.pos),
    marketValue: listing.mv,
    marketValueTrend: toTrend(listing.mvt),
    price: listing.prc,
    expiresInSeconds: listing.exs,
    seller:
      listing.u === undefined
        ? undefined
        : { id: listing.u.i, name: listing.u.n, image: listing.u.uim },
    status: listing.st,
    offerCount: listing.ofc ?? 0,
    image: listing.pim,
  }))
}

/**
 * Transfer market listings. Kept on a short leash — prices and expiry
 * countdowns are the most time-sensitive data in the app.
 */
export function useMarket(
  leagueId: string | undefined,
): UseQueryResult<MarketListing[]> {
  return useQuery({
    queryKey: qk.market(leagueId ?? 'none'),
    enabled: leagueId !== undefined,
    staleTime: 30_000,
    queryFn: async () =>
      mapMarket(
        await get<MarketResponse>(endpoints.leagues.market(leagueId as string)),
      ),
  })
}
