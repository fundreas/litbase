import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * A single toggleable filter. Rendered as a real button with
 * `aria-pressed`, so the on/off state is announced rather than only coloured.
 */
export function FilterChip({
  isActive,
  onClick,
  children,
  leading,
}: {
  isActive: boolean
  onClick: () => void
  children: ReactNode
  leading?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3',
        'text-xs font-medium whitespace-nowrap transition-colors',
        isActive
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-line bg-surface text-muted hover:text-ink active:bg-surface-2',
      )}
    >
      {leading}
      {children}
    </button>
  )
}

/**
 * **The classes that make a row of chips scroll sideways on a phone** — the
 * one place they are written, because getting them right took a report from a
 * real device.
 *
 * `-mx-3 … px-3` bleeds the row through the content well's padding, so the
 * chips scroll out at the screen's own edge rather than stopping short of it,
 * and the next one is always half-visible — which is the only affordance the
 * row has, the scrollbar being hidden.
 *
 * The last two are the fix, and neither is cosmetic:
 *
 * - **`overscroll-x-contain`** keeps the swipe in the row. A horizontal drag
 *   on a page that has nothing to scroll horizontally is a *navigation*
 *   gesture — back on Android, back/forward in an iOS home-screen app, which
 *   is how this one is meant to be installed (`apple-mobile-web-app-capable`
 *   in `index.html`) — and a scroll container hands the gesture on the moment
 *   it runs out of content, or, in a standalone iOS app, before it starts.
 *   `contain` stops the chaining: the row scrolls, and the app does not
 *   navigate out from under the finger. The battle chips were **reported
 *   unscrollable on a phone** while scrolling correctly in a desktop browser
 *   at the same width, which is exactly the shape of that: nothing wrong with
 *   the box, the swipe never reaching it.
 *
 * - **`touch-pan-x`** says the row is horizontal and nothing else, so the
 *   first millimetre of a slightly diagonal swipe cannot be resolved as a
 *   vertical page scroll and lock the gesture out of the row for the rest of
 *   the drag. The cost is that a *deliberate* vertical scroll starting on the
 *   row does not move the page — 36px of the screen that no longer scrolls it,
 *   which is what a carousel costs everywhere. `touch-pinch-zoom` is kept
 *   alongside it, because narrowing a gesture to one axis is no reason to take
 *   zooming away from anyone who needs it.
 */
export const CHIP_ROW =
  '-mx-3 no-scrollbar flex gap-2 overflow-x-auto px-3 overscroll-x-contain touch-pan-x touch-pinch-zoom'

/**
 * Horizontally scrolling row of chips. On a phone there is no room to wrap a
 * dozen competitions, so the row scrolls sideways with the scrollbar hidden
 * and its own overflow container — the page itself never scrolls horizontally.
 *
 * See {@link CHIP_ROW} for what makes the swipe land on a phone. A row whose
 * chips need no caption above them — the battle and position filters, which
 * sit under a heading that already says what they are — uses that class list
 * directly rather than this wrapper.
 */
export function FilterChipRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="px-0.5 text-[0.6875rem] tracking-wide text-faint uppercase">
        {label}
      </span>
      <div className={CHIP_ROW} role="group" aria-label={label}>
        {children}
      </div>
    </div>
  )
}
