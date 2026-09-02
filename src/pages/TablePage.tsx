import { useCompetitionTable } from '@/api/hooks/useCompetition'
import { PagePlaceholder } from '@/components/PagePlaceholder'
import { useActiveLeague } from '@/league/useActiveLeague'

export function TablePage() {
  const { competitionId } = useActiveLeague()
  const query = useCompetitionTable(competitionId)

  return (
    <PagePlaceholder
      title="Bundesliga-Tabelle"
      hookName="useCompetitionTable(competitionId)"
      isPending={query.isPending}
      itemCount={query.data?.length}
      error={query.error}
      onRetry={() => {
        void query.refetch()
      }}
    />
  )
}
