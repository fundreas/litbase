import { BarChart3, LineChart, User } from 'lucide-react'

import { PLAYER_TABS, type PlayerTab } from '@/components/player/playerTabs'
import { BottomTabBar, type BottomTab } from '@/components/ui/BottomTabBar'

/**
 * The player page's three views, docked at the bottom.
 *
 * A thin wrapper over [`BottomTabBar`](../ui/BottomTabBar.tsx), which the squad
 * page uses too — all this adds is the tab list and the fact that Details is
 * the **bare** route, so its URL stays the short one.
 */
export function PlayerTabBar({
  basePath,
  active,
}: {
  /** The player's route without a tab segment. */
  basePath: string
  active: PlayerTab
}) {
  const tabs: BottomTab[] = [
    {
      value: PLAYER_TABS.details,
      label: 'Details',
      icon: User,
      to: basePath,
    },
    {
      value: PLAYER_TABS.performance,
      label: 'Leistung',
      icon: BarChart3,
      to: `${basePath}/${PLAYER_TABS.performance}`,
    },
    {
      value: PLAYER_TABS.market,
      label: 'Markt',
      icon: LineChart,
      to: `${basePath}/${PLAYER_TABS.market}`,
    },
  ]

  return <BottomTabBar tabs={tabs} active={active} ariaLabel="Spieleransicht" />
}
