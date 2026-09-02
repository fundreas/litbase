import { LogOut, Plus } from 'lucide-react'
import { NavLink, useLocation } from 'react-router'

import { useAuth } from '@/auth/useAuth'
import { isNavItemActive, NAV_ITEMS } from '@/components/layout/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { useActiveLeague } from '@/league/useActiveLeague'
import { cn } from '@/lib/cn'
import { money } from '@/lib/format'

export function NavDrawer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { league, leagueId } = useActiveLeague()
  const { pathname } = useLocation()
  const { signOut } = useAuth()

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Navigation"
      side="left"
      footer={
        <Button
          variant="ghost"
          fullWidth
          leadingIcon={<LogOut size={18} />}
          className="justify-start"
          onClick={signOut}
        >
          Abmelden
        </Button>
      }
    >
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
              onClick={() => {
                onOpenChange(false)
              }}
              className={cn(
                'flex h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium',
                'transition-colors duration-150',
                isActive
                  ? 'bg-accent/15 text-accent'
                  : 'text-muted hover:bg-surface-2 hover:text-ink',
              )}
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
          onClick={() => {
            onOpenChange(false)
          }}
          className={({ isActive }) =>
            cn(
              'flex h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium',
              'transition-colors duration-150',
              isActive
                ? 'bg-accent/15 text-accent'
                : 'text-muted hover:bg-surface-2 hover:text-ink',
            )
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
    </Drawer>
  )
}
