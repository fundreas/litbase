import { Flag, RefreshCw, Store, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useMarket } from '@/api/hooks/useMarket'
import { useMarketValueChanges } from '@/api/hooks/useMarketValueChanges'
import { useCurrentMatchday } from '@/api/hooks/useMatchday'
import type { Market, MarketListing } from '@/api/models'
import { PageHeading } from '@/components/PageHeading'
import { MarketRow } from '@/components/market/MarketRow'
import { OfferDialog } from '@/components/market/OfferDialog'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useActiveLeague } from '@/league/useActiveLeague'
import { nowMs } from '@/lib/clock'
import { COUNTDOWN_SECONDS_FROM, kickoff, money } from '@/lib/format'

/**
 * How often the countdowns are redrawn, at rest.
 *
 * [`duration()`](../lib/format.ts) shows whole minutes above three, so a
 * per-second tick would re-render twenty rows to change nothing fifty-nine
 * times out of sixty.
 */
const TICK_MS = 10_000

/** …and once a listing is inside its last minutes, when it counts seconds. */
const TICK_FAST_MS = 1_000

/**
 * Switch to the fast tick slightly *before* the seconds appear, so the first
 * one drawn is right. Crossing the boundary on a ten-second tick would
 * otherwise show `2:51` where `3:00` belonged.
 */
const FAST_FROM_SECONDS = COUNTDOWN_SECONDS_FROM + 30

/** The page's shared clock. One interval for the whole list — see `MarketRow`. */
function useTick(intervalMs: number): number {
  const [now, setNow] = useState(() => nowMs())

  useEffect(() => {
    const id = setInterval(() => {
      setNow(nowMs())
    }, intervalMs)
    return () => {
      clearInterval(id)
    }
  }, [intervalMs])

  return now
}

/**
 * The transfer market: everything on offer, soonest to expire first.
 *
 * The ordering is the page's argument. A listing settles the moment its
 * countdown reaches zero — to the highest bid standing at that instant, with
 * no second round — so the ones about to close are the only ones you can still
 * do anything about. Manager listings, which have no expiry at all, sort last.
 *
 * Every row is two targets: the portrait opens the player, everything else
 * opens the bid dialog. See [`MarketRow`](../components/market/MarketRow.tsx).
 */
export function MarketPage() {
  const { league, leagueId, competitionId } = useActiveLeague()
  const { data, isPending, isError, error, refetch } = useMarket(leagueId)
  const matchday = useCurrentMatchday(competitionId)
  const listings = data?.listings
  const marketValueChanges = useMarketValueChanges(leagueId, listings)

  // The list is sorted by expiry, so the first listing that has one is the
  // soonest — no scan needed. Everything speeds up together: one interval
  // serves the page, and only the closing row is changing anyway.
  const soonestExpiry = listings?.find(
    (listing) => listing.expiresAt !== undefined,
  )?.expiresAt
  const isClosing =
    soonestExpiry !== undefined &&
    soonestExpiry - nowMs() < FAST_FROM_SECONDS * 1000
  const now = useTick(isClosing ? TICK_FAST_MS : TICK_MS)

  // The id, not the listing: the market refetches every half minute, and the
  // dialog has to keep showing the *current* offer state of the player it was
  // opened for rather than a snapshot from whenever it was tapped.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected =
    listings?.find((listing) => listing.id === selectedId) ?? null

  // What every standing bid would cost together, if every one of them won.
  const committed = (listings ?? []).reduce(
    (total, listing) => total + (listing.ownOffer ?? 0),
    0,
  )

  const heading = (
    <PageHeading
      title="Transfermarkt"
      subtitle={
        <span className="flex flex-wrap items-center gap-x-2">
          <span>
            Budget <span className="nums">{money(league.budget)}</span>
          </span>
          {/* What is left **if every standing bid wins**. Kickbase checks each
              offer against the budget on its own, so a manager with five live
              bids can be committed to far more than they have — and nothing
              else on the page adds them up. */}
          {committed > 0 && (
            <span
              className={
                league.budget - committed < 0 ? 'text-negative' : 'text-accent'
              }
              title="Budget, wenn alle offenen Gebote angenommen werden"
            >
              nach Geboten{' '}
              <span className="nums">{money(league.budget - committed)}</span>
            </span>
          )}
        </span>
      }
    />
  )

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        {heading}
        <SkeletonList rows={8} />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        {heading}
        <ErrorState
          error={error}
          onRetry={() => {
            void refetch()
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {heading}

      {data.listings.length === 0 ? (
        <EmptyState
          icon={<Store size={22} />}
          title="Keine Spieler auf dem Markt"
          description="Kickbase stellt laufend neue Spieler ein — schau später wieder vorbei."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {withMilestones(data, now).map((entry) =>
            entry.kind === 'milestone' ? (
              <Milestone key={entry.label} milestone={entry} />
            ) : (
              <MarketRow
                key={entry.listing.id}
                listing={entry.listing}
                leagueId={leagueId}
                fixture={matchday.data?.fixtureByTeamId.get(
                  entry.listing.teamId,
                )}
                marketValueChange={marketValueChanges.get(entry.listing.id)}
                now={now}
                onOffer={() => {
                  setSelectedId(entry.listing.id)
                }}
              />
            ),
          )}
        </ul>
      )}

      {selected !== null && (
        // Keyed by player: the dialog seeds its amount once, at mount, so a
        // fresh component per listing is what keeps a background refetch from
        // overwriting a half-typed figure.
        <OfferDialog
          key={selected.id}
          listing={selected}
          leagueId={leagueId}
          budget={league.budget}
          marketValueChange={marketValueChanges.get(selected.id)}
          onClose={() => {
            setSelectedId(null)
          }}
        />
      )}
    </div>
  )
}

/** A moment the list is cut at, and what happens then. */
interface Milestone {
  kind: 'milestone'
  at: number
  label: string
  icon: LucideIcon
}

type Entry = Milestone | { kind: 'listing'; listing: MarketListing }

/**
 * Cut the list where the two things that change a listing's worth happen.
 *
 * The list is ordered by expiry, which makes it a timeline — so the nightly
 * market-value recalculation and the matchday's first kick-off can be drawn
 * *into* it, and every row's position says whether it settles before or after
 * them. Both matter to a bid: a listing closing after the recalculation is
 * settled against a value nobody knows yet, and one closing after kick-off is
 * a player who may already have played the matchday you were buying him for.
 *
 * A milestone already past is dropped rather than drawn at the top, where it
 * would be a line about nothing. Listings with no expiry sort last and take
 * `Infinity` here, so every remaining milestone lands above them — correct:
 * a manager's listing outlives all of this.
 */
function withMilestones(market: Market, now: number): Entry[] {
  const pending: Milestone[] = [
    market.marketValueUpdateAt === undefined
      ? undefined
      : {
          kind: 'milestone' as const,
          at: market.marketValueUpdateAt,
          label: 'Neue Marktwerte',
          icon: RefreshCw,
        },
    market.matchdayStartAt === undefined
      ? undefined
      : {
          kind: 'milestone' as const,
          at: market.matchdayStartAt,
          label:
            market.day === undefined
              ? 'Anpfiff'
              : `Anpfiff ${String(market.day)}. Spieltag`,
          icon: Flag,
        },
  ]
    .filter((milestone) => milestone !== undefined)
    .filter((milestone) => milestone.at > now)
    .sort((a, b) => a.at - b.at)

  const entries: Entry[] = []
  let next = pending.shift()

  for (const listing of market.listings) {
    const expiry = listing.expiresAt ?? Number.POSITIVE_INFINITY
    while (next !== undefined && next.at <= expiry) {
      entries.push(next)
      next = pending.shift()
    }
    entries.push({ kind: 'listing', listing })
  }

  // Anything left falls after every listing on the page.
  while (next !== undefined) {
    entries.push(next)
    next = pending.shift()
  }
  return entries
}

/** The rule itself: a hairline, with the moment named in the gap. */
function Milestone({ milestone }: { milestone: Milestone }) {
  const Icon = milestone.icon

  return (
    <li className="flex items-center gap-2 px-1 pt-2 pb-1">
      <span className="h-px flex-1 bg-line" />
      <span className="flex items-center gap-1.5 text-[0.6875rem] font-semibold tracking-wide text-muted uppercase">
        <Icon size={12} aria-hidden="true" className="shrink-0" />
        {milestone.label}
        <span className="nums font-normal text-faint">
          {kickoff(new Date(milestone.at).toISOString())}
        </span>
      </span>
      <span className="h-px flex-1 bg-line" />
    </li>
  )
}
