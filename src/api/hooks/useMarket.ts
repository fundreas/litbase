import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import {
  toPosition,
  toStartProbability,
  toTrend,
  type Market,
  type MarketListing,
} from '@/api/models'
import { qk } from '@/api/queryKeys'
import type { MarketResponse } from '@/api/types'
import { nowMs } from '@/lib/clock'

/** ISO 8601 → epoch ms, so it compares directly against `expiresAt`. */
function toInstant(iso: string | undefined): number | undefined {
  if (iso === undefined) return undefined
  const parsed = Date.parse(iso)
  return Number.isNaN(parsed) ? undefined : parsed
}

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
    // Highest first, as the per-player endpoint's are: the bid worth
    // accepting is the one to read first, and the wire's order is not defined.
    offers: (listing.ofs ?? [])
      .map((offer) => ({
        id: offer.uoid,
        managerId: offer.u,
        managerName: offer.unm,
        amount: offer.uop,
      }))
      .sort((a, b) => b.amount - a.amount),
    ownOffer: listing.uop,
    ownOfferId: listing.uoid,
    image: listing.pim,
    // `prob` is documented on this endpoint, and when it arrives the row's
    // badge costs nothing. `plpim` beside it is the club's whole probable-XI
    // poster, not a per-player icon, and is deliberately left on the wire.
    startProbability: toStartProbability(listing.prob),
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
): UseQueryResult<Market> {
  return useQuery({
    queryKey: qk.market(leagueId ?? 'none'),
    enabled: leagueId !== undefined,
    staleTime: 30_000,
    // The one polled query in the app. A market page is a page you leave open
    // while a listing runs out, and nothing else would take the settled ones
    // off it. React Query pauses the interval while the tab is in the
    // background, so it costs nothing when nobody is looking.
    //
    // Since the shell's [offer notice](../../components/layout/OfferNotice.tsx)
    // mounted this too, the poll runs on **every** page of a league — that
    // notice is the app's way of saying a bid has landed on one of your
    // listings, and the bids arrive in this payload. One key, so it is still
    // one request every thirty seconds however many observers there are, and
    // arriving on the market page finds the list already fetched.
    queryFn: async () => {
      const data = await get<MarketResponse>(
        endpoints.leagues.market(leagueId as string),
      )
      return {
        listings: mapMarket(data).sort(
          (a, b) =>
            (a.expiresAt ?? Number.POSITIVE_INFINITY) -
            (b.expiresAt ?? Number.POSITIVE_INFINITY),
        ),
        marketValueUpdateAt: toInstant(data.mvud),
        matchdayStartAt: toInstant(data.dt),
        day: data.day,
        teamValue: data.tv,
      } satisfies Market
    },
  })
}
