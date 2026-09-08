import { History, Info, Shirt, Users } from 'lucide-react'
import { useMemo } from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router'

import { useMatchdayStandings } from '@/api/hooks/useDuels'
import { useSeasonSchedule } from '@/api/hooks/useMatchday'
import {
  useManagerRoster,
  useManagerSquadMembers,
} from '@/api/hooks/useManagerRoster'
import { duelResultOf, useRanking } from '@/api/hooks/useRanking'
import { duelSideOf, matchdayState } from '@/api/models'
import { useAuth } from '@/auth/useAuth'
import { ActivityFeed } from '@/components/events/ActivityFeed'
import { ManagerDetailsTab } from '@/components/manager/ManagerDetailsTab'
import {
  ManagerHeader,
  type ManagerDuel,
} from '@/components/manager/ManagerHeader'
import { ManagerLineupTab } from '@/components/manager/ManagerLineupTab'
import { ManagerSquadTab } from '@/components/manager/ManagerSquadTab'
import {
  MANAGER_TABS,
  managerTabFromPath,
} from '@/components/manager/managerTabs'
import { MatchdayPicker } from '@/components/MatchdayPicker'
import { BottomTabBar, type BottomTab } from '@/components/ui/BottomTabBar'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useActiveLeague } from '@/league/useActiveLeague'

/**
 * One manager of the league, in four views.
 *
 *   /leagues/:leagueId/managers/:managerId          → Aufstellung, `?day=N`
 *   /leagues/:leagueId/managers/:managerId/squad    → Kader
 *   /leagues/:leagueId/managers/:managerId/events   → Verlauf
 *   /leagues/:leagueId/managers/:managerId/details  → Details
 *
 * Four routes, one component, with the active tab read out of the URL — the
 * arrangement the squad, player, duel, match and club pages all use, and for
 * the same reasons: every view is linkable and survives a refresh.
 *
 * **Reached by tapping a manager**, anywhere one is named: a row of either
 * standings, either side of a duel's scoreline, the roster labels on a duel's
 * pitch and ranking, the owner of a player, and the manager who joined, left or
 * dealt in the [event feed](../components/events/ActivityFeed.tsx). There is no
 * drawer entry — a manager is a detail page, like a player or a club, and its
 * way in is the name that identifies them. It does **light** *Rangliste*, which
 * is the list every manager on this page came out of; see
 * [`navigation.ts`](../components/layout/navigation.ts).
 *
 * ## Why this page is the answer to a name
 *
 * Before it, a rival manager was a face and two numbers in a table. Their
 * eleven was visible only if you happened to be drawn against them, only on
 * that matchday, and only on the [duel page](./DuelDetailPage.tsx)'s half
 * pitch. Their squad was not visible anywhere, and neither was what they had
 * bought and sold — although the API had all three the whole time.
 *
 * ## What each view costs
 *
 *  - **The page — two requests**, both shared: the season standings (the same
 *    entry the [Rangliste](./RankingPage.tsx), the events page and the drawer
 *    read) and the season's fixture list, an hour-long entry most pages have
 *    already filled. Plus the selected matchday's standings, which the
 *    [duels](./DuelsPage.tsx) page fills for the same `?day=`.
 *  - **Aufstellung — a [manager roster](../api/hooks/useManagerRoster.ts)**:
 *    the matchday snapshot, and the per-player points fan-out under the rules
 *    that hook documents. While a matchday runs it costs **one request a tick**,
 *    because the snapshot carries the running scores for the whole squad.
 *  - **Kader — one request**, and the *same cache entry* the roster's squad
 *    lookup fills, so whichever of the two tabs is opened second is free.
 *  - **Verlauf — the league's event feed**, paged, which the events page has
 *    usually already loaded the first page of.
 *  - **Details — nothing.** It is arithmetic over the standings row.
 *
 * The gate is the tab on screen: the roster hook is handed `undefined` for the
 * side while another tab is showing, which switches its queries off — the same
 * split the [club page](./TeamDetailPage.tsx) uses to keep its scorer card off
 * the Kader's bill.
 *
 * ## The viewer's own page is not special-cased
 *
 * Tapping your own row opens your own manager page, marked *du*, rather than
 * redirecting to *Mannschaft*. Two reasons: a link that goes somewhere else for
 * one row of a table is a surprise, and the two pages answer different
 * questions — this one is the read-only portrait every manager gets, that one is
 * where a lineup is *edited*. The Details tab carries the one link across.
 */
export function ManagerDetailPage() {
  const { leagueId, competitionId } = useActiveLeague()
  const { managerId } = useParams()
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const tab = managerTabFromPath(location.pathname)
  const base = `/leagues/${leagueId}/managers/${managerId ?? ''}`

  /*
   * The season standings are this page's identity: who this manager is, where
   * they stand, and their whole per-matchday history. One shared cache entry,
   * and the reason three of the four tabs cost nothing.
   */
  const ranking = useRanking(leagueId)
  const schedule = useSeasonSchedule(competitionId)

  /*
   * The matchday in view, `?day=` if it names a real one and the current
   * matchday otherwise — the arrangement the duels and matchday pages use, so a
   * hand-edited or stale day lands on something rather than erroring.
   */
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

  /*
   * That matchday's standings — where the manager's points *for the day* come
   * from, and the only source of the duel they were in on it. The season
   * ranking's `mdp` is the **current** matchday's, so it cannot answer for any
   * other; see `duelSideOf`.
   */
  const standings = useMatchdayStandings(leagueId, selectedDay, {
    isLive: state === 'live',
  })

  const manager = ranking.data?.managers.find((entry) => entry.id === managerId)
  const onTheDay = standings.data?.managers.find(
    (entry) => entry.id === managerId,
  )

  const standingsById = useMemo(
    () =>
      new Map(
        (standings.data?.managers ?? []).map((entry) => [entry.id, entry]),
      ),
    [standings.data],
  )

  /*
   * The manager as a roster subject, which is the matchday's own row rather
   * than the season's — the points on it are what the pitch's total shows.
   * `undefined` while the standings are in flight, and on every tab but the
   * lineup, which is what keeps the points fan-out off the other three.
   */
  const side =
    onTheDay === undefined || tab !== MANAGER_TABS.lineup
      ? undefined
      : duelSideOf(onTheDay)

  const roster = useManagerRoster(leagueId, competitionId, selectedDay, side)

  /*
   * The Kader reads the same cache entry the roster's squad lookup fills, so
   * whichever of the two is opened second costs nothing. Gated the same way —
   * there is no reason for the Verlauf or the Details tab to ask for a squad.
   */
  const squad = useManagerSquadMembers(
    leagueId,
    tab === MANAGER_TABS.squad || tab === MANAGER_TABS.lineup
      ? managerId
      : undefined,
  )

  const isDuelMode = ranking.data?.isDuelMode === true

  /*
   * The duel the manager was in on the matchday in view. Only in a duel league,
   * and only when the day actually paired them with somebody — an odd-sized
   * league leaves one manager out, and a strip about a duel that does not exist
   * would be a row saying nothing.
   */
  const duel = ((): ManagerDuel | undefined => {
    if (!isDuelMode || onTheDay === undefined || selectedDay === undefined) {
      return undefined
    }
    const opponent =
      onTheDay.duelOpponentId === undefined
        ? undefined
        : standingsById.get(onTheDay.duelOpponentId)
    if (opponent === undefined) return undefined

    return {
      day: selectedDay,
      opponent,
      ownPoints: onTheDay.matchdayPoints,
      opponentPoints: opponent.matchdayPoints,
      // *Gewonnen* is past tense: a duel level at 0 in the third minute would
      // read as *Remis*, which is the one thing it is not. Same gate as the
      // matchday standings apply to their own outcome line.
      result:
        state === 'finished'
          ? duelResultOf(onTheDay, standingsById)
          : undefined,
      isLive: state === 'live',
    }
  })()

  const day = `?day=${String(selectedDay ?? '')}`
  const tabs: BottomTab[] = [
    {
      value: MANAGER_TABS.lineup,
      label: 'Aufstellung',
      icon: Shirt,
      to: `${base}${day}`,
    },
    {
      value: MANAGER_TABS.squad,
      label: 'Kader',
      icon: Users,
      to: `${base}/${MANAGER_TABS.squad}${day}`,
    },
    {
      value: MANAGER_TABS.events,
      label: 'Verlauf',
      icon: History,
      to: `${base}/${MANAGER_TABS.events}${day}`,
    },
    {
      value: MANAGER_TABS.details,
      label: 'Details',
      icon: Info,
      to: `${base}/${MANAGER_TABS.details}${day}`,
    },
  ]

  if (ranking.isPending || schedule.isPending) {
    return <SkeletonList rows={6} />
  }

  if (ranking.isError || schedule.isError) {
    return (
      <ErrorState
        error={ranking.error ?? schedule.error}
        onRetry={() => {
          void ranking.refetch()
          void schedule.refetch()
        }}
      />
    )
  }

  /*
   * A manager id the standings do not know: a hand-edited URL, a link shared
   * from another league, or somebody who has since left this one. A 404 for
   * this page rather than an error, and the way back is the list they would
   * have come from — the same treatment the club and duel pages give an id
   * they cannot resolve.
   */
  if (manager === undefined) {
    return (
      <EmptyState
        title="Manager nicht gefunden"
        description="Zu dieser Kennung führt die Liga kein Mitglied — vielleicht hat der Manager die Liga verlassen."
        action={
          <Link
            to={`/leagues/${leagueId}/ranking`}
            className="text-sm font-medium text-accent hover:underline"
          >
            Zur Rangliste
          </Link>
        }
      />
    )
  }

  const isViewer = manager.id === user?.id

  return (
    /* `min-h-0` down the whole chain so the pitch on the Aufstellung tab can
       claim the height the page has left. The bottom bar looks after itself —
       it is fixed to the viewport, see `BottomTabBar`. */
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <ManagerHeader
        manager={manager}
        isViewer={isViewer}
        isDuelMode={isDuelMode}
        duel={duel}
        leagueId={leagueId}
      />

      {/* The picker belongs to the one tab whose subject is a matchday. It
          stays out of the other three rather than being disabled on them: a
          control that does nothing where it stands is worse than one that is
          not there, and the day still rides along in `?day=` on every tab link
          so coming back lands on the matchday you left. */}
      {tab === MANAGER_TABS.lineup &&
        schedule.data !== undefined &&
        selectedDay !== undefined && (
          <MatchdayPicker
            schedule={schedule.data}
            selectedDay={selectedDay}
            onSelect={(next) => {
              void navigate(`${base}?day=${String(next)}`)
            }}
          />
        )}

      <div className="flex min-h-0 flex-1 flex-col">
        {tab === MANAGER_TABS.lineup &&
          (roster.isPending || standings.isPending ? (
            <SkeletonList rows={8} />
          ) : roster.isError ? (
            <ErrorState error={roster.error} onRetry={roster.refetch} />
          ) : roster.isEmpty ? (
            /* The snapshot endpoint answers 200 with empty lists for a matchday
               it has nothing for — one before the league existed, or before
               this manager joined it. Not an error and not an empty team, so it
               gets its own message rather than a blank pitch. */
            <EmptyState
              title="Keine Aufstellung für diesen Spieltag"
              description="Für diesen Spieltag hat Kickbase keinen Kader dieses Managers — vermutlich lag er vor seinem Beitritt."
            />
          ) : roster.data === undefined ? null : (
            <ManagerLineupTab
              roster={roster.data}
              day={selectedDay}
              leagueId={leagueId}
              isPointsPending={roster.isPointsPending}
            />
          ))}

        {tab === MANAGER_TABS.squad &&
          (squad.isPending ? (
            <SkeletonList rows={8} />
          ) : squad.isError ? (
            <ErrorState
              error={squad.error}
              onRetry={() => {
                void squad.refetch()
              }}
            />
          ) : (
            <ManagerSquadTab squad={squad.data} leagueId={leagueId} />
          ))}

        {tab === MANAGER_TABS.events && (
          <ActivityFeed
            leagueId={leagueId}
            manager={{ id: manager.id, name: manager.name, isViewer }}
          />
        )}

        {tab === MANAGER_TABS.details && (
          <ManagerDetailsTab
            manager={manager}
            isDuelMode={isDuelMode}
            isViewer={isViewer}
            leagueId={leagueId}
            matchdayBase={base}
            matchday={
              onTheDay === undefined || selectedDay === undefined
                ? undefined
                : {
                    day: selectedDay,
                    points: onTheDay.matchdayPoints,
                    placement: onTheDay.matchdayPlacement,
                  }
            }
          />
        )}
      </div>

      <BottomTabBar tabs={tabs} active={tab} ariaLabel="Manageransicht" />
    </div>
  )
}
