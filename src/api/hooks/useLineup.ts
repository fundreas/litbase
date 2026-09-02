import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'

import { post } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import { qk } from '@/api/queryKeys'
import type { SaveLineupRequest } from '@/api/types'

export interface SaveLineupInput {
  /** Formation label, e.g. `"4-4-2"`. */
  formation: string
  /** Player ids, keeper first then defence, midfield, attack. */
  playerIds: string[]
}

/**
 * Persist the lineup.
 *
 * The endpoint replaces the lineup wholesale rather than applying a delta,
 * which is what makes the caller's job easy: every save is the complete
 * intended state, so a save that lands late is not corrupting a partial
 * update — it is simply stale. The caller
 * ([`LineupTab`](../../components/squad/LineupTab.tsx)) coalesces rapid edits
 * and serialises the requests so the last write always reflects the last edit.
 *
 * On success the squad query is invalidated, since the server's `lo` values
 * are what the lineup is re-seeded from on a later visit.
 */
export function useSaveLineup(
  leagueId: string | undefined,
): UseMutationResult<void, Error, SaveLineupInput> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ formation, playerIds }: SaveLineupInput) => {
      if (leagueId === undefined) {
        throw new Error('Cannot save a lineup without a league.')
      }
      const body: SaveLineupRequest = { type: formation, players: playerIds }
      await post<unknown>(endpoints.leagues.lineup(leagueId), body)
    },
    onSuccess: async () => {
      if (leagueId === undefined) return
      await queryClient.invalidateQueries({ queryKey: qk.squad(leagueId) })
    },
  })
}
