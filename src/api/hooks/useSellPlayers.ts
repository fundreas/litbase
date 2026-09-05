import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'

import { post } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import { qk } from '@/api/queryKeys'
import { toApiError } from '@/api/errors'

/** One player to sell: the id to send, and the name a failure is reported by. */
export interface SellSubject {
  id: string
  name: string
}

/**
 * Sell players back to Kickbase, at market value.
 *
 * `POST /leagues/{id}/market/{playerId}/sell` per player — there is **no bulk
 * spelling**, so a selection of five is five requests, sent **one at a time**.
 * In order, and not in parallel: each one moves the budget, and a partial
 * failure has to be reportable as "these went, that one did not", which a
 * `Promise.all` that rejects on the first error cannot say.
 *
 * **Nothing here is reversible.** That is why the confirmation is a
 * [three-second hold](../../components/ui/HoldButton.tsx) rather than a second
 * button, and why the mutation is deliberately unshared: it exists for exactly
 * one caller, the [sale dialog](../../components/squad/SellDialog.tsx).
 *
 * A failure part-way through still **invalidates**, because the players sold
 * before it really are gone — leaving the squad list showing them would be the
 * worse lie. What is invalidated is the whole league key: the squad has lost
 * players, `/me` has a new budget, the market may hold a new listing, and the
 * lineup behind them has changed shape. One coarse drop is cheaper to reason
 * about than four precise ones, and this happens at most once a session.
 */
export function useSellPlayers(
  leagueId: string | undefined,
): UseMutationResult<void, Error, SellSubject[]> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (players: SellSubject[]) => {
      if (leagueId === undefined) {
        throw new Error('Cannot sell without a league.')
      }

      const failed: string[] = []
      for (const player of players) {
        try {
          // No body. See `endpoints.leagues.marketSell` for what is known
          // about the shape and why it was not probed any further.
          await post(endpoints.leagues.marketSell(leagueId, player.id), {})
        } catch (error) {
          failed.push(`${player.name} (${toApiError(error).message})`)
        }
      }

      if (failed.length > 0) {
        throw new Error(
          failed.length === players.length
            ? `Kickbase hat den Verkauf abgelehnt: ${failed.join(', ')}`
            : `Nicht alle Spieler konnten verkauft werden: ${failed.join(', ')}`,
        )
      }
    },
    onSettled: async () => {
      if (leagueId === undefined) return
      await queryClient.invalidateQueries({ queryKey: qk.league(leagueId) })
    },
  })
}
