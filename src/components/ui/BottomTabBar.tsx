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
 * Views of one page, docked at the bottom of the screen.
 *
 * **Not the app's navigation.** The drawer is that, and
 * [Navigation](../../../docs/routing-and-layout.md#navigation) explains why a
 * global bottom bar was removed: it duplicated the drawer and ate a row of
 * height on every screen. This is the other thing a bottom bar is good at —
 * switching between views of whatever page you are already on. It exists only
 * while that page is open, and the bottom is where a thumb already is on a
 * screen you scroll through.
 *
 * `sticky`, not `fixed` — the mirror of the header's `sticky top-0`. Fixed
 * positions against the viewport and would lie across the sidebar at `lg` and
 * up, where the content is a column in the middle of the screen. Sticky keeps
 * the bar inside that column and it still rides the bottom of the viewport
 * while the page scrolls.
 *
 * **The page owes it a full-height column.** Sticky only pins an element that
 * would otherwise be off-screen; a page whose content stops halfway down
 * leaves the bar sitting under that content, mid-screen. So every page using
 * this must put the content between the heading and the bar in a
 * `min-h-0 flex-1` box, which pushes the bar to the bottom of the well — the
 * well itself already fills the viewport. Without that the bar appears to
 * move between views, because a long view pins it and a short one does not.
 *
 * `bleed-pb-safe` cancels the content well's own bottom padding. Both carry
 * `pb-safe`, and stacked they let the bar lift by that padding at the very end
 * of the scroll, where sticky hands back to static positioning.
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
    <nav
      aria-label={ariaLabel}
      className={cn(
        // `-mx-3` cancels the content column's padding so the bar spans the
        // full width of it, the way a docked bar should.
        'sticky bottom-0 z-30 -mx-3 mt-2 bleed-pb-safe',
        'border-t border-line bg-canvas/95 px-3 pt-2 pb-safe backdrop-blur',
      )}
    >
      <ul className="flex gap-1">
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
  )
}
