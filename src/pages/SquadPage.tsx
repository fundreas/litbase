import { Calculator, Info, Shirt, Users, Wallet, X } from 'lucide-react'
import { useState } from 'react'
import { useLocation } from 'react-router'

import { useLeagueManager } from '@/api/hooks/useLeague'
import { useCurrentMatchday } from '@/api/hooks/useMatchday'
import { useSquad } from '@/api/hooks/useSquad'
import { useStartProbabilities } from '@/api/hooks/useStartProbabilities'
import { useStatusReasons } from '@/api/hooks/useStatusReasons'
import type { SquadMember } from '@/api/models'
import { PageHeading } from '@/components/PageHeading'
import { LineupTab } from '@/components/squad/LineupTab'
import { PlayerListTab } from '@/components/squad/PlayerListTab'
import { SquadLegendDialog } from '@/components/squad/SquadLegendDialog'
import { SwapDialog } from '@/components/squad/SwapDialog'
import { useLineupEditor } from '@/components/squad/useLineupEditor'
import { BottomTabBar, type BottomTab } from '@/components/ui/BottomTabBar'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useActiveLeague } from '@/league/useActiveLeague'
import { cn } from '@/lib/cn'
import { money } from '@/lib/format'

/** View value ⇄ route segment. Deliberately identical strings. */
const VIEWS = { squad: 'squad', lineup: 'lineup' } as const
type ViewValue = (typeof VIEWS)[keyof typeof VIEWS]

/**
 * The manager's own players, in two views that are **separate routes**:
 *
 *  - `/leagues/:leagueId/squad` — the full squad as a grouped list or grid.
 *  - `/leagues/:leagueId/squad/lineup` — the interactive lineup on a pitch.
 *
 * The active view is derived from the URL rather than held in local state, so
 * each is linkable, survives a refresh, and can be opened directly from
 * navigation. Both routes render this same component.
 *
 * The pitch is **nested under the squad** rather than sitting beside it at
 * `/lineup`. It always was the squad seen another way, the URL now says so, and
 * the drawer's prefix match lights "Mannschaft" for both without a special
 * case. The old `/lineup` stays as a redirect.
 *
 * Both views read the same `useSquad` query, so switching costs no request.
 */
export function SquadPage() {
  const { leagueId, competitionId } = useActiveLeague()
  const location = useLocation()
  const squad = useSquad(leagueId)
  // The budget is the manager's, not the squad's, so it is its own query —
  // a small one the dashboard has usually filled already.
  const manager = useLeagueManager(leagueId)
  // Above the early returns below, as every hook here has to be.
  const [isLegendOpen, setIsLegendOpen] = useState(false)
  /**
   * The sale calculator: `null` when off, otherwise the ids marked for sale.
   *
   * One piece of state rather than a boolean plus a set, so "in calculator
   * mode" and "what is selected" cannot disagree — leaving the mode drops the
   * selection by construction.
   */
  const [forSale, setForSale] = useState<ReadonlySet<string> | null>(null)

  const view: ViewValue = location.pathname.endsWith(`/${VIEWS.lineup}`)
    ? VIEWS.lineup
    : VIEWS.squad

  // The calculator lives on the Kader view: the pitch has no header to show
  // the running total in, and selling from an XI you are picking is two jobs
  // at once. Adjusted during render rather than in an effect so the pitch
  // never paints a frame with a stale selection behind it.
  if (forSale !== null && view !== VIEWS.squad) setForSale(null)

  const base = `/leagues/${leagueId}/${VIEWS.squad}`
  const tabs: BottomTab[] = [
    { value: VIEWS.squad, label: 'Kader', icon: Users, to: base },
    {
      value: VIEWS.lineup,
      label: 'Aufstellung',
      icon: Shirt,
      to: `${base}/${VIEWS.lineup}`,
    },
  ]

  if (squad.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeading title="Mannschaft" />
        <SkeletonList rows={8} />
      </div>
    )
  }

  if (squad.isError) {
    return (
      <ErrorState
        error={squad.error}
        onRetry={() => {
          void squad.refetch()
        }}
      />
    )
  }

  if (squad.data.length === 0) {
    return (
      <EmptyState
        title="Kein Spieler im Kader"
        description="Kaufe Spieler auf dem Transfermarkt, um dein Team aufzubauen."
      />
    )
  }

  const totalValue = squad.data.reduce(
    (sum, player) => sum + player.marketValue,
    0,
  )

  const showLegend = () => {
    setIsLegendOpen(true)
  }

  const toggleForSale = (playerId: string) => {
    setForSale((current) => {
      if (current === null) return current
      const next = new Set(current)
      if (!next.delete(playerId)) next.add(playerId)
      return next
    })
  }

  const soldValue = squad.data.reduce(
    (sum, player) =>
      forSale?.has(player.id) === true ? sum + player.marketValue : sum,
    0,
  )

  return (
    /* The `min-h-0` on every level of this chain is what lets the lineup view
       fill the remaining height rather than overflow: a flex child defaults to
       `min-height: auto` and would refuse to shrink below its content. */
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Kader only. The pitch is the page on the lineup view — a title, a
          squad count, a total value and a budget were four lines of height
          taken from it on the screens where it has least, for facts that are
          either obvious or belong beside the transfer decisions they inform.
          Its legend button moves onto the bench heading. */}
      {view === VIEWS.squad &&
        forSale !== null &&
        manager.data !== undefined && (
          <SaleCalculator
            budget={manager.data.budget}
            soldCount={forSale.size}
            soldValue={soldValue}
            onClose={() => {
              setForSale(null)
            }}
          />
        )}

      {view === VIEWS.squad && forSale === null && (
        <PageHeading
          title="Mannschaft"
          subtitle={`${String(squad.data.length)} Spieler · ${money(totalValue)} Gesamtwert`}
          action={
            <div className="flex shrink-0 items-center gap-2">
              {manager.data !== undefined && (
                <BudgetChip
                  budget={manager.data.budget}
                  onClick={() => {
                    setForSale(new Set())
                  }}
                />
              )}
              <button
                type="button"
                onClick={showLegend}
                title="Was bedeuten die Symbole?"
                aria-label="Legende anzeigen"
                className={cn(
                  'flex shrink-0 cursor-pointer items-center justify-center rounded-full border p-1.5',
                  'border-line bg-surface text-muted transition-colors',
                  'hover:border-accent/40 hover:bg-surface-2 hover:text-accent active:bg-line',
                  'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
                )}
              >
                <Info size={16} aria-hidden="true" />
              </button>
            </div>
          }
        />
      )}

      <SquadLegendDialog
        open={isLegendOpen}
        onOpenChange={setIsLegendOpen}
        showShirtRail={view === VIEWS.squad}
      />

      {/* The content column claims whatever height is left, which is what
          keeps the bottom bar *at the bottom* on both views. Sticky only pins
          something that would otherwise be off-screen: without this the Kader
          view's short list left the bar sitting directly under it, mid-screen,
          while the lineup — which already grew to fill — pinned it properly.
          The bar looked like it moved between the two. */}
      <div className="flex min-h-0 flex-1 flex-col">
        <SquadViews
          squad={squad.data}
          leagueId={leagueId}
          competitionId={competitionId}
          view={view}
          onShowLegend={showLegend}
          forSale={forSale}
          onToggleForSale={toggleForSale}
        />
      </div>

      <BottomTabBar tabs={tabs} active={view} ariaLabel="Kaderansicht" />
    </div>
  )
}

/**
 * What is left in the budget, as a chip beside the page title — and the way
 * into the [sale calculator](#SaleCalculator).
 *
 * Green at or above zero, red below. Kickbase lets a budget go negative — an
 * overdrawn manager pays interest on it — so the sign is a state worth seeing
 * without reading the number, and it belongs next to the squad because every
 * transfer decision starts here.
 *
 * The chip is the trigger because the question it answers ("can I afford
 * this?") and the question the calculator answers ("what if I sold these?")
 * are the same question one step apart. A separate "Rechner" button would sit
 * next to the number it is about and say the same thing twice.
 */
function BudgetChip({
  budget,
  onClick,
}: {
  budget: number
  onClick: () => void
}) {
  const isNegative = budget < 0

  return (
    <button
      type="button"
      onClick={onClick}
      title="Verkaufsrechner öffnen"
      className={cn(
        'nums flex shrink-0 cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1',
        'text-xs font-semibold transition-[filter]',
        'hover:brightness-125 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        isNegative
          ? 'border-negative/40 bg-negative/15 text-negative'
          : 'border-positive/40 bg-positive/15 text-positive',
      )}
    >
      <Wallet size={12} aria-hidden="true" className="shrink-0" />
      <span className="sr-only">Budget, Verkaufsrechner öffnen: </span>
      {money(budget)}
    </button>
  )
}

/**
 * "What would I have if I sold these?" — a slim bar, while the calculator is
 * open.
 *
 * It **replaces** the normal heading rather than sitting under it. The
 * calculator is a mode, not a panel: while it is on, tapping a player marks
 * him for sale instead of opening him, and the lineup rail is gone. A header
 * that still said "Mannschaft · 20 Spieler" over rows that had quietly changed
 * what they do would be the wrong kind of quiet.
 *
 * **Header-height and sticky.** It is `h-(--header-h)`, the same bar height as
 * the app header, and pins at `--header-total` — the header plus whatever the
 * notch adds — so the running total stays on screen while you scroll a squad
 * of twenty looking for the next player to mark. That is the whole point of
 * the mode; a total you have to scroll back up to read is a total you stop
 * consulting. The same offset the sidebar uses, for the same reason.
 *
 * One figure, not three. The projected budget is the answer; the count and the
 * proceeds are the working, and go underneath at subtitle size. The budget as
 * it stands was a third column and is gone — it is one tap away, on the chip
 * this bar replaced.
 *
 * Nothing here is a transaction. The figures are arithmetic on the squad's own
 * market values, and no request is sent — Kickbase's real sale price is what
 * the market pays, which is the market value only for a sale back to the
 * computer. The heading says *Rechner* for that reason, and the button that
 * leaves is an ✕ rather than anything that reads like "confirm".
 */
function SaleCalculator({
  budget,
  soldCount,
  soldValue,
  onClose,
}: {
  budget: number
  soldCount: number
  soldValue: number
  onClose: () => void
}) {
  const projected = budget + soldValue

  return (
    <div
      className={cn(
        // `-mx-3` bleeds to the edges of the content column so it reads as a
        // second header rather than a card that happens to be pinned, and
        // `-mt-4` cancels the well's top padding so the bar starts exactly
        // where it will pin. Without it the bar sat a gap below the header
        // until you scrolled and then jumped up to meet it.
        'sticky top-(--header-total) z-20 -mx-3 -mt-4 px-3',
        'border-b border-accent/30 bg-canvas/95 backdrop-blur-md',
      )}
    >
      <div className="flex h-(--header-h) items-center gap-2.5">
        <Calculator
          size={18}
          aria-hidden="true"
          className="shrink-0 text-accent"
        />

        <div className="min-w-0 flex-1">
          <h1 className="sr-only">Verkaufsrechner</h1>
          {/* `aria-live` so a screen reader hears the running total change as
              players are tapped — the number is the whole point of the mode,
              and it updates somewhere other than where the tap happened. */}
          <p
            aria-live="polite"
            className={cn(
              'nums truncate text-base leading-tight font-bold',
              projected < 0 ? 'text-negative' : 'text-positive',
            )}
          >
            {money(projected)}
          </p>
          <p className="nums truncate text-[0.6875rem] text-muted">
            {soldCount === 0
              ? 'Verkaufsrechner · Spieler antippen'
              : `${String(soldCount)} Spieler · ${money(soldValue)} Erlös`}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
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
  )
}

/**
 * Both views, sharing one lineup editor.
 *
 * Split from `SquadPage` because the editor is seeded from the squad, and the
 * squad only exists after the loading and error branches above have returned —
 * a hook cannot live behind those. Holding the editor here rather than inside
 * each view is what lets the list and the pitch edit the *same* lineup: pick a
 * player from his row and he is on the pitch when you switch across, with no
 * round trip in between.
 *
 * The swap dialog is rendered once, here, for the same reason. Either view can
 * open it — the one that is not visible keeps its trigger, and the dialog is
 * the editor's, not the view's.
 */
function SquadViews({
  squad,
  leagueId,
  competitionId,
  view,
  onShowLegend,
  forSale,
  onToggleForSale,
}: {
  squad: SquadMember[]
  leagueId: string
  competitionId: string
  view: ViewValue
  /** The lineup view has no page header, so it renders its own trigger. */
  onShowLegend: () => void
  /** Ids marked for sale, or `null` when the calculator is off. */
  forSale: ReadonlySet<string> | null
  onToggleForSale: (playerId: string) => void
}) {
  const editor = useLineupEditor({ squad, leagueId })
  const matchday = useCurrentMatchday(competitionId)
  const fixtureByTeamId = matchday.data?.fixtureByTeamId
  // Held here rather than in each view so the two share one set of requests:
  // switching to the pitch must not re-fetch what the list already knows.
  const startProbabilities = useStartProbabilities(leagueId, squad)
  const statusReasons = useStatusReasons(leagueId, squad)

  return (
    <>
      {view === VIEWS.squad ? (
        <PlayerListTab
          squad={squad}
          editor={editor}
          leagueId={leagueId}
          fixtureByTeamId={fixtureByTeamId}
          startProbabilities={startProbabilities}
          statusReasons={statusReasons}
          forSale={forSale}
          onToggleForSale={onToggleForSale}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <LineupTab
            squad={squad}
            editor={editor}
            fixtureByTeamId={fixtureByTeamId}
            startProbabilities={startProbabilities}
            statusReasons={statusReasons}
            onShowLegend={onShowLegend}
          />
        </div>
      )}

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
