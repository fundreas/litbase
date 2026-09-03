import { BarChart3, LineChart, User, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'

import { PLAYER_TABS, type PlayerTab } from '@/components/player/playerTabs'
import { cn } from '@/lib/cn'

const TABS: Array<{ value: PlayerTab; label: string; icon: LucideIcon }> = [
  { value: PLAYER_TABS.details, label: 'Details', icon: User },
  { value: PLAYER_TABS.performance, label: 'Leistung', icon: BarChart3 },
  { value: PLAYER_TABS.market, label: 'Markt', icon: LineChart },
]

/**
 * The player page's three views, docked at the bottom of the screen.
 *
 * **The one bottom bar in the app**, and deliberately so. The app's navigation
 * is the drawer precisely because a global tab bar duplicated it and ate a row
 * of height on every page; this is not navigation between pages but between
 * three views of one player, it exists only while that page is open, and the
 * bottom is where a thumb already is on a screen you scroll through.
 *
 * `sticky` rather than `fixed`: fixed would position against the viewport and
 * so lie across the sidebar at desktop widths, where this page is a column in
 * the middle of the screen. Sticky keeps it inside that column, and it still
 * rides the bottom of the viewport while the page scrolls.
 *
 * Each tab is a real `<Link>`, so every view is linkable, opens in a new tab
 * on a middle click, and survives a refresh — the tab is read back out of the
 * URL rather than held in state.
 */
export function PlayerTabBar({
  basePath,
  active,
}: {
  /** The player's route without a tab segment. */
  basePath: string
  active: PlayerTab
}) {
  return (
    <nav
      aria-label="Spieleransicht"
      className={cn(
        // `-mx-3` cancels the content column's padding so the bar spans the
        // full width of it, the way a docked bar should.
        'sticky bottom-0 z-30 -mx-3 mt-2',
        'border-t border-line bg-canvas/95 px-3 pt-2 pb-safe backdrop-blur',
      )}
    >
      <ul className="flex gap-1">
        {TABS.map((tab) => {
          const isActive = tab.value === active
          const Icon = tab.icon

          return (
            <li key={tab.value} className="flex-1">
              <Link
                // Details is the bare route, so its URL stays the short one.
                to={
                  tab.value === PLAYER_TABS.details
                    ? basePath
                    : `${basePath}/${tab.value}`
                }
                // `replace` so flicking between the three does not fill the
                // history stack — back should leave the player, not walk back
                // through every tab visit. Same rule as the squad page.
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
