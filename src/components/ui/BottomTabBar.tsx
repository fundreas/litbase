import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router'

import { cn } from '@/lib/cn'

export interface BottomTab {
  /** Matched against `active` to decide which one is lit. */
  value: string
  label: string
  icon: LucideIcon
  /** Where the tab goes. */
  to: string
}

/**
 * Views of one page, docked at the bottom of the screen — **always on screen,
 * whatever the page is doing.**
 *
 * **Not the app's navigation.** The drawer is that, and
 * [Navigation](../../../docs/routing-and-layout.md#navigation) explains why a
 * global bottom bar was removed: it duplicated the drawer and cost a row of
 * height on every screen. This is the other thing a bottom bar is good at —
 * switching between views of whatever page you are already on. It exists only
 * while that page is open, and the bottom is where a thumb already is on a
 * screen you scroll through.
 *
 * ## Fixed, not sticky
 *
 * It was `sticky bottom-0`, and **it was reported scrolling out of view.**
 *
 * Sticky can only hold an element against the viewport while its containing
 * block still reaches past it, so it is only ever as reliable as the height
 * chain above it — and this one is unusually tangled: `min-h-dvh` on
 * [`AppShell`](../layout/AppShell.tsx)'s root over a `min-h-0 flex-1` row, then
 * a well that pages subdivide with more of the same. Exactly which link gives
 * way was **not** run down; what matters is that a bar whose visibility is
 * contingent on six ancestors getting their heights right is the wrong shape of
 * solution for "always on screen".
 *
 * Loosening the chain instead is not available anyway: that `min-h-0` is what
 * lets a [pitch](../squad/Pitch.tsx) size itself *down* to the window, which is
 * most of what the lineup views are. So the bar stops depending on the chain at
 * all. `fixed` pins it to the viewport and nothing above it in the tree can
 * take that away.
 *
 * **It no longer asks anything of the page.** The old arrangement carried a
 * contract — every page using it had to wrap its content in a `min-h-0 flex-1`
 * box, or the bar sat halfway up a short screen — which five pages had to
 * remember and a sixth would have got wrong. The spacer below replaces it: the
 * bar reserves its own footprint in the flow, so the last row of a list clears
 * it and a short page still gets the bar at the bottom.
 *
 * ## Staying out of the sidebar
 *
 * Fixed positions against the viewport, which at `lg` and up would lay the bar
 * across the [sidebar](../layout/NavSidebar.tsx). So it starts where the
 * sidebar ends (`lg:left-64`, that column's `w-64`) and centres its own
 * contents at the content well's `max-w-3xl`, which lines the tabs up with the
 * page above them at every width.
 *
 * Each tab is a real `<Link>`, so every view is linkable, opens in a new tab on
 * a middle click, and survives a refresh — the active view is read back out of
 * the URL rather than held in state. `replace` keeps flicking between them out
 * of the history stack: back should leave the page, not walk through every tab
 * visit.
 */
export function BottomTabBar({
  tabs,
  active,
  ariaLabel,
}: {
  tabs: BottomTab[]
  active: string
  ariaLabel: string
}) {
  return (
    <>
      {/*
        The bar's own footprint, kept in the flow so the page can be scrolled
        clear of it. Same box metrics as the bar itself — the margin, the border
        and the padding around a 3rem row — including `bleed-pb-safe`, which
        cancels the well's `pb-safe`: the fixed bar covers that strip anyway, so
        counting it twice would leave a gap under the last row.
      */}
      <div
        aria-hidden="true"
        className="mt-2 bleed-pb-safe border-t border-transparent pt-2 pb-safe"
      >
        <div className="h-12" />
      </div>

      <nav
        aria-label={ariaLabel}
        className={cn(
          'fixed inset-x-0 bottom-0 z-30 lg:left-64',
          'border-t border-line bg-canvas/95 pb-safe backdrop-blur',
        )}
      >
        {/* Centred and capped like the content well, so the tabs sit under the
            page rather than under the window. */}
        <ul className="mx-auto flex w-full max-w-3xl gap-1 px-3 pt-2">
          {tabs.map((tab) => {
            const isActive = tab.value === active
            const Icon = tab.icon

            return (
              <li key={tab.value} className="flex-1">
                <Link
                  to={tab.to}
                  replace
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl',
                    'text-[0.6875rem] font-medium transition-colors',
                    isActive
                      ? 'bg-accent/15 text-accent'
                      : 'text-faint hover:bg-surface-2 hover:text-ink',
                  )}
                >
                  <Icon
                    size={18}
                    aria-hidden="true"
                    strokeWidth={isActive ? 2.4 : 2}
                  />
                  {tab.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
