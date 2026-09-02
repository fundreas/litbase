import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import type { RankedManager } from '@/api/models'
import { qk } from '@/api/queryKeys'
import type { RankingResponse } from '@/api/types'

function mapRanking(data: RankingResponse): RankedManager[] {
  return (data.us ?? []).map((user) => ({
    id: user.i,
    name: user.n,
    image: user.uim,
    seasonPoints: user.sp,
    seasonPlacement: user.spl,
    matchdayPoints: user.mdp,
    matchdayPlacement: user.mdpl,
    teamValue: user.tv,
    placementChange: user.ppc ?? 0,
    pointsPerMatchday: user.lp ?? [],
    isAdmin: user.adm ?? false,
  }))
}

/** Standings of every manager in the league, already ordered by placement. */
export function useRanking(
  leagueId: string | undefined,
): UseQueryResult<RankedManager[]> {
  return useQuery({
    queryKey: qk.ranking(leagueId ?? 'none'),
    enabled: leagueId !== undefined,
    queryFn: async () =>
      mapRanking(
        await get<RankingResponse>(
          endpoints.leagues.ranking(leagueId as string),
        ),
      ),
  })
}
