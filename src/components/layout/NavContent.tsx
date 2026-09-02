import { LogOut, Plus } from 'lucide-react'
import { NavLink, useLocation } from 'react-router'

import { useAuth } from '@/auth/useAuth'
import { isNavItemActive, NAV_ITEMS } from '@/components/layout/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { useActiveLeague } from '@/league/useActiveLeague'
import { cn } from '@/lib/cn'
import { money } from '@/lib/format'

/**
 * One row style for every entry, so the drawer and the permanent sidebar
 * cannot drift apart visually.
 */
const ROW =
  'flex h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-150'
const ROW_ACTIVE = 'bg-accent/15 text-accent'
const ROW_IDLE = 'text-muted hover:bg-surface-2 hover:text-ink'

/**
 * The navigation itself: which league you are in, the pages, and the way into
 * another league.
 *
 * Rendered in two places — inside the [`NavDrawer`](./NavDrawer.tsx) on narrow
 * screens and inside the [`NavSidebar`](./NavSidebar.tsx) from `lg` up — which
 * is the whole reason it is a component rather than markup in the drawer. The
 * two surfaces differ only in their frame.
 *
 * `onNavigate` is what the drawer passes to close itself on a tap. The sidebar
 * has nothing to close, so it passes nothing.
 */
export function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const { league, leagueId } = useActiveLeague()
  const { pathname } = useLocation()

  return (
    <>
      <div className="mb-3 flex items-center gap-3 rounded-card border border-line bg-surface px-3 py-3">
        <Avatar src={league.image} name={league.name} size={40} square />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">
            {league.name}
          </p>
          <p className="nums truncate text-xs text-muted">
            Budget {money(league.budget)}
          </p>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const { to, label, icon: Icon } = item
          // Not NavLink's own `isActive`: one entry can cover several routes
          // of the same page, so the match comes from the item's own rules.
          const isActive = isNavItemActive(item, pathname, leagueId)
          return (
            <NavLink
              key={to}
              to={`/leagues/${leagueId}/${to}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={onNavigate}
              className={cn(ROW, isActive ? ROW_ACTIVE : ROW_IDLE)}
            >
              <Icon size={20} className={isActive ? '' : 'text-faint'} />
              {label}
            </NavLink>
          )
        })}
      </nav>

      {/* Separate from NAV_ITEMS: /join is not league-scoped, so it cannot be
          built from the `/leagues/:leagueId/...` pattern the others use. It
          also needs to be reachable by users who already have a league and
          therefore never see the /leagues gate. */}
      <div className="mt-3 border-t border-line pt-3">
        <NavLink
          to="/join"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(ROW, isActive ? ROW_ACTIVE : ROW_IDLE)
          }
        >
          {({ isActive }) => (
            <>
              <Plus size={20} className={isActive ? '' : 'text-faint'} />
              Liga beitreten
            </>
          )}
        </NavLink>
      </div>
    </>
  )
}

/** Sign out. Sits in the drawer's footer and at the foot of the sidebar. */
export function NavSignOutButton() {
  const { signOut } = useAuth()

  return (
    <Button
      variant="ghost"
      fullWidth
      leadingIcon={<LogOut size={18} />}
      className="justify-start"
      onClick={signOut}
    >
      Abmelden
    </Button>
  )
}
