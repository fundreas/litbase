import { useId, useState } from 'react'

import type { MarketValueDay } from '@/api/models'
import { cn } from '@/lib/cn'
import { money, moneyDelta, weekdayDate } from '@/lib/format'

/** Drawing space. Arbitrary — the SVG is stretched to whatever box it gets. */
const VIEW = { width: 100, height: 100 } as const

/**
 * Fraction of the vertical range left empty above and below the line.
 *
 * Without it a series that only ever rises is drawn flush against the top edge
 * and reads as clipped.
 */
const PADDING = 0.08

interface Plot {
  /** `d` for the line. */
  line: string
  /** `d` for the filled area under it. */
  area: string
  /** Where each day sits, so the readout can snap to one. */
  positions: Array<{ x: number; y: number }>
  min: number
  max: number
}

function plot(days: MarketValueDay[]): Plot | undefined {
  if (days.length < 2) return undefined

  const values = days.map((day) => day.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  // A flat series has no range to scale into; give it one so it draws as a
  // line through the middle rather than dividing by zero.
  const span = max - min || Math.max(max, 1)
  const top = max + span * PADDING
  const bottom = min - span * PADDING

  const positions = days.map((day, index) => ({
    x: (index / (days.length - 1)) * VIEW.width,
    y: VIEW.height - ((day.value - bottom) / (top - bottom)) * VIEW.height,
  }))

  const line = positions
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${point.x.toFixed(3)} ${point.y.toFixed(3)}`,
    )
    .join(' ')

  const first = positions[0]
  const last = positions[positions.length - 1]
  const area =
    first === undefined || last === undefined
      ? line
      : `${line} L${last.x.toFixed(3)} ${VIEW.height} L${first.x.toFixed(3)} ${VIEW.height} Z`

  return { line, area, positions, min, max }
}

/**
 * A player's market value over the selected window.
 *
 * Inline SVG rather than a charting library: this is one series of at most 365
 * points with no axes to speak of, and the smallest library that draws it is
 * larger than the rest of the page. It also means the line can reference the
 * app's own theme tokens instead of a second palette.
 *
 * **The line is drawn in a stretched SVG and every label is HTML.** The path
 * lives in a `preserveAspectRatio="none"` viewBox so it fills any width
 * without arithmetic; `vectorEffect="non-scaling-stroke"` keeps the stroke an
 * even weight despite that stretch. Text cannot survive the same treatment —
 * it would be squashed horizontally — so the labels sit outside the SVG,
 * positioned as a percentage of the same box.
 *
 * Touching or hovering the chart reads out that day. There is no separate
 * "tap to inspect" affordance because the whole plot is the target.
 */
export function MarketValueChart({ days }: { days: MarketValueDay[] }) {
  const gradientId = useId()
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined)

  const shape = plot(days)
  const first = days[0]
  const last = days[days.length - 1]

  if (shape === undefined || first === undefined || last === undefined) {
    return (
      <div className="flex h-44 items-center justify-center rounded-card border border-line bg-surface text-xs text-faint">
        Zu wenige Daten für einen Verlauf
      </div>
    )
  }

  const isUp = last.value >= first.value
  const stroke = isUp ? 'var(--color-positive)' : 'var(--color-negative)'

  const active = activeIndex === undefined ? undefined : days[activeIndex]
  const activePoint =
    activeIndex === undefined ? undefined : shape.positions[activeIndex]

  /** Nearest day to where the pointer is, as a fraction of the width. */
  const pick = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    if (box.width === 0) return
    const ratio = (event.clientX - box.left) / box.width
    const index = Math.round(ratio * (days.length - 1))
    setActiveIndex(Math.min(Math.max(index, 0), days.length - 1))
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        className="relative h-44 w-full touch-pan-y overflow-hidden rounded-card border border-line bg-surface"
        role="img"
        aria-label={`Marktwertverlauf von ${weekdayDate(first.date)} bis ${weekdayDate(last.date)}, ${money(first.value)} auf ${money(last.value)}`}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => {
          setActiveIndex(undefined)
        }}
      >
        <svg
          viewBox={`0 0 ${String(VIEW.width)} ${String(VIEW.height)}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Quarter gridlines. Unlabelled on purpose — the numbers that
              matter are the high and the low, and those are called out. */}
          {[0.25, 0.5, 0.75].map((fraction) => (
            <line
              key={fraction}
              x1="0"
              x2={VIEW.width}
              y1={VIEW.height * fraction}
              y2={VIEW.height * fraction}
              stroke="var(--color-line)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <path d={shape.area} fill={`url(#${gradientId})`} />
          <path
            d={shape.line}
            fill="none"
            stroke={stroke}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          {activePoint !== undefined && (
            <line
              x1={activePoint.x}
              x2={activePoint.x}
              y1="0"
              y2={VIEW.height}
              stroke="var(--color-ink)"
              strokeWidth="1"
              strokeOpacity="0.45"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* The marker is HTML, not an SVG circle: a circle in a stretched
            viewBox comes out an ellipse. */}
        {activePoint !== undefined && (
          <span
            className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-canvas"
            style={{
              left: `${String(activePoint.x)}%`,
              top: `${String(activePoint.y)}%`,
              background: stroke,
            }}
          />
        )}

        {active === undefined ? (
          <>
            <Label className="top-1.5 right-2">{money(shape.max)}</Label>
            <Label className="right-2 bottom-1.5">{money(shape.min)}</Label>
          </>
        ) : (
          <div
            className={cn(
              'pointer-events-none absolute top-1.5 left-1/2 -translate-x-1/2',
              'rounded-lg border border-line bg-canvas/95 px-2 py-1 text-center shadow-raise',
            )}
          >
            <div className="nums text-sm font-semibold text-ink">
              {money(active.value)}
            </div>
            <div className="nums text-[0.625rem] text-muted">
              {weekdayDate(active.date)}
              {active.change !== undefined && (
                <span
                  className={cn(
                    'ml-1 font-medium',
                    active.change > 0 && 'text-positive',
                    active.change < 0 && 'text-negative',
                  )}
                >
                  {moneyDelta(active.change)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between px-1 text-[0.625rem] text-faint">
        <span>{weekdayDate(first.date)}</span>
        <span>{weekdayDate(last.date)}</span>
      </div>
    </div>
  )
}

function Label({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'nums pointer-events-none absolute rounded bg-canvas/70 px-1 text-[0.625rem] text-faint',
        className,
      )}
    >
      {children}
    </span>
  )
}
