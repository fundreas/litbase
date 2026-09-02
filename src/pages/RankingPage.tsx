import {
  CircleCheck,
  CircleMinus,
  CircleX,
  Minus,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { duelResultOf, useRanking } from '@/api/hooks/useRanking'
import type { DuelResult, RankedManager } from '@/api/models'
import { useAuth } from '@/auth/useAuth'
import { PageHeading } from '@/components/PageHeading'
import { Avatar } from '@/components/ui/Avatar'
import { SkeletonList } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { useActiveLeague } from '@/league/useActiveLeague'
import { cn } from '@/lib/cn'
import { money, placement, points } from '@/lib/format'

/** Which of the two tables the list is showing. */
type SortKey = 'duel' | 'total'

export function RankingPage() {
  const { leagueId } = useActiveLeague()
  const { user } = useAuth()
  const { data, isPending, isError, error, refetch } = useRanking(leagueId)
  const [sortBy, setSortBy] = useState<SortKey>('duel')

  // In a duel league the two tables genuinely disagree, so the toggle switches
  // the whole view at once — order, placement number and headline figure.
  // Listing duel placements in points order would just look broken.
  const isDuelView = data?.isDuelMode === true && sortBy === 'duel'

  const managers = useMemo(() => {
    const list = data?.managers ?? []
    // The hook already sorted by the league's own table, so only the
    // non-default view needs re-sorting.
    if (data?.isDuelMode !== true || sortBy === 'duel') return list
    return [...list].sort(
      (a, b) =>
        a.seasonPlacement - b.seasonPlacement ||
        b.seasonPoints - a.seasonPoints,
    )
  }, [data, sortBy])

  // Duel results are resolved against the opponent named in `hhoui`, so the
  // whole field has to be addressable by id.
  const byId = useMemo(
    () =>
      new Map((data?.managers ?? []).map((manager) => [manager.id, manager])),
    [data],
  )

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
            ? `${String(managers.length)} Manager · Duell-Modus`
            : `${String(managers.length)} Manager`
        }
        action={
          data.isDuelMode ? (
            <SortToggle value={sortBy} onChange={setSortBy} />
          ) : undefined
        }
      />

      <ul className="flex flex-col gap-2">
        {managers.map((manager) => (
          <ManagerRow
            key={manager.id}
            manager={manager}
            isMe={manager.id === user?.id}
            isDuelView={isDuelView}
            duelResult={
              data.isDuelMode ? duelResultOf(manager, byId) : undefined
            }
          />
        ))}
      </ul>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/** Only rendered for duel leagues — elsewhere both options mean the same. */
function SortToggle({
  value,
  onChange,
}: {
  value: SortKey
  onChange: (next: SortKey) => void
}) {
  const options: Array<{ key: SortKey; label: string; title: string }> = [
    { key: 'duel', label: 'Duell', title: 'Nach Duellpunkten sortieren' },
    { key: 'total', label: 'Punkte', title: 'Nach Kickbase-Punkten sortieren' },
  ]

  return (
    <div
      role="group"
      aria-label="Sortierung"
      className="flex shrink-0 gap-0.5 rounded-full border border-line bg-surface p-0.5"
    >
      {options.map((option) => {
        const isActive = option.key === value
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={isActive}
            title={option.title}
            onClick={() => {
              onChange(option.key)
            }}
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
              isActive
                ? 'bg-accent text-accent-ink'
                : 'text-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function ManagerRow({
  manager,
  isMe,
  isDuelView,
  duelResult,
}: {
  manager: RankedManager
  isMe: boolean
  isDuelView: boolean
  duelResult: DuelResult | undefined
}) {
  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-card border bg-surface px-3 py-3',
        isMe ? 'border-accent/50' : 'border-line',
      )}
    >
      {/* Placement and its movement belong together; the right-hand column is
          two point figures. */}
      <span className="w-8 shrink-0 text-center">
        <span className="nums block text-sm font-bold text-faint">
          {placement(
            isDuelView ? manager.duelPlacement : manager.seasonPlacement,
          )}
        </span>
        <PlacementChange value={manager.placementChange} />
      </span>

      <Avatar src={manager.image} name={manager.name} size={36} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {manager.name}
          {isMe && <span className="ml-1.5 text-xs text-accent">du</span>}
        </p>
        <p className="nums flex items-center gap-1.5 text-xs text-muted">
          <span className="truncate">{money(manager.teamValue)} Teamwert</span>
          <span aria-hidden="true">·</span>
          {/* The matchday figure is the manager's real Kickbase points, not
              the duel points — those are what the duel was decided on, and the
              icon says how it went. */}
          <span className="shrink-0">{points(manager.matchdayPoints)}</span>
          <DuelResultIcon result={duelResult} />
        </p>
      </div>

      {/* Two figures stacked, so the ordering is self-explaining: the bold one
          is what the table is sorted by, the muted one is the other total. */}
      <div className="shrink-0 text-right">
        <p className="nums text-sm font-semibold text-ink">
          {points(isDuelView ? manager.duelPoints : manager.seasonPoints)}
        </p>
        {manager.duelPoints !== undefined && (
          <p
            className="nums text-xs text-muted"
            title={
              isDuelView ? 'Kickbase-Punkte insgesamt' : 'Duellpunkte insgesamt'
            }
          >
            {isDuelView
              ? `${points(manager.seasonPoints)} Pkt`
              : `${points(manager.duelPoints)} Duell`}
          </p>
        )}
      </div>
    </li>
  )
}

const DUEL_RESULT = {
  won: {
    Icon: CircleCheck,
    className: 'text-positive',
    label: 'Duell gewonnen',
  },
  drawn: { Icon: CircleMinus, className: 'text-muted', label: 'Duell remis' },
  lost: { Icon: CircleX, className: 'text-negative', label: 'Duell verloren' },
} as const

function DuelResultIcon({ result }: { result: DuelResult | undefined }) {
  if (result === undefined) return null
  const { Icon, className, label } = DUEL_RESULT[result]
  return (
    <Icon
      size={13}
      role="img"
      aria-label={label}
      className={cn('shrink-0', className)}
    />
  )
}

function PlacementChange({ value }: { value: number }) {
  if (value === 0) {
    return (
      <span className="flex items-center justify-center gap-0.5 text-xs text-faint">
        <Minus size={12} />
      </span>
    )
  }
  const isUp = value > 0
  return (
    <span
      className={cn(
        'nums flex items-center justify-center gap-0.5 text-xs',
        isUp ? 'text-positive' : 'text-negative',
      )}
    >
      {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {Math.abs(value)}
    </span>
  )
}
