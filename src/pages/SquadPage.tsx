import { useSquad } from '@/api/hooks/useSquad'
import { PageHeading } from '@/components/PageHeading'
import { LineupTab } from '@/components/squad/LineupTab'
import { PlayerListTab } from '@/components/squad/PlayerListTab'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useActiveLeague } from '@/league/useActiveLeague'
import { money } from '@/lib/format'

/**
 * The manager's own players, in two views:
 *
 *  - **Kader** — the full squad as a grouped list.
 *  - **Aufstellung** — the interactive lineup on a pitch.
 *
 * Both read the same `useSquad` query, so switching tabs costs no request.
 */
export function SquadPage() {
  const { leagueId, competitionId } = useActiveLeague()
  const { data, isPending, isError, error, refetch } = useSquad(leagueId)

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
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Mein Team"
        subtitle={`${String(data.length)} Spieler · ${money(totalValue)} Gesamtwert`}
      />

      <Tabs defaultValue="squad">
        <TabsList>
          <TabsTrigger value="squad">Kader</TabsTrigger>
          <TabsTrigger value="lineup">Aufstellung</TabsTrigger>
        </TabsList>

        <TabsContent value="squad">
          <PlayerListTab squad={data} competitionId={competitionId} />
        </TabsContent>
        <TabsContent value="lineup">
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
