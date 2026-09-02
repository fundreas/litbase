import {
  CircleCheck,
  CircleMinus,
  CircleX,
  Sigma,
  Swords,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
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
import { placement, points } from '@/lib/format'

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
            duelOpponentName={
              manager.duelOpponentId === undefined
                ? undefined
                : byId.get(manager.duelOpponentId)?.name
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
  // Crossed swords for the head-to-head table, a summation sign for the
  // points total. Icon-only keeps the control out of the heading's way; the
  // meaning rides on `title` plus screen-reader text rather than a label that
  // would need truncating on a phone.
  const options: Array<{ key: SortKey; Icon: LucideIcon; label: string }> = [
    { key: 'duel', Icon: Swords, label: 'Nach Duellpunkten sortieren' },
    { key: 'total', Icon: Sigma, label: 'Nach Kickbase-Punkten sortieren' },
  ]

  return (
    <div
      role="group"
      aria-label="Sortierung"
      className="flex shrink-0 gap-0.5 rounded-full border border-line bg-surface p-0.5"
    >
      {options.map(({ key, Icon, label }) => {
        const isActive = key === value
        return (
          <button
            key={key}
            type="button"
            aria-pressed={isActive}
            title={label}
            onClick={() => {
              onChange(key)
            }}
            className={cn(
              'flex h-8 w-9 items-center justify-center rounded-full transition-colors',
              isActive
                ? 'bg-accent text-accent-ink'
                : 'text-muted hover:text-ink',
            )}
          >
            <Icon size={15} aria-hidden="true" />
            <span className="sr-only">{label}</span>
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
  duelOpponentName,
}: {
  manager: RankedManager
  isMe: boolean
  isDuelView: boolean
  duelResult: DuelResult | undefined
  duelOpponentName: string | undefined
}) {
  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-card border bg-surface px-3 py-2.5',
        isMe ? 'border-accent/50' : 'border-line',
      )}
    >
      {/* Placement and avatar are one group with a tight gap of their own, so
          the row's `gap-3` separates them from the text rather than pushing
          the number away from the face it belongs to. */}
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="w-6 text-center">
          <span className="nums block text-base font-bold text-faint">
            {placement(
              isDuelView ? manager.duelPlacement : manager.seasonPlacement,
            )}
          </span>
          {/* Only when it actually moved — a lone dash was a line saying
              nothing. */}
          <PlacementChange value={manager.placementChange} />
        </span>
        <Avatar src={manager.image} name={manager.name} size={48} />
      </span>

      {/* Name, then two subtitles: what was scored this matchday, then how
          the duel it fed into went. */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {manager.name}
          {isMe && <span className="ml-1.5 text-xs text-accent">du</span>}
        </p>
        {/* The manager's real Kickbase points for the matchday — not their
            duel points, which are the headline figure on the right. */}
        <p className="nums truncate text-xs text-muted">
          {points(manager.matchdayPoints)} Pkt am Spieltag
        </p>
        <DuelLine result={duelResult} opponentName={duelOpponentName} />
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
  won: { Icon: CircleCheck, className: 'text-positive', text: 'Gewonnen' },
  drawn: { Icon: CircleMinus, className: 'text-muted', text: 'Remis' },
  lost: { Icon: CircleX, className: 'text-negative', text: 'Verloren' },
} as const

/**
 * How the current duel went, and against whom.
 *
 * The outcome is spelled out rather than left to the icon's colour, which
 * would be the only cue otherwise — and colour alone is not a cue everyone
 * gets. Renders nothing at all outside duel leagues, where there is no duel
 * and no opponent to name.
 */
function DuelLine({
  result,
  opponentName,
}: {
  result: DuelResult | undefined
  opponentName: string | undefined
}) {
  if (result === undefined && opponentName === undefined) return null
  const outcome = result === undefined ? undefined : DUEL_RESULT[result]

  return (
    <p className="flex items-center gap-1 text-xs">
      {outcome !== undefined && (
        <>
          <outcome.Icon
            size={13}
            aria-hidden="true"
            className={cn('shrink-0', outcome.className)}
          />
          <span className={cn('shrink-0 font-medium', outcome.className)}>
            {outcome.text}
          </span>
        </>
      )}
      {opponentName !== undefined && (
        <span className="truncate text-faint">vs. {opponentName}</span>
      )}
    </p>
  )
}

function PlacementChange({ value }: { value: number }) {
  // Nothing at all when the placement held: a dash on its own line was a
  // second subtitle that carried no information.
  if (value === 0) return null

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
