import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'

import { api, post } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import { qk } from '@/api/queryKeys'
import type { PlaceOfferRequest, PlaceOfferResponse } from '@/api/types'

/** Bidding on one listing. */
export interface PlaceOfferVariables {
  playerId: string
  /** Offer price, in €. */
  price: number
}

/** Withdrawing a bid. The id comes back as `ownOfferId` on the listing. */
export interface WithdrawOfferVariables {
  playerId: string
  offerId: string
}

/**
 * Bid on a market listing.
 *
 * The body is `{ price }` **spelled out** — the abbreviated `{ prc }` every
 * other write on this API would take is rejected with 400 `InvalidData`.
 * Verified against the live API, as is the rest of the offer surface; see
 * [docs/pages/market.md](../../docs/pages/market.md).
 *
 * Bidding costs nothing up front: the budget is only debited when the listing
 * settles, so an offer placed and withdrawn leaves no trace on the account.
 * That is what makes this safe to expose as a plain button.
 *
 * On success the market is invalidated — the listing comes back carrying
 * `uop`/`uoid`, which is how the row knows to show *your* offer rather than
 * the asking price.
 */
export function usePlaceOffer(
  leagueId: string | undefined,
): UseMutationResult<PlaceOfferResponse, Error, PlaceOfferVariables> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ playerId, price }: PlaceOfferVariables) => {
      if (leagueId === undefined) {
        throw new Error('Cannot place an offer without a league.')
      }
      const body: PlaceOfferRequest = { price }
      return post<PlaceOfferResponse>(
        endpoints.leagues.marketOffers(leagueId, playerId),
        body,
      )
    },
    onSuccess: async () => {
      if (leagueId === undefined) return
      await queryClient.invalidateQueries({ queryKey: qk.market(leagueId) })
    },
  })
}

/**
 * Withdraw one's own offer.
 *
 * `DELETE`, which the shared `get`/`post` helpers do not cover — this is the
 * app's only one, so it goes through the axios instance directly rather than
 * growing a helper with a single caller.
 */
export function useWithdrawOffer(
  leagueId: string | undefined,
): UseMutationResult<void, Error, WithdrawOfferVariables> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ playerId, offerId }: WithdrawOfferVariables) => {
      if (leagueId === undefined) {
        throw new Error('Cannot withdraw an offer without a league.')
      }
      await api.delete(
        endpoints.leagues.marketOffer(leagueId, playerId, offerId),
      )
    },
    onSuccess: async () => {
      if (leagueId === undefined) return
      await queryClient.invalidateQueries({ queryKey: qk.market(leagueId) })
    },
  })
}
