import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import {
  toPosition,
  toStartProbability,
  toTrend,
  type SquadMember,
} from '@/api/models'
import { qk } from '@/api/queryKeys'
import type { SquadResponse } from '@/api/types'

function mapSquad(data: SquadResponse): SquadMember[] {
  return (data.it ?? []).map((player) => ({
    id: player.i,
    firstName: player.fn,
    lastName: player.n,
    teamId: player.tid,
    position: toPosition(player.pos),
    marketValue: player.mv,
    marketValueTrend: toTrend(player.mvt),
    profitLoss: player.mvgl ?? 0,
    totalPoints: player.p,
    averagePoints: player.ap,
    status: player.st,
    startProbability: toStartProbability(player.prob),
    image: player.pim,
    offerCount: player.ofc ?? 0,
    lineupOrder: player.lo,
  }))
}

/** The signed-in manager's players. */
export function useSquad(
  leagueId: string | undefined,
): UseQueryResult<SquadMember[]> {
  return useQuery({
    queryKey: qk.squad(leagueId ?? 'none'),
    enabled: leagueId !== undefined,
    queryFn: async () =>
      mapSquad(
        await get<SquadResponse>(endpoints.leagues.squad(leagueId as string)),
      ),
  })
}
