import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * Football pitch background, drawn as inline SVG.
 *
 * Inline rather than an image file for three reasons: it scales to any aspect
 * ratio without artefacts, it costs no extra request, and the line colours can
 * reference the same theme tokens as the rest of the app.
 *
 * The markings are laid out for a **vertical** pitch (own goal at the bottom,
 * attacking upward), which is how a lineup reads on a phone. Proportions are
 * loosely real: an 68×105 m pitch scaled into a 100×150 viewBox.
 */
export function Pitch({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative flex min-h-72 flex-col overflow-hidden rounded-card border border-line',
        className,
      )}
    >
      <svg
        viewBox="0 0 100 150"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          {/* Two greens rather than one flat fill, so the pitch reads as turf
              without a texture image. */}
          <linearGradient id="pitch-turf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.42 0.09 148)" />
            <stop offset="100%" stopColor="oklch(0.33 0.07 148)" />
          </linearGradient>
        </defs>

        <rect width="100" height="150" fill="url(#pitch-turf)" />

        {/* Mown stripes — subtle, and they give the field depth. */}
        {[0, 2, 4, 6, 8].map((band) => (
          <rect
            key={band}
            x="0"
            y={band * 15}
            width="100"
            height="15"
            fill="oklch(1 0 0 / 0.025)"
          />
        ))}

        <g
          fill="none"
          stroke="oklch(1 0 0 / 0.28)"
          strokeWidth="0.6"
          vectorEffect="non-scaling-stroke"
        >
          {/* Touchlines */}
          <rect x="3" y="3" width="94" height="144" />
          {/* Halfway line and centre circle */}
          <line x1="3" y1="75" x2="97" y2="75" />
          <circle cx="50" cy="75" r="14" />
          <circle cx="50" cy="75" r="0.8" fill="oklch(1 0 0 / 0.28)" />
          {/* Bottom penalty area (own goal) */}
          <rect x="22" y="120" width="56" height="27" />
          <rect x="38" y="139" width="24" height="8" />
          {/* Top penalty area */}
          <rect x="22" y="3" width="56" height="27" />
          <rect x="38" y="3" width="24" height="8" />
        </g>
      </svg>

      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
