import { ArrowRight, ChevronRight, Trophy } from 'lucide-react'
import { Link } from 'react-router'

import { useAchievement } from '@/api/hooks/useAchievements'
import { useMatchdayStandings } from '@/api/hooks/useDuels'
import { usePlayerOffers } from '@/api/hooks/usePlayerOffers'
import type { LeagueActivity, RankedManager } from '@/api/models'
import { ManagerRankingTab } from '@/components/ranking/ManagerRankingTab'
import { Avatar } from '@/components/ui/Avatar'
import { InfoDialog } from '@/components/ui/InfoDialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { money, moneyDelta } from '@/lib/format'

/**
 * What a **purchase** opens: who bought whom for how much, and — the reason
 * the sheet exists rather than a jump to the player — **what you bid**, if you
 * were in on it.
 *
 * The bid is a second request, made only when the sheet opens, because it is
 * one per player and a feed of transfers would otherwise fan out over all of
 * them. It is also the one figure here the feed entry does not carry.
 *
 * Whether Kickbase keeps a *losing* bid once the listing settles is not
 * established — see [`playerOffers`](../../api/endpoints.ts). So the line is
 * rendered when the answer has one and silently absent when it does not,
 * rather than the sheet claiming you did not bid.
 */
export function TransferDialog({
  leagueId,
  activity,
  manager,
  onClose,
}: {
  leagueId: string
  activity: Extract<LeagueActivity, { kind: 'transfer' }>
  /** The buyer from the standings, when the name still resolves to a member. */
  manager: RankedManager | undefined
  onClose: () => void
}) {
  const offers = usePlayerOffers(leagueId, activity.playerId)
  const ownOffer = offers.data?.ownOffer

  return (
    <InfoDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Transfer"
    >
      {/* The player, at the size the market draws him — this sheet is about
          one player and there is room for his face. */}
      <div className="flex items-center gap-3">
        <Avatar
          src={activity.playerImage}
          name={activity.playerName}
          size={56}
          className="bg-surface-2"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-ink">
            {activity.playerName}
          </p>
          <p className="nums text-sm text-muted">{money(activity.price)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-card border border-line bg-surface-2/40 px-3 py-2.5">
        <ArrowRight size={16} aria-hidden="true" className="text-positive" />
        <Avatar src={manager?.image} name={activity.managerName} size={28} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
          {activity.managerName}
        </span>
        <span className="shrink-0 text-xs text-faint">gekauft</span>
      </div>

      {/* Your own bid, when there was one. A skeleton while it loads, nothing
          at all when the answer is that there is none — an explicit "du hast
          nicht geboten" would be a claim the API cannot support for a
          settled transfer. */}
      {offers.isPending ? (
        <Skeleton className="h-12" />
      ) : ownOffer !== undefined ? (
        <div
          className={cn(
            'flex items-center justify-between gap-3 rounded-card px-3 py-2.5',
            'border border-accent/40 bg-accent/5',
          )}
        >
          <span className="text-sm text-muted">Dein Gebot</span>
          <span className="nums text-sm font-semibold text-accent">
            {money(ownOffer)}
          </span>
        </div>
      ) : null}

      <Link
        to={`/leagues/${leagueId}/players/${activity.playerId}`}
        onClick={onClose}
        className="flex items-center justify-center gap-0.5 text-sm font-medium text-accent"
      >
        Zum Spieler
        <ChevronRight size={15} />
      </Link>
    </InfoDialog>
  )
}

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
