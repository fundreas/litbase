import { ArrowLeft, BadgeCheck, Search, Users } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import {
  useCompetitions,
  useJoinableLeagues,
  useJoinLeague,
  useRecommendedLeagues,
} from '@/api/hooks/useJoinableLeagues'
import {
  GAME_MODE_LABEL,
  GAME_MODE_OPTIONS,
  type Competition,
  type JoinableLeague,
} from '@/api/models'
import { ApiError } from '@/api/errors'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FilterChip, FilterChipRow } from '@/components/ui/FilterChip'
import { Input } from '@/components/ui/Input'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { points } from '@/lib/format'

/**
 * Browse and join leagues.
 *
 * Lives at the top-level `/join` rather than under `/leagues/...` for two
 * reasons: joining is not scoped to a league (a user with none must reach it),
 * and `/leagues/join` would sit uncomfortably next to `/leagues/:leagueId`.
 */
export function JoinLeaguePage() {
  const navigate = useNavigate()
  const [pending, setPending] = useState<JoinableLeague | null>(null)

  return (
    <div className="mx-auto min-h-dvh w-full max-w-3xl px-3 pb-16">
      <div className="pt-safe" />

      <header className="flex h-14 items-center gap-1">
        <button
          type="button"
          onClick={() => {
            void navigate(-1)
          }}
          aria-label="Zurück"
          className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="truncate text-lg font-bold tracking-tight text-ink">
          Liga beitreten
        </h1>
      </header>

      <Tabs defaultValue="recommended">
        <TabsList>
          <TabsTrigger value="recommended">Empfohlen</TabsTrigger>
          <TabsTrigger value="all">Alle</TabsTrigger>
          <TabsTrigger value="search">Suche</TabsTrigger>
        </TabsList>

        <TabsContent value="recommended">
          <RecommendedTab onPick={setPending} />
        </TabsContent>
        <TabsContent value="all">
          <AllTab onPick={setPending} />
        </TabsContent>
        <TabsContent value="search">
          <SearchTab onPick={setPending} />
        </TabsContent>
      </Tabs>

      <JoinConfirmation
        league={pending}
        onClose={() => {
          setPending(null)
        }}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Tabs                                                                       */
/* -------------------------------------------------------------------------- */

function RecommendedTab({ onPick }: { onPick: (l: JoinableLeague) => void }) {
  const query = useRecommendedLeagues()
  // Recommended items carry the competition name already, so no lookup here.
  return <LeagueResults query={query} onPick={onPick} />
}

function AllTab({ onPick }: { onPick: (l: JoinableLeague) => void }) {
  const [competitionId, setCompetitionId] = useState<string>()
  const [gameMode, setGameMode] = useState<number>()

  const competitions = useCompetitions()
  const query = useJoinableLeagues({ competitionId, gameMode })

  return (
    <div className="flex flex-col gap-4">
      <FilterChipRow label="Wettbewerb">
        <FilterChip
          isActive={competitionId === undefined}
          onClick={() => {
            setCompetitionId(undefined)
          }}
        >
          Alle
        </FilterChip>
        {competitions.data?.map((competition) => (
          <FilterChip
            key={competition.id}
            isActive={competitionId === competition.id}
            onClick={() => {
              setCompetitionId(
                competitionId === competition.id ? undefined : competition.id,
              )
            }}
            leading={
              <Avatar
                src={competition.image}
                name={competition.name}
                size={16}
                square
                className="bg-transparent"
              />
            }
          >
            {competition.name}
          </FilterChip>
        ))}
      </FilterChipRow>

      <FilterChipRow label="Spielmodus">
        <FilterChip
          isActive={gameMode === undefined}
          onClick={() => {
            setGameMode(undefined)
          }}
        >
          Alle
        </FilterChip>
        {GAME_MODE_OPTIONS.map((mode) => (
          <FilterChip
            key={mode}
            isActive={gameMode === mode}
            onClick={() => {
              setGameMode(gameMode === mode ? undefined : mode)
            }}
          >
            {GAME_MODE_LABEL[mode]}
          </FilterChip>
        ))}
      </FilterChipRow>

      <LeagueResults
        query={query}
        onPick={onPick}
        competitions={competitions.data}
      />
    </div>
  )
}

function SearchTab({ onPick }: { onPick: (l: JoinableLeague) => void }) {
  const [draft, setDraft] = useState('')
  // Only the submitted term drives the request, so typing costs nothing.
  const [submitted, setSubmitted] = useState('')

  const competitions = useCompetitions()
  const query = useJoinableLeagues(
    { query: submitted },
    { enabled: submitted !== '' },
  )

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(draft.trim())
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="Liga suchen"
            type="search"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
            }}
            placeholder="Name der Liga"
            autoCapitalize="none"
            autoCorrect="off"
            enterKeyHint="search"
          />
        </div>
        <Button
          type="submit"
          size="lg"
          leadingIcon={<Search size={18} />}
          disabled={draft.trim() === ''}
        >
          Suchen
        </Button>
      </form>

      {submitted === '' ? (
        <EmptyState
          icon={<Search size={22} />}
          title="Nach einer Liga suchen"
          description="Gib einen Namen ein und starte die Suche."
        />
      ) : (
        <LeagueResults
          query={query}
          onPick={onPick}
          competitions={competitions.data}
          emptyTitle={`Keine Liga für „${submitted}“`}
        />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Results                                                                    */
/* -------------------------------------------------------------------------- */

interface ResultsQuery {
  data: JoinableLeague[] | undefined
  isPending: boolean
  isError: boolean
  error: unknown
  refetch: () => unknown
}

function LeagueResults({
  query,
  onPick,
  competitions,
  emptyTitle = 'Keine Liga gefunden',
}: {
  query: ResultsQuery
  onPick: (league: JoinableLeague) => void
  competitions?: Competition[]
  emptyTitle?: string
}) {
  // `/list` results carry only a competition id, so the name is resolved here.
  const nameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const competition of competitions ?? []) {
      map.set(competition.id, competition.name)
    }
    return map
  }, [competitions])

  if (query.isPending) return <SkeletonList rows={6} />

  if (query.isError) {
    return (
      <ErrorState
        error={query.error}
        onRetry={() => {
          query.refetch()
        }}
      />
    )
  }

  const leagues = query.data ?? []
  if (leagues.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description="Versuche einen anderen Filter oder Suchbegriff."
      />
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {leagues.map((league) => (
        <li key={league.id}>
          <LeagueRow
            league={league}
            competitionName={
              league.competitionName ??
              (league.competitionId !== undefined
                ? nameById.get(league.competitionId)
                : undefined)
            }
            onClick={() => {
              onPick(league)
            }}
          />
        </li>
      ))}
    </ul>
  )
}

function LeagueRow({
  league,
  competitionName,
  onClick,
}: {
  league: JoinableLeague
  competitionName?: string
  onClick: () => void
}) {
  const meta = [
    competitionName,
    league.gameMode !== undefined
      ? GAME_MODE_LABEL[league.gameMode]
      : undefined,
  ].filter((part): part is string => part !== undefined)

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-card border border-line bg-surface px-3 py-3 text-left transition-colors hover:border-accent/40 hover:bg-surface-2 active:bg-line"
    >
      <Avatar src={league.image} name={league.name} size={44} square />

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-ink">
          <span className="truncate">{league.name}</span>
          {league.isFeatured && (
            <BadgeCheck
              size={14}
              className="shrink-0 text-accent"
              aria-label="Verifizierte Liga"
            />
          )}
        </p>
        {meta.length > 0 && (
          <p className="truncate text-xs text-muted">{meta.join(' · ')}</p>
        )}
        {league.managerCount !== undefined && (
          <p className="nums mt-0.5 flex items-center gap-1 text-xs text-faint">
            <Users size={12} />
            {points(league.managerCount)}
            {league.managerLimit !== undefined &&
              ` / ${points(league.managerLimit)}`}
            {' Manager'}
          </p>
        )}
      </div>

      {league.memberImages.length > 0 && (
        <div className="flex shrink-0 -space-x-2">
          {league.memberImages.slice(0, 3).map((image) => (
            <Avatar
              key={image}
              src={image}
              size={24}
              className="ring-2 ring-surface"
            />
          ))}
        </div>
      )}
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/* Confirmation                                                               */
/* -------------------------------------------------------------------------- */

function JoinConfirmation({
  league,
  onClose,
}: {
  league: JoinableLeague | null
  onClose: () => void
}) {
  const navigate = useNavigate()
  const join = useJoinLeague()
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = () => {
    if (!league) return
    setError(null)
    join.mutate(league.id, {
      onSuccess: () => {
        onClose()
        void navigate(`/leagues/${league.id}/dashboard`, { replace: true })
      },
      onError: (caught) => {
        setError(
          caught instanceof ApiError
            ? caught.message
            : 'Beitritt fehlgeschlagen.',
        )
      },
    })
  }

  return (
    <ConfirmDialog
      open={league !== null}
      onOpenChange={(open) => {
        if (!open && !join.isPending) {
          setError(null)
          onClose()
        }
      }}
      title="Liga beitreten?"
      description={
        league === null ? undefined : (
          <>
            Du trittst{' '}
            <span className="font-semibold text-ink">{league.name}</span> bei
            und startest dort mit einem leeren Kader.
          </>
        )
      }
      confirmLabel="Beitreten"
      onConfirm={handleConfirm}
      isBusy={join.isPending}
      error={error}
    >
      {league !== null && (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-canvas px-3 py-2.5">
          <Avatar src={league.image} name={league.name} size={36} square />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">
              {league.name}
            </p>
            {league.managerCount !== undefined && (
              <p className="nums truncate text-xs text-muted">
                {points(league.managerCount)} Manager
              </p>
            )}
          </div>
        </div>
      )}
    </ConfirmDialog>
  )
}
