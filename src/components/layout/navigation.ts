import {
  LayoutDashboard,
  ListOrdered,
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
}

/**
 * The app's navigation. Add a page here and it appears in the drawer (and in
 * the bottom bar if `primary`) — nothing else to wire up.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: 'dashboard', label: 'Übersicht', icon: LayoutDashboard, primary: true },
  { to: 'squad', label: 'Mein Team', icon: Users, primary: true },
  { to: 'market', label: 'Transfermarkt', icon: Store, primary: true },
  { to: 'ranking', label: 'Rangliste', icon: Trophy, primary: true },
  { to: 'table', label: 'Bundesliga-Tabelle', icon: Table2 },
  { to: 'players', label: 'Alle Spieler', icon: ListOrdered },
]
