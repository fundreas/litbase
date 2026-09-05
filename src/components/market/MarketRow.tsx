import { TrendingDown, TrendingUp } from 'lucide-react'
import { Link } from 'react-router'

import {
  POSITION_LABEL,
  type MarketListing,
  type TeamFixture,
} from '@/api/models'
import { FixtureBadge } from '@/components/squad/FixtureBadge'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'
import { duration, money, moneyDelta, time } from '@/lib/format'

/**
 * One listing.
 *
 * **Two targets, and the split is the portrait.** Tapping the player's picture
 * opens his page — the reference move, the one you make to check a scoring
 * history before deciding. Tapping anywhere else opens the bid dialog, because
 * that is what the market is *for*, and it deserves the large target rather
 * than the small one.
 *
 * `now` is passed in rather than read here so every row on the page counts down
 * against the same instant — twenty rows each holding their own interval would
 * drift apart visibly and re-render the list twenty times a second.
 */
export function MarketRow({
  listing,
  leagueId,
  fixture,
  marketValueChange,
  now,
  onOffer,
}: {
  listing: MarketListing
  leagueId: string
  /** The player's club's next fixture, if the matchday is known. */
  fixture: TeamFixture | undefined
  /** Move over the last 24 hours; `undefined` until the lookup lands. */
  marketValueChange: number | undefined
  /** The page's shared clock, in epoch millis. */
  now: number
  onOffer: () => void
}) {
  const { ownOffer, seller, price, marketValue } = listing
  const ChangeIcon =
    marketValueChange !== undefined && marketValueChange < 0
      ? TrendingDown
      : TrendingUp

  /* Flush portrait, matching the squad row: the Kickbase cutouts are
     transparent PNGs, so a wash grounds the figure and the inner edge is
     masked to dissolve into the row rather than ending on a line. */
  const portrait = (
    <Link
      to={`/leagues/${leagueId}/players/${listing.id}`}
      aria-label={`${listing.lastName} öffnen`}
      className={cn(
        'flex w-14 shrink-0 self-stretch',
        'transition-opacity hover:opacity-80',
      )}
    >
      <Avatar
        src={listing.image}
        name={listing.lastName}
        fill
        className={cn(
          'w-full self-stretch bg-transparent',
          'bg-linear-to-t from-surface-2/60 to-transparent to-70%',
          '[mask-image:linear-gradient(to_right,#000_65%,transparent)]',
        )}
      />
    </Link>
  )

  return (
    <li
      className={cn(
        'flex items-stretch overflow-hidden rounded-card border bg-surface',
        // A standing bid marks the **whole row**, the same outline the squad
        // page uses for a player marked for sale. A label under the price said
        // the same thing in a place you had to look for it; an outline is seen
        // while scanning the list, which is when it matters.
        ownOffer === undefined
          ? 'border-line'
          : 'border-accent bg-accent/5 ring-1 ring-accent',
      )}
    >
      {portrait}

      <button
        type="button"
        onClick={onOffer}
        aria-label={`Für ${listing.lastName} bieten`}
        className="flex min-w-0 flex-1 items-stretch text-left transition-colors hover:bg-surface-2"
      >
        <span className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">
              {listing.lastName}
            </span>

            {/* Position, and who you would be buying from — when there is
                anyone. A computer listing has no seller on the wire, and
                naming Kickbase in that slot says nothing you could act on:
                the absence of a manager *is* the fact. The position takes the
                line instead, and shares it when a manager is there. */}
            <span className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted">
              <span className="shrink-0 tracking-wide uppercase">
                {POSITION_LABEL[listing.position]}
              </span>
              {seller !== undefined && (
                <>
                  <span aria-hidden="true" className="text-faint">
                    ·
                  </span>
                  <Avatar src={seller.image} name={seller.name} size={14} />
                  <span className="truncate">{seller.name}</span>
                </>
              )}
            </span>
          </span>

          <span className="shrink-0 text-right">
            {/* **One figure, the one that answers the question.** Your own
                offer if you have made one, else what a manager is asking, else
                the market value — which is what a computer listing charges
                anyway. Printing all three stacked them into a column the eye
                had to reconcile, and two of them are usually the same number.
                The row's outline says when the figure is your own bid. */}
            <span
              className={cn(
                'nums block text-sm font-semibold',
                ownOffer === undefined ? 'text-ink' : 'text-accent',
              )}
            >
              {money(ownOffer ?? (seller === undefined ? marketValue : price))}
            </span>

            {/* The overnight move as the subtitle: the one thing about the
                figure above that is not visible in the figure above. */}
            <span
              className={cn(
                'nums flex items-center justify-end gap-0.5 text-xs',
                marketValueChange !== undefined &&
                  marketValueChange > 0 &&
                  'text-positive',
                marketValueChange !== undefined &&
                  marketValueChange < 0 &&
                  'text-negative',
                (marketValueChange === undefined || marketValueChange === 0) &&
                  'text-faint',
              )}
              title="Marktwertänderung in den letzten 24 Stunden"
            >
              {marketValueChange !== undefined && marketValueChange !== 0 && (
                <ChangeIcon size={11} aria-hidden="true" className="shrink-0" />
              )}
              {moneyDelta(marketValueChange)}
              <span className="sr-only"> in den letzten 24 Stunden</span>
            </span>
          </span>
        </span>

        <span className="flex shrink-0 items-center self-stretch border-l border-line bg-canvas/40 px-2.5">
          <FixtureBadge fixture={fixture} size="md" />
        </span>

        <Countdown expiresAt={listing.expiresAt} now={now} />
      </button>
    </li>
  )
}

/**
 * How long the listing has left, and when that is.
 *
 * Both, because they answer different questions: "3 Std." is what you plan
 * around, "22:48" is what you set an alarm for. A manager's listing has
 * neither — it runs until they withdraw it or accept — and says so rather than
 * showing a dash that would read as missing data.
 */
function Countdown({
  expiresAt,
  now,
}: {
  expiresAt: number | undefined
  now: number
}) {
  const panel =
    'flex w-[4.5rem] shrink-0 flex-col items-center justify-center gap-0.5 self-stretch border-l border-line bg-canvas/40 px-1.5 text-center'

  if (expiresAt === undefined) {
    return (
      <span className={panel}>
        <span className="text-[0.6875rem] leading-tight text-muted">offen</span>
        <span className="text-[0.625rem] leading-tight text-faint">
          bis Verkauf
        </span>
      </span>
    )
  }

  const secondsLeft = Math.round((expiresAt - now) / 1000)
  // Under an hour the listing is about to settle, and that is the one moment
  // the countdown is worth reading twice — so it takes the accent.
  const isUrgent = secondsLeft > 0 && secondsLeft < 3600

  return (
    <span className={panel}>
      <span
        className={cn(
          'nums text-[0.6875rem] leading-tight font-semibold',
          isUrgent ? 'text-accent' : 'text-ink',
        )}
      >
        {duration(secondsLeft)}
      </span>
      <span className="nums text-[0.625rem] leading-tight text-faint">
        {time(new Date(expiresAt).toISOString())}
      </span>
    </span>
  )
}
