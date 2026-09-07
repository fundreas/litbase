import { CalendarDays, ListOrdered, Swords } from 'lucide-react'
import { useMemo } from 'react'
import { useLocation, useSearchParams } from 'react-router'

import { useTeamDirectory } from '@/api/hooks/useCompetition'
import { useLiveMatches } from '@/api/hooks/useLiveMatches'
import { useMatchdayMatches, useSeasonSchedule } from '@/api/hooks/useMatchday'
import { useMatchdayRanking } from '@/api/hooks/useMatchdayRanking'
import {
  matchdayState,
  POSITION_LABEL,
  type MatchdayMatch,
  type PositionKey,
} from '@/api/models'
import { MatchCard } from '@/components/matchday/MatchCard'
import { PlayerRankingTab } from '@/components/ranking/PlayerRankingTab'
import { MatchdayPicker } from '@/components/MatchdayPicker'
import { BottomTabBar, type BottomTab } from '@/components/ui/BottomTabBar'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useAuth } from '@/auth/useAuth'
import { useActiveLeague } from '@/league/useActiveLeague'
import { kickoff as kickoffLabel } from '@/lib/format'

/** The page's two views, and the URL segment each one is reached by. */
const VIEWS = { matches: 'matchday', ranking: 'ranking' } as const
type ViewValue = (typeof VIEWS)[keyof typeof VIEWS]

/**
 * `?pos=` → the position the ranking is filtered to, or `undefined` for the
 * unfiltered list. Anything else in the slot — a typo, an old link — falls
 * back to *Alle* rather than erroring, the same rule `?day=` follows.
 */
function toRankingPosition(raw: string | null): PositionKey | undefined {
  return raw !== null && raw in POSITION_LABEL
    ? (raw as PositionKey)
    : undefined
}

/**
 * Every match of one matchday, live while they are being played.
 *
 * The competition's fixtures rather than the league's managers — the one screen
 * in the app that is about football rather than about Kickbase, and the way
 * into [one match in detail](./MatchDetailPage.tsx).
 *
 * The matchday lives in the query string (`?day=`), not in component state, the
 * same as on the [Duels](./DuelsPage.tsx) page and for the same reasons: a
 * weekend can be linked to and survives a refresh. An absent or nonsensical
 * `day` falls back to the competition's current matchday rather than erroring,
 * because a hand-edited URL should not be able to produce a broken page.
 *
 * **Grouped by kick-off**, which is how a Bundesliga matchday is actually
 * experienced: a Friday evening, five o'clock on Saturday, the late one, two on
 * Sunday. A flat list of nine sorted by time says the same thing while making
 * the reader work out where the breaks are, and the group heading carries the
 * date so no row has to repeat it.
 *
 * Everything here reads the **season fixture list** — one request, shared with
 * the squad page, the duel picker and the player pages — plus one request per
 * match that has kicked off, for the live score and the minute.
 *
 * ## Two views
 *
 * *Spiele* is the fixtures above. *Rangliste* is the matchday's best players,
 * which answers the other question a matchday raises — not "how did the games
 * go" but "who actually scored". They are siblings rather than one scrolling
 * page because the second is a competition-wide ranking that has nothing to do
 * with the grouping-by-kick-off the first is built around.
 *
 * The view comes from the **path segment**, as on the squad, duel-detail and
 * match-detail pages, so each is linkable and survives a refresh. `?day=` and
 * `?pos=` ride along with it.
 *
 * ## The picker is the page heading
 *
 * Both views are about one selected matchday and nothing else, so a title
 * reading *Spieltag* above a control reading *2. Spieltag* was the same word
 * twice with the useful half in the smaller type. The
 * [picker](../components/MatchdayPicker.tsx) takes the `h1`'s size and weight
 * and a rule under it does the separating, which is what its own doc comment
 * has claimed all along — *the heading of the page is itself the control*.
 *
 * They do not offer the **same** matchdays. The fixtures exist for all 34; a
 * ranking exists from kick-off onwards, so the Rangliste is handed a schedule
 * narrowed to the matchdays that have one, and steps and drawer alike cannot
 * reach past it. The matchday being played comes from Kickbase live, and
 * everything before it from the app's own files — see
 * [`useMatchdayRanking`](../api/hooks/useMatchdayRanking.ts).
 */
export function MatchdayPage() {
  const { leagueId, competitionId } = useActiveLeague()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()

  const view: ViewValue = location.pathname.endsWith(`/${VIEWS.ranking}`)
    ? VIEWS.ranking
    : VIEWS.matches

  const schedule = useSeasonSchedule(competitionId)

  // Validated against the real schedule: a matchday that is not in the fixture
  // list would select nothing and render as an empty page.
  const requestedDay = Number(searchParams.get('day'))
  const selectedDay =
    schedule.data === undefined
      ? undefined
      : schedule.data.matchdays.some((entry) => entry.day === requestedDay)
        ? requestedDay
        : schedule.data.currentDay

  const matches = useMatchdayMatches(competitionId, selectedDay)

  /** Fresh score and minute per match — nothing for one that has not started. */
  const liveByMatchId = useLiveMatches(matches.data)

  /*
   * The position filter lives in the query string beside `?day=`, not in
   * component state, for the reason everything else on this page does: a
   * *Torwarte, 2. Spieltag* is a thing worth linking to, and a refresh should
   * land on the list you were reading. Each position is its own request — see
   * `useCompetitionPlayers` — so it is also the query key.
   */
  const rankingPosition = toRankingPosition(searchParams.get('pos'))

  /*
   * **A matchday only has a ranking once it has started.** The Rangliste
   * therefore offers the played matchdays and the one being played, and
   * nothing further ahead: a picker that stepped to an unplayed matchday would
   * be offering an empty list as if it were a result.
   *
   * The narrowed schedule is what the picker is handed, so the steppers and
   * the drawer cannot disagree with each other about what is reachable.
   */
  const rankedDays = useMemo(() => {
    const matchdays = (schedule.data?.matchdays ?? []).filter(
      (entry) => matchdayState(entry) !== 'upcoming',
    )
    return { currentDay: schedule.data?.currentDay ?? 0, matchdays }
  }, [schedule.data])

  /*
   * `?day=` is shared with the fixtures, which *can* be read for a matchday
   * that has not kicked off. Arriving on the Rangliste with one of those
   * selected falls back to the newest matchday that does have a ranking,
   * rather than rendering a picker whose label is not in its own list.
   */
  const latestRankedDay = rankedDays.matchdays.at(-1)?.day
  const rankingDay = rankedDays.matchdays.some(
    (entry) => entry.day === selectedDay,
  )
    ? selectedDay
    : latestRankedDay

  /*
   * Polling follows the matchday the *ranking* is showing, which is not always
   * the one `?day=` names — arriving from an unplayed fixture list falls back
   * to the newest played one, and that one may well be under way.
   */
  const rankingIsLive = rankedDays.matchdays.some(
    (entry) => entry.day === rankingDay && matchdayState(entry) === 'live',
  )

  /*
   * Kickbase's ranking is the *current* matchday's and can be nothing else —
   * every matchday parameter probed is swallowed. So the matchday being played
   * comes from the API, live, and everything before it from the app's own
   * files under `data/`. `useMatchdayRanking` is the seam, and the only thing
   * on this page that knows there are two sources at all.
   *
   * Gating on the view matters: the Spiele view is the page's front door and
   * should not pay for a request it never renders. Passing `undefined` leaves
   * both queries idle, the same way every hook in the app waits for its id.
   */
  const rankingId = view === VIEWS.ranking ? competitionId : undefined

  const ranking = useMatchdayRanking({
    competitionId: rankingId,
    day: rankingDay,
    currentDay: schedule.data?.currentDay,
    position: rankingPosition,
    isLive: rankingIsLive,
  })
  const teams = useTeamDirectory(rankingId)

  /*
   * One group per distinct kick-off. The list arrives sorted by kick-off, so
   * insertion order is already the order to render — no second sort, and the
   * groups cannot disagree with the rows about the sequence.
   */
  const slots = useMemo(() => {
    const byKickoff = new Map<string, MatchdayMatch[]>()
    for (const match of matches.data ?? []) {
      const group = byKickoff.get(match.kickoff) ?? []
      group.push(match)
      byKickoff.set(match.kickoff, group)
    }
    return [...byKickoff]
  }, [matches.data])

  if (schedule.isPending) {
    return (
      <div className="flex flex-col gap-4">
        {/* The heading is the picker, and the picker cannot be drawn without a
            schedule — so the placeholder is the shape it will take rather than
            a title that is about to be replaced by something else. */}
        <div className="-mx-3 border-b border-line px-3 pb-3">
          <div className="h-11 w-40 animate-pulse rounded-xl bg-surface-2" />
        </div>
        <SkeletonList rows={9} />
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

  /*
   * `?day=` and `?pos=` ride along, so switching views keeps the matchday you
   * were looking at rather than snapping back to the current one, and keeps
   * the Rangliste's position filter across a trip to the fixtures and back.
   */
  const linkQuery = new URLSearchParams()
  if (selectedDay !== undefined) linkQuery.set('day', String(selectedDay))
  if (rankingPosition !== undefined) linkQuery.set('pos', rankingPosition)
  const base = `/leagues/${leagueId}/${VIEWS.matches}`
  const query = linkQuery.toString()
  const suffix = query === '' ? '' : `?${query}`

  /**
   * Change one parameter and keep the rest — the day picker must not silently
   * clear the position filter, and the chips must not clear the day.
   *
   * `replace` keeps the back button meaning "leave the page" rather than
   * walking back through every matchday and every chip that was tapped.
   */
  const patchParams = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(searchParams)
    if (value === undefined) next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
  }
  const tabs: BottomTab[] = [
    {
      value: VIEWS.matches,
      label: 'Spiele',
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

  return (
    <div className="flex flex-col gap-4">
      {/* **The picker is the page heading**, on both views and on the one
          `?day=`. Everything either view shows is about one selected matchday,
          so a title reading *Spieltag* above a control reading *2. Spieltag*
          was the same word twice with the useful half in the smaller type. The
          rule under it does the separating a heading's whitespace used to.

          The two views hand it **different matchdays to offer**: the fixtures
          exist for all 34, a ranking only from kick-off onwards. */}
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
          onSelect={(day) => {
            patchParams('day', String(day))
          }}
        />
      )}

      <div className="flex flex-col">
        {view === VIEWS.ranking ? (
          rankingDay === undefined ? (
            <EmptyState
              icon={<ListOrdered size={22} />}
              title="Noch kein Spieltag gespielt"
              description="Sobald der erste Spieltag angepfiffen ist, steht hier die Wertung."
            />
          ) : ranking.isError ? (
            <ErrorState error={ranking.error} onRetry={ranking.refetch} />
          ) : ranking.isMissing ? (
            /* Not an error and not an empty list: this matchday simply has no
               file yet. Every matchday is in this state until the seed script
               is run for it, so it says what is missing and what produces it
               rather than offering a retry that cannot help. */
            <EmptyState
              icon={<ListOrdered size={22} />}
              title="Noch nicht archiviert"
              description={`Für Spieltag ${String(rankingDay)} liegt noch keine gespeicherte Rangliste vor. Kickbase liefert nur Spieltag ${String(schedule.data.currentDay)} — ältere werden mit "npm run data:rankings" erzeugt.`}
              action={
                latestRankedDay === undefined ? undefined : (
                  <button
                    type="button"
                    className="mt-1 rounded-lg px-3 py-1.5 text-sm font-medium text-accent hover:bg-surface-2"
                    onClick={() => {
                      patchParams('day', String(latestRankedDay))
                    }}
                  >
                    Zu Spieltag {latestRankedDay}
                  </button>
                )
              }
            />
          ) : (
            <PlayerRankingTab
              data={ranking.data}
              teams={teams.data}
              leagueId={leagueId}
              viewerId={user?.id}
              isPending={ranking.isPending}
              scope="matchday"
              source={ranking.source}
              position={rankingPosition}
              onPositionChange={(next) => {
                patchParams('pos', next)
              }}
            />
          )
        ) : matches.isPending ? (
          <SkeletonList rows={9} />
        ) : slots.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={22} />}
            title="Keine Spiele"
            description="Für diesen Spieltag hat Kickbase keine Begegnungen."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {slots.map(([kickoff, group]) => (
              <section key={kickoff} className="flex flex-col gap-2">
                <h2 className="nums px-0.5 text-xs font-medium tracking-wide text-faint uppercase">
                  {kickoffLabel(kickoff)}
                </h2>
                <ul className="flex flex-col gap-2">
                  {group.map((match) => (
                    <MatchCard
                      key={match.matchId}
                      match={match}
                      live={liveByMatchId.get(match.matchId)}
                      to={`/leagues/${leagueId}/matchday/${match.matchId}`}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <BottomTabBar tabs={tabs} active={view} ariaLabel="Spieltagsansicht" />
    </div>
  )
}
