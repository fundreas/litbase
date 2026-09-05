import {
  CalendarDays,
  LayoutDashboard,
  Shield,
  Store,
  Swords,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react'

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
  /**
   * Show only in leagues played as duels.
   *
   * Whether a league is one is not knowable from the URL — it is read off the
   * standings (`hhpl`), so the entry appears once that query resolves. It is
   * hidden until then rather than shown and withdrawn, which would flash an
   * entry that a normal league never has.
   */
  requiresDuelMode?: boolean
}

/**
 * Is this entry the active one for the current path?
 *
 * A page's **detail routes count as the page**: `/duels/3212306-2857817` and
 * its `/ranking` tab all keep *Duelle* lit, because a drawer that highlights
 * nothing once you tap into a row reads as "you have navigated away from the
 * app". Hence the prefix test alongside the exact one — it is general, so any
 * future detail route inherits it without a per-item flag.
 */
export function isNavItemActive(
  item: NavItem,
  pathname: string,
  leagueId: string,
): boolean {
  return [item.to, ...(item.alsoMatches ?? [])].some((segment) => {
    const base = `/leagues/${leagueId}/${segment}`
    return pathname === base || pathname.startsWith(`${base}/`)
  })
}

/**
 * The app's navigation. Add a page here and it appears in the drawer —
 * nothing else to wire up.
 *
 * "Mannschaft" is the only entry for the team page even though the pitch has
 * its own route: the bottom bar on that page is the natural way between the
 * two views, and a second drawer entry for a sibling view is noise. Since the
 * pitch moved to `/squad/lineup`, the prefix test below covers it anyway.
 *
 * There is no *global* bottom tab bar: it duplicated the drawer, ate a row of
 * screen height on exactly the small screens where the pitch needs it, and
 * forced a second, coarser notion of "which entry is active". The drawer is
 * the single navigation surface between pages. The squad and player pages do
 * dock a `BottomTabBar` of their own, but that switches between views of one
 * page rather than between pages, and never leaves it.
 *
 * **Only built pages are listed.** `players` (Alle Spieler) is still a
 * `PagePlaceholder` stub, and offering it in the drawer promises a screen that
 * is not there. Its route is untouched, so a direct URL still opens the stub —
 * add the entry back here when the page exists and it reappears. `table` was
 * the other one; it is now the built *Teams* page below, and `/table` redirects
 * onto it.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: 'dashboard', label: 'Übersicht', icon: LayoutDashboard },
  {
    to: 'squad',
    label: 'Mannschaft',
    icon: Users,
    // The pitch lives at `/squad/lineup`, which the prefix test in
    // `isNavItemActive` already covers — no entry needed for it.
    //
    // `players` covers the player detail page, which is reached by tapping a
    // squad row and has no drawer entry of its own. It also covers the
    // unlisted `/players` stub — harmless while that stub is not offered
    // anywhere, and the line to revisit if "Alle Spieler" ever becomes its
    // own entry. `lineup` is the pre-move URL, kept so the redirect flashes
    // the right entry on its way through.
    alsoMatches: ['players', 'lineup'],
  },
  { to: 'market', label: 'Transfermarkt', icon: Store },
  { to: 'ranking', label: 'Rangliste', icon: Trophy },
  // The competition's fixtures. `isNavItemActive`'s prefix test already covers
  // the match detail page at `/matchday/:matchId`, so it needs no
  // `alsoMatches` — tapping into a match keeps *Spieltag* lit.
  { to: 'matchday', label: 'Spieltag', icon: CalendarDays },
  // Every club in the competition, as a table. `isNavItemActive`'s prefix test
  // covers the club page at `/teams/:teamId` for free, so tapping a row keeps
  // *Teams* lit — and so does arriving at a club from a crest on some other
  // page, which used to light nothing at all.
  { to: 'teams', label: 'Teams', icon: Shield },
  { to: 'duels', label: 'Duelle', icon: Swords, requiresDuelMode: true },
]
