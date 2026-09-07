import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import type { Achievement } from '@/api/models'
import { qk } from '@/api/queryKeys'
import type { AchievementResponse } from '@/api/types'

/**
 * One achievement, as it stands for the viewer — above all **what it paid**.
 *
 * The feed entry that announces an achievement names and describes it but
 * says nothing about the money, and the list endpoint carries no reward
 * either; only this per-type detail does. So an achievement row asks for its
 * own type — one request each, and there are a handful of achievement rows in
 * a feed of hundreds. Held for an hour: the description and the reward are
 * fixed, and `timesEarned` moves once a matchday at most.
 */
export function useAchievement(
  leagueId: string | undefined,
  type: number | undefined,
): UseQueryResult<Achievement> {
  return useQuery({
    queryKey: qk.achievement(leagueId ?? 'none', type ?? 0),
    enabled: leagueId !== undefined && type !== undefined,
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const data = await get<AchievementResponse>(
        endpoints.leagues.achievement(leagueId as string, type as number),
      )
      return {
        type: data.t,
        name: data.n,
        description: data.d,
        reward: data.er,
        isEarned: data.ise,
        timesEarned: data.ac ?? 0,
        earnedAt: data.dt,
      } satisfies Achievement
    },
  })
}
