import { useLocation, useNavigate } from 'react-router'

import { useSquad } from '@/api/hooks/useSquad'
import { PageHeading } from '@/components/PageHeading'
import { LineupTab } from '@/components/squad/LineupTab'
import { PlayerListTab } from '@/components/squad/PlayerListTab'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useActiveLeague } from '@/league/useActiveLeague'
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
        <PageHeading title="Mein Team" />
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
        title="Mein Team"
        subtitle={`${String(data.length)} Spieler · ${money(totalValue)} Gesamtwert`}
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

        <TabsContent value={TABS.squad}>
          <PlayerListTab squad={data} competitionId={competitionId} />
        </TabsContent>
        <TabsContent
          value={TABS.lineup}
          className="flex min-h-0 flex-1 flex-col"
        >
          <LineupTab
            squad={data}
            leagueId={leagueId}
            competitionId={competitionId}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
