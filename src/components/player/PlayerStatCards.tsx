import { TrendingDown, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'
import { money, moneyDelta, points as formatPoints } from '@/lib/format'

/**
 * A headline figure with its companion underneath.
 *
 * Deliberately **not** `StatTile` with a second tile beside it. A market value
 * and its 24-hour move are one fact read two ways, and so are a points total
 * and its average — splitting each pair across two bordered boxes made a row
 * of four containers that all looked equally important and left the reader
 * pairing them up by eye. One box, one heading, and the derived number sits
 * where a derived number belongs: below the thing it derives from.
 */
function PairCard({
  label,
  value,
  foot,
  className,
}: {
  label: string
  value: ReactNode
  foot: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-card border border-line bg-surface px-3 py-2.5',
        className,
      )}
    >
      <div className="truncate text-[0.6875rem] tracking-wide text-faint uppercase">
        {label}
      </div>
      <div className="nums mt-0.5 truncate text-lg font-semibold text-ink">
        {value}
      </div>
      <div className="nums mt-1 truncate text-xs">{foot}</div>
    </div>
  )
}

/** Market value, with the last 24 hours under it. */
export function MarketValueCard({
  marketValue,
  changeDay,
  className,
}: {
  marketValue: number
  changeDay: number
  className?: string
}) {
  const Icon = changeDay >= 0 ? TrendingUp : TrendingDown

  return (
    <PairCard
      label="Marktwert"
      value={money(marketValue)}
      className={className}
      foot={
        <span
          className={cn(
            'flex items-center gap-1',
            changeDay > 0 && 'text-positive',
            changeDay < 0 && 'text-negative',
            changeDay === 0 && 'text-faint',
          )}
        >
          <Icon size={12} aria-hidden="true" className="shrink-0" />
          <span className="truncate">{moneyDelta(changeDay)} · 24 Std.</span>
        </span>
      }
    />
  )
}

/** Season points, with the per-appearance average under them. */
export function PointsCard({
  totalPoints,
  averagePoints,
  className,
}: {
  totalPoints: number
  averagePoints: number
  className?: string
}) {
  return (
    <PairCard
      label="Punkte"
      value={formatPoints(totalPoints)}
      className={className}
      foot={
        <span className="truncate text-muted">
          ⌀ {formatPoints(averagePoints)} pro Einsatz
        </span>
      }
    />
  )
}
