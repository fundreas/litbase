import { useMarket } from '@/api/hooks/useMarket'
import { PagePlaceholder } from '@/components/PagePlaceholder'
import { useActiveLeague } from '@/league/useActiveLeague'

export function MarketPage() {
  const { leagueId } = useActiveLeague()
  const query = useMarket(leagueId)

  return (
    <PagePlaceholder
      title="Transfermarkt"
      hookName="useMarket(leagueId)"
      isPending={query.isPending}
      itemCount={query.data?.length}
      error={query.error}
      onRetry={() => {
        void query.refetch()
      }}
    />
  )
}
