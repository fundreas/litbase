import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'

import { get, post } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import type {
  Competition,
  JoinableLeague,
  JoinableLeagueFilters,
} from '@/api/models'
import { qk } from '@/api/queryKeys'
import type {
  CompetitionsResponse,
  LeagueListItem,
  LeagueListResponse,
  RecommendedLeaguesResponse,
} from '@/api/types'

const MINUTE = 60_000

/* -------------------------------------------------------------------------- */
/* Mapping                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * `/recommended` and `/list` return different item shapes for the same thing.
 * These two mappers are the only place that difference exists.
 */
function mapRecommended(data: RecommendedLeaguesResponse): JoinableLeague[] {
  return (data.it ?? []).map((item) => ({
    id: item.i,
    name: item.lnm,
    image: item.lim,
    // This endpoint gives the resolved name but no competition id.
    competitionName: item.cpn,
    managerCount: item.mgc,
    isFeatured: item.isvf ?? false,
    memberImages: (item.m ?? [])
      .map((member) => member.uim)
      .filter((image): image is string => image !== undefined),
  }))
}

function mapListItem(item: LeagueListItem): JoinableLeague {
  return {
    id: item.li,
    name: item.lnm,
    image: item.lim,
    // This endpoint gives the id but no name — resolve it against
    // `useCompetitions()` at render time.
    competitionId: item.cpi,
    competitionImage: item.cpim,
    managerCount: item.mgc,
    managerLimit: item.mgm,
    isFeatured: item.isvf ?? false,
    gameMode: item.gpm,
    memberImages: [],
  }
}

/* -------------------------------------------------------------------------- */
/* Queries                                                                    */
/* -------------------------------------------------------------------------- */

/** Leagues Kickbase suggests for this account. */
export function useRecommendedLeagues(): UseQueryResult<JoinableLeague[]> {
  return useQuery({
    queryKey: qk.joinable.recommended(),
    staleTime: 5 * MINUTE,
    queryFn: async () =>
      mapRecommended(
        await get<RecommendedLeaguesResponse>(endpoints.leagues.recommended),
      ),
  })
}

/**
 * Browsable and searchable joinable leagues.
 *
 * Filter names are **camelCase** (`competitionId`, `gamePlayMode`) — the
 * wire-style spellings are ignored by the server rather than rejected, so a
 * typo here looks like a filter that simply does not narrow anything.
 *
 * `enabled` lets the search tab hold off until the user actually submits.
 */
export function useJoinableLeagues(
  filters: JoinableLeagueFilters,
  options: { enabled?: boolean } = {},
): UseQueryResult<JoinableLeague[]> {
  return useQuery({
    queryKey: qk.joinable.list(filters),
    enabled: options.enabled ?? true,
    staleTime: 2 * MINUTE,
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (filters.query !== undefined && filters.query !== '') {
        params.query = filters.query
      }
      if (filters.competitionId !== undefined) {
        params.competitionId = filters.competitionId
      }
      if (filters.gameMode !== undefined) {
        params.gamePlayMode = String(filters.gameMode)
      }

      const data = await get<LeagueListResponse>(endpoints.leagues.list, {
        params,
      })
      return (data.it ?? []).map(mapListItem)
    },
  })
}

/** All competitions, for the filter chips. Effectively static. */
export function useCompetitions(): UseQueryResult<Competition[]> {
  return useQuery({
    queryKey: qk.competitions.list(),
    staleTime: 60 * MINUTE,
    queryFn: async () => {
      const data = await get<CompetitionsResponse>(endpoints.competitions.all)
      return (data.it ?? []).map((item) => ({
        id: item.i,
        name: item.n,
        image: item.cpim,
      })) satisfies Competition[]
    },
  })
}

/* -------------------------------------------------------------------------- */
/* Mutation                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Join a league.
 *
 * The success response body is **not consumed** — deliberately, since its
 * shape is unverified (confirming it would mean joining a real league). All
 * the caller needs is that it resolved; the affected caches are then dropped
 * so the new membership is refetched.
 */
export function useJoinLeague(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (leagueId: string) => {
      await post<unknown>(endpoints.leagues.join(leagueId))
    },
    onSuccess: async () => {
      // Membership changed, and the browsable lists now contain a league the
      // user is already in.
      await queryClient.invalidateQueries({ queryKey: qk.leagues.all })
      await queryClient.invalidateQueries({ queryKey: qk.joinable.all })
    },
  })
}
