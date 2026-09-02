import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'

import { post } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import { qk } from '@/api/queryKeys'
import type { SaveLineupRequest } from '@/api/types'

/**
 * What to write. `POST /lineup` and `POST /lineup/clear` are two different
 * endpoints, and which one applies depends on the lineup, so the decision is
 * modelled here rather than at the call site.
 */
export type LineupWrite =
  | {
      kind: 'save'
      /** Formation label, e.g. `"4-4-2"`. */
      formation: string
      /** Exactly eleven player ids, in slot order 0…10. */
      playerIds: string[]
    }
  | { kind: 'clear' }

/**
 * Persist the lineup.
 *
 * `POST /v4/leagues/{id}/lineup` replaces the lineup wholesale rather than
 * applying a delta, which is what makes the caller's job tractable: every
 * write is the complete intended state, so a write that lands late is merely
 * stale, never corrupting.
 *
 * Emptying the lineup goes through `POST /lineup/clear`, which takes no body —
 * the plain endpoint expects a formation, and there is no formation that
 * describes "nobody".
 *
 * On success the squad query is invalidated, since its `lo` values are what
 * the lineup is re-seeded from on the next visit.
 */
export function useSaveLineup(
  leagueId: string | undefined,
): UseMutationResult<void, Error, LineupWrite> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (write: LineupWrite) => {
      if (leagueId === undefined) {
        throw new Error('Cannot save a lineup without a league.')
      }

      if (write.kind === 'clear') {
        await post<unknown>(endpoints.leagues.lineupClear(leagueId))
        return
      }

      const body: SaveLineupRequest = {
        type: write.formation,
        players: write.playerIds,
      }
      await post<unknown>(endpoints.leagues.lineup(leagueId), body)
    },
    onSuccess: async () => {
      if (leagueId === undefined) return
      await queryClient.invalidateQueries({ queryKey: qk.squad(leagueId) })
    },
  })
}
