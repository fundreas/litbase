import { Info, Shirt, Users, Wallet } from 'lucide-react'
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

  const view: ViewValue = location.pathname.endsWith(`/${VIEWS.lineup}`)
    ? VIEWS.lineup
    : VIEWS.squad

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

  return (
    /* The `min-h-0` on every level of this chain is what lets the lineup view
       fill the remaining height rather than overflow: a flex child defaults to
       `min-height: auto` and would refuse to shrink below its content. */
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeading
        title="Mannschaft"
        subtitle={`${String(squad.data.length)} Spieler · ${money(totalValue)} Gesamtwert`}
        action={
          <div className="flex shrink-0 items-center gap-2">
            {manager.data !== undefined && (
              <BudgetChip budget={manager.data.budget} />
            )}
            {/* In the page header rather than inside a view: most of what it
                explains — the probability badges, the fixture icons — appears
                on both, and a legend that moves between views is one nobody
                finds. */}
            <button
              type="button"
              onClick={() => {
                setIsLegendOpen(true)
              }}
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

      <SquadLegendDialog
        open={isLegendOpen}
        onOpenChange={setIsLegendOpen}
        showShirtRail={view === VIEWS.squad}
      />

      <SquadViews
        squad={squad.data}
        leagueId={leagueId}
        competitionId={competitionId}
        view={view}
      />

      <BottomTabBar tabs={tabs} active={view} ariaLabel="Kaderansicht" />
    </div>
  )
}

/**
 * What is left in the budget, as a chip beside the page title.
 *
 * Green at or above zero, red below. Kickbase lets a budget go negative — an
 * overdrawn manager pays interest on it — so the sign is a state worth seeing
 * without reading the number, and it belongs next to the squad because every
 * transfer decision starts here.
 */
function BudgetChip({ budget }: { budget: number }) {
  const isNegative = budget < 0

  return (
    <span
      title={`Budget: ${money(budget)}`}
      className={cn(
        'nums flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1',
        'text-xs font-semibold',
        isNegative
          ? 'border-negative/40 bg-negative/15 text-negative'
          : 'border-positive/40 bg-positive/15 text-positive',
      )}
    >
      <Wallet size={12} aria-hidden="true" className="shrink-0" />
      <span className="sr-only">Budget: </span>
      {money(budget)}
    </span>
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
}: {
  squad: SquadMember[]
  leagueId: string
  competitionId: string
  view: ViewValue
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
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <LineupTab
            squad={squad}
            editor={editor}
            fixtureByTeamId={fixtureByTeamId}
            startProbabilities={startProbabilities}
            statusReasons={statusReasons}
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
