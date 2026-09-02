import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'

import { useLeagueDetails, useLeagueManager } from '@/api/hooks/useLeague'
import { useRanking } from '@/api/hooks/useRanking'
import { useAuth } from '@/auth/useAuth'
import { PageHeading } from '@/components/PageHeading'
import { Avatar } from '@/components/ui/Avatar'
import { Card, CardHeader, StatTile } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { useActiveLeague } from '@/league/useActiveLeague'
import { date, money, placement, points } from '@/lib/format'

/**
 * Reference implementation for a data page: a couple of queries, a loading
 * skeleton per section, one error state, no manual fetching.
 */
export function DashboardPage() {
  const { league, leagueId } = useActiveLeague()
  const { user } = useAuth()

  const managerQuery = useLeagueManager(leagueId)
  const detailsQuery = useLeagueDetails(leagueId)
  const rankingQuery = useRanking(leagueId)

  const ranking = rankingQuery.data
  const me = ranking?.managers.find((manager) => manager.id === user?.id)
  const podium = ranking?.managers.slice(0, 3) ?? []
  const placementOf = (manager: {
    seasonPlacement: number
    duelPlacement?: number
  }) =>
    ranking?.isDuelMode === true
      ? manager.duelPlacement
      : manager.seasonPlacement

  if (managerQuery.isError) {
    return (
      <ErrorState
        error={managerQuery.error}
        onRetry={() => {
          void managerQuery.refetch()
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeading
        title={league.name}
        subtitle={
          detailsQuery.data
            ? `${detailsQuery.data.competitionName} · ${String(detailsQuery.data.memberCount)} Manager · seit ${date(detailsQuery.data.createdAt)}`
            : undefined
        }
      />

      <section className="grid grid-cols-2 gap-2">
        {managerQuery.isPending ? (
          <>
            <Skeleton className="h-20 rounded-card" />
            <Skeleton className="h-20 rounded-card" />
            <Skeleton className="h-20 rounded-card" />
            <Skeleton className="h-20 rounded-card" />
          </>
        ) : (
          <>
            <StatTile
              label="Budget"
              value={money(managerQuery.data?.budget)}
              tone={
                (managerQuery.data?.budget ?? 0) < 0 ? 'negative' : 'positive'
              }
            />
            <StatTile label="Teamwert" value={money(me?.teamValue)} />
            <StatTile
              label="Punkte"
              value={points(
                ranking?.isDuelMode === true
                  ? me?.duelPoints
                  : me?.seasonPoints,
              )}
              hint={`Spieltag: ${points(
                ranking?.isDuelMode === true
                  ? me?.duelMatchdayPoints
                  : me?.matchdayPoints,
              )}`}
            />
            <StatTile
              label="Platz"
              value={placement(me === undefined ? undefined : placementOf(me))}
              hint={`${String(managerQuery.data?.squadSize ?? 0)} Spieler im Kader`}
            />
          </>
        )}
      </section>

      <Card>
        <CardHeader
          title="Rangliste"
          action={
            <Link
              to={`/leagues/${leagueId}/ranking`}
              className="flex items-center gap-0.5 text-xs font-medium text-accent"
            >
              Alle
              <ChevronRight size={14} />
            </Link>
          }
        />
        {rankingQuery.isPending ? (
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {podium.map((manager) => (
              <li
                key={manager.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span className="nums w-6 shrink-0 text-sm font-semibold text-faint">
                  {placement(placementOf(manager))}
                </span>
                <Avatar src={manager.image} name={manager.name} size={32} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                  {manager.name}
                  {manager.id === user?.id && (
                    <span className="ml-1.5 text-xs text-accent">du</span>
                  )}
                </span>
                <span className="nums shrink-0 text-sm font-semibold text-ink">
                  {points(
                    ranking?.isDuelMode === true
                      ? manager.duelPoints
                      : manager.seasonPoints,
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
