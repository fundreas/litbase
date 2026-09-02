import { LogOut, Plus, Trophy } from 'lucide-react'
import { Link, Navigate } from 'react-router'

import { useLeagues } from '@/api/hooks/useLeagues'
import { useAuth } from '@/auth/useAuth'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'

/**
 * `/leagues` — the route reached whenever no league is in the URL.
 *
 * It resolves rather than asks: the user is sent straight into their first
 * league. The screen only ever renders for the three cases where there is
 * nothing to send them to — loading, a failed request, or an account that
 * belongs to no league at all.
 *
 * Switching between leagues happens in the header's `LeagueSwitcher`, not
 * here, which is why there is no list on this page.
 */
export function LeagueGate() {
  const { data: leagues, isPending, isError, error, refetch } = useLeagues()
  const { user, signOut } = useAuth()

  if (isPending) {
    return <LoadingState label="Ligen werden geladen …" className="min-h-dvh" />
  }

  if (isError) {
    return (
      <Shell user={user} signOut={signOut}>
        <ErrorState
          error={error}
          onRetry={() => {
            void refetch()
          }}
        />
      </Shell>
    )
  }

  // `noUncheckedIndexedAccess` makes this `League | undefined`, which is
  // exactly the distinction that decides between forwarding and the empty
  // state — no length check needed.
  const firstLeague = leagues[0]
  if (firstLeague !== undefined) {
    return <Navigate to={`/leagues/${firstLeague.id}/dashboard`} replace />
  }

  return (
    <Shell user={user} signOut={signOut}>
      <EmptyState
        icon={<Trophy size={22} />}
        title="Keine Liga gefunden"
        description="Dein Kickbase-Konto ist in keiner Liga. Tritt einer bei, um loszulegen."
        action={
          <div className="mt-3 flex flex-col items-center gap-2">
            <Link
              to="/join"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink shadow-raise transition-[filter] hover:brightness-110"
            >
              <Plus size={18} />
              Liga beitreten
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void refetch()
              }}
            >
              Erneut prüfen
            </Button>
          </div>
        }
      />
    </Shell>
  )
}

/** Signed-in chrome, so the user always has a way back out. */
function Shell({
  user,
  signOut,
  children,
}: {
  user: { name: string; avatar?: string } | null
  signOut: () => void
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-md px-4 py-10">
      <div className="pt-safe" />
      <header className="mb-6 flex items-center gap-3">
        <Avatar src={user?.avatar} name={user?.name} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">
            Hallo {user?.name ?? ''}
          </p>
          <p className="text-sm text-muted">litbase</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          leadingIcon={<LogOut size={16} />}
        >
          Abmelden
        </Button>
      </header>
      {children}
    </div>
  )
}
