import { ChevronRight, LogOut, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { NavLink, useLocation } from 'react-router'

import { useRanking } from '@/api/hooks/useRanking'
import { useAuth } from '@/auth/useAuth'
import { isNavItemActive, NAV_ITEMS } from '@/components/layout/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { useActiveLeague } from '@/league/useActiveLeague'
import { cn } from '@/lib/cn'

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

  // Duel leagues get an extra page, and nothing in the URL says whether this
  // is one — it is read off the standings. That makes the navigation a
  // consumer of a query, which it otherwise would not be; the cost is one
  // small request already shared with the events page and the ranking page.
  const { data: ranking } = useRanking(leagueId)
  const items = useMemo(
    () =>
      NAV_ITEMS.filter(
        (item) =>
          item.requiresDuelMode !== true || ranking?.isDuelMode === true,
      ),
    [ranking],
  )

  return (
    <>
      {/*
        The league, and the way into it. It was a plain box with the budget
        under the name — the manager's money, printed where the *league* is
        named, and already on Transfermarkt where it is spent. Now the card is
        the entry point to the [Liga page](../../pages/LeaguePage.tsx): the
        rules it plays by, everyone in it, and the battles running inside it.
        Nothing else in the app named the league and went nowhere.
      */}
      <NavLink
        to={`/leagues/${leagueId}/league`}
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            'mb-3 flex items-center gap-3 rounded-card border px-3 py-3 transition-colors',
            isActive
              ? 'border-accent/50 bg-accent/10'
              : 'border-line bg-surface hover:bg-surface-2',
          )
        }
      >
        {({ isActive }) => (
          <>
            <Avatar src={league.image} name={league.name} size={40} square />
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
              {league.name}
            </p>
            <ChevronRight
              size={16}
              className={cn(
                'shrink-0',
                isActive ? 'text-accent' : 'text-faint',
              )}
            />
          </>
        )}
      </NavLink>

      <nav className="flex flex-col gap-1">
        {items.map((item) => {
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
