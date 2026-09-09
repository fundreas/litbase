import {
  Flag,
  Gavel,
  RefreshCw,
  Store,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'

import { useLeagueDetails } from '@/api/hooks/useLeague'
import { useMarket } from '@/api/hooks/useMarket'
import { useMarketValueChanges } from '@/api/hooks/useMarketValueChanges'
import { useCurrentMatchday } from '@/api/hooks/useMatchday'
import type { Market, MarketListing } from '@/api/models'
import { useAuth } from '@/auth/useAuth'
import { PageHeading } from '@/components/PageHeading'
import { ManagerListingsTab } from '@/components/market/ManagerListingsTab'
import { MarketRow } from '@/components/market/MarketRow'
import { OfferDialog } from '@/components/market/OfferDialog'
import { OwnListingsTab } from '@/components/market/OwnListingsTab'
import { BottomTabBar, type BottomTab } from '@/components/ui/BottomTabBar'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useActiveLeague } from '@/league/useActiveLeague'
import { nowMs } from '@/lib/clock'
import { COUNTDOWN_SECONDS_FROM, kickoff, money } from '@/lib/format'
import { maximumOffer } from '@/lib/offerRules'
import { useHashModal } from '@/lib/useHashModal'

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

/**
 * The page's three views, as path segments.
 *
 * `market` is the **bare** route (`/leagues/:leagueId/market`), so its value is
 * only ever used to name the view, never appended to a URL.
 */
const VIEWS = {
  market: 'market',
  managers: 'managers',
  offers: 'offers',
} as const

type View = (typeof VIEWS)[keyof typeof VIEWS]

/**
 * The page's shared clock. One interval for the whole list — see `MarketRow`.
 *
 * `null` stops it. Only Kickbase's listings count down — the other two views
 * hold listings with no expiry at all — and a clock nothing reads is a
 * re-render of the page once a second.
 */
function useTick(intervalMs: number | null): number {
  const [now, setNow] = useState(() => nowMs())

  useEffect(() => {
    if (intervalMs === null) return undefined
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
 * The transfer market — **Kickbase's listings, soonest to expire first.**
 *
 * The ordering is the page's argument. A listing settles the moment its
 * countdown reaches zero — to the highest bid standing at that instant, with
 * no second round — so the ones about to close are the only ones you can still
 * do anything about.
 *
 * Every row is two targets: the portrait opens the player, everything else
 * opens the bid dialog. See [`MarketRow`](../components/market/MarketRow.tsx).
 *
 * ## One payload, up to three views
 *
 * The market response holds three different things in one array, and only the
 * first of them belongs in a list ordered by urgency:
 *
 * | View | Segment | What is in it |
 * | ---- | ------- | ------------- |
 * | *Markt* | `market` | Kickbase's own listings — the ones with a clock |
 * | *Manager* | `market/managers` | what the rest of the league is selling, cheapest against the market value first — [`ManagerListingsTab`](../components/market/ManagerListingsTab.tsx) |
 * | *Gebote* | `market/offers` | your listings, and the league's bids on them — [`OwnListingsTab`](../components/market/OwnListingsTab.tsx) |
 *
 * A manager's listing has **no expiry at all**: it stands until he withdraws
 * it or takes a bid. Mixed into the market list it could only sort last, a
 * heap at the bottom under rows counting down — the same page telling you to
 * hurry about one listing and nothing at all about the next. Split off, each
 * list gets the ordering its own kind of listing deserves.
 *
 * ## The view is a path segment
 *
 * Switched by a [`BottomTabBar`](../components/ui/BottomTabBar.tsx) like every
 * other multi-view page in the app — the thumb is already down there, and each
 * view is then linkable and survives a refresh. Its *Gebote* tab carries a
 * **badge** counting the bids standing on your listings, which is the one
 * thing on this page that arrives while you are not looking at it and is worth
 * a mark that says so. *Manager* carries none: a listing appearing there is
 * news about the league, not a thing waiting for an answer from you, and a
 * badge that counts everything counts for nothing.
 *
 * **Each tab appears only when its side is inhabited**, and the bar only when
 * two of them are: a tab that opens an empty view is a question with one
 * answer, and a one-tab bar spends a row of screen height offering no choice.
 * A view reached by URL keeps the bar whatever the data says, so a bookmark to
 * a side that has since emptied still has its way back rather than being a
 * dead end.
 */
export function MarketPage() {
  const { league, leagueId, competitionId } = useActiveLeague()
  const { user } = useAuth()
  const location = useLocation()
  const view: View = location.pathname.endsWith(`/${VIEWS.offers}`)
    ? VIEWS.offers
    : location.pathname.endsWith(`/${VIEWS.managers}`)
      ? VIEWS.managers
      : VIEWS.market
  const { data, isPending, isError, error, refetch } = useMarket(leagueId)
  const matchday = useCurrentMatchday(competitionId)
  // For `upe` — whether this league lets a bid fall below the market value.
  // Cached ten minutes and already fetched by the events page, so arriving from
  // there costs nothing.
  const details = useLeagueDetails(leagueId)
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
  // Only Kickbase's list counts down: the other two views hold listings with
  // no expiry at all, and a clock nothing reads is a re-render a second.
  const now = useTick(
    view !== VIEWS.market ? null : isClosing ? TICK_FAST_MS : TICK_MS,
  )

  /**
   * Which listing's bid dialog is open — `#offer:<playerId>`, so the back
   * gesture closes it and a refresh under it reopens it on the same player.
   * See [`useHashModal`](../lib/useHashModal.ts).
   *
   * The hash carries the id, not the listing: the market refetches every half
   * minute, and the dialog has to keep showing the *current* offer state of
   * the player it was opened for rather than a snapshot from whenever it was
   * tapped. A player whose listing has since expired is no longer in the list,
   * and the dialog then stays shut rather than bidding into a closed auction.
   */
  const offer = useHashModal('offer')

  // What every standing bid would cost together, if every one of them won.
  const committed = (listings ?? []).reduce(
    (total, listing) => total + (listing.ownOffer ?? 0),
    0,
  )
  // …and how far the sum of them is allowed to go: budget plus 33 % of team
  // value. Kickbase enforces this on the *total*, not per bid.
  const ceiling = maximumOffer({
    allowsUnderpay: details.data?.allowsUnderpay,
    budget: league.budget,
    teamValue: data?.teamValue,
    committedElsewhere: 0,
  })
  const afterOffers = league.budget - committed

  /**
   * The payload cut three ways: **Kickbase's**, **another manager's**, and
   * **yours**.
   *
   * A listing names its seller (`u`) or has none at all, and the signed-in
   * manager's id is on the session, so all three need nothing fetched. Each
   * one is a view, and an empty one is a tab that does not appear.
   */
  const houseListings = (listings ?? []).filter(
    (listing) => listing.seller === undefined,
  )
  const managerListings = (listings ?? []).filter(
    (listing) => listing.seller !== undefined && listing.seller.id !== user?.id,
  )
  const ownListings = (listings ?? []).filter(
    (listing) => listing.seller !== undefined && listing.seller.id === user?.id,
  )
  const received = ownListings.reduce(
    (total, listing) => total + listing.offers.length,
    0,
  )

  /* What the `#offer:` hash names, resolved against the listings you can
     actually bid on — Kickbase's and the league's. A stale URL naming a player
     of your own opens nothing rather than a bid dialog for a bid Kickbase
     would refuse. */
  const selected =
    [...houseListings, ...managerListings].find(
      (listing) => listing.id === offer.id,
    ) ?? null

  const base = `/leagues/${leagueId}/${VIEWS.market}`
  /* Each side of the payload earns its tab by having something in it — or by
     being the view you are on, so a link to a side that has since emptied
     keeps its way back instead of becoming a dead end. The order is fixed and
     the optional tabs are inserted in it rather than appended, because it is
     the order of the market itself: the house, the league, then you. */
  const tabs: BottomTab[] = [
    { value: VIEWS.market, label: 'Markt', icon: Store, to: base },
    ...(managerListings.length > 0 || view === VIEWS.managers
      ? [
          {
            value: VIEWS.managers,
            label: 'Manager',
            icon: Users,
            to: `${base}/${VIEWS.managers}`,
          },
        ]
      : []),
    ...(ownListings.length > 0 || view === VIEWS.offers
      ? [
          {
            value: VIEWS.offers,
            label: 'Gebote',
            icon: Gavel,
            to: `${base}/${VIEWS.offers}`,
            // Bids from other managers, on players of yours. The count is the
            // whole reason to go and look, and it lands without anything on
            // screen moving.
            badge: received,
          },
        ]
      : []),
  ]
  const bar =
    tabs.length > 1 ? (
      <BottomTabBar tabs={tabs} active={view} ariaLabel="Marktansicht" />
    ) : null

  const heading = (
    <PageHeading
      title="Transfermarkt"
      subtitle={
        <span className="flex flex-wrap items-center gap-x-2">
          <span>
            Budget <span className="nums">{money(league.budget)}</span>
          </span>
          {/* What is left **if every standing bid wins**, and nothing else on
              the page adds them up. Kickbase counts them all against one
              ceiling — budget plus 33 % of team value — so the three colours
              are three different situations: inside the budget (accent),
              borrowing, which is allowed (amber), and past the ceiling, where
              the next bid is refused outright (red). The last is reachable
              without doing anything: the nightly recalculation moves both team
              value and the ceiling under bids already standing. */}
          {committed > 0 && (
            <span
              className={
                ceiling !== undefined && committed > ceiling
                  ? 'text-negative'
                  : afterOffers < 0
                    ? 'text-warning'
                    : 'text-accent'
              }
              title="Budget, wenn alle offenen Gebote angenommen werden"
            >
              nach Geboten <span className="nums">{money(afterOffers)}</span>
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
        {bar}
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
        {bar}
      </div>
    )
  }

  /* The seller's view is the whole page, so it returns before the buying side
     is built: no list of twenty rows to make, and the `#offer:` dialog — which
     is a bid of one's own, opened from a market row — has no business here. */
  if (view === VIEWS.offers) {
    return (
      <div className="flex flex-col gap-4">
        {heading}
        <OwnListingsTab listings={ownListings} leagueId={leagueId} />
        {bar}
      </div>
    )
  }

  /* The list this view is: the league's, or Kickbase's — and the one you are
     not on is never built, since an unchosen branch of a ternary is never
     evaluated. Both are the buying side and both hand their rows to the
     `#offer:` dialog below: a bid on a manager's listing is the same bid,
     seeded the same way and counted against the same ceiling. */
  const buying =
    view === VIEWS.managers ? (
      <ManagerListingsTab
        listings={managerListings}
        leagueId={leagueId}
        fixtureByTeamId={matchday.data?.fixtureByTeamId}
        onOffer={offer.open}
      />
    ) : houseListings.length === 0 ? (
      <EmptyState
        icon={<Store size={22} />}
        title="Keine Spieler auf dem Markt"
        description="Kickbase stellt laufend neue Spieler ein — schau später wieder vorbei."
      />
    ) : (
      <ul className="flex flex-col gap-2">
        {withMilestones(data, houseListings, now).map((entry) =>
          entry.kind === 'milestone' ? (
            <Milestone
              key={`${entry.label}-${String(entry.at)}`}
              milestone={entry}
            />
          ) : (
            <MarketRow
              key={entry.listing.id}
              listing={entry.listing}
              leagueId={leagueId}
              fixture={matchday.data?.fixtureByTeamId.get(entry.listing.teamId)}
              marketValueChange={marketValueChanges.get(entry.listing.id)}
              now={now}
              onOffer={() => {
                offer.open(entry.listing.id)
              }}
            />
          ),
        )}
      </ul>
    )

  return (
    <div className="flex flex-col gap-4">
      {heading}

      {buying}

      {selected !== null && (
        // Keyed by player: the dialog seeds its amount once, at mount, so a
        // fresh component per listing is what keeps a background refetch from
        // overwriting a half-typed figure.
        <OfferDialog
          key={selected.id}
          listing={selected}
          leagueId={leagueId}
          rules={{
            allowsUnderpay: details.data?.allowsUnderpay,
            budget: league.budget,
            teamValue: data.teamValue,
            // This listing's own bid is **not** committed: re-bidding on the
            // same player replaces the standing offer rather than adding a
            // second one.
            committedElsewhere: committed - (selected.ownOffer ?? 0),
          }}
          marketValueChange={marketValueChanges.get(selected.id)}
          onClose={offer.close}
        />
      )}

      {bar}
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
 * would be a line about nothing. Only the *Markt* view's listings are cut this
 * way, and every one of them has an expiry; the `Infinity` fallback stands for
 * the wire sending a listing without one, which lands it below every rule —
 * correct, since nothing is known to settle it.
 */
function withMilestones(
  market: Market,
  /** The listings to cut — the *Markt* view's, not the whole payload. */
  listings: MarketListing[],
  now: number,
): Entry[] {
  // How far out the rules are worth drawing: the last listing that has an
  // expiry at all. Beyond it there is nothing left to divide.
  const horizon = listings.reduce(
    (latest, listing) => Math.max(latest, listing.expiresAt ?? 0),
    0,
  )

  const pending: Milestone[] = [
    ...marketValueMilestones(market.marketValueUpdateAt, horizon),
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

  for (const listing of listings) {
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

/** The recalculation runs **nightly**; the response names only the next one. */
const MARKET_VALUE_PERIOD_MS = 24 * 60 * 60_000

/** Enough for any listing the market holds, and a stop against a bad `mvud`. */
const MAX_MARKET_VALUE_MILESTONES = 7

/**
 * Every recalculation between now and the last listing's expiry — not just the
 * one the response names.
 *
 * A listing can run two and a half days, which is **three** recalculations, and
 * a row sitting after the second is worth a different amount of caution than
 * one sitting after the first. `mvud` gives only the next; the rest follow at a
 * day's spacing, which is what the field has been observed to do (20:00 UTC,
 * every night).
 */
function marketValueMilestones(
  first: number | undefined,
  horizon: number,
): Milestone[] {
  if (first === undefined) return []

  const milestones: Milestone[] = []
  for (
    let at = first;
    at <= horizon && milestones.length < MAX_MARKET_VALUE_MILESTONES;
    at += MARKET_VALUE_PERIOD_MS
  ) {
    milestones.push({
      kind: 'milestone',
      at,
      label: 'Neue Marktwerte',
      icon: RefreshCw,
    })
  }
  // The first one always earns its line, even when every listing settles
  // before it: "nothing here survives tonight" is worth saying too.
  return milestones.length > 0
    ? milestones
    : [
        {
          kind: 'milestone',
          at: first,
          label: 'Neue Marktwerte',
          icon: RefreshCw,
        },
      ]
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
