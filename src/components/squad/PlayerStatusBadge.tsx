import { Plus } from 'lucide-react'

import { cn } from '@/lib/cn'

/**
 * The "not available" marker on a squad player.
 *
 * **A red cross, not a red dot.** The dot said only that *something* was wrong,
 * and a bare coloured dot on a dark row is easy to read as decoration —
 * particularly next to the availability *and* probability marks the squad
 * already carries. A white cross in a red disc is the first-aid mark, which
 * needs no legend and stays crisp where a plaster or a syringe glyph turns to
 * mush: this renders at 13–14px on a list row and 12px on a pitch portrait.
 *
 * **One mark for every non-zero status.** Kickbase's `st` is a code, not a
 * flag — injury, knock, rehab, suspension and "not in the squad" are different
 * values, and `stl` carries further ones alongside — but the meaning of the
 * individual numbers is not confirmed against live data, and guessing would
 * put a medical mark on a suspended player. So the *icon* says the one thing
 * we know for certain (he cannot be counted on this week) and the *tooltip*
 * carries the specifics, in Kickbase's own words, from `stxt`. When the reason
 * has not arrived — a healthy fetch that simply carried no text, or a status
 * Kickbase leaves unexplained — the mark falls back to the generic label
 * rather than inventing one.
 */
export function PlayerStatusBadge({
  /** The wire's `st`. `0` renders nothing, so callers need no guard. */
  status,
  /** `stxt`, e.g. "Wadenprobleme – verpasst BMG (H)". */
  reason,
  size = 14,
  /** Draws a contrasting ring, for sitting on a photo or the pitch. */
  onImage = false,
  /** For the legend, where the badge sits next to the very words it means. */
  decorative = false,
  className,
}: {
  status: number
  reason?: string
  size?: number
  onImage?: boolean
  decorative?: boolean
  className?: string
}) {
  if (status === 0) return null

  const spoken = reason ?? 'Nicht einsatzbereit'

  return (
    <span
      {...(decorative
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': spoken, title: spoken })}
      style={{ width: size, height: size }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        'bg-negative text-white',
        onImage && 'ring-2 ring-white/85',
        className,
      )}
    >
      <Plus
        size={Math.round(size * 0.78)}
        // Heavier than lucide's default: at this size a 2px stroke reads grey
        // rather than white against the red.
        className="stroke-[3.5]"
        aria-hidden="true"
      />
    </span>
  )
}
