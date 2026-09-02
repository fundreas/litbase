import { NavLink, useLocation } from 'react-router'

import { isBarItemActive, NAV_ITEMS } from '@/components/layout/navigation'
import { useActiveLeague } from '@/league/useActiveLeague'
import { cn } from '@/lib/cn'

/**
 * Thumb-reachable tab bar for the pages people hit constantly. Phones only —
 * on a wider screen the drawer is enough and this would just eat space.
 */
export function BottomNav() {
  const { leagueId } = useActiveLeague()
  const { pathname } = useLocation()
  const items = NAV_ITEMS.filter((item) => item.primary === true)

  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/95 pb-safe backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto flex max-w-3xl">
        {items.map((item) => {
          const { to, label, icon: Icon } = item
          // Not NavLink's own `isActive`: one bar entry can stand for several
          // routes, so the match is computed from the item's own rules.
          const isActive = isBarItemActive(item, pathname, leagueId)
          return (
            <li key={to} className="flex-1">
              <NavLink
                to={`/leagues/${leagueId}/${to}`}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex h-14 flex-col items-center justify-center gap-1',
                  'text-[0.6875rem] font-medium transition-colors duration-150',
                  isActive ? 'text-accent' : 'text-faint active:text-muted',
                )}
              >
                <Icon size={20} />
                <span className="truncate px-1">{label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
