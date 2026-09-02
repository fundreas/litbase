import {
  LayoutDashboard,
  ListOrdered,
  Shirt,
  Store,
  Table2,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  /** Path segment appended to `/leagues/:leagueId`. */
  to: string
  label: string
  icon: LucideIcon
  /** Shown in the bottom bar on phones, not just the drawer. */
  primary?: boolean
  /**
   * Extra segments this entry should light up for **in the bottom bar**.
   *
   * The bar carries a coarser set of destinations than the drawer, so one
   * entry can stand for a page that has several routes — `squad` covers
   * `/lineup` there, while the drawer lists both and each matches only itself.
   */
  alsoMatchesInBar?: string[]
}

/** Is this the active entry for the bottom bar, given the current path? */
export function isBarItemActive(
  item: NavItem,
  pathname: string,
  leagueId: string,
): boolean {
  return [item.to, ...(item.alsoMatchesInBar ?? [])].some(
    (segment) => pathname === `/leagues/${leagueId}/${segment}`,
  )
}

/**
 * The app's navigation. Add a page here and it appears in the drawer (and in
 * the bottom bar if `primary`) — nothing else to wire up.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: 'dashboard', label: 'Übersicht', icon: LayoutDashboard, primary: true },
  {
    to: 'squad',
    label: 'Mein Team',
    icon: Users,
    primary: true,
    alsoMatchesInBar: ['lineup'],
  },
  { to: 'lineup', label: 'Aufstellung', icon: Shirt },
  { to: 'market', label: 'Transfermarkt', icon: Store, primary: true },
  { to: 'ranking', label: 'Rangliste', icon: Trophy, primary: true },
  { to: 'table', label: 'Bundesliga-Tabelle', icon: Table2 },
  { to: 'players', label: 'Alle Spieler', icon: ListOrdered },
]
