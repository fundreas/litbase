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
}

/**
 * The app's navigation. Add a page here and it appears in the drawer —
 * nothing else to wire up.
 *
 * There is no bottom tab bar: it duplicated the drawer, ate a row of screen
 * height on exactly the small screens where the pitch needs it, and forced a
 * second, coarser notion of "which entry is active". The drawer is the single
 * navigation surface.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: 'dashboard', label: 'Übersicht', icon: LayoutDashboard },
  { to: 'squad', label: 'Mein Team', icon: Users },
  { to: 'lineup', label: 'Aufstellung', icon: Shirt },
  { to: 'market', label: 'Transfermarkt', icon: Store },
  { to: 'ranking', label: 'Rangliste', icon: Trophy },
  { to: 'table', label: 'Bundesliga-Tabelle', icon: Table2 },
  { to: 'players', label: 'Alle Spieler', icon: ListOrdered },
]
