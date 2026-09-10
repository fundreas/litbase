import { ChevronRight, Gavel, X } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useLocation } from 'react-router'

import { useMarket } from '@/api/hooks/useMarket'
import { offersReceived, ownListingsOf } from '@/api/models'
import { useAuth } from '@/auth/useAuth'
import { useActiveLeague } from '@/league/useActiveLeague'
import { cn } from '@/lib/cn'
import { markOffersSeen, useSeenOffers } from '@/lib/seenOffers'

/**
 * **"3 Gebote für 2 deiner Spieler"** — a row under the app bar, on every page
 * of the league, whenever another manager has bid on a player you put on the
 * market.
 *
 * It is the one thing in this app that arrives while you are looking at
 * something else and **goes away if you ignore it**: a bid stands until you
 * accept it, decline it, or the bidder pulls it, and the market page's *Gebote*
 * tab — the only place it is otherwise visible — is a view you have no reason
 * to open on the off-chance. So the shell carries the count and the way there,
 * and nothing else does.
 *
 * ## Inside the sticky header, not under it
 *
 * The row is rendered by [`Header`](./Header.tsx) as its second line, so it
 * belongs to the same sticky block as the app bar and stays on screen while you
 * scroll a squad of twenty. A sibling below the header would have scrolled
 * away, and a notice you have to scroll up to re-read is a notice you stop
 * trusting.
 *
 * That makes the header taller while the row is up, which everything pinned
 * *below* the header has to know about: the [sidebar](./NavSidebar.tsx), the
 * squad's [sale calculator](../../pages/SquadPage.tsx). It is told in CSS, not
 * in props — the row marks itself `data-offer-notice` and
 * [`index.css`](../../index.css) grows `--header-total` by `--notice-h` for a
 * document that contains one. The same `:has()` arrangement the shell already
 * uses to hide the floating dots under a docked bottom bar: no state to lift,
 * and nothing for a page to remember.
 *
 * ## It costs no request of its own
 *
 * The bids arrive in the market payload, on your own listings, in `ofs` — see
 * {@link ownListingsOf}. Mounting [`useMarket`](../../api/hooks/useMarket.ts)
 * here is what makes that payload the app's **one poll**: it is the same query
 * key the market page reads, so the two share one cache entry and one timer,
 * and arriving on *Transfermarkt* from anywhere finds the list already there.
 * React Query pauses the interval while the tab is in the background, so a
 * phone in a pocket costs nothing.
 *
 * The rate is that query's own **thirty seconds** rather than a minute of its
 * own: two intervals on one key would both have fired, and the shorter of the
 * two is the one the market's countdowns already justify.
 *
 * ## Closing it, and what brings it back
 *
 * The **X** dismisses the bids standing *now*. It does not stop the poll and
 * does not turn the notice off: the next bid is one you have not been told
 * about, and the row comes back with it, counting all of them again. What is
 * remembered is a set of offer ids rather than a flag — see
 * [`seenOffers`](../../lib/seenOffers.ts) for why, and for why it is written
 * down rather than held in state.
 *
 * **Opening *Gebote* counts as being told**, on the same set of ids, however
 * you got there. Without it the row would be waiting again the moment you
 * navigated away from the view it had just sent you to, which is the ordinary
 * way through it. And while that view is open the row hides altogether: it
 * would be a link to the page underneath it, over a list of the very bids it
 * is counting.
 */
export function OfferNotice() {
  const { leagueId } = useActiveLeague()
  const { user } = useAuth()
  const location = useLocation()
  const { data } = useMarket(leagueId)
  const seen = useSeenOffers(leagueId)

  const offers = offersReceived(data?.listings, user?.id)
  const ids = offers.map((offer) => offer.id)
  /* The effect's dependency below, and the reason the ids are joined rather
     than handed over as the array: that array is rebuilt on every poll,
     whether anything moved or not. */
  const key = ids.join(',')

  const offersPath = `/leagues/${leagueId}/market/offers`
  const isOnOffers = location.pathname === offersPath
  const hasUnseen = ids.some((id) => !seen.includes(id))

  /* Reading the bids where they live is being told about them, so the visit
     writes the dismissal the X would have written. An effect because it is a
     write to storage — the store outside React that the row renders off —
     rather than a piece of state to keep in step; `hasUnseen` keeps a poll
     that moved nothing from writing anything. */
  useEffect(() => {
    if (!isOnOffers || !hasUnseen) return
    markOffersSeen(leagueId, key === '' ? [] : key.split(','))
  }, [isOnOffers, hasUnseen, key, leagueId])

  if (offers.length === 0 || !hasUnseen || isOnOffers) return null

  // How many of your listings those bids are spread over — the count alone
  // would leave "3 Gebote" ambiguous between three managers after one player
  // and one after each of three.
  const listingCount = ownListingsOf(data?.listings, user?.id).filter(
    (listing) => listing.offers.length > 0,
  ).length

  return (
    <div
      // What `index.css` looks for to make room below the header. See above.
      data-offer-notice=""
      className={cn(
        'flex h-(--notice-h) items-stretch',
        'border-t border-accent/25 bg-accent/12',
      )}
    >
      <Link
        to={offersPath}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 px-3 lg:px-4',
          'transition-colors hover:bg-accent/20',
          'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        )}
      >
        <Gavel size={14} aria-hidden="true" className="shrink-0 text-accent" />
        {/* `aria-live`, because the row appears while the reader is somewhere
            else entirely — the whole point of it — and a screen reader would
            otherwise only meet it on the next pass through the header. */}
        <span
          aria-live="polite"
          className="nums min-w-0 flex-1 truncate text-xs font-semibold text-ink"
        >
          {offers.length === 1
            ? 'Ein Gebot'
            : `${String(offers.length)} Gebote`}
          <span className="font-normal text-muted">
            {listingCount === 1
              ? ' für einen deiner Spieler'
              : ` für ${String(listingCount)} deiner Spieler`}
          </span>
        </span>
        <ChevronRight
          size={14}
          aria-hidden="true"
          className="shrink-0 text-accent"
        />
      </Link>

      {/* Beside the link rather than inside it: a button nested in an anchor
          is not markup a browser has to make sense of. */}
      <button
        type="button"
        onClick={() => {
          markOffersSeen(leagueId, ids)
        }}
        title="Hinweis ausblenden"
        aria-label="Hinweis ausblenden"
        className={cn(
          'flex w-9 shrink-0 items-center justify-center',
          'text-muted transition-colors hover:bg-accent/20 hover:text-ink',
          'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        )}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
