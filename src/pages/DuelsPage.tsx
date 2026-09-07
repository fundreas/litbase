import { ListOrdered, Swords } from 'lucide-react'
import { useMemo } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router'

import { useActivePlayerCounts } from '@/api/hooks/useActivePlayerCounts'
import { useDuels, useMatchdayStandings } from '@/api/hooks/useDuels'
import { useSeasonSchedule } from '@/api/hooks/useMatchday'
import { matchdayState, type Duel } from '@/api/models'
import { useAuth } from '@/auth/useAuth'
import { DuelCard } from '@/components/duels/DuelCard'
import { MatchdayPicker } from '@/components/MatchdayPicker'
import { ManagerRankingTab } from '@/components/ranking/ManagerRankingTab'
import { Avatar } from '@/components/ui/Avatar'
import { BottomTabBar, type BottomTab } from '@/components/ui/BottomTabBar'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useActiveLeague } from '@/league/useActiveLeague'
import { placement } from '@/lib/format'

/** The page's two views, and the URL segment each one is reached by. */
const VIEWS = { duels: 'duels', ranking: 'ranking' } as const
type ViewValue = (typeof VIEWS)[keyof typeof VIEWS]

/**
 * One matchday of the league, two ways: **the duels, and the ranking**.
 *
 *   /leagues/:leagueId/duels?day=N          → Duelle
 *   /leagues/:leagueId/duels/ranking?day=N  → Rangliste
 *
 * *Duelle* is every manager's head-to-head. *Rangliste* is the same managers
 * ranked by what they scored that day — the other question a duel weekend
 * raises, and one the pairings answer only five duels at a time. They are
 * siblings rather than one scrolling page because the second re-orders the
 * whole field, which is exactly what the first does not do.
 *
 * **Duel leagues only** — see the redirect below.
 *
 * ## One request serves both
 *
 * There is no duel endpoint: `/leagues/{id}/ranking?dayNumber=` is the source
 * of the pairings *and* of the points. So the response is cached raw and read
 * twice through `select` —
 * [`useDuels`](../api/hooks/useDuels.ts) for the pairings,
 * `useMatchdayStandings` for the ranking — and switching tabs issues no
 * request at all.
 *
 * ## The picker is the page heading
 *
 * Both views are about one selected matchday and nothing else, so a title
 * reading *Duelle* above a control reading *2. Spieltag* spent a row of a
 * phone screen on the word already in the drawer. The
 * [picker](../components/MatchdayPicker.tsx) takes the `h1`'s size and weight
 * on both views, exactly as on [Spieltag](./MatchdayPage.tsx), and the state
 * that used to be the page's subtitle — live, finished, not yet kicked off —
 * is the caption under the picker's own label.
 *
 * The matchday lives in the query string (`?day=`), not in component state, so
 * a duel weekend can be linked to and survives a refresh — the same reason the
 * league id is in the path. An absent or nonsensical `day` falls back to the
 * competition's current matchday rather than erroring, because a hand-edited
 * URL should not be able to produce a broken page: the ranking endpoint answers
 * 200 for `dayNumber=0` or `99` with every per-matchday field quietly missing,
 * which would render as a page of empty duels.
 *
 * The two views do not offer the **same** matchdays. Pairings are drawn for the
 * whole season, but a *ranking* of a matchday nobody has played is ten zeroes
 * presented as a result — so the Rangliste is handed a schedule narrowed to the
 * matchdays that have kicked off, and steps and drawer alike cannot reach past
 * it. Same rule, same reasoning as the matchday page's own Rangliste.
 */
export function DuelsPage() {
  const { leagueId, competitionId } = useActiveLeague()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()

  const view: ViewValue = location.pathname.endsWith(`/${VIEWS.ranking}`)
    ? VIEWS.ranking
    : VIEWS.duels

  const schedule = useSeasonSchedule(competitionId)

  // The day has to be validated against the real schedule: the ranking
  // endpoint answers 200 for `dayNumber=0` or `99` with every per-matchday
  // field quietly missing, which would render as a page of empty duels.
  const requestedDay = Number(searchParams.get('day'))
  const selectedDay =
    schedule.data === undefined
      ? undefined
      : schedule.data.matchdays.some((entry) => entry.day === requestedDay)
        ? requestedDay
        : schedule.data.currentDay

  /*
   * **A matchday only has a ranking once it has started.** The Rangliste
   * therefore offers the played matchdays and the one being played, and
   * nothing further ahead. The narrowed schedule is what the picker is handed,
   * so the steppers and the drawer cannot disagree about what is reachable.
   */
  const rankedDays = useMemo(() => {
    const matchdays = (schedule.data?.matchdays ?? []).filter(
      (entry) => matchdayState(entry) !== 'upcoming',
    )
    return { currentDay: schedule.data?.currentDay ?? 0, matchdays }
  }, [schedule.data])

  /*
   * `?day=` is shared with the duels, which exist for a matchday that has not
   * kicked off. Arriving on the Rangliste with one of those selected falls
   * back to the newest matchday that does have a ranking, rather than
   * rendering a picker whose label is not in its own list.
   */
  const latestRankedDay = rankedDays.matchdays.at(-1)?.day
  const rankingDay = rankedDays.matchdays.some(
    (entry) => entry.day === selectedDay,
  )
    ? selectedDay
    : latestRankedDay

  /*
   * The matchday actually asked for. On the Rangliste that is the day being
   * ranked — so the duel each row names is the duel of the day on screen —
   * and before the season's first kick-off it falls back to `selectedDay`,
   * which keeps the query enabled: the duel-mode redirect below reads its
   * response, and a page that cannot tell whether the league plays duels
   * would be a worse answer than an empty ranking.
   */
  const activeDay =
    view === VIEWS.ranking ? (rankingDay ?? selectedDay) : selectedDay

  const matchday = schedule.data?.matchdays.find(
    (entry) => entry.day === activeDay,
  )
  const state = matchday === undefined ? undefined : matchdayState(matchday)
  const isLive = state === 'live'

  const duels = useDuels(leagueId, activeDay, { isLive })

  /*
   * The same cache entry, mapped the other way — one request, two readings, so
   * the Rangliste costs nothing beyond what the Duelle tab already spent. Left
   * idle on the Duelle tab the way every hook in the app waits: the mapping is
   * not free, and nothing renders it there.
   */
  const standings = useMatchdayStandings(
    view === VIEWS.ranking ? leagueId : undefined,
    activeDay,
    { isLive },
  )

  // The viewer's own duel goes first — it is the one they opened the page for.
  // Everything else keeps the hook's table order.
  const ordered = useMemo(() => {
    const list = duels.data?.duels ?? []
    if (user === null) return list
    const isMine = (duel: Duel) =>
      duel.sides.some((side) => side.id === user.id)
    const mine = list.filter(isMine)
    return mine.length === 0
      ? list
      : [...mine, ...list.filter((duel) => !isMine(duel))]
  }, [duels.data, user])

  /**
   * How many players each manager has on the pitch **right now**.
   *
   * Asked for every manager on the page at once, and only while a match is
   * actually running — see
   * [`useActivePlayerCounts`](../api/hooks/useActivePlayerCounts.ts), which is
   * where the cost of that is reasoned about. `ordered` is memoised, so the id
   * list is stable between the once-a-minute polls.
   *
   * **The Rangliste asks for nobody.** The line it would feed is on the duel
   * card, so a fan-out of one request per manager while the other tab is open
   * would be paying for a row that is not on screen.
   */
  const managerIds = useMemo(
    () =>
      view === VIEWS.duels
        ? ordered.flatMap((duel) => duel.sides.map((side) => side.id))
        : [],
    [ordered, view],
  )
  const activePlayers = useActivePlayerCounts(
    leagueId,
    competitionId,
    activeDay,
    managerIds,
  )

  if (schedule.isPending || duels.isPending) {
    return (
      <div className="flex flex-col gap-4">
        {/* The heading is the picker, and the picker cannot be drawn without a
            schedule — so the placeholder is the shape it will take rather than
            a title that is about to be replaced by something else. */}
        <div className="-mx-3 border-b border-line px-3 pb-3">
          <div className="h-11 w-40 animate-pulse rounded-xl bg-surface-2" />
        </div>
        <SkeletonList rows={6} />
      </div>
    )
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

  // A league that does not play duels has no duels page. The drawer already
  // hides the entry; this is what makes a typed or bookmarked URL behave the
  // same way instead of rendering an empty screen.
  if (!duels.data.isDuelMode) {
    return <Navigate to={`/leagues/${leagueId}/dashboard`} replace />
  }

  const hasStarted = state === 'live' || state === 'finished'

  /*
   * `?day=` rides along, so switching views keeps the matchday you were
   * looking at rather than snapping back to the current one.
   */
  const base = `/leagues/${leagueId}/${VIEWS.duels}`
  const suffix = selectedDay === undefined ? '' : `?day=${String(selectedDay)}`
  const tabs: BottomTab[] = [
    {
      value: VIEWS.duels,
      label: 'Duelle',
      icon: Swords,
      to: `${base}${suffix}`,
    },
    {
      value: VIEWS.ranking,
      label: 'Rangliste',
      icon: ListOrdered,
      to: `${base}/${VIEWS.ranking}${suffix}`,
    },
  ]

  const selectDay = (day: number) => {
    // `replace` keeps the back button meaning "leave the page" rather than
    // walking back through every matchday that was looked at.
    setSearchParams({ day: String(day) }, { replace: true })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* **The picker is the page heading**, on both views and on the one
          `?day=` — everything either view shows is about the one selected
          matchday. The two hand it different matchdays to offer: pairings
          exist for the whole season, a ranking only from kick-off onwards. */}
      {view === VIEWS.ranking && rankingDay === undefined ? (
        // Before the season's first kick-off there is no matchday to pick and
        // no ranking to show. A picker over an empty range would be a heading
        // reading "undefined. Spieltag".
        <h1 className="text-xl font-bold tracking-tight text-ink">Rangliste</h1>
      ) : (
        <MatchdayPicker
          variant="heading"
          schedule={view === VIEWS.ranking ? rankedDays : schedule.data}
          selectedDay={
            (view === VIEWS.ranking ? rankingDay : selectedDay) as number
          }
          onSelect={selectDay}
        />
      )}

      {view === VIEWS.ranking ? (
        rankingDay === undefined ? (
          <EmptyState
            icon={<ListOrdered size={22} />}
            title="Noch kein Spieltag gespielt"
            description="Sobald der erste Spieltag angepfiffen ist, steht hier die Wertung."
          />
        ) : standings.isError ? (
          <ErrorState
            error={standings.error}
            onRetry={() => {
              void standings.refetch()
            }}
          />
        ) : (
          <ManagerRankingTab
            standings={standings.data}
            leagueId={leagueId}
            viewerId={user?.id}
            isFinished={state === 'finished'}
            isPending={standings.isPending}
          />
        )
      ) : (
        <>
          {ordered.length === 0 ? (
            <EmptyState
              icon={<Swords size={22} />}
              title="Keine Duelle"
              description="Für diesen Spieltag sind noch keine Paarungen ausgelost."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {ordered.map((duel) => (
                <DuelCard
                  key={duel.id}
                  duel={duel}
                  to={`/leagues/${leagueId}/duels/${duel.id}?day=${String(activeDay)}`}
                  hasStarted={hasStarted}
                  isFinished={state === 'finished'}
                  viewerId={user?.id}
                  activePlayers={activePlayers}
                />
              ))}
            </ul>
          )}

          {duels.data.byes.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-xs font-medium tracking-wide text-faint uppercase">
                Ohne Gegner
              </h2>
              <ul className="flex flex-col gap-2">
                {duels.data.byes.map((side) => (
                  <li
                    key={side.id}
                    className="flex items-center gap-2.5 rounded-card border border-line bg-surface px-3 py-3"
                  >
                    <Avatar src={side.image} name={side.name} size={44} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {side.name}
                      </p>
                      <p className="nums truncate text-xs text-muted">
                        {placement(side.duelPlacement ?? side.seasonPlacement)}{' '}
                        Platz
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <BottomTabBar tabs={tabs} active={view} ariaLabel="Duellansicht" />
    </div>
  )
}
