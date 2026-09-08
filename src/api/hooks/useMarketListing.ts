import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'

import { api, post } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
import { qk } from '@/api/queryKeys'
import type { ListPlayerRequest } from '@/api/types'

/**
 * The **selling** side of the market: putting one of your own players up,
 * taking him down again, and answering what somebody bids — either way.
 *
 * Bidding lives in [`useMarketOffers`](./useMarketOffers.ts) and selling to
 * Kickbase outright in [`useSellPlayers`](./useSellPlayers.ts). The four
 * mutations here are the parts the app had documented and never called.
 *
 * All of them **invalidate the whole league key**, as the sale does: a player
 * changing hands or price moves the squad, the budget, the market, the
 * player's own page and the activity feed at once, and one coarse drop is
 * cheaper to reason about than five precise ones on an action nobody fires
 * twice a minute.
 */

/** Putting a player up, or re-pricing the listing he is already on. */
export interface ListPlayerVariables {
  playerId: string
  /** Asking price, in €. */
  price: number
}

/**
 * List one of your own players at a price you set.
 *
 * The body is the **abbreviated** `{ pi, prc }` — the opposite convention to
 * the `{ price }` a bid takes one path segment away, and `{ playerId, price }`
 * answers 500 `NotFound`.
 *
 * **Sending it for a player already listed re-prices him** rather than being
 * refused, so the price dialog needs no separate call and no withdraw-first
 * dance. Probed 2026-09-08: five prices in a row, each read back on the next
 * request.
 */
export function useListPlayer(
  leagueId: string | undefined,
): UseMutationResult<void, Error, ListPlayerVariables> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ playerId, price }: ListPlayerVariables) => {
      if (leagueId === undefined) {
        throw new Error('Cannot list a player without a league.')
      }
      const body: ListPlayerRequest = { pi: playerId, prc: price }
      await post(endpoints.leagues.market(leagueId), body)
    },
    onSuccess: () => invalidateLeague(queryClient, leagueId),
  })
}

/**
 * Take your own listing back off the market.
 *
 * `DELETE`, and **idempotent** — a second one answers `200` again rather than
 * 404, so a double tap is harmless. Standing bids are dropped with it; what
 * Kickbase tells the bidders is not established.
 */
export function useWithdrawListing(
  leagueId: string | undefined,
): UseMutationResult<void, Error, { playerId: string }> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ playerId }: { playerId: string }) => {
      if (leagueId === undefined) {
        throw new Error('Cannot withdraw a listing without a league.')
      }
      await api.delete(endpoints.leagues.marketListing(leagueId, playerId))
    },
    onSuccess: () => invalidateLeague(queryClient, leagueId),
  })
}

/**
 * One bid on one of your listings — the shape of both answers to it, accept
 * and decline alike, which take the identical path and body.
 */
export interface AcceptOfferVariables {
  playerId: string
  /** The offer's id — `uoid` on the listing. */
  offerId: string
}

/**
 * Accept a bid: the player goes to that manager and the money comes to you.
 *
 * **Not reversible**, which is why the dialog behind it is a
 * [two-second hold](../../components/ui/HoldButton.tsx) — the same treatment
 * selling to Kickbase gets.
 *
 * **Never fired against a real offer.** The verb is established (`OPTIONS`
 * answers `405 allow: POST`) and a made-up offer id answers 500 `NotFound`,
 * but producing a genuine bid costs a second account, so the success path is
 * unproven (**?**). If Kickbase wants a body here, this is the first place to
 * look — an empty one is what the sibling writes take.
 *
 * `NotFound` is **re-worded** rather than left to the shared mapping: the
 * generic copy for that name is about a league that no longer exists, and here
 * it means the bid is gone — withdrawn, or the listing already settled.
 */
export function useAcceptOffer(
  leagueId: string | undefined,
): UseMutationResult<void, Error, AcceptOfferVariables> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ playerId, offerId }: AcceptOfferVariables) => {
      if (leagueId === undefined) {
        throw new Error('Cannot accept an offer without a league.')
      }
      try {
        await post(
          endpoints.leagues.marketOfferAccept(leagueId, playerId, offerId),
          {},
        )
      } catch (error) {
        const apiError = toApiError(error)
        if (apiError.apiError === 'NotFound') {
          throw new Error(
            'Dieses Gebot gibt es nicht mehr — es wurde zurückgezogen oder der Spieler ist schon weg.',
          )
        }
        throw apiError
      }
    },
    onSuccess: () => invalidateLeague(queryClient, leagueId),
  })
}

/**
 * Turn a bid down.
 *
 * The mirror of {@link useAcceptOffer}, and the quieter half of it: nothing
 * changes hands, the player stays yours and the listing stays up, so the only
 * thing lost is the bid itself. That is why the dialog asks with a
 * [second question](../../components/player/PlayerSaleDialogs.tsx) rather than
 * a two-second hold — reversible enough for a tap, deliberate enough not to be
 * one tap.
 *
 * **Never fired against a real offer** either (**?**), for the same reason: a
 * genuine bid needs a second account. The `NotFound` rewording is the accept's,
 * because the state it describes is the accept's — the bid is gone, whether it
 * was withdrawn or the listing has already settled.
 */
export function useDeclineOffer(
  leagueId: string | undefined,
): UseMutationResult<void, Error, AcceptOfferVariables> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ playerId, offerId }: AcceptOfferVariables) => {
      if (leagueId === undefined) {
        throw new Error('Cannot decline an offer without a league.')
      }
      try {
        await post(
          endpoints.leagues.marketOfferDecline(leagueId, playerId, offerId),
          {},
        )
      } catch (error) {
        const apiError = toApiError(error)
        if (apiError.apiError === 'NotFound') {
          throw new Error(
            'Dieses Gebot gibt es nicht mehr — es wurde zurückgezogen oder der Spieler ist schon weg.',
          )
        }
        throw apiError
      }
    },
    onSuccess: () => invalidateLeague(queryClient, leagueId),
  })
}

async function invalidateLeague(
  queryClient: ReturnType<typeof useQueryClient>,
  leagueId: string | undefined,
): Promise<void> {
  if (leagueId === undefined) return
  await queryClient.invalidateQueries({ queryKey: qk.league(leagueId) })
}
