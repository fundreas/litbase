import { ChevronRight, LogOut, RefreshCw, Settings } from 'lucide-react'
import { Link } from 'react-router'

import { useAuth } from '@/auth/useAuth'
import { Avatar } from '@/components/ui/Avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { useActiveLeague } from '@/league/useActiveLeague'
import { date } from '@/lib/format'

/**
 * Avatar on the right of the header; opens the account menu.
 *
 * The menu is everything that is about **the reader** rather than about the
 * league: who is signed in,
 * [Einstellungen](../../pages/PreferencesPage.tsx), and the way out. The head
 * row is itself a link to one's own
 * [manager page](../../pages/ManagerDetailPage.tsx) — the page a tap on any
 * row of the standings opens, only about oneself. That split is why the
 * settings page has no entry in the drawer or in the dots sheet — those are the league's pages, and a face in the corner is the
 * obvious place to look for one's own.
 */
export function UserMenu() {
  const { user, signOut, expiresAt, isRemembered } = useAuth()
  const { leagueId } = useActiveLeague()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Konto"
        className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-surface-2 data-[state=open]:bg-surface-2"
      >
        <Avatar src={user?.avatar} name={user?.name} size={32} />
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        {/* The reader's own row is a link to their manager page — the same
            page a row in the standings opens, only about oneself. Without a
            signed-in user there is nothing to link to, so the head stays the
            plain label it was. */}
        {user !== null ? (
          <DropdownMenuItem asChild className="h-auto gap-3 py-2">
            <Link to={`/leagues/${leagueId}/managers/${user.id}`}>
              <Avatar src={user.avatar} name={user.name} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">
                  {user.name}
                </span>
                <span className="block truncate text-xs text-muted">
                  {user.email}
                </span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-faint" />
            </Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuLabel>
            <p className="truncate text-sm font-semibold text-ink">Konto</p>
          </DropdownMenuLabel>
        )}
        <DropdownMenuSeparator />

        {/* `asChild` so the row is a real link: it opens in a new tab on a
            middle click and shows its target on hover, which a menu item that
            navigates in an `onSelect` cannot. The path carries the league id
            because the page lives under the league route — see
            [`router.tsx`](../../routes/router.tsx) for why. */}
        <DropdownMenuItem asChild>
          <Link to={`/leagues/${leagueId}/preferences`}>
            <Settings size={18} className="text-faint" />
            Einstellungen
          </Link>
        </DropdownMenuItem>

        {/* Switching leagues lives in the header's LeagueSwitcher — /leagues
            now forwards straight into a league, so a menu entry pointing there
            would bounce right back. */}
        <DropdownMenuItem
          onSelect={() => {
            window.location.reload()
          }}
        >
          <RefreshCw size={18} className="text-faint" />
          Neu laden
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem tone="danger" onSelect={signOut}>
          <LogOut size={18} />
          Abmelden
        </DropdownMenuItem>

        {expiresAt !== null && (
          <p className="px-3 pt-1.5 pb-1 text-[0.6875rem] leading-snug text-faint">
            Sitzung bis {date(new Date(expiresAt).toISOString())}
            {isRemembered ? ' · wird automatisch erneuert' : ''}
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
