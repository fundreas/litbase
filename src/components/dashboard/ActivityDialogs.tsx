import { Trophy } from 'lucide-react'

import { useAchievement } from '@/api/hooks/useAchievements'
import { useMatchdayStandings } from '@/api/hooks/useDuels'
import { ManagerRankingTab } from '@/components/ranking/ManagerRankingTab'
import { InfoDialog } from '@/components/ui/InfoDialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { moneyDelta } from '@/lib/format'

/**
 * What an achievement row opens: the description Kickbase gives it, what it
 * paid, and how often the viewer has earned it.
 *
 * The name and the description are already on the feed entry; the reward and
 * the count are not, so the sheet reads the same per-type detail the row used
 * for its subtitle — one cache entry between them, no second request.
 */
export function AchievementDialog({
  leagueId,
  achievementType,
  title,
  description,
  onClose,
}: {
  leagueId: string
  achievementType: number
  title: string
  description: string
  onClose: () => void
}) {
  const query = useAchievement(leagueId, achievementType)
  const achievement = query.data

  return (
    <InfoDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={
        <span className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Trophy size={16} aria-hidden="true" />
          </span>
          {title}
        </span>
      }
      description={description}
    >
      {query.isPending ? (
        <Skeleton className="h-14" />
      ) : query.isError ? (
        <ErrorState error={query.error} className="py-4" />
      ) : (
        <dl className="grid grid-cols-2 gap-2">
          <Fact
            label="Prämie"
            value={
              achievement !== undefined && achievement.reward > 0
                ? moneyDelta(achievement.reward)
                : 'keine'
            }
            tone={
              achievement !== undefined && achievement.reward > 0
                ? 'positive'
                : undefined
            }
          />
          <Fact
            label="Erreicht"
            value={`${String(achievement?.timesEarned ?? 0)}×`}
          />
        </dl>
      )}
    </InfoDialog>
  )
}

function Fact({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'positive'
}) {
  return (
    <div className="rounded-card border border-line bg-surface-2/40 px-3 py-2">
      <dt className="text-[0.6875rem] tracking-wide text-faint uppercase">
        {label}
      </dt>
      <dd
        className={`nums mt-0.5 text-base font-semibold ${tone === 'positive' ? 'text-positive' : 'text-ink'}`}
      >
        {value}
      </dd>
    </div>
  )
}

/**
 * What a matchday row opens in a league without duels: the matchday's manager
 * ranking, the same rows the matchday page's Rangliste draws.
 *
 * Reads `/ranking?dayNumber=` rather than the feed entry's own detail — that
 * one has placements and points but no avatars, and the standings entry is
 * one the duels and matchday pages may already have filled.
 */
export function MatchdayDialog({
  leagueId,
  day,
  label,
  viewerId,
  onClose,
}: {
  leagueId: string
  day: number
  label: string
  viewerId: string | undefined
  onClose: () => void
}) {
  const query = useMatchdayStandings(leagueId, day)

  return (
    <InfoDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={label}
    >
      {query.isError ? (
        <ErrorState error={query.error} className="py-4" />
      ) : (
        <ManagerRankingTab
          standings={query.data}
          leagueId={leagueId}
          viewerId={viewerId}
          isFinished
          isPending={query.isPending}
        />
      )}
    </InfoDialog>
  )
}
