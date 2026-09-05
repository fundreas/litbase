import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/cn'

/** One of the two choices: what it is, what it looks like, what it is called. */
export interface PairOption<T extends string> {
  value: T
  icon: LucideIcon
  /** Phrased as the *destination* — it becomes "switch to …" on the control. */
  label: string
}

/**
 * A choice between two views, as **one button showing both symbols**.
 *
 * Two buttons would say the same thing with twice the target area and an
 * `aria-pressed` state each, for a choice with exactly two outcomes and no cost
 * to getting it wrong. One button that swaps is the smaller, faster control —
 * and keeping *both* glyphs on it is what makes it legible: a lone icon has to
 * answer "is this the current view or the one I would switch to?", which a
 * single glyph cannot. Here the lit one is where you are and the faint one is
 * where a tap takes you.
 *
 * Right-aligned and icon-only: these are preferences set once, not primary
 * actions, and they should not pull the eye away from the content they arrange.
 *
 * The same control in both places it appears — the squad's list/grid and the
 * [match ranking](../matchday/MatchRankingTab.tsx)'s combined/per-club — so a
 * reader who learns the notation once does not meet a second version of it.
 */
export function PairToggle<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T
  /** Exactly two, in the order they are drawn. */
  options: readonly [PairOption<T>, PairOption<T>]
  onChange: (value: T) => void
  className?: string
}) {
  const next = options.find((option) => option.value !== value) ?? options[1]
  const label = `Zu: ${next.label}`

  return (
    <div className={cn('flex justify-end', className)}>
      <button
        type="button"
        onClick={() => {
          onChange(next.value)
        }}
        title={label}
        aria-label={label}
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2',
          'transition-colors hover:border-accent/40 hover:bg-surface-2',
          'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        )}
      >
        {options.map((option, index) => (
          <span key={option.value} className="flex items-center gap-1.5">
            {index > 0 && (
              <span aria-hidden="true" className="h-4 w-px bg-line" />
            )}
            <option.icon
              size={15}
              aria-hidden="true"
              className={option.value === value ? 'text-accent' : 'text-faint'}
            />
          </span>
        ))}
      </button>
    </div>
  )
}
