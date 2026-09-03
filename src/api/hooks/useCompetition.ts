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

/** A club, as anything that only needs to name one sees it. */
export interface TeamSummary {
  id: string
  name: string
  image?: string
}

/*
 * Module-level so React Query can memoise `select` on its identity — an arrow
 * created during render would hand back a new Map every time. Same reason as
 * the selectors in `useMatchday`.
 */
function selectTeamDirectory(
  data: CompetitionTableResponse,
): Map<string, TeamSummary> {
  const byId = new Map<string, TeamSummary>()
  for (const row of data.it ?? []) {
    byId.set(row.tid, { id: row.tid, name: row.tn, image: row.tim })
  }
  return byId
}

/**
 * Team id → name and crest, built from the league table.
 *
 * The one lookup of its kind: there is no `/v4/competitions/{id}/teams`
 * endpoint (404), and the fixture payloads carry crests and three-letter
 * symbols but never a full name.
 *
 * **It only knows this season's clubs.** A relegated side in a player's older
 * seasons resolves to nothing, which is why every consumer pairs it with the
 * crest the payload itself carries and treats the name as the optional half.
 *
 * Reads the same cache entry as {@link useCompetitionTable}, so a page showing
 * both pays for one request.
 */
export function useTeamDirectory(
  competitionId: string | undefined,
): UseQueryResult<Map<string, TeamSummary>> {
  return useQuery({
    queryKey: qk.competitionTable(competitionId ?? 'none'),
    enabled: competitionId !== undefined,
    staleTime: HOUR,
    select: selectTeamDirectory,
    queryFn: () =>
      get<CompetitionTableResponse>(
        endpoints.competitions.table(competitionId as string),
      ),
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
