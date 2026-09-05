/**
 * The team page's four views ⇄ their route segments.
 *
 * Its own module, and a plain object rather than a union of string literals
 * written out at each use, for the reason
 * [`playerTabs`](../player/playerTabs.ts) is: the page, the bottom bar and the
 * router all have to agree on the spelling, and a typo in one of the three is
 * a view that silently never lights up.
 *
 * The Übersicht is the **bare** route — a club's page opened from a crest
 * should land somewhere, not on a tab chosen by a URL suffix.
 */
export const TEAM_TABS = {
  overview: 'overview',
  squad: 'squad',
  matches: 'matches',
  live: 'live',
} as const

export type TeamTab = (typeof TEAM_TABS)[keyof typeof TEAM_TABS]

/**
 * Which view a path is showing.
 *
 * Suffix matching rather than parsing, as on the squad, duel and match pages:
 * the base path already carries a league id and a team id, and re-deriving
 * those here to split the last segment off would be a second, weaker copy of
 * what the router already did.
 */
export function teamTabFromPath(pathname: string): TeamTab {
  if (pathname.endsWith(`/${TEAM_TABS.squad}`)) return TEAM_TABS.squad
  if (pathname.endsWith(`/${TEAM_TABS.matches}`)) return TEAM_TABS.matches
  if (pathname.endsWith(`/${TEAM_TABS.live}`)) return TEAM_TABS.live
  return TEAM_TABS.overview
}
