import { LayoutDashboard, Trophy, Users, type LucideIcon } from 'lucide-react'

export interface NavItem {
  /** Path segment appended to `/leagues/:leagueId`. */
  to: string
  label: string
  icon: LucideIcon
  /**
   * Sibling segments that are part of the same page.
   *
   * "Mannschaft" points at `/squad` but the team page also lives at `/lineup`,
   * reached by its tabs. Without this the drawer would highlight nothing while
   * the lineup tab is open.
   */
  alsoMatches?: string[]
}

/** Is this entry the active one for the current path? */
export function isNavItemActive(
  item: NavItem,
  pathname: string,
  leagueId: string,
): boolean {
  return [item.to, ...(item.alsoMatches ?? [])].some(
    (segment) => pathname === `/leagues/${leagueId}/${segment}`,
  )
}

/**
 * The app's navigation. Add a page here and it appears in the drawer —
 * nothing else to wire up.
 *
 * "Mannschaft" is the only entry for the team page even though `/lineup` is its
 * own route: the tabs on that page are the natural way between the two views,
 * and a second drawer entry for a sibling tab is noise.
 *
 * There is no bottom tab bar: it duplicated the drawer, ate a row of screen
 * height on exactly the small screens where the pitch needs it, and forced a
 * second, coarser notion of "which entry is active". The drawer is the single
 * navigation surface.
 *
 * **Only built pages are listed.** `market` (Transfermarkt), `table`
 * (Bundesliga-Tabelle) and `players` (Alle Spieler) are still
 * `PagePlaceholder` stubs, and offering them in the drawer promises a screen
 * that is not there. Their routes are untouched, so a direct URL still opens
 * the stub — add the entry back here when the page exists and it reappears.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: 'dashboard', label: 'Übersicht', icon: LayoutDashboard },
  { to: 'squad', label: 'Mannschaft', icon: Users, alsoMatches: ['lineup'] },
  { to: 'ranking', label: 'Rangliste', icon: Trophy },
]
