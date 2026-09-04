import { ChevronLeft } from 'lucide-react'
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router'

import { useDuelRosters } from '@/api/hooks/useDuelRosters'
import { useDuels } from '@/api/hooks/useDuels'
import { useSeasonSchedule } from '@/api/hooks/useMatchday'
import { duelLeader, matchdayState, type DuelSide } from '@/api/models'
import { useAuth } from '@/auth/useAuth'
import { DuelLineupTab } from '@/components/duels/DuelLineupTab'
import { DuelRankingTab } from '@/components/duels/DuelRankingTab'
import { Avatar } from '@/components/ui/Avatar'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useActiveLeague } from '@/league/useActiveLeague'
import { cn } from '@/lib/cn'
import { points } from '@/lib/format'

/** Tab value ⇄ route segment, following the squad page's convention. */
const TABS = { lineup: 'lineup', ranking: 'ranking' } as const
type TabValue = (typeof TABS)[keyof typeof TABS]

/**
 * One duel, in detail: both elevens and a combined player ranking.
 *
 *   /leagues/:leagueId/duels/:duelId         → Aufstellung
 *   /leagues/:leagueId/duels/:duelId/ranking → Rangliste
 *
 * `duelId` is both manager ids joined with `-`, which is what the list page
 * already uses as a React key — so the URL needs no lookup table and a shared
 * link resolves for anyone in the league. The matchday rides along in `?day=`,
 * exactly as on the list.
 *
 * The pairing itself is read from `useDuels`, the same query the list page
 * ran, so arriving here costs nothing extra for the duel — only the rosters
 * are new.
 */
export function DuelDetailPage() {
  const { leagueId, competitionId } = useActiveLeague()
  const { duelId } = useParams()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()

  const schedule = useSeasonSchedule(competitionId)

  const requestedDay = Number(searchParams.get('day'))
  const selectedDay =
    schedule.data === undefined
      ? undefined
      : schedule.data.matchdays.some((entry) => entry.day === requestedDay)
        ? requestedDay
        : schedule.data.currentDay

  const matchday = schedule.data?.matchdays.find(
    (entry) => entry.day === selectedDay,
  )
  const state = matchday === undefined ? undefined : matchdayState(matchday)

  const duels = useDuels(leagueId, selectedDay, { isLive: state === 'live' })
  const duel = duels.data?.duels.find((entry) => entry.id === duelId)

  // Passed through as-is. A live poll hands back new objects each minute, so
  // memoising on the ids would only pin stale point totals in place — and the
  // totals are exactly what changes.
  const rosters = useDuelRosters(
    leagueId,
    competitionId,
    selectedDay,
    duel?.sides,
  )

  const tab: TabValue = location.pathname.endsWith(`/${TABS.ranking}`)
    ? TABS.ranking
    : TABS.lineup

  const backTo = `/leagues/${leagueId}/duels?day=${String(selectedDay ?? '')}`

  const handleTabChange = (next: string) => {
    const base = `/leagues/${leagueId}/duels/${duelId ?? ''}`
    const to = next === TABS.ranking ? `${base}/${TABS.ranking}` : base
    // `replace` so flicking between tabs does not fill the history stack.
    void navigate(`${to}?day=${String(selectedDay ?? '')}`, { replace: true })
  }

  if (schedule.isPending || duels.isPending) {
    return <SkeletonList rows={8} />
  }

  if (schedule.isError) {
    return (
      <ErrorState
        error={schedule.error}
        onRetry={() => {
          void schedule.refetch()
        }}
      />
    )
  }

  if (duels.isError) {
    return (
      <ErrorState
        error={duels.error}
        onRetry={() => {
          void duels.refetch()
        }}
      />
    )
  }

  // The pairing changes every matchday, so a link kept from another matchday
  // names two managers who are not drawn against each other here.
  if (duel === undefined) {
    return (
      <EmptyState
        title="Duell nicht gefunden"
        description="An diesem Spieltag gibt es diese Paarung nicht."
        action={
          <Link
            to={backTo}
            className="text-sm font-medium text-accent hover:underline"
          >
            Zurück zu den Duellen
          </Link>
        }
      />
    )
  }

  const hasStarted = state === 'live' || state === 'finished'
  const leader = hasStarted ? duelLeader(duel) : undefined

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          to={backTo}
          className="-ml-1 inline-flex h-8 items-center gap-1 text-sm text-muted transition-colors hover:text-ink"
        >
          <ChevronLeft size={16} />
          Duelle
        </Link>

        <div className="mt-1 flex items-center gap-3">
          <Scoreline
            side={duel.sides[0]}
            align="left"
            hasStarted={hasStarted}
            isLeader={leader?.id === duel.sides[0].id}
            isViewer={duel.sides[0].id === user?.id}
          />
          <span className="shrink-0 text-xs font-medium text-faint">:</span>
          <Scoreline
            side={duel.sides[1]}
            align="right"
            hasStarted={hasStarted}
            isLeader={leader?.id === duel.sides[1].id}
            isViewer={duel.sides[1].id === user?.id}
          />
        </div>

        <p className="mt-1 text-center text-xs text-muted">
          {String(selectedDay)}. Spieltag
          {state === 'live' && ' · Live'}
          {state === 'finished' && ' · Beendet'}
          {state === 'upcoming' && ' · Noch nicht angepfiffen'}
        </p>
      </div>

      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value={TABS.lineup}>Aufstellung</TabsTrigger>
          <TabsTrigger value={TABS.ranking}>Rangliste</TabsTrigger>
        </TabsList>

        {rosters.isPending ? (
          <div className="mt-4">
            <SkeletonList rows={8} />
          </div>
        ) : rosters.isError ? (
          <ErrorState error={rosters.error} onRetry={rosters.refetch} />
        ) : rosters.isEmpty ? (
          /* The snapshot endpoint answers 200 with empty lists for a matchday
             it has nothing for — one before the league existed, most often.
             That is not an error and not an empty team, so it gets its own
             message rather than two blank rosters. */
          <div className="mt-4">
            <EmptyState
              title="Keine Aufstellung für diesen Spieltag"
              description="Kickbase hat für diesen Spieltag keine Kader — vermutlich lag er vor der Gründung der Liga."
            />
          </div>
        ) : rosters.data === undefined ? null : (
          <>
            <TabsContent value={TABS.lineup}>
              <DuelLineupTab rosters={rosters.data} viewerId={user?.id} />
            </TabsContent>
            <TabsContent value={TABS.ranking}>
              <DuelRankingTab rosters={rosters.data} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}

/*
 * `HistoricalNotice` used to live here: a banner explaining that a past
 * matchday showed *today's* eleven with old points beside it, because the API
 * served squads only as they stood now. That is no longer true —
 * `users/{uid}/teamcenter?dayNumber=` serves the real snapshot (found
 * 2026-09-04) — so the rows are the players who were actually fielded and
 * there is nothing left to apologise for.
 */

/** One half of the header scoreline: name over the manager's matchday total. */
function Scoreline({
  side,
  align,
  hasStarted,
  isLeader,
  isViewer,
}: {
  side: DuelSide
  align: 'left' | 'right'
  hasStarted: boolean
  isLeader: boolean
  isViewer: boolean
}) {
  const isRight = align === 'right'

  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 items-center gap-2',
        isRight && 'flex-row-reverse',
      )}
    >
      <Avatar src={side.image} name={side.name} size={36} />
      <div className={cn('min-w-0 flex-1', isRight && 'text-right')}>
        <p className="truncate text-sm font-semibold text-ink">
          {side.name}
          {isViewer && <span className="ml-1.5 text-xs text-accent">du</span>}
        </p>
        <p
          className={cn(
            'nums truncate text-lg font-bold',
            isLeader ? 'text-ink' : 'text-muted',
          )}
        >
          {hasStarted ? points(side.matchdayPoints) : '–'}
        </p>
      </div>
    </div>
  )
}
