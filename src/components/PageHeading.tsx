import type { ReactNode } from 'react'

/** Consistent page title block. Every page should start with one. */
export function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold tracking-tight text-ink">
          {title}
        </h1>
        {subtitle !== undefined && (
          <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  )
}
