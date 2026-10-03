import { TrendingDown, TrendingUp } from 'lucide-react'

import { VALUE_MODE, type ValueMode } from '@/components/squad/useValueMode'
import { cn } from '@/lib/cn'
import { moneyDelta } from '@/lib/format'

/**
 * **The switch, as one labelled glyph that swaps when tapped.**
 *
 * Not the [pair toggle](../ui/PairToggle.tsx) the list/grid choice next to it
 * uses, and the difference is what each choice *is*. A layout has two states
 * that look like what they do, so two glyphs side by side with the live one lit
 * is readable at a glance. These two are both *a signed amount of money in the
 * same place*: a clock and a coin shown together would say nothing about which
 * figure is in the rows, because neither glyph is the figure. So this one names
 * its state instead — the label under the prices is the label on the button —
 * and a tap swaps both at once.
 *
 * It takes the same shell as its neighbours — same height, border and rounding
 * as the [scenario link](./PlayerListTab.tsx) and the pair toggle — so the
 * three read as one toolbar rather than three unrelated controls.
 */
export function ValueModeButton({
  value,
  onChange,
  className,
}: {
  value: ValueMode
  onChange: (mode: ValueMode) => void
  className?: string
}) {
  const next: ValueMode = value === 'day' ? 'profit' : 'day'
  const current = VALUE_MODE[value]
  const Icon = current.icon

  return (
    <button
      type="button"
      onClick={() => {
        onChange(next)
      }}
      title={`${current.title} · tippen für: ${VALUE_MODE[next].title}`}
      aria-label={`Angezeigt: ${current.title}. Wechseln zu: ${VALUE_MODE[next].title}`}
      className={cn(
        'flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-2',
        'text-xs font-semibold text-muted transition-colors',
        'hover:border-accent/40 hover:bg-surface-2 hover:text-accent',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        className,
      )}
    >
      <Icon size={15} aria-hidden="true" className="shrink-0 text-accent" />
      {current.label}
    </button>
  )
}

/**
 * The figure itself — the line under a row's market value, in whichever mode
 * the list is in.
 *
 * Drawn identically in one's own Kader and in a rival's, so a player reads the
 * same wherever he is met. The arrow is the *same* signal as the amount, only
 * its direction, so the two cannot contradict each other; it is dropped at
 * zero, where there is no direction to point in.
 *
 * **Zero means two different things and is drawn the same way**, grey: a flat
 * night is a fact about a night, and a profit of nothing is a claim about a
 * trade. Neither is good news or bad, which is all the colour is for.
 *
 * `undefined` is not zero — it is a figure the payload did not carry — and it
 * renders as the app's `–`, faint, rather than as a confident nought.
 */
export function ValueDelta({
  mode,
  changeDay,
  profitLoss,
}: {
  mode: ValueMode
  /** `tfhmvt`, in €. */
  changeDay: number | undefined
  /** `mvgl`, in €. Absent where the payload has no purchase price. */
  profitLoss: number | undefined
}) {
  const value = mode === 'day' ? changeDay : profitLoss
  const Icon = value !== undefined && value < 0 ? TrendingDown : TrendingUp

  return (
    <span
      className={cn(
        'nums flex items-center justify-end gap-0.5 text-xs',
        value !== undefined && value > 0 && 'text-positive',
        value !== undefined && value < 0 && 'text-negative',
        (value === undefined || value === 0) && 'text-faint',
      )}
      title={VALUE_MODE[mode].title}
    >
      {value !== undefined && value !== 0 && (
        <Icon size={11} aria-hidden="true" className="shrink-0" />
      )}
      {moneyDelta(value)}
      <span className="sr-only">{VALUE_MODE[mode].srHint}</span>
    </span>
  )
}
