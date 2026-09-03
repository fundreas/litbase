import { Plus } from 'lucide-react'

import { availabilityLabel } from '@/api/models'
import { PLAYER_AVAILABILITY } from '@/api/types'
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
 * **Two marks, because the codes are now known.** This used to be one cross
 * for every non-zero `st`, on the grounds that guessing at the numbers would
 * sooner or later put a medical mark on a suspended player. The numbers have
 * since been read off live data — see {@link PLAYER_AVAILABILITY}, decoded
 * across all 18 squads against the German `stxt` each carries — and that one
 * case turned out to be real: `st: 8` is a suspension, and both players
 * carrying it had been sent off in their club's previous fixture.
 *
 * So a suspension gets a red card and everything else keeps the cross. The
 * scale is deliberately *not* opened up any further than that: injury, knock
 * and rehab differ in severity but not in what the reader has to do about
 * them, and three shades of red disc is a legend nobody reads. The tooltip
 * still carries the specifics in Kickbase's own words from `stxt`, and falls
 * back to the code's label — not a generic one — when no text arrives.
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
  if (status === PLAYER_AVAILABILITY.FIT) return null

  const isSuspended = status === PLAYER_AVAILABILITY.SUSPENDED
  // `stxt` when Kickbase supplies one, the code's own label otherwise — a
  // suspension carries no text at all, and "Nicht einsatzbereit" would be the
  // one thing the red card has already said.
  const spoken = reason ?? availabilityLabel(status)

  if (isSuspended) {
    return (
      <span
        {...(decorative
          ? { 'aria-hidden': true }
          : { role: 'img', 'aria-label': spoken, title: spoken })}
        style={{ width: Math.round(size * 0.72), height: size }}
        className={cn(
          'inline-block shrink-0 rounded-[2px] bg-negative',
          onImage && 'ring-2 ring-white/85',
          className,
        )}
      />
    )
  }

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
