import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router'

import { NavMoreTab } from '@/components/layout/NavMoreTab'
import { cn } from '@/lib/cn'

export interface BottomTab {
  /** Matched against `active` to decide which one is lit. */
  value: string
  label: string
  icon: LucideIcon
  /** Where the tab goes. */
  to: string
  /**
   * A count worth interrupting for, drawn on the icon's corner.
   *
   * Omitted or `0` draws nothing: a badge saying zero is a mark that catches
   * the eye to report that nothing happened. The market page's *Gebote* tab
   * uses it for bids standing on your own listings — see
   * [`MarketPage`](../../pages/MarketPage.tsx).
   */
  badge?: number
}

/** Past this the pill would be wider than the icon it sits on. */
const BADGE_MAX = 99

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
 * A tab can carry a **badge** — a count on the icon's corner, for a view with
 * something waiting in it. It is drawn only above zero, so a quiet tab looks
 * quiet.
 *
 * Each tab is a real `<Link>`, so every view is linkable, opens in a new tab on
 * a middle click, and survives a refresh — the active view is read back out of
 * the URL rather than held in state. `replace` keeps flicking between them out
 * of the history stack: back should leave the page, not walk through every tab
 * visit.
 *
 * ## The dots
 *
 * Every bar ends with one tab that is **not** a view of the page: the app's
 * navigation, as three dots under the right thumb — see
 * [`NavMoreTab`](../layout/NavMoreTab.tsx) for the gesture and for why
 * reaching the top-left hamburger was the thing worth fixing. It is added here
 * rather than passed in by each page, because "always there" is the point: a
 * bar is exactly where a thumb already is, and a page that had to remember to
 * opt in would be the page where the reach comes back.
 *
 * It is why a *`ui/`* primitive imports from `layout/` — the one thing in this
 * component that knows about the app's pages, and the reason the bar may only
 * be docked inside a league route.
 *
 * The open state lives up here for two reasons. The bar has to **lift itself
 * over the dim** that sheet puts on the page (`z-50` against the dim's
 * `z-40`), so that the bar stays lit and the sheet — its own child — is drawn
 * above the dim rather than under it; an element cannot raise its own parent.
 * And up here **any** navigation puts the sheet away, the back button
 * included: the same during-render pathname comparison the
 * [shell](../layout/AppShell.tsx) uses for the drawer, so the sheet never
 * paints for a frame over a page it was not opened on.
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
  const { pathname } = useLocation()
  const [more, setMore] = useState({ isOpen: false, path: pathname })
  if (more.path !== pathname) setMore({ isOpen: false, path: pathname })
  const setIsMoreOpen = (isOpen: boolean) => {
    setMore((current) => ({ ...current, isOpen }))
  }

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
        // What the shell's `:has()` test looks for: a page with a bar has the
        // dots in it already, so the floating button stays away. See
        // [`AppShell`](../layout/AppShell.tsx).
        data-bottom-bar=""
        className={cn(
          'fixed inset-x-0 bottom-0 lg:left-64',
          'border-t border-line bg-canvas/95 pb-safe backdrop-blur',
          more.isOpen ? 'z-50' : 'z-30',
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
                  {/* The badge rides the icon rather than the label: it is a
                      count of things, and the icon is the thing. `relative`
                      here and not on the link, so it is pinned to the glyph's
                      corner at any label length. */}
                  <span className="relative flex shrink-0">
                    <Icon
                      size={18}
                      aria-hidden="true"
                      strokeWidth={isActive ? 2.4 : 2}
                    />
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span
                        className={cn(
                          'nums absolute -top-1.5 -right-2 min-w-4 rounded-full px-1',
                          'bg-accent text-center text-[0.625rem] leading-4 font-bold',
                          'text-accent-ink',
                        )}
                      >
                        {tab.badge > BADGE_MAX
                          ? `${String(BADGE_MAX)}+`
                          : tab.badge}
                      </span>
                    )}
                  </span>
                  {tab.label}
                </Link>
              </li>
            )
          })}

          <NavMoreTab isOpen={more.isOpen} onOpenChange={setIsMoreOpen} />
        </ul>
      </nav>
    </>
  )
}
