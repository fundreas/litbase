import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import type { MarketListing } from '@/api/models'
import { qk } from '@/api/queryKeys'
import type { PlayerDetailResponse } from '@/api/types'

/**
 * Market values are recalculated once a night (`mvud` on the market response
 * names the moment, 20:00 UTC). Half an hour is still far fresher than the
 * data, and it matches what the squad page holds player details for.
 */
const STALE_MS = 30 * 60_000

/**
 * Each listing's market-value move over the last 24 hours, keyed by player id.
 *
 * **One request per listing, because there is no bulk source.** `tfhmvt` is
 * the figure, and it lives only on `/v4/leagues/{id}/players/{pid}` — the
 * market payload itself carries `mvt`, the *direction*, and no amount;
 * `/v4/competitions/{id}/players` carries neither. So this is the same
 * unavoidable fan-out the duel pages make for points, at market size: around
 * twenty requests, once per half hour.
 *
 * It is cheap in practice because the key is `qk.playerDetail`, the entry the
 * squad page, the player page and the probability lookups all read. A manager
 * who has just come from their own squad pays for the overlap once.
 *
 * A missing entry is the normal case while the requests are in flight, and is
 * indistinguishable on the wire from a player Kickbase has no figure for, so
 * nothing here surfaces an error — the row simply shows no change.
 */
export function useMarketValueChanges(
  leagueId: string | undefined,
  listings: MarketListing[] | undefined,
): Map<string, number> {
  const playerIds = useMemo(
    () => (listings ?? []).map((listing) => listing.id),
    [listings],
  )

  const queries = useQueries({
    queries: playerIds.map((playerId) => ({
      queryKey: qk.playerDetail(leagueId ?? 'none', playerId),
      enabled: leagueId !== undefined,
      staleTime: STALE_MS,
      queryFn: () =>
        get<PlayerDetailResponse>(
          endpoints.leagues.player(leagueId as string, playerId),
        ),
    })),
  })

  // Rebuilt per render rather than memoised: `useQueries` returns a fresh
  // array each time, so a `useMemo` on it would never hit anyway.
  const changes = new Map<string, number>()
  queries.forEach((query, index) => {
    const change = query.data?.tfhmvt
    const playerId = playerIds[index]
    if (change !== undefined && playerId !== undefined) {
      changes.set(playerId, change)
    }
  })
  return changes
}
