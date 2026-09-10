import { ChevronRight, Gavel, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { useMarket } from '@/api/hooks/useMarket'
import { offersReceived, ownListingsOf } from '@/api/models'
import { useAuth } from '@/auth/useAuth'
import { useActiveLeague } from '@/league/useActiveLeague'
import { cn } from '@/lib/cn'

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
 * The **X** dismisses the bids standing *now* — it does not stop the poll and
 * it does not turn the notice off. Three things bring the row back, and they
 * are the three ways the situation can change:
 *
 *  - **A new bid.** What is dismissed is a set of offer ids, not a flag and
 *    not a count: an id nobody has closed the row on is a bid the reader has
 *    not seen, so the row returns counting all of them again. A count would
 *    have been fooled by one bid pulled and another placed between two polls.
 *  - **A reload.** The set is React state and **deliberately not persisted**.
 *    A bid is money waiting on an answer and it stands until it is answered,
 *    so the reader should meet it again on the next visit; a dismissal that
 *    outlived the tab would quietly bury a live offer for as long as it stood.
 *  - **Switching leagues.** The set is reset with the league — see below.
 *
 * The row stays up **on the *Gebote* view as well**, where the bids it counts
 * are listed. It is the one page where it is redundant, and hiding it there
 * was worse than redundant: it read as the notice being consumed by the tap
 * that opened the view, and the count vanished from the chrome at the moment
 * the reader was working through it.
 */
export function OfferNotice() {
  const { leagueId } = useActiveLeague()
  const { user } = useAuth()
  const { data } = useMarket(leagueId)

  const offers = offersReceived(data?.listings, user?.id)
  const ids = offers.map((offer) => offer.id)

  /**
   * The ids the X was pressed on, alongside the league they belong to.
   *
   * Adjusted **during render** when the league changes, the pattern the
   * [shell](./AppShell.tsx) uses for the drawer: this component is not
   * remounted by a league switch — the shell outlives it — and a set carried
   * across would dismiss bids in a market it was never shown in.
   */
  const [dismissed, setDismissed] = useState<{
    leagueId: string
    ids: string[]
  }>({ leagueId, ids: [] })
  if (dismissed.leagueId !== leagueId) {
    setDismissed({ leagueId, ids: [] })
  }

  const isPending = ids.some((id) => !dismissed.ids.includes(id))
  if (!isPending) return null

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
        to={`/leagues/${leagueId}/market/offers`}
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
          setDismissed({ leagueId, ids })
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
