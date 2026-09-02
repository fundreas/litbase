import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import {
  toPosition,
  type CompetitionPlayerSummary,
  type TableRow,
} from '@/api/models'
import { qk } from '@/api/queryKeys'
import type {
  CompetitionPlayersResponse,
  CompetitionTableResponse,
} from '@/api/types'

const HOUR = 60 * 60_000

/** Every player in the competition. A large payload — cached for an hour. */
export function useCompetitionPlayers(
  competitionId: string | undefined,
): UseQueryResult<CompetitionPlayerSummary[]> {
  return useQuery({
    queryKey: qk.competitionPlayers(competitionId ?? 'none'),
    enabled: competitionId !== undefined,
    staleTime: HOUR,
    queryFn: async () => {
      const data = await get<CompetitionPlayersResponse>(
        endpoints.competitions.players(competitionId as string),
      )
      return (data.it ?? []).map((player) => ({
        id: player.pi,
        lastName: player.n,
        teamId: player.tid,
        position: toPosition(player.pos),
        points: player.p,
        minutesPlayed: player.mt ?? 0,
        goals: player.g ?? 0,
        assists: player.a ?? 0,
        isInjured: player.il ?? false,
        image: player.pim,
      })) satisfies CompetitionPlayerSummary[]
    },
  })
}

/** The real-world league table. */
export function useCompetitionTable(
  competitionId: string | undefined,
): UseQueryResult<TableRow[]> {
  return useQuery({
    queryKey: qk.competitionTable(competitionId ?? 'none'),
    enabled: competitionId !== undefined,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const data = await get<CompetitionTableResponse>(
        endpoints.competitions.table(competitionId as string),
      )
      return (data.it ?? []).map((row) => ({
        teamId: row.tid,
        teamName: row.tn,
        teamImage: row.tim,
        placement: row.cpl,
        previousPlacement: row.pcpl,
        points: row.cp,
        matchesPlayed: row.mc,
        goalDifference: row.gd,
        kickbasePoints: row.sp ?? 0,
      })) satisfies TableRow[]
    },
  })
}
