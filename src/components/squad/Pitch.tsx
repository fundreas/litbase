import type { ReactNode } from 'react'

import type { PitchOrientation } from '@/components/squad/pitchMetrics'
import { cn } from '@/lib/cn'

/**
 * Football pitch background, drawn as inline SVG.
 *
 * Inline rather than an image file for three reasons: it scales to any aspect
 * ratio without artefacts, it costs no extra request, and the line colours can
 * reference the same theme tokens as the rest of the app.
 *
 * Two sets of markings, because the pitch is drawn two ways — see
 * [`PitchOrientation`](./pitchMetrics.ts). `portrait` is the phone's: own goal
 * at the bottom, attacking upward. `landscape` is that same pitch turned a
 * quarter turn anticlockwise for a wide screen, goals at the left and right
 * ends. Proportions are loosely real either way: a 68×105 m pitch scaled into
 * a 100×150 viewBox, or 150×100 on its side.
 *
 * **Drawn out twice rather than rotated with a `transform`.** The turf
 * gradient runs top-to-bottom and the stroke width is deliberately
 * non-scaling; a rotated group would tilt the first and is one more thing
 * between a reader of this file and the shape they can see on screen. Two
 * dozen coordinates is the cheaper honesty.
 */
export function Pitch({
  children,
  className,
  orientation = 'portrait',
}: {
  children: ReactNode
  className?: string
  /** Which way round the markings go. Defaults to the phone's pitch. */
  orientation?: PitchOrientation
}) {
  const isLandscape = orientation === 'landscape'

  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden rounded-card border border-line',
        /* A floor, not a height — every caller grows past it. Landscape needs
           the taller one: its busiest band is a *column* of five, where
           portrait's tallest stack is the four bands themselves. Callers that
           set their own `min-h` still win, as they must: the pitches that draw
           eight bands have measured their own floor. */
        isLandscape ? 'min-h-[26rem]' : 'min-h-72',
        className,
      )}
    >
      <svg
        viewBox={isLandscape ? '0 0 150 100' : '0 0 100 150'}
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

        <rect
          width={isLandscape ? 150 : 100}
          height={isLandscape ? 100 : 150}
          fill="url(#pitch-turf)"
        />

        {/* Mown stripes — subtle, and they give the field depth. They run the
            length of the pitch, so they turn with it. */}
        {[0, 2, 4, 6, 8].map((band) =>
          isLandscape ? (
            <rect
              key={band}
              x={band * 15}
              y="0"
              width="15"
              height="100"
              fill="oklch(1 0 0 / 0.025)"
            />
          ) : (
            <rect
              key={band}
              x="0"
              y={band * 15}
              width="100"
              height="15"
              fill="oklch(1 0 0 / 0.025)"
            />
          ),
        )}

        <g
          fill="none"
          stroke="oklch(1 0 0 / 0.28)"
          strokeWidth="0.6"
          vectorEffect="non-scaling-stroke"
        >
          {isLandscape ? (
            <>
              {/* Touchlines */}
              <rect x="3" y="3" width="144" height="94" />
              {/* Halfway line and centre circle */}
              <line x1="75" y1="3" x2="75" y2="97" />
              <circle cx="75" cy="50" r="14" />
              <circle cx="75" cy="50" r="0.8" fill="oklch(1 0 0 / 0.28)" />
              {/* Left penalty area — the home keeper's, or a lone eleven's */}
              <rect x="3" y="22" width="27" height="56" />
              <rect x="3" y="38" width="8" height="24" />
              {/* Right penalty area */}
              <rect x="120" y="22" width="27" height="56" />
              <rect x="139" y="38" width="8" height="24" />
            </>
          ) : (
            <>
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
            </>
          )}
        </g>
      </svg>

      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
