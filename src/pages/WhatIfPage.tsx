import { Calculator, ChevronDown, Gavel, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'

import { useTeamDirectory } from '@/api/hooks/useCompetition'
import { useLeagueDetails, useLeagueManager } from '@/api/hooks/useLeague'
import { useMarket } from '@/api/hooks/useMarket'
import {
  useCurrentMatchday,
  useUpcomingMatchday,
} from '@/api/hooks/useMatchday'
import { usePlaceOffer, useWithdrawOffer } from '@/api/hooks/useMarketOffers'
import { usePlayerDetail } from '@/api/hooks/usePlayer'
import { useSquadForecasts } from '@/api/hooks/usePlayerForecast'
import { useSquad } from '@/api/hooks/useSquad'
import { useStartProbabilities } from '@/api/hooks/useStartProbabilities'
import { useStatusReasons } from '@/api/hooks/useStatusReasons'
import {
  forecastDays,
  forecastValueOn,
  offerBaseline,
  type MarketListing,
  type PlayerDetail,
  type SquadMember,
} from '@/api/models'
import {
  OfferAmountField,
  OfferListingFacts,
} from '@/components/market/OfferFields'
import { LineupTab } from '@/components/squad/LineupTab'
import { PlayerListTab } from '@/components/squad/PlayerListTab'
import { SquadLegendDialog } from '@/components/squad/SquadLegendDialog'
import { SwapDialog } from '@/components/squad/SwapDialog'
import { useLineupEditor } from '@/components/squad/useLineupEditor'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { CHIP_ROW_END, FilterChip } from '@/components/ui/FilterChip'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useActiveLeague } from '@/league/useActiveLeague'
import { cn } from '@/lib/cn'
import { money, moneyDelta, moneyExact, weekdayDay } from '@/lib/format'
import { checkOffer, debtAllowance, maximumOffer } from '@/lib/offerRules'

/** The three views, sharing one scenario. */
const TABS = { offer: 'offer', squad: 'squad', lineup: 'lineup' } as const
type Tab = (typeof TABS)[keyof typeof TABS]

/**
 * **"What if?"** — the squad rearranged around a transfer that has not
 * happened.
 *
 * ## Two scenarios, one page
 *
 * The target is in the path and the path is what picks the scenario:
 *
 *  - `/whatif/:playerId` — **"what if I bought him?"**. Three tabs: the bid,
 *    the sales that would fund it, the eleven it would change.
 *  - `/squad/whatif` — **"what if I sold them?"**. The same page with the
 *    target and its offer tab taken out, reached from the Kader's own toolbar.
 *    Nothing is being bought, so there is no bid to type and nothing on the
 *    page is real; it is the sale calculator with a pitch attached, which is
 *    the question the [sale calculator](./SquadPage.tsx) could not answer —
 *    *who would I be fielding afterwards?*
 *
 * Everything below is written about the purchase, because it is the fuller of
 * the two; the sale scenario is it minus the target.
 *
 * ## The bids already standing
 *
 * A manager with three live bids does not have the budget the app shows him;
 * he has that budget minus three purchases that may all land tonight. So the
 * scenario counts them — **every one of them, until it is switched off**, from
 * the [panel in the header](#OffersPanel): their money leaves the projection
 * and their players arrive on the bench, because "what if they were accepted"
 * is a question about the eleven as much as about the money.
 *
 * **One bid at a time.** The summary row counts the lot or none of them; the
 * list behind its chevron carries a switch per bid, which is the question a
 * manager with three out actually has — *this* one I expect to win, those two
 * I do not, so what does that leave me? The exclusions are held as a set of
 * ids, so a bid placed or lost while the page is open joins or leaves the
 * reckoning on its own.
 *
 * The switches move the **projection and the squad only**. What the bid on the
 * offer tab is checked against does not move with them: `committedElsewhere`
 * is always the full sum, because Kickbase counts every standing bid against
 * the ceiling whether or not this page is imagining it accepted. Same rule as
 * the sales — see *the rules are the real ones* below.
 *
 * A bid is three questions that the [bid dialog](../components/market/OfferDialog.tsx)
 * could only ask the first of. *What will I pay* is arithmetic against a
 * budget; *can I afford it* is a question about who you would sell to fund it;
 * *is he worth it* is a question about who he would displace on the pitch. This
 * page holds all three at once, because the answers move each other: a sale
 * raises the budget, and a purchase only earns its money if it changes the
 * eleven.
 *
 * ## Nothing here happens, except the bid
 *
 * The sales are **hypothetical** — nobody is sold, no `POST` is sent, the
 * squad is untouched. So is the lineup: the editor runs as a
 * [sandbox](../components/squad/useLineupEditor.ts), because an eleven built
 * around a player you do not own is not a lineup any server would accept.
 *
 * The **bid is real**, and is the only thing on the page that is: placing it
 * and withdrawing it are the market's own mutations, unchanged. That
 * asymmetry is the point rather than an inconsistency — the scenario exists to
 * be *decided*, and the decision is the bid.
 *
 * The rules the bid is checked against are the **real** ones, too: budget and
 * team value as they stand, not as the scenario imagines them. Kickbase would
 * refuse a bid funded by a sale that has not happened, and a button that let
 * one through would be lying about which of the two numbers on screen the
 * server is reading.
 *
 * ## One scenario, three tabs
 *
 * Head tabs rather than the bottom bar the [squad](./SquadPage.tsx) and
 * [market](./MarketPage.tsx) use: those switch between views of data that is
 * simply *there*, while these three are steps in one piece of work, and the
 * state they share is the work. The tabs stay in reach of the figure they all
 * change — the projected budget above them, which is the scenario's answer.
 *
 * **Every exit is a back press.** Submitting, withdrawing and cancelling all
 * `navigate(-1)`, which lands on the market the bid dialog was opened from.
 * The scenario is memory only, so a forward press builds a fresh one out of
 * whatever the squad and the market then say — the sales it imagined are not
 * waiting to be re-imagined.
 *
 * ## `?bid=` seeds the amount, once
 *
 * The dialog hands over whatever was already typed into it, so crossing to the
 * page is not a retype. It is an **initial value and nothing more**: the field
 * takes it at mount and the query is never written again, because a URL that
 * tracked every keystroke would put a history entry behind each one. Absent,
 * malformed or non-numeric, the amount falls back to {@link offerBaseline},
 * exactly as the dialog's does.
 */
export function WhatIfPage() {
  const { league, leagueId, competitionId } = useActiveLeague()
  /** Absent on `/squad/whatif` — the scenario that sells and buys nobody. */
  const { playerId } = useParams()
  const isPurchase = playerId !== undefined
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  /**
   * **Which standing bids the scenario leaves out**, by listing id — empty,
   * because every one of them counts until it is switched off.
   *
   * Held as the *exclusions* rather than the inclusions so that a bid placed
   * while this page is open arrives counted, like every other: a set of
   * inclusions seeded at mount would silently drop it.
   *
   * Held here rather than in the scenario below because the header that
   * switches them is rendered by this component — the loading and error
   * branches need it before there is a scenario to hold anything.
   */
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(() => new Set())

  const market = useMarket(leagueId)
  const squad = useSquad(leagueId)
  // The budget is the manager's, not the squad's, so it is its own query — the
  // same small one the squad page reads.
  const manager = useLeagueManager(leagueId)
  // For `upe` — whether this league lets a bid fall below the market value.
  const details = useLeagueDetails(leagueId)
  /**
   * The target, in more detail than a listing carries.
   *
   * The listing has his money and his position; this has his points, his
   * fitness and his lineup probability, which is what the squad list and the
   * pitch draw for everybody else. Same cache entry the market page's 24-hour
   * lookup and the player page use, so it is usually already paid for.
   */
  const player = usePlayerDetail(leagueId, playerId)

  const listing = market.data?.listings.find((entry) => entry.id === playerId)

  /**
   * **Every other bid this account has standing**, as the listings they are on.
   *
   * The target's own is excluded, and not only for tidiness: re-bidding on the
   * same player *replaces* the standing offer rather than adding to it, so
   * counting it would spend his money twice. It is the same exclusion
   * {@link checkOffer}'s ceiling makes, which is why the sum below is what
   * feeds it.
   */
  const offers = useMemo(
    () =>
      (market.data?.listings ?? []).filter(
        (entry) => entry.ownOffer !== undefined && entry.id !== playerId,
      ),
    [market.data, playerId],
  )
  /**
   * …and the ones the scenario is actually counting — the switches' answer.
   *
   * Derived from `offers` each render rather than held, so that a bid placed
   * or lost while the page is open joins or leaves this list on its own. The
   * exclusions are ids and an id that no longer has a listing simply matches
   * nothing.
   */
  const counted = useMemo(
    () => offers.filter((entry) => !excluded.has(entry.id)),
    [offers, excluded],
  )
  const countedTotal = counted.reduce(
    (total, entry) => total + (entry.ownOffer ?? 0),
    0,
  )

  const toggleOffer = (offerId: string) => {
    setExcluded((current) => {
      const next = new Set(current)
      if (!next.delete(offerId)) next.add(offerId)
      return next
    })
  }
  /** All or nothing, from the summary row's own switch. */
  const setAllOffers = (counts: boolean) => {
    setExcluded(counts ? new Set() : new Set(offers.map((entry) => entry.id)))
  }

  const heading = (
    <ScenarioHeading
      listing={listing}
      subtitle={
        isPurchase ? 'Ein Kauf, durchgerechnet' : 'Verkäufe, durchgerechnet'
      }
      offers={offers}
      counted={counted}
      countedTotal={countedTotal}
      onToggleOffer={toggleOffer}
      onCountAll={setAllOffers}
      onLeave={() => {
        void navigate(-1)
      }}
    />
  )

  /* The market is only consulted for the target — his listing, and the team
     value the bid's ceiling is measured against. A sale scenario waits for
     neither: it is the squad and the budget, both of which it already has. */
  if (squad.isPending || (isPurchase && market.isPending)) {
    return (
      <div className="flex flex-col gap-4">
        {heading}
        <SkeletonList rows={6} />
      </div>
    )
  }

  if (squad.isError) {
    return (
      <div className="flex flex-col gap-4">
        {heading}
        <ErrorState
          error={squad.error}
          onRetry={() => {
            void squad.refetch()
          }}
        />
      </div>
    )
  }

  if (isPurchase && market.isError) {
    return (
      <div className="flex flex-col gap-4">
        {heading}
        <ErrorState
          error={market.error}
          onRetry={() => {
            void market.refetch()
          }}
        />
      </div>
    )
  }

  /* No listing, no scenario: the page's whole subject is a purchase, and one
     that cannot be bid on any more — expired, withdrawn, already sold — leaves
     nothing to calculate. The squad tabs would still work and would be a
     calculator answering a question nobody asked. */
  if (isPurchase && listing === undefined) {
    return (
      <div className="flex flex-col gap-4">
        {heading}
        <EmptyState
          icon={<Calculator size={22} />}
          title="Dieser Spieler steht nicht mehr auf dem Markt"
          description="Das Angebot ist abgelaufen, zurückgezogen oder schon verkauft."
        />
        <Button
          variant="secondary"
          onClick={() => {
            void navigate(-1)
          }}
        >
          Zurück
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {heading}

      <WhatIfScenario
        /* `undefined` is the sale scenario — the page without a purchase in
           it, and therefore without the tab the purchase is decided on. */
        listing={listing}
        /* Digits only, and only ever the starting figure. Anything else in
           `?bid=` — a word, a decimal, a hand-edited URL — falls through to
           the listing's own baseline rather than seeding the field with
           something that is not a number. */
        initialBid={digitsOrUndefined(searchParams.get('bid'))}
        player={player.data}
        squad={squad.data ?? []}
        leagueId={leagueId}
        competitionId={competitionId}
        budget={manager.data?.budget ?? league.budget}
        teamValue={market.data?.teamValue}
        allowsUnderpay={details.data?.allowsUnderpay}
        offers={offers}
        countedOffers={counted}
        onLeave={() => {
          void navigate(-1)
        }}
      />
    </div>
  )
}

/**
 * The scenario itself — held here rather than in the page because it is seeded
 * from data the page's loading branches have to return before.
 *
 * Three pieces of state, and all three are shared by all three tabs:
 *
 *  - the **bid**, because the tab it is typed on is not the tab where the
 *    budget it spends is felt;
 *  - the **sales**, marked on the Kader and paid into the budget the offer tab
 *    is checked against;
 *  - the **lineup**, which the sales take players out of and the purchase adds
 *    one to.
 *
 * Radix unmounts the tab that is not showing, which is exactly why none of it
 * can live in the tabs.
 *
 * **Without a `listing` this is the sale scenario**, and the difference is one
 * subtraction rather than a second implementation: no target on the bench, no
 * *Gebot* tab, no bid in the projection. Every other line below — the sales,
 * the sandbox pitch, the swap dialog, the legend — is the same code answering
 * the same question with one fewer term in it.
 */
function WhatIfScenario({
  listing,
  initialBid,
  player,
  squad,
  leagueId,
  competitionId,
  budget,
  teamValue,
  allowsUnderpay,
  offers,
  countedOffers,
  onLeave,
}: {
  /** The player being bought, or `undefined` for a scenario that only sells. */
  listing: MarketListing | undefined
  /** What the bid dialog already had in its field, if anything. */
  initialBid: string | undefined
  /** The target's fuller self, once it lands. */
  player: PlayerDetail | undefined
  squad: SquadMember[]
  leagueId: string
  competitionId: string
  budget: number
  teamValue: number | undefined
  allowsUnderpay: boolean | undefined
  /** The listings this account has a standing bid on, the target's aside. */
  offers: MarketListing[]
  /** The subset of them the header's switches have left imagined accepted. */
  countedOffers: MarketListing[]
  /** Back to wherever the bid dialog was — every conclusion uses it. */
  onLeave: () => void
}) {
  /* The bid is the purchase scenario's first question; with nobody to buy
     there is no such tab, and the Kader is where the scenario starts. */
  const [tab, setTab] = useState<Tab>(
    listing === undefined ? TABS.squad : TABS.offer,
  )
  const [amount, setAmount] = useState(() =>
    listing === undefined ? '' : (initialBid ?? String(offerBaseline(listing))),
  )
  /** Who would be sold to pay for him. Ids, as the sale calculator holds them. */
  const [sold, setSold] = useState<ReadonlySet<string>>(() => new Set())
  /**
   * **The day the sales are imagined to happen on** — an ISO date out of the
   * [forecast](../api/hooks/usePlayerForecast.ts), or `undefined` for the
   * value standing now.
   *
   * `undefined` is not "no answer" but the answer most of the time: the value
   * Kickbase is showing today is a fact, and every day on offer beside it is a
   * prediction. So the scenario starts on the fact, and the manager is the one
   * who asks for the prediction.
   */
  const [saleDate, setSaleDate] = useState<string | undefined>(undefined)
  /**
   * The symbol legend. `useState` rather than the squad page's `#legend` hash:
   * every exit from this page is a back press, and a hash layer over it would
   * spend one of those on closing a sheet instead of leaving the scenario.
   */
  const [isLegendOpen, setIsLegendOpen] = useState(false)

  const placeOffer = usePlaceOffer(leagueId)
  const withdrawOffer = useWithdrawOffer(leagueId)

  /**
   * The target as a squad member, so the list and the pitch can draw him with
   * everybody else — see {@link asMember}, which the players the standing bids
   * would bring in go through as well.
   *
   * He is the only one of them with a {@link PlayerDetail} behind him: the page
   * fetches one for the player it is about, and would not fetch a dozen more
   * for a bench.
   */
  const target = useMemo<SquadMember | undefined>(
    () => (listing === undefined ? undefined : asMember(listing, player)),
    [listing, player],
  )

  /**
   * **Your own players** — the Kader tab's list, and the only players the
   * scenario can sell.
   *
   * The target is filtered out. You cannot bid on your own listing, so he
   * would not normally be in here at all; the guard is what keeps a duplicate
   * id from giving two rows the same React key and putting one player on the
   * pitch twice.
   */
  const own = useMemo(
    () => squad.filter((member) => member.id !== target?.id),
    [squad, target?.id],
  )
  /**
   * **The players the standing bids would bring in**, while the header's
   * switch is on — benched, like the target, because a purchase that has not
   * been accepted has not picked itself.
   *
   * Built out of the **listing** rather than a detail request each: the pitch
   * draws a name, a portrait, a club, an availability mark and a lineup
   * probability, and a market row already carries every one of them. What the
   * listing cannot say is points, and the pitch never asks.
   *
   * Filtered against the squad as well as against the target. You cannot bid
   * on a player you own, so the guard should never fire; it is what keeps a
   * duplicate id from giving two React children the same key and putting one
   * man on the pitch twice.
   */
  const arrivals = useMemo(() => {
    const owned = new Set(own.map((member) => member.id))
    return countedOffers
      .filter((entry) => entry.id !== target?.id && !owned.has(entry.id))
      .map((entry) => asMember(entry))
  }, [countedOffers, own, target?.id])
  /** Those, him, and them — the squad the scenario is arranged from. */
  const full = useMemo(
    () =>
      target === undefined
        ? [...own, ...arrivals]
        : [...own, target, ...arrivals],
    [own, target, arrivals],
  )
  /** …and what is left of it once the marked players are sold. */
  const remaining = useMemo(
    () => full.filter((member) => !sold.has(member.id)),
    [full, sold],
  )

  /**
   * The lineup, as a **sandbox**: nothing it does reaches Kickbase.
   *
   * Seeded from the real `lo` slots, so it opens on the eleven that is
   * actually fielded, and fed `remaining` — so marking a player for sale takes
   * him off this pitch as well, which is the whole point of doing both on one
   * page.
   */
  const editor = useLineupEditor({ squad: remaining, leagueId, persist: false })
  const matchday = useCurrentMatchday(competitionId)
  const day = matchday.data?.day
  /* The **next** opponent, as everywhere else a player is listed — see
     [`useUpcomingMatchday`](../api/hooks/useMatchday.ts). Same cache entry as
     the line above, so no second request. */
  const fixtureByTeamId = useUpcomingMatchday(competitionId)?.fixtureByTeamId
  /* Each club's crest, for the watermark behind a Kader row — out of the
     season's table, which is one request cached ten minutes and the same entry
     the league table, the club pages and the Spieltag already read. A club the
     current table does not hold simply has no watermark. */
  const teams = useTeamDirectory(competitionId)
  // Held here, not per tab, so the list and the pitch share one set of
  // requests. `full` rather than `remaining`: a player marked for sale is
  // still drawn on the Kader, marked.
  const startProbabilities = useStartProbabilities(leagueId, full)
  const statusReasons = useStatusReasons(leagueId, full)

  /**
   * **Every sellable player's next five days**, so the scenario can be dated.
   *
   * `own` and not `full`: the only players this page can sell are the ones it
   * already owns, and a forecast for a man on the bench of a bid that has not
   * been accepted would be money nobody can realise.
   *
   * It is fetched whether or not a day is picked, because the days themselves
   * come out of the files — the run publishes five, of which tonight's
   * recalculation has usually eaten one, and a picker built from the calendar
   * instead would offer a day half the squad has no number for. They are
   * ~300-byte static files on a CDN, and the same cache entries the player
   * pages fill.
   */
  const ownIds = useMemo(() => own.map((member) => member.id), [own])
  const forecasts = useSquadForecasts(competitionId, ownIds)
  /**
   * The days those files can still speak for, oldest first — the chips.
   *
   * Recomputed each render rather than memoised: the map behind it is rebuilt
   * each render too (see the hook), so a `useMemo` on it would be a dependency
   * that always changed, wearing a cache for nothing.
   */
  const saleDays = forecastDays(forecasts.values())
  /**
   * …and the one that is selected, **if it is still on offer**.
   *
   * A page left open across ten in the evening is a page whose furthest day
   * has just become today's value — the chips shift under it, and a date that
   * is no longer among them has to fall back to today rather than quietly
   * keep pricing the squad off a prediction that has been overtaken.
   */
  const saleDay =
    saleDate !== undefined && saleDays.includes(saleDate) ? saleDate : undefined
  /**
   * **What each player would fetch on that day**, by id — the figure the rows
   * print and the total adds up.
   *
   * Only the players the forecast actually reaches are in here. The rest keep
   * today's market value, in the rows and in the sum, and the working under
   * the total says how many of them there were: a prediction nobody made is
   * better replaced by a fact than by the nearest other day's guess.
   *
   * Built per render rather than memoised, like the map it reads from — a
   * dozen lookups against a five-entry list, and nothing downstream of it is
   * memoised either.
   */
  const saleValues = new Map<string, number>()
  if (saleDay !== undefined) {
    for (const member of own) {
      const value = forecastValueOn(forecasts.get(member.id), saleDay)
      if (value !== undefined) saleValues.set(member.id, value)
    }
  }

  const bid = listing === undefined ? 0 : Number(amount)
  /**
   * What the standing bids have already claimed.
   *
   * **Not** the switch's business: Kickbase counts every live bid against the
   * 33 % ceiling whether or not this page is imagining them accepted, and a
   * rule that moved with a checkbox would be a rule about the checkbox. The
   * switch moves {@link pendingSpend} below, which is the projection.
   */
  const committedElsewhere = offers.reduce(
    (total, entry) => total + (entry.ownOffer ?? 0),
    0,
  )
  /**
   * …and what the *scenario* has them spending: the bids still switched on,
   * which is nothing once they are all off.
   */
  const pendingSpend = countedOffers.reduce(
    (total, entry) => total + (entry.ownOffer ?? 0),
    0,
  )
  const rules = { allowsUnderpay, budget, teamValue, committedElsewhere }
  const verdict =
    listing === undefined
      ? undefined
      : checkOffer(bid, listing.marketValue, rules)
  const soldMembers = own.filter((member) => sold.has(member.id))
  /** What the sales bring in **on the chosen day** — today's values by default. */
  const proceeds = soldMembers.reduce(
    (sum, member) => sum + (saleValues.get(member.id) ?? member.marketValue),
    0,
  )
  /** The same sales at the value standing now — what the day is measured on. */
  const proceedsToday = soldMembers.reduce(
    (sum, member) => sum + member.marketValue,
    0,
  )
  /**
   * How many of the marked players the forecast could not price for that day —
   * counted so the working can say so rather than leaving a total that is
   * quietly part prediction and part fact without saying which parts.
   */
  const unforecastCount =
    saleDay === undefined
      ? 0
      : soldMembers.filter((member) => !saleValues.has(member.id)).length
  const isBusy = placeOffer.isPending || withdrawOffer.isPending
  const error = placeOffer.error ?? withdrawOffer.error
  const ownOffer = listing?.ownOffer
  const ownOfferId = listing?.ownOfferId

  const toggleSold = (playerId: string) => {
    setSold((current) => {
      const next = new Set(current)
      if (!next.delete(playerId)) next.add(playerId)
      return next
    })
  }

  return (
    <>
      {/* Everywhere but the pitch. The lineup view is the one that wants the
          height — it sizes itself down to the window — and it is also the one
          tab that changes nothing about the money. */}
      {tab !== TABS.lineup && (
        <ProjectedBudget
          budget={budget}
          /* `undefined`, not `0`: there is no bid in a sale scenario, and a
             line reading "Gebot −0 €" would be inventing one. */
          bid={
            listing === undefined ? undefined : Number.isFinite(bid) ? bid : 0
          }
          proceeds={proceeds}
          proceedsToday={proceedsToday}
          soldCount={sold.size}
          /* The sale day, and the days there are to pick from. Empty outside
             the Bundesliga and whenever the forecast host has nothing to say,
             in which case the picker is not drawn at all. */
          saleDays={saleDays}
          saleDay={saleDay}
          onSelectSaleDay={setSaleDate}
          unforecastCount={unforecastCount}
          pendingSpend={pendingSpend}
          /* The **bids**, not the arrivals: the two differ only if a bid
             somehow stands on a player already owned, and this line is the
             money, which that bid still spends. */
          pendingCount={countedOffers.length}
          allowance={debtAllowance(teamValue)}
          maximumBid={maximumOffer(rules)}
        />
      )}

      <Tabs
        value={tab}
        onValueChange={(next) => {
          setTab(next as Tab)
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="shrink-0">
          {listing !== undefined && (
            <TabsTrigger value={TABS.offer}>Gebot</TabsTrigger>
          )}
          <TabsTrigger value={TABS.squad}>
            Kader
            {/* What the scenario has already sold, where the tab that did it
                is not the tab being read. Silent at zero. */}
            {sold.size > 0 && (
              <span className="nums ml-1.5 font-semibold">
                −{String(sold.size)}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value={TABS.lineup}>Aufstellung</TabsTrigger>
        </TabsList>

        {listing !== undefined && verdict !== undefined && (
          <TabsContent value={TABS.offer}>
            <div className="flex flex-col gap-3">
              <div className="rounded-card border border-line bg-surface px-3 py-2.5 text-sm leading-snug text-muted">
                <OfferListingFacts
                  listing={listing}
                  marketValueChange={player?.marketValueChangeDay}
                />
              </div>

              <OfferAmountField
                listing={listing}
                rules={rules}
                amount={amount}
                setAmount={setAmount}
                verdict={verdict}
                isBusy={isBusy}
              />

              {error !== null && (
                <p
                  role="alert"
                  className="rounded-xl border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative"
                >
                  {error.message}
                </p>
              )}

              {/* The two conclusions, in the app's usual order: leave on the
                  left, act on the right. Both leave the page — this is the one
                  tab where anything is decided. */}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  fullWidth
                  disabled={isBusy}
                  onClick={onLeave}
                >
                  Abbrechen
                </Button>
                <Button
                  fullWidth
                  isLoading={placeOffer.isPending}
                  disabled={!verdict.isAllowed || isBusy}
                  onClick={() => {
                    if (!verdict.isAllowed) return
                    placeOffer.mutate(
                      { playerId: listing.id, price: bid },
                      { onSuccess: onLeave },
                    )
                  }}
                >
                  {ownOffer === undefined ? 'Bieten' : 'Gebot ändern'}
                </Button>
              </div>

              {/* Withdrawing is a third thing and only exists while there is
                  a bid to take back. It is a labelled button here rather than
                  the dialog's ✗ on the field: a page has the room to say
                  it. */}
              {ownOfferId !== undefined && (
                <Button
                  variant="danger"
                  fullWidth
                  isLoading={withdrawOffer.isPending}
                  disabled={isBusy}
                  onClick={() => {
                    withdrawOffer.mutate(
                      { playerId: listing.id, offerId: ownOfferId },
                      { onSuccess: onLeave },
                    )
                  }}
                >
                  Gebot zurückziehen
                </Button>
              )}
            </div>
          </TabsContent>
        )}

        <TabsContent value={TABS.squad}>
          {/* Calculator mode, permanently: on this page a tap on a row means
              "sell him in this scenario", which is the only thing the Kader is
              here for. `forSale` is never `null`, so the mode never has to be
              entered — the page *is* the mode.

              `own`, not `full`: the target has no business in a list whose
              every row is a player you could sell. He is what the scenario is
              buying, and he appears where that means something — on the bench
              of the third tab, waiting to be brought on. With no target the
              two lists are the same squad anyway. */}
          <PlayerListTab
            squad={own}
            editor={editor}
            leagueId={leagueId}
            fixtureByTeamId={fixtureByTeamId}
            teams={teams.data}
            matchday={day}
            startProbabilities={startProbabilities}
            statusReasons={statusReasons}
            forSale={sold}
            onToggleForSale={toggleSold}
            /* Empty until a day is picked, and then every row prices itself
               for that day — the list and the total have to be answering the
               same question. */
            saleValues={saleValues}
          />
        </TabsContent>

        <TabsContent
          value={TABS.lineup}
          className="flex min-h-0 flex-1 flex-col"
        >
          {/* `remaining`, not `full`: a player sold in this scenario is gone
              from the squad, so he is not on the bench either. */}
          <LineupTab
            squad={remaining}
            editor={editor}
            fixtureByTeamId={fixtureByTeamId}
            matchday={day}
            startProbabilities={startProbabilities}
            statusReasons={statusReasons}
            onShowLegend={() => {
              setIsLegendOpen(true)
            }}
          />
        </TabsContent>
      </Tabs>

      <SquadLegendDialog
        open={isLegendOpen}
        onOpenChange={setIsLegendOpen}
        isSquadList={tab === TABS.squad}
      />

      {/* The editor's, not a view's: either squad tab can fill a position that
          is already full, and the dialog asks who makes way. */}
      <SwapDialog
        incoming={editor.incoming}
        lineup={editor.lineup}
        fixtureByTeamId={fixtureByTeamId}
        onCancel={editor.cancelSwap}
        onConfirm={editor.confirmSwap}
      />
    </>
  )
}

/**
 * A **listing as a squad member**, so the list and the pitch can draw a player
 * the manager does not own yet with everybody else.
 *
 * Used for the target and for each player a standing bid would bring in. The
 * fuller {@link PlayerDetail} is passed where there is one — only the target
 * has it, and only once its request lands — and everything it would have said
 * falls back to what the market row already carries.
 *
 * `profitLoss` is `0` because there is nothing to be up or down on: he has not
 * been bought. It is the one figure here that is a placeholder rather than a
 * fact, and the honest alternative — widening `SquadMember` to make it
 * optional — would put a branch in every row in the app for the hypothetical
 * players on one page.
 */
function asMember(listing: MarketListing, detail?: PlayerDetail): SquadMember {
  return {
    id: listing.id,
    firstName: listing.firstName,
    lastName: listing.lastName,
    teamId: listing.teamId,
    position: listing.position,
    marketValue: listing.marketValue,
    marketValueTrend: listing.marketValueTrend,
    profitLoss: 0,
    marketValueChangeDay: detail?.marketValueChangeDay,
    totalPoints: detail?.totalPoints ?? 0,
    averagePoints: detail?.averagePoints ?? 0,
    status: detail?.status ?? listing.status,
    startProbability: detail?.startProbability ?? listing.startProbability,
    image: listing.image,
    offerCount: listing.offerCount,
    // Benched to begin with. Fielding him is what the lineup tab is for.
    lineupOrder: undefined,
  }
}

/**
 * The page's own heading, with **the player in it**.
 *
 * A scenario about one purchase should show who is being bought, and a name in
 * a subtitle is the weakest way to do that: the market row, the squad row and
 * the feed all identify a player by his portrait first. So the portrait sits
 * flush on the left over the **full height of the header**, the way it does in
 * every list in the app — grounded by a wash that fades out before the top,
 * with its inner edge masked so the clipped shoulder dissolves into the header
 * instead of ending on a line. The fade starts past 65 %, which keeps the face
 * clear of it.
 *
 * A bordered block rather than the app's plain [`PageHeading`](../components/PageHeading.tsx):
 * a portrait bled to an edge needs an edge to bleed to, and something has to
 * clip it.
 *
 * With no listing there is no portrait and the block is a plain header — a
 * sale scenario is about the squad, which has no one face to show.
 *
 * The ✗ is the fourth way out, for the two tabs that have no buttons of their
 * own — a scenario you cannot leave from the pitch would be a trap.
 *
 * **The offers panel lives here**, under the title, because it is the only
 * control on the page that every tab is subject to: it moves the money on two
 * of them and the bench on the third, and the budget block it would otherwise
 * belong in is not drawn on the pitch. A tab of its own would have the same
 * fault from the other side — you cannot switch a bid off while looking at the
 * eleven it changes. It is absent entirely when there is no bid standing,
 * which is most of the time.
 */
function ScenarioHeading({
  listing,
  subtitle,
  offers,
  counted,
  countedTotal,
  onToggleOffer,
  onCountAll,
  onLeave,
}: {
  /**
   * `undefined` while the market is loading, if it has no such listing, or —
   * on `/squad/whatif` — because the scenario buys nobody.
   */
  listing: MarketListing | undefined
  /** What the scenario is, until the player it is about has landed. */
  subtitle: string
  /** Every bid this account has standing, the target's aside. */
  offers: MarketListing[]
  /** The ones still switched on. */
  counted: MarketListing[]
  /** What those add up to. */
  countedTotal: number
  onToggleOffer: (offerId: string) => void
  onCountAll: (counts: boolean) => void
  onLeave: () => void
}) {
  return (
    <div className="flex shrink-0 flex-col overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex items-stretch">
        {listing !== undefined && (
          <Avatar
            src={listing.image}
            name={listing.lastName}
            fill
            className={cn(
              'w-20 shrink-0 self-stretch bg-transparent',
              'bg-linear-to-t from-surface-2/60 to-transparent to-70%',
              '[mask-image:linear-gradient(to_right,#000_65%,transparent)]',
            )}
          />
        )}

        <div
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 py-3 pr-2',
            listing === undefined ? 'pl-4' : 'pl-1',
          )}
        >
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight text-ink">
              Was wäre wenn
            </h1>
            <p className="mt-0.5 truncate text-xs text-muted">
              {listing === undefined
                ? subtitle
                : `${listing.firstName ?? ''} ${listing.lastName}`.trim()}
            </p>
          </div>

          <button
            type="button"
            onClick={onLeave}
            title="Rechner schließen"
            aria-label="Rechner schließen"
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
              'text-muted transition-colors hover:bg-surface-2 hover:text-ink',
              'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
            )}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {offers.length > 0 && (
        <OffersPanel
          offers={offers}
          counted={counted}
          countedTotal={countedTotal}
          onToggle={onToggleOffer}
          onCountAll={onCountAll}
        />
      )}
    </div>
  )
}

/**
 * **"…and if the bids I have out were accepted?"** — the scenario's one global
 * control, and the only one every tab is subject to.
 *
 * A manager with three live bids does not really have the budget the app
 * prints for him; he has that minus three purchases that could all land
 * tonight. Counting them is therefore the honest reading of "what if", which
 * is why **every bid starts switched on** — and why each can be switched off,
 * because the opposite reading is honest too: bids are lost far more often
 * than they are won, and the manager usually knows which of his are hopeless.
 *
 * **One bid at a time, not all or nothing.** The summary row flips the lot,
 * which is the quick answer; the chevron opens the list behind it, one row per
 * standing bid, and that is where the real question gets asked — *this* bid is
 * the one I expect to win, so what does the squad look like with him in it and
 * the other two gone? A single switch could only ever answer the two extremes
 * of that, and neither extreme is what a manager with three bids out believes.
 *
 * **It moves the squad as well as the money.** A counted bid's player arrives
 * on the bench of the lineup tab, which is the whole reason this is not simply
 * a line of arithmetic in the budget block — and the reason it sits in the
 * header, which is the one thing on the page the pitch does not hide.
 *
 * The target's own bid is not in here: the page's caller filters it out,
 * because re-bidding on a player *replaces* the standing offer rather than
 * adding to it, and the list would be offering to spend his money twice.
 *
 * Each row, and the summary, is a `role="switch"` button with its label inside
 * it rather than a checkbox with the label beside it. The pills are drawn, not
 * real — they have no state of their own to disagree with `aria-checked`.
 */
function OffersPanel({
  offers,
  counted,
  countedTotal,
  onToggle,
  onCountAll,
}: {
  offers: MarketListing[]
  counted: MarketListing[]
  countedTotal: number
  onToggle: (offerId: string) => void
  onCountAll: (counts: boolean) => void
}) {
  /* Shut to begin with. The summary is the whole answer for the manager with
     one bid out, and the list is a dozen rows above a page that is already
     scrolled — it opens when somebody wants to disagree with the default. */
  const [isOpen, setIsOpen] = useState(false)
  const countedIds = new Set(counted.map((entry) => entry.id))
  const isAll = counted.length === offers.length
  const isNone = counted.length === 0

  return (
    <div className="border-t border-line">
      <div className="flex items-center">
        {/* The summary and the disclosure are one target: reading "2 von 3"
            and wanting to know *which* two is the same impulse. */}
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => {
            setIsOpen((open) => !open)
          }}
          title="Gebote einzeln wählen"
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 py-2 pl-3 text-left',
            'transition-colors hover:bg-surface-2',
            /* `ring-inset`: the heading card clips its overflow to keep its
               corners, so a ring drawn outside this row would be cut off. */
            'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus-visible:ring-inset',
          )}
        >
          <Gavel
            size={14}
            aria-hidden="true"
            className={cn('shrink-0', isNone ? 'text-faint' : 'text-accent')}
          />

          <span className="min-w-0 flex-1 truncate text-xs text-muted">
            {isAll ? (
              <>
                <span className="nums font-semibold text-ink">
                  {offers.length} offene{offers.length === 1 ? 's' : ''} Gebot
                  {offers.length === 1 ? '' : 'e'}
                </span>{' '}
                angenommen
              </>
            ) : (
              /* Partial, and zero reads as a case of it rather than as its own
                 sentence — "0 von 3" keeps the denominator on screen, which is
                 what says the list is still there to re-open. */
              <>
                <span className="nums font-semibold text-ink">
                  {counted.length} von {offers.length}
                </span>{' '}
                Geboten angenommen
              </>
            )}
          </span>

          {/* What saying yes costs, so the switch is not a leap of faith — and
              it is the counted sum, because that is the figure that left the
              total above the tabs. */}
          <span
            className={cn(
              'nums shrink-0 text-xs font-semibold',
              isNone ? 'text-faint' : 'text-negative',
            )}
          >
            −{money(countedTotal)}
          </span>

          <ChevronDown
            size={14}
            aria-hidden="true"
            className={cn(
              'shrink-0 text-faint transition-transform',
              isOpen && 'rotate-180',
            )}
          />
        </button>

        {/* All or none, without opening anything — the two answers most
            managers want, kept one tap away from the summary that states
            them. */}
        <button
          type="button"
          role="switch"
          aria-checked={isAll ? true : isNone ? false : 'mixed'}
          onClick={() => {
            onCountAll(!isAll)
          }}
          title="Alle offenen Gebote mitrechnen"
          aria-label="Alle offenen Gebote mitrechnen"
          className={cn(
            'flex h-8 shrink-0 items-center rounded-lg px-3',
            'transition-colors hover:bg-surface-2',
            'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus-visible:ring-inset',
          )}
        >
          <SwitchPill state={isAll ? 'on' : isNone ? 'off' : 'mixed'} />
        </button>
      </div>

      {isOpen && (
        /* In the market's own order, which is the order the bids were found
           in — not sorted by amount, because a list that reorders itself as
           you switch rows off is a list you lose your place in. */
        <ul className="border-t border-line bg-surface-2/40">
          {offers.map((entry) => (
            <li key={entry.id}>
              <OfferToggleRow
                listing={entry}
                isOn={countedIds.has(entry.id)}
                onToggle={() => {
                  onToggle(entry.id)
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * One standing bid, and whether the scenario believes in it.
 *
 * The portrait and the surname identify him the way every other list in the
 * app does; the figure is **what was bid**, not what he is worth, because that
 * is the money this row is deciding about. Switched off, the whole row fades
 * rather than only its pill — the player is still listed, which is the point,
 * but he is no longer part of the arithmetic above or the bench behind.
 */
function OfferToggleRow({
  listing,
  isOn,
  onToggle,
}: {
  listing: MarketListing
  isOn: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors',
        'hover:bg-surface-2',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus-visible:ring-inset',
        !isOn && 'opacity-55',
      )}
    >
      <Avatar src={listing.image} name={listing.lastName} size={22} />

      <span className="min-w-0 flex-1 truncate text-xs text-ink">
        {listing.lastName}
      </span>

      <span
        className={cn(
          'nums shrink-0 text-xs font-semibold',
          isOn ? 'text-negative' : 'text-faint',
        )}
      >
        −{money(listing.ownOffer ?? 0)}
      </span>

      <SwitchPill state={isOn ? 'on' : 'off'} />
    </button>
  )
}

/**
 * The drawn pill, shared by the summary and its rows.
 *
 * `mixed` is the summary's only extra state — some bids counted and some not —
 * and it is drawn as the knob stopped halfway on a dimmed track, which is the
 * one position neither of the other two can be mistaken for.
 */
function SwitchPill({ state }: { state: 'on' | 'off' | 'mixed' }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative h-4 w-7 shrink-0 rounded-full transition-colors',
        state === 'on'
          ? 'bg-accent'
          : state === 'mixed'
            ? 'bg-accent/40'
            : 'bg-line',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-3 w-3 rounded-full transition-all',
          state === 'on'
            ? 'left-3.5 bg-accent-ink'
            : state === 'mixed'
              ? 'left-2 bg-accent'
              : 'left-0.5 bg-faint',
        )}
      />
    </span>
  )
}

/** `?bid=1750000` → `"1750000"`; anything else → `undefined`. */
function digitsOrUndefined(raw: string | null): string | undefined {
  if (raw === null) return undefined
  const digits = raw.replace(/\D/g, '')
  return digits === '' ? undefined : digits
}

/**
 * **What the budget would be if all of it happened** — the scenario's answer,
 * above the tabs that change it.
 *
 * One figure, and the working under it. The bid is money out and the sales are
 * money in, and what is left is the question the page exists to answer.
 *
 * **Without a bid it is a sale calculator with a pitch behind it.** The term
 * drops out of the working, and with nothing else spending either the overdraft
 * lines go too — selling only ever moves the budget upwards, so there is no
 * floor to warn about — and the label says *Verkäufe* rather than *Transfer*.
 *
 * **It pins.** A squad of twenty is a page you scroll, and the answer has to
 * stay legible while you are marking the eleventh player at the bottom of it —
 * the same reasoning, and the same `--header-total` offset, as the squad
 * page's [sale calculator](./SquadPage.tsx) bar. It bleeds `-mx-3` to the
 * column's edges and carries its own canvas band so that nothing shows through
 * the card's rounded corners as rows scroll behind it; the band's `pb-4` is
 * cancelled by `-mb-4`, so the block occupies exactly the height it did
 * before. It is `z-20`, under the header's `z-30`.
 *
 * **Negative is not the same as too far.** Kickbase lends against team value
 * and charges interest on the overdraft, so an overdrawn budget is a normal
 * state and it takes three colours to say which one you are in — the same
 * three the [market page](./MarketPage.tsx)'s heading uses, for the same
 * reason: green while the purchase fits inside the budget, **amber** while it
 * borrows, which is allowed, and **red** past `33 %` of team value, where
 * Kickbase refuses the bid outright. Two of those look identical without the
 * allowance to measure against, which is why it is printed underneath.
 *
 * The floor is stated as a **depth** (`−32,9 Mio.`) and the bid's own bound as
 * a **maximum** (`höchstens 41,2 Mio.`). They are the same rule from the two
 * ends a manager thinks about it from: how deep may I go, and what may I write
 * in the field. The second differs from the first by the budget and by every
 * bid already standing elsewhere, which is why neither can be deduced from the
 * other on sight.
 *
 * The projection is **not** what Kickbase checks a bid against; the offer
 * tab's own rules are, and they read the budget as it stands. This is the
 * figure the manager is planning with, which is a different thing and is why
 * both are on screen.
 */
function ProjectedBudget({
  budget,
  bid,
  proceeds,
  proceedsToday,
  soldCount,
  saleDays,
  saleDay,
  onSelectSaleDay,
  unforecastCount,
  pendingSpend,
  pendingCount,
  allowance,
  maximumBid,
}: {
  budget: number
  /** What would be spent, or `undefined` when nothing is being bought. */
  bid: number | undefined
  /** What the sales bring in on {@link saleDay}. */
  proceeds: number
  /** What the same sales bring in today — the figure the day is measured on. */
  proceedsToday: number
  soldCount: number
  /** The forecast days there are to choose from, oldest first; may be empty. */
  saleDays: string[]
  /** The one chosen, or `undefined` for today. */
  saleDay: string | undefined
  onSelectSaleDay: (date: string | undefined) => void
  /** Marked players the forecast could not price for that day. */
  unforecastCount: number
  /** What the bids still switched on would take; `0` once they all are off. */
  pendingSpend: number
  /** How many of them there are — `0` whenever the spend is. */
  pendingCount: number
  /** How far below zero this league lets the budget go. `undefined` = unknown. */
  allowance: number | undefined
  /** The most this listing could be bid, ceiling and other bids included. */
  maximumBid: number | undefined
}) {
  const projected = budget + proceeds - (bid ?? 0) - pendingSpend
  const isOverdrawn = projected < 0
  /* Anything at all is being bought — this bid, or the ones already out. The
     overdraft only exists where money leaves. */
  const isBuying = bid !== undefined || pendingSpend > 0
  // Past the floor, or — with no allowance to compare against — simply in the
  // red, which is the most that can honestly be said without team value.
  const isPastFloor =
    allowance === undefined ? isOverdrawn : projected < -allowance

  return (
    <div
      className={cn(
        'sticky top-(--header-total) z-20 -mx-3 -mb-4 shrink-0 px-3 pb-4',
        'bg-canvas',
      )}
    >
      <div className="rounded-card border border-line bg-surface px-3 py-2.5">
        <p className="text-[0.6875rem] tracking-wide text-faint uppercase">
          {bid !== undefined
            ? 'Budget nach dem Transfer'
            : pendingSpend > 0
              ? 'Budget nach den Transfers'
              : 'Budget nach den Verkäufen'}
        </p>
        {/* `aria-live` so a screen reader hears the total change as players are
          marked and the bid is typed — it updates somewhere other than where
          the tap happened. */}
        <p
          aria-live="polite"
          className={cn(
            'nums mt-0.5 text-lg leading-tight font-bold',
            isPastFloor
              ? 'text-negative'
              : isOverdrawn
                ? 'text-warning'
                : 'text-positive',
          )}
        >
          {moneyExact(projected)}
        </p>
        <p className="nums mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
          <span>Budget {money(budget)}</span>
          {/* A sale scenario with nothing marked yet has no working to show, and
            a lone budget under a figure equal to it reads as a page that has
            not loaded. It says what to do instead — the same nudge the
            [sale calculator](./SquadPage.tsx) puts under its own total. */}
          {!isBuying && soldCount === 0 && (
            <>
              <span aria-hidden="true" className="text-faint">
                ·
              </span>
              <span>Spieler zum Verkaufen antippen</span>
            </>
          )}
          {/* The bids already out that the header's panel is still counting.
            Named separately from `Gebot` above, which is the one being
            typed. */}
          {pendingCount > 0 && (
            <>
              <span aria-hidden="true" className="text-faint">
                ·
              </span>
              <span>
                {pendingCount} offene{pendingCount === 1 ? 's' : ''} Gebot
                {pendingCount === 1 ? '' : 'e'} −{money(pendingSpend)}
              </span>
            </>
          )}
          {bid !== undefined && (
            <>
              <span aria-hidden="true" className="text-faint">
                ·
              </span>
              <span>Gebot −{money(bid)}</span>
            </>
          )}
          {soldCount > 0 && (
            <>
              <span aria-hidden="true" className="text-faint">
                ·
              </span>
              <span className="text-positive">
                {soldCount} verkauft +{money(proceeds)}
              </span>
              {/* **What the day is worth**, and only while it is worth
                  something: the sales on a future day against the same sales
                  today. It is the one figure that says whether waiting is
                  actually the better move, and it is small — a few per cent of
                  a squad — so it has to be printed rather than inferred from
                  two totals read at different times. */}
              {saleDay !== undefined && proceeds !== proceedsToday && (
                <span
                  className={
                    proceeds > proceedsToday ? 'text-positive' : 'text-negative'
                  }
                >
                  ({moneyDelta(proceeds - proceedsToday)} ggü. jetzt)
                </span>
              )}
              {/* The part of that total that is **not** a prediction. A run
                  that is a day older than the rest stops short of the last
                  chip, and a player it never covered has no file at all; both
                  keep today's value, and a total that is part fact has to say
                  which part. */}
              {unforecastCount > 0 && (
                <>
                  <span aria-hidden="true" className="text-faint">
                    ·
                  </span>
                  <span className="text-faint">
                    {unforecastCount} ohne Prognose
                  </span>
                </>
              )}
            </>
          )}
        </p>

        {/* The allowance, and what it leaves for *this* player. Only with team
          value in hand, and only where there is an overdraft to speak of. */}
        {isBuying && allowance !== undefined && allowance > 0 && (
          <p className="nums mt-1 flex flex-wrap gap-x-2 border-t border-line pt-1.5 text-xs text-faint">
            <span>
              Minus möglich bis{' '}
              <span className="font-semibold text-warning">
                −{money(allowance)}
              </span>{' '}
              (33 % vom Teamwert)
            </span>
            {bid !== undefined && maximumBid !== undefined && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Gebot höchstens{' '}
                  <span className="font-semibold text-ink">
                    {money(maximumBid)}
                  </span>
                </span>
              </>
            )}
          </p>
        )}

        {saleDays.length > 0 && (
          <SaleDayPicker
            days={saleDays}
            selected={saleDay}
            onSelect={onSelectSaleDay}
          />
        )}
      </div>
    </div>
  )
}

/**
 * **"…and if I sold them on Sunday instead?"**
 *
 * Market values move every night, and a squad's does not move with it: some
 * players are climbing and some are bleeding, which is exactly the question a
 * manager deciding *when* to sell is asking. The
 * [forecast](../api/hooks/usePlayerForecast.ts) answers it for the next five
 * days, and this is where the scenario takes the answer — one chip per day the
 * run still speaks for, and **Heute**, which is the only one of them that is a
 * fact rather than a prediction and is therefore the one the page opens on.
 *
 * It sits at the foot of the budget block because that is the figure it moves,
 * and **on one line with its caption** rather than under it: the block is
 * pinned over a list of twenty players, and a line of height taken here is a
 * row of squad nobody can see. The chips scroll sideways —
 * [`CHIP_ROW_END`](../components/ui/FilterChip.tsx) — so the fifth day is
 * reachable on a phone without the row wrapping to a second line and taking
 * that row back anyway.
 *
 * The picker is **not drawn at all** where there is nothing to pick: outside
 * the Bundesliga, which is the only competition the run publishes for, and
 * whenever the host has nothing the night has not already overtaken.
 *
 * It is absent from the pitch along with the rest of the block, which is
 * right: who you would field is not a question about what day you sell on.
 */
function SaleDayPicker({
  days,
  selected,
  onSelect,
}: {
  days: string[]
  selected: string | undefined
  onSelect: (date: string | undefined) => void
}) {
  return (
    <div className="mt-1.5 flex items-center gap-2 border-t border-line pt-2">
      <span className="shrink-0 text-[0.6875rem] tracking-wide text-faint uppercase">
        Verkauf
      </span>

      <div className={CHIP_ROW_END} role="group" aria-label="Verkaufstag">
        {/* **"Jetzt", not "Heute"**, and the difference is the whole reason
            the first chip beside it can carry today's own date: Kickbase moves
            every value at ten in the evening, so until then *today's* value is
            a prediction like any other and the figure on screen is last
            night's. Two chips reading "Heute" and "Fr., 3." on a Friday the
            3rd would be a riddle; a now and a date are not. */}
        <FilterChip
          isActive={selected === undefined}
          onClick={() => {
            onSelect(undefined)
          }}
        >
          Jetzt
        </FilterChip>
        {days.map((date) => (
          <FilterChip
            key={date}
            isActive={selected === date}
            onClick={() => {
              onSelect(date)
            }}
          >
            {weekdayDay(date)}
          </FilterChip>
        ))}
      </div>
    </div>
  )
}
