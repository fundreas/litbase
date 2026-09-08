import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import type { PlayerOfferState } from '@/api/models'
import { qk } from '@/api/queryKeys'
import type { PlayerOffersResponse } from '@/api/types'

/** How often a listing of the viewer's own is re-read while they watch it. */
const WATCH_MS = 30_000

/**
 * **One player's market state**: whether he is listed, at what, what the
 * viewer bid on him — and, on the viewer's own listing, the bids standing
 * against it.
 *
 * The only endpoint that answers any of it — see
 * [`playerOffers`](../endpoints.ts). Nothing else in the API exposes a bid
 * per player: the market payload carries `uop` only while the listing stands
 * and only inside a list of twenty, and the activity feed carries nothing at
 * all.
 *
 * `enabled` is the caller's, because the callers are a dialog and a tab: the
 * [activity feed](../../components/events/ActivityFeed.tsx) asks for this when
 * a transfer is opened, not for every transfer row on screen. Held for five
 * minutes — a bid does not change unless the viewer changes it, and the market
 * page invalidates its own key when they do.
 *
 * `watch` is the exception to that. On the
 * [player page's seller panel](../../components/player/PlayerOwnerActions.tsx)
 * the interesting change comes from *other* managers, so a listing of one's
 * own is re-read every thirty seconds — the same cadence the market page runs
 * at, and for the same reason. **Only while a listing actually stands**: the
 * poll is driven by the response, so a player sitting quietly in the squad
 * costs one request and then nothing.
 */
export function usePlayerOffers(
  leagueId: string | undefined,
  playerId: string | undefined,
  {
    enabled = true,
    watch = false,
  }: { enabled?: boolean; watch?: boolean } = {},
): UseQueryResult<PlayerOfferState> {
  return useQuery({
    queryKey: qk.playerOffers(leagueId ?? 'none', playerId ?? 'none'),
    enabled: enabled && leagueId !== undefined && playerId !== undefined,
    staleTime: watch ? WATCH_MS : 5 * 60_000,
    refetchInterval: (query) =>
      watch && query.state.data?.isListed === true ? WATCH_MS : false,
    queryFn: async () => {
      const data = await get<PlayerOffersResponse>(
        endpoints.leagues.playerOffers(leagueId as string, playerId as string),
      )
      return {
        // `prc` is `0` for a player who is not listed, which is not a price.
        price:
          data.prc !== undefined && data.prc !== null && data.prc > 0
            ? data.prc
            : undefined,
        isListed: data.iotm ?? false,
        ownOffer: data.uop ?? undefined,
        // Highest first: the one worth accepting is the one to read first, and
        // the wire's order is not defined.
        offers: (data.ofs ?? [])
          .map((offer) => ({
            id: offer.uoid,
            managerId: offer.u,
            managerName: offer.unm,
            managerImage: offer.uim,
            amount: offer.uop,
          }))
          .sort((a, b) => b.amount - a.amount),
        ownerId: data.oui ?? undefined,
        ownerName: data.onm,
      } satisfies PlayerOfferState
    },
  })
}
