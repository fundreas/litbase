import { Info } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { useCurrentMatchday } from '@/api/hooks/useMatchday'
import type { SquadMember } from '@/api/models'
import { useSquad } from '@/api/hooks/useSquad'
import { useStartProbabilities } from '@/api/hooks/useStartProbabilities'
import { useStatusReasons } from '@/api/hooks/useStatusReasons'
import { PageHeading } from '@/components/PageHeading'
import { LineupTab } from '@/components/squad/LineupTab'
import { PlayerListTab } from '@/components/squad/PlayerListTab'
import { SquadLegendDialog } from '@/components/squad/SquadLegendDialog'
import { SwapDialog } from '@/components/squad/SwapDialog'
import { useLineupEditor } from '@/components/squad/useLineupEditor'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useActiveLeague } from '@/league/useActiveLeague'
import { cn } from '@/lib/cn'
import { money } from '@/lib/format'

/** Tab value ⇄ route segment. Deliberately identical strings. */
const TABS = { squad: 'squad', lineup: 'lineup' } as const
type TabValue = (typeof TABS)[keyof typeof TABS]

/**
 * The manager's own players, in two views that are **separate routes**:
 *
 *  - `/leagues/:leagueId/squad` — the full squad as a grouped list.
 *  - `/leagues/:leagueId/lineup` — the interactive lineup on a pitch.
 *
 * The active tab is derived from the URL rather than held in local state, so
 * each view is linkable, survives a refresh, and can be opened directly from
 * navigation. Both routes render this same component.
 *
 * Both read the same `useSquad` query, so switching tabs costs no request.
 */
export function SquadPage() {
  const { leagueId, competitionId } = useActiveLeague()
  const location = useLocation()
  const navigate = useNavigate()
  const { data, isPending, isError, error, refetch } = useSquad(leagueId)
  // Above the early returns below, as every hook here has to be.
  const [isLegendOpen, setIsLegendOpen] = useState(false)

  const tab: TabValue = location.pathname.endsWith(`/${TABS.lineup}`)
    ? TABS.lineup
    : TABS.squad

  const handleTabChange = (next: string) => {
    // `replace` so flicking between tabs does not fill the history stack —
    // back should leave the page, not walk back through every tab visit.
    void navigate(`/leagues/${leagueId}/${next}`, { replace: true })
  }

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeading title="Mannschaft" />
        <SkeletonList rows={8} />
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          void refetch()
        }}
      />
    )
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title="Kein Spieler im Kader"
        description="Kaufe Spieler auf dem Transfermarkt, um dein Team aufzubauen."
      />
    )
  }

  const totalValue = data.reduce((sum, player) => sum + player.marketValue, 0)

  return (
    /* The `min-h-0` on every level of this chain is what lets the lineup tab
       fill the remaining height rather than overflow: a flex child defaults to
       `min-height: auto` and would refuse to shrink below its content. */
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeading
        title="Mannschaft"
        subtitle={`${String(data.length)} Spieler · ${money(totalValue)} Gesamtwert`}
        // In the page header rather than inside a tab: most of what it
        // explains — the probability badges, the fixture icons — appears on
        // both, and a legend that moves between tabs is one nobody finds.
        action={
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
        }
      />

      <SquadLegendDialog
        open={isLegendOpen}
        onOpenChange={setIsLegendOpen}
        showShirtRail={tab === TABS.squad}
      />

      <Tabs
        value={tab}
        onValueChange={handleTabChange}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList>
          <TabsTrigger value={TABS.squad}>Kader</TabsTrigger>
          <TabsTrigger value={TABS.lineup}>Aufstellung</TabsTrigger>
        </TabsList>

        <SquadTabs
          squad={data}
          leagueId={leagueId}
          competitionId={competitionId}
        />
      </Tabs>
    </div>
  )
}

/**
 * Both tabs, sharing one lineup editor.
 *
 * Split from `SquadPage` because the editor is seeded from the squad, and the
 * squad only exists after the loading and error branches above have returned —
 * a hook cannot live behind those. Holding the editor here rather than inside
 * each tab is what lets the list and the pitch edit the *same* lineup: pick a
 * player from his row and he is on the pitch when you switch across, with no
 * round trip in between.
 *
 * The swap dialog is rendered once, here, for the same reason. Either tab can
 * open it — the tab that is not visible keeps its trigger, and the dialog is
 * the editor's, not the tab's.
 */
function SquadTabs({
  squad,
  leagueId,
  competitionId,
}: {
  squad: SquadMember[]
  leagueId: string
  competitionId: string
}) {
  const editor = useLineupEditor({ squad, leagueId })
  const matchday = useCurrentMatchday(competitionId)
  const fixtureByTeamId = matchday.data?.fixtureByTeamId
  // Held here rather than in each tab so the two share one set of requests:
  // switching to the pitch must not re-fetch what the list already knows.
  const startProbabilities = useStartProbabilities(leagueId, squad)
  const statusReasons = useStatusReasons(leagueId, squad)

  return (
    <>
      <TabsContent value={TABS.squad}>
        <PlayerListTab
          squad={squad}
          editor={editor}
          leagueId={leagueId}
          fixtureByTeamId={fixtureByTeamId}
          startProbabilities={startProbabilities}
          statusReasons={statusReasons}
        />
      </TabsContent>
      <TabsContent value={TABS.lineup} className="flex min-h-0 flex-1 flex-col">
        <LineupTab
          squad={squad}
          editor={editor}
          fixtureByTeamId={fixtureByTeamId}
          startProbabilities={startProbabilities}
          statusReasons={statusReasons}
        />
      </TabsContent>

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
