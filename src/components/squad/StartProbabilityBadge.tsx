import { Check, Star, X } from 'lucide-react'
import type { ComponentType } from 'react'

import { START_PROBABILITY, type StartProbability } from '@/api/models'
import { cn } from '@/lib/cn'

/**
 * How each tier is drawn.
 *
 * The glyphs mirror the ones Ligainsider draws inside its own team poster, so
 * anyone who has seen the official app reads these without a legend. Two of the
 * five are text rather than icons on purpose: lucide's `HelpCircle` and
 * `AlertCircle` carry their own ring, which inside this badge's circle turns
 * into two concentric rings and mush at 12px. A bare `?` and `!` stay crisp at
 * any size.
 *
 * Colours are literals rather than theme tokens because this is a five-step
 * scale, and the palette has no blue and only one green. Tying "certain" to
 * `accent` would also make it compete with every actionable control on the
 * page, which is the opposite of what a passive indicator should do.
 */
const TIER_STYLE: Record<
  StartProbability,
  {
    background: string
    icon?: ComponentType<{ size?: number | string; className?: string }>
    glyph?: string
  }
> = {
  1: { background: 'oklch(0.62 0.17 255)', icon: Star },
  2: { background: 'oklch(0.62 0.16 150)', icon: Check },
  3: { background: 'oklch(0.68 0.17 62)', glyph: '?' },
  4: { background: 'oklch(0.58 0.20 25)', glyph: '!' },
  // Ligainsider's is a flat black; lifted just off it so the badge still has
  // an edge against the dark surface of a squad row.
  5: { background: 'oklch(0.28 0.012 260)', icon: X },
}

/**
 * The lineup-probability tier as a filled circle.
 *
 * Deliberately glyph-*and*-colour rather than colour alone: five steps is more
 * than colour can carry on its own, and about 1 in 12 men cannot separate the
 * red from the green. The glyph is the signal; the colour reinforces it.
 */
export function StartProbabilityBadge({
  tier,
  size = 14,
  /** Draws a contrasting ring, for sitting on a photo or the pitch. */
  onImage = false,
  className,
}: {
  tier: StartProbability
  size?: number
  onImage?: boolean
  className?: string
}) {
  const { label, description } = START_PROBABILITY[tier]
  const { background, icon: Icon, glyph } = TIER_STYLE[tier]

  return (
    <span
      role="img"
      aria-label={description}
      title={description}
      style={{
        width: size,
        height: size,
        background,
        // The glyph tracks the circle so one component serves a 12px row mark
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
          className="stroke-[3.5]"
          aria-hidden="true"
        />
      )}
      <span className="sr-only">{label}</span>
    </span>
  )
}

/**
 * The badge parked in the corner of a player portrait.
 *
 * Bottom-right, not top-right: the top-right corner already belongs to the
 * availability dot on the pitch, and the two would overlap. The wrapper must
 * be `relative` — every caller here already is, because the availability dot
 * needs the same.
 */
export function StartProbabilityCorner({
  tier,
  size,
}: {
  tier: StartProbability
  size: number
}) {
  return (
    <StartProbabilityBadge
      tier={tier}
      size={size}
      onImage
      // Pulled slightly outside the circle so it clears the portrait's own
      // curve — at the tangent a corner badge looks half-swallowed.
      className="absolute -right-0.5 -bottom-0.5"
    />
  )
}
