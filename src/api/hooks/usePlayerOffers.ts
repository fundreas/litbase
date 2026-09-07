import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import type { PlayerOfferState } from '@/api/models'
import { qk } from '@/api/queryKeys'
import type { PlayerOffersResponse } from '@/api/types'

/**
 * **What the viewer bid on one player**, plus whether he is on the market.
 *
 * The only endpoint that answers it — see
 * [`playerOffers`](../endpoints.ts). Nothing else in the API exposes a bid
 * per player: the market payload carries `uop` only while the listing stands
 * and only inside a list of twenty, and the activity feed carries nothing at
 * all.
 *
 * `enabled` is the caller's, because the one caller is a dialog: the
 * [activity feed](../../components/dashboard/ActivityFeed.tsx) asks for this
 * when a transfer is opened, not for every transfer row on screen. Held for
 * five minutes — a bid does not change unless the viewer changes it, and the
 * market page invalidates its own key when they do.
 */
export function usePlayerOffers(
  leagueId: string | undefined,
  playerId: string | undefined,
  { enabled = true }: { enabled?: boolean } = {},
): UseQueryResult<PlayerOfferState> {
  return useQuery({
    queryKey: qk.playerOffers(leagueId ?? 'none', playerId ?? 'none'),
    enabled: enabled && leagueId !== undefined && playerId !== undefined,
    staleTime: 5 * 60_000,
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
      } satisfies PlayerOfferState
    },
  })
}
