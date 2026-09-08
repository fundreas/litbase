import { Store, Tag } from 'lucide-react'
import { useState } from 'react'

import type { PlayerListingOffer, PlayerOfferState } from '@/api/models'
import { ReceivedOfferRow } from '@/components/market/ReceivedOfferRow'
import {
  AcceptOfferDialog,
  ListPlayerDialog,
  SellToKickbaseDialog,
  type SaleSubject,
} from '@/components/player/PlayerSaleDialogs'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { money } from '@/lib/format'

/**
 * **What the owner can do with his own player**, at the head of the Transfers
 * tab.
 *
 * The tab is otherwise a record of what has already happened, and this is the
 * one place on the page where the next entry in that record can be written. It
 * shows only to the manager who owns him — for everyone else the API has no
 * such verbs, and the page stays a read.
 *
 * ## Two ways out, and they are genuinely different
 *
 * *An Kickbase* is a sale at the market value, right now, to nobody. *Auf den
 * Markt* is an ask: the league sees him, managers bid, and the money can be
 * more or less than he is worth. So they are two buttons rather than one
 * dialog with a mode — the choice is made before the figure, not after it.
 *
 * Both of them and the accept are the same decision seen from three sides, so
 * all three dialogs live together in
 * [`PlayerSaleDialogs`](./PlayerSaleDialogs.tsx).
 *
 * ## The offers
 *
 * They arrive from other managers while the page is open, which is why the
 * query behind this **polls at thirty seconds while a listing stands** — the
 * market page's cadence, for the market page's reason. Tapping one opens the
 * accept-or-decline dialog. The rows are the market page's own — see
 * [`ReceivedOfferRow`](../market/ReceivedOfferRow.tsx), which is where the
 * seller's side is shown for *every* listed player at once.
 *
 * **An empty list is not proof of an empty market.** `ofs` carries the offers
 * *this account may see*; that it includes every bid on one's own listing is
 * the documented reading and is unproven (**?**), so the card says "keine
 * Gebote" only in the sense of "none Kickbase is showing you".
 */
export function PlayerOwnerActions({
  player,
  market,
  isLoading,
  leagueId,
}: {
  player: SaleSubject
  /** Listing and bids, once the market state lands. */
  market: PlayerOfferState | undefined
  isLoading: boolean
  leagueId: string
}) {
  const [dialog, setDialog] = useState<
    | { kind: 'sell' }
    | { kind: 'list' }
    | { kind: 'accept'; offer: PlayerListingOffer }
    | undefined
  >(undefined)

  const askingPrice = market?.isListed === true ? market.price : undefined
  const offers = market?.isListed === true ? (market.offers ?? []) : []

  return (
    <>
      <Card>
        <CardHeader
          title="Dein Spieler"
          action={
            isLoading ? (
              <Skeleton className="h-4 w-24" />
            ) : (
              <span className="nums text-xs text-faint">
                {askingPrice === undefined
                  ? 'Nicht auf dem Markt'
                  : `Angeboten für ${money(askingPrice)}`}
              </span>
            )
          }
        />

        <div className="flex gap-2 p-3">
          <Button
            variant="secondary"
            fullWidth
            leadingIcon={<Store size={16} aria-hidden="true" />}
            onClick={() => {
              setDialog({ kind: 'sell' })
            }}
          >
            An Kickbase
          </Button>
          <Button
            fullWidth
            /* Disabled only until the market state lands: opening the price
               dialog before it does would seed the field from a listing we
               have not read yet and quietly re-price him at market value. */
            disabled={isLoading}
            leadingIcon={<Tag size={16} aria-hidden="true" />}
            onClick={() => {
              setDialog({ kind: 'list' })
            }}
          >
            {askingPrice === undefined ? 'Auf den Markt' : 'Preis ändern'}
          </Button>
        </div>
      </Card>

      {askingPrice !== undefined && (
        <Card>
          <CardHeader
            title="Gebote"
            action={
              <span className="nums text-xs text-faint">
                {offers.length === 0
                  ? 'keine'
                  : `${String(offers.length)} · höchstes ${money(offers[0]?.amount ?? 0)}`}
              </span>
            }
          />
          {offers.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted">
              Noch kein Manager hat geboten.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {offers.map((offer) => (
                <li key={offer.id}>
                  <ReceivedOfferRow
                    offer={offer}
                    marketValue={player.marketValue}
                    onOpen={() => {
                      setDialog({ kind: 'accept', offer })
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {dialog?.kind === 'sell' && (
        <SellToKickbaseDialog
          player={player}
          leagueId={leagueId}
          onClose={() => {
            setDialog(undefined)
          }}
          onSold={() => {
            setDialog(undefined)
          }}
        />
      )}

      {dialog?.kind === 'list' && (
        <ListPlayerDialog
          player={player}
          askingPrice={askingPrice}
          leagueId={leagueId}
          onClose={() => {
            setDialog(undefined)
          }}
        />
      )}

      {dialog?.kind === 'accept' && (
        <AcceptOfferDialog
          player={player}
          offer={dialog.offer}
          leagueId={leagueId}
          onClose={() => {
            setDialog(undefined)
          }}
          onAccepted={() => {
            setDialog(undefined)
          }}
        />
      )}
    </>
  )
}
