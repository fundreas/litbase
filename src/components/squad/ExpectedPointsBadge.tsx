import { Target } from 'lucide-react'

import { cn } from '@/lib/cn'
import { points } from '@/lib/format'

/**
 * **What you expect him to score**, as a chip under the fixture crest.
 *
 * Only ever drawn when a guess exists: an empty slot on every row would be a
 * column of nothing, and the whole feature is opt-in per player. Its absence
 * is the "not guessed yet" state, and the crest above it is the tap target
 * that fixes that.
 *
 * The target glyph is what keeps a bare accent number from reading as points
 * already scored — the one thing on a squad row it could plausibly be
 * confused with. It is `aria-hidden`, and the chip carries the whole sentence
 * as its label and its tooltip, because three characters in a corner explain
 * nothing on their own. The [legend](./SquadLegendDialog.tsx) explains it once
 * for good.
 */
export function ExpectedPointsBadge({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  const label = `Erwartete Punkte: ${points(value)}`

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        'nums flex shrink-0 items-center gap-0.5 rounded-full border px-1 py-px',
        'border-accent/40 bg-accent/15 text-[0.625rem] leading-none font-semibold text-accent',
        className,
      )}
    >
      <Target size={9} aria-hidden="true" className="shrink-0" />
      {points(value)}
    </span>
  )
}
