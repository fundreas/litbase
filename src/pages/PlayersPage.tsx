import { useCompetitionPlayers } from '@/api/hooks/useCompetition'
import { PagePlaceholder } from '@/components/PagePlaceholder'
import { useActiveLeague } from '@/league/useActiveLeague'

export function PlayersPage() {
  const { competitionId } = useActiveLeague()
  const query = useCompetitionPlayers(competitionId)

  return (
    <PagePlaceholder
      title="Alle Spieler"
      hookName="useCompetitionPlayers(competitionId)"
      isPending={query.isPending}
      itemCount={query.data?.length}
      error={query.error}
      onRetry={() => {
        void query.refetch()
      }}
    />
  )
}
