import { LogOut, RefreshCw } from 'lucide-react'

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
import { date } from '@/lib/format'

/** Avatar on the right of the header; opens the account menu. */
export function UserMenu() {
  const { user, signOut, expiresAt, isRemembered } = useAuth()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Konto"
        className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-surface-2 data-[state=open]:bg-surface-2"
      >
        <Avatar src={user?.avatar} name={user?.name} size={32} />
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <DropdownMenuLabel>
          <p className="truncate text-sm font-semibold text-ink">
            {user?.name ?? 'Konto'}
          </p>
          <p className="truncate text-xs text-muted">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

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
