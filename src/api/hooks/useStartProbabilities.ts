import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import {
  toStartProbability,
  type SquadMember,
  type StartProbability,
} from '@/api/models'
import { qk } from '@/api/queryKeys'
import type { PlayerDetailResponse } from '@/api/types'

/**
 * Ligainsider revises its assessment a few times a week, and `ts` on the
 * payload moves in whole days. Half an hour is far fresher than the data.
 */
const STALE_MS = 30 * 60_000

/**
 * Each squad player's lineup-probability tier.
 *
 * **Gap-filling, not a blanket fan-out.** `prob` is declared on the squad
 * payload but undocumented there, so whether it arrives is a question about a
 * live response rather than about the types. Players who already carry it cost
 * nothing; only the rest are fetched, one detail request each. If Kickbase
 * serves `prob` on the squad this hook fires zero requests and quietly becomes
 * a no-op — which is the reason it is written this way round rather than
 * always fetching.
 *
 * Rows render fine before the answers land: a missing tier is the *normal*
 * case (no Membership, off-season, nobody has assessed the player) and is
 * indistinguishable on the wire from a failed request, so nothing here
 * surfaces an error. The badge simply does not appear.
 */
export function useStartProbabilities(
  leagueId: string | undefined,
  squad: SquadMember[] | undefined,
): Map<string, StartProbability> {
  const missing = useMemo(
    () =>
      (squad ?? [])
        .filter((player) => player.startProbability === undefined)
        .map((player) => player.id),
    [squad],
  )

  const queries = useQueries({
    queries: missing.map((playerId) => ({
      queryKey: qk.playerDetail(leagueId ?? 'none', playerId),
      enabled: leagueId !== undefined,
      staleTime: STALE_MS,
      queryFn: () =>
        get<PlayerDetailResponse>(
          endpoints.leagues.player(leagueId as string, playerId),
        ),
    })),
  })

  // Rebuilt per render rather than memoised: `useQueries` hands back a fresh
  // array every time, so memoising it needs a surrogate key that is harder to
  // trust than the ~25 map writes it saves. Same trade-off, and same reasoning,
  // as `useDuelRosters`.
  const byPlayerId = new Map<string, StartProbability>()

  for (const player of squad ?? []) {
    if (player.startProbability !== undefined) {
      byPlayerId.set(player.id, player.startProbability)
    }
  }
  for (const query of queries) {
    const detail = query.data
    if (detail === undefined) continue
    const tier = toStartProbability(detail.prob)
    if (tier !== undefined) byPlayerId.set(detail.i, tier)
  }

  return byPlayerId
}
