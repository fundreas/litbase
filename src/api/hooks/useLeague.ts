import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import type { LeagueDetails, LeagueManager } from '@/api/models'
import { qk } from '@/api/queryKeys'
import type { LeagueMeResponse, LeagueOverviewResponse } from '@/api/types'

/** The signed-in manager inside a league: budget, squad size, unread count. */
export function useLeagueManager(
  leagueId: string | undefined,
): UseQueryResult<LeagueManager> {
  return useQuery({
    queryKey: qk.leagueMe(leagueId ?? 'none'),
    enabled: leagueId !== undefined,
    queryFn: async () => {
      const data = await get<LeagueMeResponse>(
        endpoints.leagues.me(leagueId as string),
      )
      return {
        leagueName: data.lnm,
        competitionId: data.cpi,
        budget: data.b,
        squadSize: data.bs ?? 0,
        unreadCount: data.un ?? 0,
        isAdmin: data.adm ?? false,
      } satisfies LeagueManager
    },
  })
}

/** League metadata and member list. */
export function useLeagueDetails(
  leagueId: string | undefined,
): UseQueryResult<LeagueDetails> {
  return useQuery({
    queryKey: qk.leagueOverview(leagueId ?? 'none'),
    enabled: leagueId !== undefined,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const data = await get<LeagueOverviewResponse>(
        endpoints.leagues.overview(leagueId as string),
      )
      const members = (data.m ?? []).map((member) => ({
        id: member.ui,
        image: member.uim,
      }))
      return {
        id: data.i,
        name: data.lnm,
        competitionId: data.cpi,
        competitionName: data.cpn,
        createdAt: data.dt,
        memberCount: data.mid?.length ?? members.length,
        members,
        // Permissive when the field is missing: the server enforces the rule
        // anyway, and blocking a legal bid on an absent flag is the worse of
        // the two failures.
        allowsUnderpay: data.upe ?? true,
      } satisfies LeagueDetails
    },
  })
}
