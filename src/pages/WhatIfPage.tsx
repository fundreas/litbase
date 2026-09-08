import { Calculator, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { useLeagueDetails, useLeagueManager } from '@/api/hooks/useLeague'
import { useMarket } from '@/api/hooks/useMarket'
import { useCurrentMatchday } from '@/api/hooks/useMatchday'
import { usePlaceOffer, useWithdrawOffer } from '@/api/hooks/useMarketOffers'
import { usePlayerDetail } from '@/api/hooks/usePlayer'
import { useSquad } from '@/api/hooks/useSquad'
import { useStartProbabilities } from '@/api/hooks/useStartProbabilities'
import { useStatusReasons } from '@/api/hooks/useStatusReasons'
import {
  offerBaseline,
  type MarketListing,
  type PlayerDetail,
  type SquadMember,
} from '@/api/models'
import { PageHeading } from '@/components/PageHeading'
import {
  OfferAmountField,
  OfferListingFacts,
} from '@/components/market/OfferFields'
import { LineupTab } from '@/components/squad/LineupTab'
import { PlayerListTab } from '@/components/squad/PlayerListTab'
import { SquadLegendDialog } from '@/components/squad/SquadLegendDialog'
import { SwapDialog } from '@/components/squad/SwapDialog'
import { useLineupEditor } from '@/components/squad/useLineupEditor'
import { Button } from '@/components/ui/Button'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useActiveLeague } from '@/league/useActiveLeague'
import { cn } from '@/lib/cn'
import { money, moneyExact } from '@/lib/format'
import { checkOffer } from '@/lib/offerRules'

/** The three views, sharing one scenario. */
const TABS = { offer: 'offer', squad: 'squad', lineup: 'lineup' } as const
type Tab = (typeof TABS)[keyof typeof TABS]

/**
 * **"What if I bought him?"** — one player, and the squad rearranged around
 * the purchase.
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
 */
export function WhatIfPage() {
  const { league, leagueId, competitionId } = useActiveLeague()
  const { playerId } = useParams()
  const navigate = useNavigate()

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

  const heading = (
    <PageHeading
      title="Was wäre wenn"
      subtitle={
        listing === undefined
          ? 'Ein Kauf, durchgerechnet'
          : `${listing.firstName ?? ''} ${listing.lastName}`.trim()
      }
      action={
        <button
          type="button"
          onClick={() => {
            void navigate(-1)
          }}
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
      }
    />
  )

  if (market.isPending || squad.isPending) {
    return (
      <div className="flex flex-col gap-4">
        {heading}
        <SkeletonList rows={6} />
      </div>
    )
  }

  if (market.isError) {
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
  if (listing === undefined) {
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
        listing={listing}
        player={player.data}
        squad={squad.data ?? []}
        leagueId={leagueId}
        competitionId={competitionId}
        budget={manager.data?.budget ?? league.budget}
        teamValue={market.data.teamValue}
        allowsUnderpay={details.data?.allowsUnderpay}
        /* Every other bid this account has standing. Kickbase counts them all
           against one ceiling, and this listing's own is **not** committed:
           re-bidding on the same player replaces the standing offer. */
        committedElsewhere={market.data.listings.reduce(
          (total, entry) =>
            entry.id === listing.id ? total : total + (entry.ownOffer ?? 0),
          0,
        )}
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
 */
function WhatIfScenario({
  listing,
  player,
  squad,
  leagueId,
  competitionId,
  budget,
  teamValue,
  allowsUnderpay,
  committedElsewhere,
  onLeave,
}: {
  listing: MarketListing
  /** The target's fuller self, once it lands. */
  player: PlayerDetail | undefined
  squad: SquadMember[]
  leagueId: string
  competitionId: string
  budget: number
  teamValue: number | undefined
  allowsUnderpay: boolean | undefined
  committedElsewhere: number
  /** Back to wherever the bid dialog was — every conclusion uses it. */
  onLeave: () => void
}) {
  const [tab, setTab] = useState<Tab>(TABS.offer)
  const [amount, setAmount] = useState(() => String(offerBaseline(listing)))
  /** Who would be sold to pay for him. Ids, as the sale calculator holds them. */
  const [sold, setSold] = useState<ReadonlySet<string>>(() => new Set())
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
   * everybody else.
   *
   * `profitLoss` is `0` because there is nothing to be up or down on: he has
   * not been bought. It is the one figure on his row that is a placeholder
   * rather than a fact, and the honest alternative — widening `SquadMember` to
   * make it optional — would put a branch in every row in the app for one
   * hypothetical player on one page.
   */
  const target = useMemo<SquadMember>(
    () => ({
      id: listing.id,
      firstName: listing.firstName,
      lastName: listing.lastName,
      teamId: listing.teamId,
      position: listing.position,
      marketValue: listing.marketValue,
      marketValueTrend: listing.marketValueTrend,
      profitLoss: 0,
      marketValueChangeDay: player?.marketValueChangeDay,
      totalPoints: player?.totalPoints ?? 0,
      averagePoints: player?.averagePoints ?? 0,
      status: player?.status ?? 0,
      startProbability: player?.startProbability,
      image: listing.image,
      offerCount: listing.offerCount,
      // Benched to begin with. Fielding him is the question the third tab asks.
      lineupOrder: undefined,
    }),
    [listing, player],
  )

  /**
   * The scenario's squad: yours, plus him.
   *
   * He is filtered out of your own side first. You cannot bid on your own
   * listing, so this is defensive rather than expected — but a duplicate id
   * would give two rows the same React key and put a player on the pitch
   * twice.
   */
  const full = useMemo(
    () => [...squad.filter((member) => member.id !== target.id), target],
    [squad, target],
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
  const fixtureByTeamId = matchday.data?.fixtureByTeamId
  // Held here, not per tab, so the list and the pitch share one set of
  // requests. `full` rather than `remaining`: a player marked for sale is
  // still drawn on the Kader, marked.
  const startProbabilities = useStartProbabilities(leagueId, full)
  const statusReasons = useStatusReasons(leagueId, full)

  const bid = Number(amount)
  const verdict = checkOffer(bid, listing.marketValue, {
    allowsUnderpay,
    budget,
    teamValue,
    committedElsewhere,
  })
  const proceeds = squad
    .filter((member) => sold.has(member.id))
    .reduce((sum, member) => sum + member.marketValue, 0)
  const isBusy = placeOffer.isPending || withdrawOffer.isPending
  const error = placeOffer.error ?? withdrawOffer.error
  const { ownOffer, ownOfferId } = listing

  const toggleSold = (playerId: string) => {
    // The target is what the scenario is *buying*. Tapping him on the Kader
    // does nothing rather than offering to sell a player nobody owns.
    if (playerId === target.id) return
    setSold((current) => {
      const next = new Set(current)
      if (!next.delete(playerId)) next.add(playerId)
      return next
    })
  }

  return (
    <>
      <ProjectedBudget
        budget={budget}
        bid={Number.isFinite(bid) ? bid : 0}
        proceeds={proceeds}
        soldCount={sold.size}
      />

      <Tabs
        value={tab}
        onValueChange={(next) => {
          setTab(next as Tab)
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="shrink-0">
          <TabsTrigger value={TABS.offer}>Gebot</TabsTrigger>
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
              rules={{
                allowsUnderpay,
                budget,
                teamValue,
                committedElsewhere,
              }}
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

            {/* Withdrawing is a third thing and only exists while there is a
                bid to take back. It is a labelled button here rather than the
                dialog's ✗ on the field: a page has the room to say it. */}
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

        <TabsContent value={TABS.squad}>
          {/* Calculator mode, permanently: on this page a tap on a row means
              "sell him in this scenario", which is the only thing the Kader is
              here for. `forSale` is never `null`, so the mode never has to be
              entered — the page *is* the mode. */}
          <PlayerListTab
            squad={full}
            editor={editor}
            leagueId={leagueId}
            fixtureByTeamId={fixtureByTeamId}
            startProbabilities={startProbabilities}
            statusReasons={statusReasons}
            forSale={sold}
            onToggleForSale={toggleSold}
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
        showShirtRail={tab === TABS.squad}
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
 * **What the budget would be if all of it happened** — the scenario's answer,
 * above the three tabs that change it.
 *
 * One figure, and the working under it. The bid is money out and the sales are
 * money in, and the sign of what is left is the question the page exists to
 * answer: green if the purchase fits, red if it does not. Kickbase does allow
 * a negative budget — it charges interest on one — so red is a state worth
 * seeing rather than a refusal.
 *
 * It is **not** what Kickbase checks a bid against; the offer tab's own rules
 * are, and they read the budget as it stands. This is the figure the manager is
 * planning with, which is a different thing and is why both are on screen.
 */
function ProjectedBudget({
  budget,
  bid,
  proceeds,
  soldCount,
}: {
  budget: number
  bid: number
  proceeds: number
  soldCount: number
}) {
  const projected = budget + proceeds - bid

  return (
    <div className="shrink-0 rounded-card border border-line bg-surface px-3 py-2.5">
      <p className="text-[0.6875rem] tracking-wide text-faint uppercase">
        Budget nach dem Transfer
      </p>
      {/* `aria-live` so a screen reader hears the total change as players are
          marked and the bid is typed — it updates somewhere other than where
          the tap happened. */}
      <p
        aria-live="polite"
        className={cn(
          'nums mt-0.5 text-lg leading-tight font-bold',
          projected < 0 ? 'text-negative' : 'text-positive',
        )}
      >
        {moneyExact(projected)}
      </p>
      <p className="nums mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
        <span>Budget {money(budget)}</span>
        <span aria-hidden="true" className="text-faint">
          ·
        </span>
        <span>Gebot −{money(bid)}</span>
        {soldCount > 0 && (
          <>
            <span aria-hidden="true" className="text-faint">
              ·
            </span>
            <span className="text-positive">
              {soldCount} verkauft +{money(proceeds)}
            </span>
          </>
        )}
      </p>
    </div>
  )
}
