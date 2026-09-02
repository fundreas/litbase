import { Hammer } from 'lucide-react'

import { PageHeading } from '@/components/PageHeading'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/States'

/**
 * Scaffold for a page that has infrastructure but no UI yet.
 *
 * It runs the page's real query so you can see at a glance that the endpoint,
 * auth and cache all work — then replace the whole component with your layout.
 */
export function PagePlaceholder({
  title,
  hookName,
  itemCount,
  isPending,
  error,
  onRetry,
}: {
  title: string
  /** The hook this page is meant to build on, e.g. `useMarket(leagueId)`. */
  hookName: string
  itemCount?: number
  isPending: boolean
  error?: unknown
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeading title={title} subtitle="Noch nicht gebaut" />

      {error !== undefined && error !== null ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : (
        <Card className="flex flex-col items-center gap-3 px-5 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Hammer size={22} />
          </div>

          <p className="text-sm font-semibold text-ink">
            Diese Seite wartet auf ihre UI
          </p>

          {isPending ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Spinner size={14} />
              Daten werden geladen …
            </p>
          ) : (
            <p className="nums text-sm text-muted">
              <span className="font-semibold text-positive">
                {itemCount ?? 0}
              </span>{' '}
              Einträge geladen — die API-Anbindung steht.
            </p>
          )}

          <code className="mt-1 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs text-accent">
            {hookName}
          </code>
        </Card>
      )}
    </div>
  )
}
