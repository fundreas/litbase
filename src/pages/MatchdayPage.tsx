import { CalendarDays, ListOrdered, Swords } from 'lucide-react'
import { useMemo } from 'react'
import { useLocation, useSearchParams } from 'react-router'

import {
  useCompetitionPlayers,
  useTeamDirectory,
} from '@/api/hooks/useCompetition'
import { useLiveMatches } from '@/api/hooks/useLiveMatches'
import { useMatchdayMatches, useSeasonSchedule } from '@/api/hooks/useMatchday'
import {
  matchdayState,
  POSITION_LABEL,
  POSITION_NAME_PLURAL,
  type MatchdayMatch,
  type PositionKey,
} from '@/api/models'
import { MatchCard } from '@/components/matchday/MatchCard'
import { MatchdayRankingTab } from '@/components/matchday/MatchdayRankingTab'
import { MatchdayPicker } from '@/components/MatchdayPicker'
import { PageHeading } from '@/components/PageHeading'
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
 * *Spiele* is the fixtures above. *Rangliste* is the matchday's twenty-five
 * best players, which answers the other question a matchday raises — not "how
 * did the games go" but "who actually scored". They are siblings rather than
 * one scrolling page because the second is a competition-wide ranking that has
 * nothing to do with the grouping-by-kick-off the first is built around.
 *
 * The view comes from the **path segment**, as on the squad, duel-detail and
 * match-detail pages, so each is linkable and survives a refresh. `?day=`
 * rides along with it — see the picker below, which is the one thing the two
 * views do not share.
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

  const matchday = schedule.data?.matchdays.find(
    (entry) => entry.day === selectedDay,
  )
  const state = matchday === undefined ? undefined : matchdayState(matchday)

  /*
   * The ranking is the *current* matchday's and can be nothing else: every
   * matchday parameter probed (`dayNumber`, `matchId`, `mi`, and six more
   * spellings) is ignored by the endpoint — `position` is the only one it
   * honours. So it is requested only on the view that shows it, and only when
   * the picked day is the one it can answer for — passing `undefined` leaves
   * the hook idle, the same way every hook in the app waits for its id.
   *
   * Gating on the view matters: the Spiele view is the page's front door and
   * should not pay for a request it never renders.
   */
  const isCurrentDay =
    selectedDay !== undefined && selectedDay === schedule.data?.currentDay
  const rankingId =
    view === VIEWS.ranking && isCurrentDay ? competitionId : undefined

  /*
   * The position filter lives in the query string beside `?day=`, not in
   * component state, for the reason everything else on this page does: a
   * *Rangliste, Torhüter* is a thing worth linking to, and a refresh should
   * land on the list you were reading. It is a separate request per position —
   * see `useCompetitionPlayers` — so this is also the query key.
   */
  const rankingPosition = toRankingPosition(searchParams.get('pos'))
  const ranking = useCompetitionPlayers(rankingId, {
    isLive: state === 'live',
    position: rankingPosition,
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
        <PageHeading title="Spieltag" />
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
      <PageHeading
        title="Spieltag"
        subtitle={
          view === VIEWS.ranking
            ? /* No count in the filtered wording. Each position is its own
                 top 25, but the keepers come back short — 18, two per fixture,
                 the whole population — and a heading promising 25 above 18
                 rows would read as a bug in the list rather than as the shape
                 of the data. */
              rankingPosition === undefined
              ? 'Die 25 besten Spieler des Spieltags'
              : `Die besten ${POSITION_NAME_PLURAL[rankingPosition]} des Spieltags`
            : state === 'live'
              ? 'Live-Ergebnisse, minütlich aktualisiert'
              : state === 'finished'
                ? 'Endergebnisse des Spieltags'
                : 'Noch nicht angepfiffen'
        }
      />

      {/* The picker belongs to the fixtures alone. The ranking endpoint takes
          `position` but no matchday at all, so a picker above it would be a
          control that visibly does nothing — worse than its absence, because
          it would imply the list below had followed. The one filter the
          ranking *does* honour sits inside the ranking, next to the rows it
          changes, rather than up here beside a control it has nothing to do
          with. */}
      {view === VIEWS.matches && (
        <MatchdayPicker
          schedule={schedule.data}
          selectedDay={selectedDay as number}
          onSelect={(day) => {
            patchParams('day', String(day))
          }}
        />
      )}

      <div className="flex flex-col">
        {view === VIEWS.ranking ? (
          isCurrentDay ? (
            <MatchdayRankingTab
              data={ranking.data}
              teams={teams.data}
              leagueId={leagueId}
              viewerId={user?.id}
              isPending={ranking.isPending}
              position={rankingPosition}
              onPositionChange={(next) => {
                patchParams('pos', next)
              }}
            />
          ) : (
            /* Not an error and not an empty list: the data exists, it just
               cannot be asked for. Saying which matchday *can* be shown, and
               offering the one tap that gets there, is the difference between
               a limit and a dead end. */
            <EmptyState
              icon={<ListOrdered size={22} />}
              title="Nur für den aktuellen Spieltag"
              description={`Kickbase liefert die Spieler-Rangliste ausschließlich für Spieltag ${String(schedule.data.currentDay)}.`}
              action={
                <button
                  type="button"
                  className="mt-1 rounded-lg px-3 py-1.5 text-sm font-medium text-accent hover:bg-surface-2"
                  onClick={() => {
                    patchParams('day', String(schedule.data.currentDay))
                  }}
                >
                  Zu Spieltag {schedule.data.currentDay}
                </button>
              }
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
