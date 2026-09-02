import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import type { League } from '@/api/models'
import { qk } from '@/api/queryKeys'
import type { LeagueSelectionResponse } from '@/api/types'

function mapLeagues(data: LeagueSelectionResponse): League[] {
  return (data.it ?? []).map((item) => ({
    id: item.i,
    name: item.n,
    competitionId: item.cpi,
    image: item.cpim,
    budget: item.b,
    teamValue: item.tv ?? 0,
    placement: item.pl,
    unreadCount: item.un ?? 0,
  }))
}

/**
 * The user's leagues. Backs the league switcher, so it is cached generously —
 * league membership changes rarely.
 */
export function useLeagues(): UseQueryResult<League[]> {
  return useQuery({
    queryKey: qk.leagues.selection(),
    queryFn: async () =>
      mapLeagues(
        await get<LeagueSelectionResponse>(endpoints.leagues.selection),
      ),
    staleTime: 10 * 60_000,
  })
}
