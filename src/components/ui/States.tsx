import { AlertTriangle, Inbox, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'

import { ApiError } from '@/api/errors'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'

/** Centred spinner for full-page or full-panel loads. */
export function LoadingState({
  label = 'Lädt …',
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-16 text-muted',
        className,
      )}
    >
      <Spinner size={28} />
      <span className="text-sm">{label}</span>
    </div>
  )
}

/** Failure state with a retry affordance. Understands {@link ApiError}. */
export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown
  onRetry?: () => void
  className?: string
}) {
  const isOffline = error instanceof ApiError && error.isNetwork
  const message =
    error instanceof Error ? error.message : 'Etwas ist schiefgelaufen.'

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-14 text-center',
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-negative/15 text-negative">
        {isOffline ? <WifiOff size={22} /> : <AlertTriangle size={22} />}
      </div>
      <p className="max-w-sm text-sm text-muted">{message}</p>
      {onRetry !== undefined && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Erneut versuchen
        </Button>
      )}
    </div>
  )
}

/** "Nothing here yet" state. */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-6 py-14 text-center',
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-faint">
        {icon ?? <Inbox size={22} />}
      </div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description !== undefined && (
        <p className="max-w-sm text-sm text-muted">{description}</p>
      )}
      {action}
    </div>
  )
}
