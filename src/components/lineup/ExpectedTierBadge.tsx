import { Armchair, Check, Star, X } from 'lucide-react'
import type { ComponentType } from 'react'

import { EXPECTED_TIER, type ExpectedTier } from '@/api/models'
import { cn } from '@/lib/cn'

/**
 * How each tier is drawn.
 *
 * The same vocabulary as
 * [`StartProbabilityBadge`](../squad/StartProbabilityBadge.tsx) — a filled
 * circle, a glyph, a colour — because the two scales answer the same question
 * and a reader meeting both on the club page should not have to learn two
 * visual languages for it. The glyphs then differ where the claims differ:
 * `bench` gets a chair rather than Ligainsider's `!`, since "expected in the
 * squad, not in the eleven" is a *place*, not a doubt.
 *
 * Colours are literals rather than theme tokens for the reason that file gives
 * at length: this is a five-step scale, and the palette has no blue and only
 * one green.
 */
const TIER_STYLE: Record<
  ExpectedTier,
  {
    background: string
    icon?: ComponentType<{ size?: number | string; className?: string }>
    glyph?: string
  }
> = {
  sure: { background: 'oklch(0.62 0.17 255)', icon: Star },
  likely: { background: 'oklch(0.62 0.16 150)', icon: Check },
  coin_flip: { background: 'oklch(0.68 0.17 62)', glyph: '?' },
  bench: { background: 'oklch(0.58 0.20 25)', icon: Armchair },
  out: { background: 'oklch(0.28 0.012 260)', icon: X },
}

/**
 * The run's confidence in one player, as a filled circle.
 *
 * Glyph *and* colour rather than colour alone: five steps is more than colour
 * can carry on its own, and about 1 in 12 men cannot separate the red from the
 * green.
 *
 * The tooltip names the scale rather than the step — "Gesetzt" on its own does
 * not say what it is a judgement about, and on these screens it is a judgement
 * made by a model rather than by a journalist, which is the part a reader is
 * entitled to know.
 */
export function ExpectedTierBadge({
  tier,
  size = 14,
  /** Draws a contrasting ring, for sitting on a photo or the pitch. */
  onImage = false,
  /** For the legend, where the badge sits next to the very words it means. */
  decorative = false,
  className,
}: {
  tier: ExpectedTier
  size?: number
  onImage?: boolean
  decorative?: boolean
  className?: string
}) {
  const { background, icon: Icon, glyph } = TIER_STYLE[tier]
  const spoken = `Prognose: ${EXPECTED_TIER[tier].label}`

  return (
    <span
      {...(decorative
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': spoken, title: spoken })}
      style={{
        width: size,
        height: size,
        background,
        // The glyph tracks the circle, so one component serves a 12px row mark
        // and a 22px badge on a 96px pitch portrait.
        fontSize: Math.round(size * 0.72),
      }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        'leading-none font-bold text-white',
        onImage && 'ring-2 ring-white/85',
        className,
      )}
    >
      {Icon === undefined ? (
        <span aria-hidden="true">{glyph}</span>
      ) : (
        <Icon
          size={Math.round(size * 0.62)}
          className="stroke-[3]"
          aria-hidden="true"
        />
      )}
    </span>
  )
}
