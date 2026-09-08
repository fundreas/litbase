/**
 * The manager page's four views ⇄ their route segments.
 *
 * Its own module, and a plain object rather than string literals written out at
 * each use, for the reason [`teamTabs`](../team/teamTabs.ts) and
 * [`playerTabs`](../player/playerTabs.ts) are: the page, the bottom bar and the
 * router all have to agree on the spelling, and a typo in one of the three is a
 * view that silently never lights up.
 *
 * **The lineup is the bare route.** A manager is opened from a name in a table
 * or beside a player, and the question that name raises is *what have they got
 * on the pitch* — so that is what the bare URL answers, and the other three are
 * suffixes. It is the one tab of the four whose subject is a **matchday** rather
 * than the manager, which is why `?day=` rides along on every tab link: coming
 * back to it must not land on a different matchday than the one you left.
 */
export const MANAGER_TABS = {
  lineup: 'lineup',
  squad: 'squad',
  events: 'events',
  details: 'details',
} as const

export type ManagerTab = (typeof MANAGER_TABS)[keyof typeof MANAGER_TABS]

/**
 * Which view a path is showing.
 *
 * Suffix matching rather than parsing, as on the squad, duel, match and club
 * pages: the base path already carries a league id and a manager id, and
 * re-deriving those here to split the last segment off would be a second,
 * weaker copy of what the router already did.
 */
export function managerTabFromPath(pathname: string): ManagerTab {
  if (pathname.endsWith(`/${MANAGER_TABS.squad}`)) return MANAGER_TABS.squad
  if (pathname.endsWith(`/${MANAGER_TABS.events}`)) return MANAGER_TABS.events
  if (pathname.endsWith(`/${MANAGER_TABS.details}`)) return MANAGER_TABS.details
  return MANAGER_TABS.lineup
}
