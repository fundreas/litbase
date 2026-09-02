import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * A single toggleable filter. Rendered as a real button with
 * `aria-pressed`, so the on/off state is announced rather than only coloured.
 */
export function FilterChip({
  isActive,
  onClick,
  children,
  leading,
}: {
  isActive: boolean
  onClick: () => void
  children: ReactNode
  leading?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3',
        'text-xs font-medium whitespace-nowrap transition-colors',
        isActive
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-line bg-surface text-muted hover:text-ink active:bg-surface-2',
      )}
    >
      {leading}
      {children}
    </button>
  )
}

/**
 * Horizontally scrolling row of chips. On a phone there is no room to wrap a
 * dozen competitions, so the row scrolls sideways with the scrollbar hidden
 * and its own overflow container — the page itself never scrolls horizontally.
 */
export function FilterChipRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="px-0.5 text-[0.6875rem] tracking-wide text-faint uppercase">
        {label}
      </span>
      <div
        className="-mx-3 no-scrollbar flex gap-2 overflow-x-auto px-3"
        role="group"
        aria-label={label}
      >
        {children}
      </div>
    </div>
  )
}
