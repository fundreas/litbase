import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/cn'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-card border border-line bg-surface', className)}
      {...rest}
    />
  )
}

export function CardHeader({
  title,
  action,
  className,
}: {
  title: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-b border-line px-4 py-3',
        className,
      )}
    >
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {action}
    </div>
  )
}

/** Label-over-value tile, the workhorse for budget / points / team value. */
export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
  className,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: 'neutral' | 'positive' | 'negative'
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
      <div
        className={cn(
          'nums mt-0.5 truncate text-lg font-semibold',
          tone === 'positive' && 'text-positive',
          tone === 'negative' && 'text-negative',
        )}
      >
        {value}
      </div>
      {hint !== undefined && (
        <div className="nums mt-0.5 truncate text-xs text-muted">{hint}</div>
      )}
    </div>
  )
}
