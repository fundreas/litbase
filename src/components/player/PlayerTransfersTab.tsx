import { Store } from 'lucide-react'

import type { PlayerTransfer, TransferParty } from '@/api/models'
import { Avatar } from '@/components/ui/Avatar'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { money, moneyDelta, time, weekdayDate } from '@/lib/format'

/**
 * Every hand the player has passed through in this league, newest first.
 *
 * ## One row per event, not per owner
 *
 * The wire gives a chain of ownership events and names only the manager who
 * *received* the player on each — a sale back to Kickbase names nobody at all.
 * [`toTransferHistory`](../../api/models.ts) folds that into the pair of
 * parties each row wants, which is what lets a row say *Von Marvin* rather
 * than leaving the reader to pair it up with the line below.
 *
 * The **manager on the row is the one who acted**: the buyer on a purchase,
 * the seller on a sale. So the faces down the left are the league's managers
 * rather than an alternating column of Kickbase's shop icon, and the line
 * under each name says which way the player went.
 *
 * ## The second figure
 *
 * A fee alone is not a judgement — 12 Mio. is a bargain or a disaster
 * depending on the day. So each priced row carries the fee against the market
 * value **of that day**, exactly as the
 * [transfer sheet](../events/ActivityDialogs.tsx) does on the events page, and
 * for the same reason: today's value has moved since and says nothing about
 * the deal.
 *
 * **The colour reads from the acting manager's side**, which means it flips
 * with the direction. Paying over the market value is a paper loss the moment
 * the player lands, so an *Aufpreis* on a purchase is red; being paid over it
 * is a win, so the same sign on a sale is green.
 *
 * The market values arrive with the Markt tab's request, so a row shows the
 * fee first and grows its comparison when that lands — the panel is never
 * blocked on it, and a player whose deal predates the year Kickbase serves
 * simply keeps the fee on its own.
 */
export function PlayerTransfersTab({
  transfers,
  viewerId,
}: {
  transfers: PlayerTransfer[]
  /** The signed-in manager, badged where they are a party. */
  viewerId: string | undefined
}) {
  if (transfers.length === 0) {
    return (
      <EmptyState
        title="Keine Transfers"
        description="Diesen Spieler hat in dieser Liga noch niemand besessen."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Transferhistorie"
          action={
            <span className="nums text-xs text-faint">
              {transfers.length}{' '}
              {transfers.length === 1 ? 'Eintrag' : 'Einträge'}
            </span>
          }
        />
        <ul className="divide-y divide-line">
          {transfers.map((transfer) => (
            <li key={transfer.date}>
              <TransferRow transfer={transfer} viewerId={viewerId} />
            </li>
          ))}
        </ul>
      </Card>

      <p className="px-1 text-[0.6875rem] text-faint">
        Nur diese Liga – die Historie beginnt mit dem Liga-Start. Der zweite
        Betrag ist die Differenz zum Marktwert des Transfertages.
      </p>
    </div>
  )
}

/**
 * One event: who did it, which way the player went, and what it cost.
 *
 * A row with no manager on either side is possible in principle — a chain that
 * opens with a sale — and falls back to Kickbase's own mark rather than an
 * empty circle.
 */
function TransferRow({
  transfer,
  viewerId,
}: {
  transfer: PlayerTransfer
  viewerId: string | undefined
}) {
  const actor = transfer.to ?? transfer.from
  const isViewer = actor?.id !== undefined && actor.id === viewerId

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {actor === undefined ? <KickbaseMark /> : <PartyAvatar party={actor} />}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {actor?.name ?? 'Kickbase'}
          {isViewer && (
            <span className="ml-1.5 text-xs font-medium text-accent">du</span>
          )}
        </p>
        <p className="truncate text-xs text-muted">
          {counterparty(transfer)} · {weekdayDate(transfer.date)}
          <span className="nums text-faint"> {time(transfer.date)}</span>
        </p>
      </div>

      <span className="shrink-0 text-right">
        <span
          className={cn(
            'nums block text-sm font-semibold',
            transfer.fee > 0 ? 'text-ink' : 'text-faint',
          )}
        >
          {transfer.fee > 0 ? money(transfer.fee) : '–'}
        </span>
        {transfer.premium !== undefined && (
          <span
            className={cn(
              'nums block text-xs',
              premiumTone(transfer.kind, transfer.premium),
            )}
          >
            {moneyDelta(transfer.premium)}
          </span>
        )}
      </span>
    </div>
  )
}

/** The other side of the deal, in the words the row has room for. */
function counterparty(transfer: PlayerTransfer): string {
  switch (transfer.kind) {
    case 'granted':
      return 'Startkader'
    case 'bought':
      return `Von ${transfer.from?.name ?? 'Kickbase'}`
    case 'sold':
      return 'An Kickbase verkauft'
    case 'released':
      return 'Freigegeben'
    default:
      // A transfer type the API has not shown us. Named, not guessed at.
      return 'Wechsel'
  }
}

/**
 * Green where the acting manager came out ahead.
 *
 * Over the market value is bad for a buyer and good for a seller, so the sign
 * means opposite things on the two directions and the colour has to follow the
 * side rather than the sign.
 */
function premiumTone(kind: PlayerTransfer['kind'], premium: number): string {
  if (premium === 0) return 'text-faint'
  const favourable = kind === 'sold' ? premium > 0 : premium < 0
  return favourable ? 'text-positive' : 'text-negative'
}

function PartyAvatar({ party }: { party: TransferParty }) {
  return <Avatar src={party.image} name={party.name} size={36} />
}

/** Kickbase itself as a party — the market's own icon, at avatar size. */
function KickbaseMark() {
  return (
    <span
      aria-hidden="true"
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-faint"
    >
      <Store size={18} />
    </span>
  )
}
