import { Minus, TrendingDown, TrendingUp } from 'lucide-react'

import { useRanking } from '@/api/hooks/useRanking'
import { useAuth } from '@/auth/useAuth'
import { PageHeading } from '@/components/PageHeading'
import { Avatar } from '@/components/ui/Avatar'
import { SkeletonList } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { useActiveLeague } from '@/league/useActiveLeague'
import { cn } from '@/lib/cn'
import { money, placement, points } from '@/lib/format'

export function RankingPage() {
  const { leagueId } = useActiveLeague()
  const { user } = useAuth()
  const { data, isPending, isError, error, refetch } = useRanking(leagueId)

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeading title="Rangliste" />
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

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Rangliste"
        subtitle={
          data.isDuelMode
            ? `${String(data.managers.length)} Manager · Duell-Modus`
            : `${String(data.managers.length)} Manager`
        }
      />

      <ul className="flex flex-col gap-2">
        {data.managers.map((manager) => {
          const isMe = manager.id === user?.id
          return (
            <li
              key={manager.id}
              className={cn(
                'flex items-center gap-3 rounded-card border bg-surface px-3 py-3',
                isMe ? 'border-accent/50' : 'border-line',
              )}
            >
              <span className="nums w-7 shrink-0 text-center text-sm font-bold text-faint">
                {placement(
                  data.isDuelMode
                    ? manager.duelPlacement
                    : manager.seasonPlacement,
                )}
              </span>

              <Avatar src={manager.image} name={manager.name} size={36} />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {manager.name}
                  {isMe && (
                    <span className="ml-1.5 text-xs text-accent">du</span>
                  )}
                </p>
                <p className="nums truncate text-xs text-muted">
                  {data.isDuelMode ? (
                    <>
                      {points(manager.seasonPoints)} Punkte ·{' '}
                      {points(manager.duelMatchdayPoints)} am Spieltag
                    </>
                  ) : (
                    <>
                      {money(manager.teamValue)} Teamwert ·{' '}
                      {points(manager.matchdayPoints)} am Spieltag
                    </>
                  )}
                </p>
              </div>

              <div className="shrink-0 text-right">
                {/* In a duel league the table is decided by duel points, so
                    that is the headline; the raw season total moves to the
                    secondary line rather than disappearing. */}
                <p className="nums text-sm font-semibold text-ink">
                  {points(
                    data.isDuelMode ? manager.duelPoints : manager.seasonPoints,
                  )}
                </p>
                <PlacementChange value={manager.placementChange} />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function PlacementChange({ value }: { value: number }) {
  if (value === 0) {
    return (
      <span className="flex items-center justify-end gap-0.5 text-xs text-faint">
        <Minus size={12} />
      </span>
    )
  }
  const isUp = value > 0
  return (
    <span
      className={cn(
        'nums flex items-center justify-end gap-0.5 text-xs',
        isUp ? 'text-positive' : 'text-negative',
      )}
    >
      {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {Math.abs(value)}
    </span>
  )
}
