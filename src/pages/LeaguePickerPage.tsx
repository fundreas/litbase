import { ChevronRight, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router'

import { useLeagues } from '@/api/hooks/useLeagues'
import { useAuth } from '@/auth/useAuth'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { money, placement } from '@/lib/format'

/**
 * Shown at `/leagues` when no league is in the URL yet. Once a league is
 * chosen the id lives in the path, so refreshes and bookmarks keep working.
 */
export function LeaguePickerPage() {
  const { data: leagues, isPending, isError, error, refetch } = useLeagues()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md px-4 py-10">
      <div className="pt-safe" />

      <header className="mb-6 flex items-center gap-3">
        <Avatar src={user?.avatar} name={user?.name} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">
            Hallo {user?.name ?? ''}
          </p>
          <p className="text-sm text-muted">Wähle eine Liga</p>
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

      {isPending && <SkeletonList rows={3} />}

      {isError && (
        <ErrorState
          error={error}
          onRetry={() => {
            void refetch()
          }}
        />
      )}

      {leagues !== undefined && leagues.length === 0 && (
        <EmptyState
          title="Keine Liga gefunden"
          description="Dein Kickbase-Konto ist in keiner Liga. Tritt in der Kickbase-App einer Liga bei und lade diese Seite neu."
        />
      )}

      <ul className="flex flex-col gap-2">
        {leagues?.map((league) => (
          <li key={league.id}>
            <button
              type="button"
              onClick={() => {
                void navigate(`/leagues/${league.id}/dashboard`)
              }}
              className="flex w-full items-center gap-3 rounded-card border border-line bg-surface px-3 py-3.5 text-left transition-colors hover:border-accent/40 hover:bg-surface-2 active:bg-line"
            >
              <Avatar src={league.image} name={league.name} size={40} square />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {league.name}
                </p>
                <p className="nums truncate text-xs text-muted">
                  Platz {placement(league.placement)} · Budget{' '}
                  {money(league.budget)}
                </p>
              </div>
              <ChevronRight size={18} className="shrink-0 text-faint" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
