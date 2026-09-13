import {
  Flag,
  Gavel,
  RefreshCw,
  Store,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'
import { useLocation } from 'react-router'

import { useTeamDirectory } from '@/api/hooks/useCompetition'
import { useLeagueDetails } from '@/api/hooks/useLeague'
import { useMarket } from '@/api/hooks/useMarket'
import { useMarketValueChanges } from '@/api/hooks/useMarketValueChanges'
import { useCurrentMatchday, useSeasonFixtures } from '@/api/hooks/useMatchday'
import { useStartProbabilities } from '@/api/hooks/useStartProbabilities'
import {
  fixtureAfter,
  offersReceived,
  ownListingsOf,
  type Market,
  type MarketListing,
  type ScheduledMatchday,
  type TeamFixture,
} from '@/api/models'
import { useAuth } from '@/auth/useAuth'
import { PageHeading } from '@/components/PageHeading'
import { ManagerListingsTab } from '@/components/market/ManagerListingsTab'
import { MarketRow } from '@/components/market/MarketRow'
import { OfferDialog } from '@/components/market/OfferDialog'
import { OwnListingsTab } from '@/components/market/OwnListingsTab'
import { useExpectedPointsView } from '@/components/squad/useExpectedPointsView'
import { BottomTabBar, type BottomTab } from '@/components/ui/BottomTabBar'
import { Card } from '@/components/ui/Card'
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
  /* The season's fixtures, keyed by matchday — **not** just the current one.
     Every listing settles at an instant of its own, and the match a buyer
     actually gets is the first one that has not kicked off by then, so each
     row resolves its own opponent against this. Same cache entry as the
     current matchday above: no second request. See {@link fixtureFor}. */
  const seasonFixtures = useSeasonFixtures(competitionId)
  // For `upe` — whether this league lets a bid fall below the market value.
  // Cached ten minutes and already fetched by the events page, so arriving from
  // there costs nothing.
  const details = useLeagueDetails(leagueId)
  const listings = data?.listings
  const marketValueChanges = useMarketValueChanges(leagueId, listings)
  /* The two marks about the coming matchday, for every row of both buying
     views — see [`MarketRow`](../components/market/MarketRow.tsx).

     Neither costs this page a request. The market payload carries `prob`
     itself, and the gaps in it are filled out of `qk.playerDetail`, which the
     24-hour move above has already fetched for every listing. The expected
     points are one static file per competition and matchday, shared with the
     Kader — a manager arriving from his own squad pays for none of it twice. */
  const startProbabilities = useStartProbabilities(leagueId, listings)
  const expected = useExpectedPointsView(matchday.data?.day)
  /* His own club's crest, for the end of each row's name line. The market
     payload names the club (`tid`) and does not picture it, so the crest comes
     from the season's table — one request, cached ten minutes, and the same
     cache entry the league table, the club pages and the Spieltag already
     read. A club the current table does not hold simply has no crest, which is
     how every other consumer of the directory treats it. */
  const teams = useTeamDirectory(competitionId)

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
  const ownListings = ownListingsOf(listings, user?.id)
  /* The same count the [shell's notice](../components/layout/OfferNotice.tsx)
     announces, from the same function — the badge on this bar and the row
     under the header are two views of one figure and must not disagree. */
  const received = offersReceived(listings, user?.id).length

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
        {/* Inside the card the rows will land in, the way the
            [feed](../components/events/ActivityFeed.tsx) waits: the shape on
            screen does not change when the listings arrive, only its
            contents. */}
        <Card className="p-3">
          <SkeletonList rows={8} />
        </Card>
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
        matchdays={seasonFixtures.data}
        teams={teams.data}
        startProbabilities={startProbabilities}
        expected={expected}
        onOffer={offer.open}
      />
    ) : houseListings.length === 0 ? (
      <EmptyState
        icon={<Store size={22} />}
        title="Keine Spieler auf dem Markt"
        description="Kickbase stellt laufend neue Spieler ein — schau später wieder vorbei."
      />
    ) : (
      /* **A card per group, rows flush inside it** — the shape the
         [activity feed](../components/events/ActivityFeed.tsx) has, cut where
         the clock cuts the market. Inside a card a hairline between neighbours
         replaces the 8px of page that used to show through; between two cards
         the moment that divides them is named on a rule of its own, outside
         either of them.

         **The card is what makes a group a group.** It opens *and closes* — a
         rounded bottom edge under the last listing before the kick-off — so a
         set is seen as a set rather than inferred from a band drawn across a
         list that never ends. A separator that ran wall to wall inside one
         card read as a table's section row, which is a different thing
         entirely: these are independent blocks with a line between them.

         `overflow-hidden` on the card, not the rows: the first and last rows
         are clipped to its corners, which is what lets a row carry a
         full-bleed portrait and no rounding of its own. */
      <div className="flex flex-col gap-2">
        {groupByMilestone(data, houseListings, now).map((group) => (
          <Fragment
            key={
              group.milestone === undefined
                ? 'open'
                : `${group.milestone.label}-${String(group.milestone.at)}`
            }
          >
            {group.milestone !== undefined && (
              <Milestone milestone={group.milestone} />
            )}
            {group.listings.length > 0 && (
              <Card className="overflow-hidden">
                <ul className="divide-y divide-line">
                  {group.listings.map((listing) => (
                    <MarketRow
                      key={listing.id}
                      listing={listing}
                      leagueId={leagueId}
                      {...fixtureFor(seasonFixtures.data, listing, now)}
                      team={teams.data?.get(listing.teamId)}
                      marketValueChange={marketValueChanges.get(listing.id)}
                      startProbability={startProbabilities.get(listing.id)}
                      expectedPoints={expected.entry(listing.id)}
                      now={now}
                      onOffer={() => {
                        offer.open(listing.id)
                      }}
                    />
                  ))}
                </ul>
              </Card>
            )}
          </Fragment>
        ))}
      </div>
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

/**
 * **The fixture a listing is bought for**, and which matchday that is.
 *
 * Not the current matchday: a listing settles at its own instant, and from the
 * matchday's first kick-off onwards a transfer no longer delivers into it — a
 * bid won on Saturday evening hands you a player whose match this weekend has
 * already been played without him. So the opponent a row shows is the first
 * matchday's that has **not** started when the listing expires, which on a
 * matchday afternoon means the rows below the *Anpfiff* rule name a different
 * club from the rows above it. That split is the point, and the rule is where
 * it becomes visible.
 *
 * A listing with no expiry on the wire is measured against the clock instead —
 * the same reading a manager's listing gets, since "whenever it settles" is
 * the best that can be said of it.
 *
 * Spread straight into the row, which is why the keys are its prop names.
 */
function fixtureFor(
  matchdays: ScheduledMatchday[] | undefined,
  listing: MarketListing,
  now: number,
): { fixture: TeamFixture | undefined; fixtureDay: number | undefined } {
  const upcoming = fixtureAfter(
    matchdays,
    listing.teamId,
    listing.expiresAt ?? now,
  )
  return { fixture: upcoming?.fixture, fixtureDay: upcoming?.matchday.day }
}

/** A moment the list is cut at, and what happens then. */
interface Milestone {
  kind: 'milestone'
  at: number
  label: string
  icon: LucideIcon
}

/**
 * One group of listings: everything that settles before the next thing to
 * happen, and the moment that opened the group.
 *
 * `milestone` is `undefined` on the **first** group only — the listings
 * settling before anything at all changes. A group with a milestone and no
 * listings is a moment that falls after every listing on the page, and draws
 * as a separator with nothing under it.
 */
interface ListingGroup {
  /** What happened just before these listings. `undefined` for the first. */
  milestone?: Milestone
  listings: MarketListing[]
}

/**
 * Cut the list where the two things that change a listing's worth happen.
 *
 * The list is ordered by expiry, which makes it a timeline — so the nightly
 * market-value recalculation and the matchday's first kick-off cut it into
 * groups, and every row's group says whether it settles before or after them.
 * Both matter to a bid: a listing closing after the recalculation is settled
 * against a value nobody knows yet, and one closing after kick-off is a player
 * who may already have played the matchday you were buying him for.
 *
 * **Groups rather than one list with rules in it.** Each group is drawn as its
 * own card, so it opens and *closes* — the last listing before a kick-off has
 * a rounded bottom edge, which is what makes the set read as a set. See
 * {@link Milestone} for the separator between two of them.
 *
 * A milestone already past is dropped rather than drawn at the top, where it
 * would be a line about nothing. Only the *Markt* view's listings are cut this
 * way, and every one of them has an expiry; the `Infinity` fallback stands for
 * the wire sending a listing without one, which lands it below every rule —
 * correct, since nothing is known to settle it.
 */
function groupByMilestone(
  market: Market,
  /** The listings to cut — the *Markt* view's, not the whole payload. */
  listings: MarketListing[],
  now: number,
): ListingGroup[] {
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

  const groups: ListingGroup[] = []
  // The listings before anything happens. Dropped at the end if the first
  // milestone is already due — which is the market at five to eight in the
  // evening, every listing on the page settling after tonight's recalculation.
  let current: ListingGroup = { listings: [] }
  let next = pending.shift()

  for (const listing of listings) {
    const expiry = listing.expiresAt ?? Number.POSITIVE_INFINITY
    while (next !== undefined && next.at <= expiry) {
      groups.push(current)
      current = { milestone: next, listings: [] }
      next = pending.shift()
    }
    current.listings.push(listing)
  }
  groups.push(current)

  // Anything left falls after every listing on the page: a separator, and
  // nothing under it. Worth drawing — "nothing here survives tonight" is a
  // thing to know before bidding.
  while (next !== undefined) {
    groups.push({ milestone: next, listings: [] })
    next = pending.shift()
  }

  return groups.filter(
    (group) => group.milestone !== undefined || group.listings.length > 0,
  )
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

/**
 * The cut itself: a **rule between two cards**, with the moment named in its
 * gap.
 *
 * It sits *outside* the groups, on the page rather than in a card, and that is
 * the whole of the reasoning. Drawn inside one long card it became a band
 * running from one border to the other — a table's section heading, which says
 * "the list continues, in a new section". What happens here is stronger than
 * that: the listings above it settle under one set of facts and the ones below
 * under another, so they are separate blocks, and the line between them belongs
 * to neither.
 *
 * The time rides in the label, not at the right edge: there is no card here to
 * give it a column, and a figure floated to the far side of an empty rule reads
 * as unrelated to the words at the middle of it.
 */
function Milestone({ milestone }: { milestone: Milestone }) {
  const Icon = milestone.icon

  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <span className="h-px flex-1 bg-line" />
      <span className="flex items-center gap-1.5 text-[0.6875rem] font-semibold tracking-wide text-muted uppercase">
        <Icon size={12} aria-hidden="true" className="shrink-0" />
        {milestone.label}
        <span className="nums font-normal text-faint">
          {kickoff(new Date(milestone.at).toISOString())}
        </span>
      </span>
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}
