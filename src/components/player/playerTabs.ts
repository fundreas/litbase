/**
 * The player page's three views, as route segments.
 *
 * Its own module rather than a couple of extra exports from `PlayerTabBar`:
 * a file that exports both components and plain values breaks React Fast
 * Refresh, which is the same reason `navigation.ts` sits apart from the nav
 * components and `lazyPages.tsx` apart from the route table.
 *
 * `details` is the **bare** route (`/players/:playerId`), so the value here is
 * only ever used to name the tab, never appended to a URL.
 */
export const PLAYER_TABS = {
  details: 'details',
  performance: 'performance',
  market: 'market',
} as const

export type PlayerTab = (typeof PLAYER_TABS)[keyof typeof PLAYER_TABS]

/** The tab a URL names. Anything unrecognised is the Details tab. */
export function playerTabFromPath(pathname: string): PlayerTab {
  if (pathname.endsWith(`/${PLAYER_TABS.performance}`)) {
    return PLAYER_TABS.performance
  }
  if (pathname.endsWith(`/${PLAYER_TABS.market}`)) return PLAYER_TABS.market
  return PLAYER_TABS.details
}
