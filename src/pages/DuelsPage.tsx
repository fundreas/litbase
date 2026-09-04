import { Swords } from 'lucide-react'
import { useMemo } from 'react'
import { Navigate, useSearchParams } from 'react-router'

import { useDuels } from '@/api/hooks/useDuels'
import { useSeasonSchedule } from '@/api/hooks/useMatchday'
import { matchdayState, type Duel } from '@/api/models'
import { useAuth } from '@/auth/useAuth'
import { DuelCard } from '@/components/duels/DuelCard'
import { MatchdayPicker } from '@/components/MatchdayPicker'
import { PageHeading } from '@/components/PageHeading'
import { Avatar } from '@/components/ui/Avatar'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useActiveLeague } from '@/league/useActiveLeague'
import { placement } from '@/lib/format'

/**
 * Every manager's head-to-head for one matchday.
 *
 * The matchday lives in the query string (`?day=`), not in component state, so
 * a duel weekend can be linked to and survives a refresh — the same reason the
 * league id is in the path. An absent or nonsensical `day` falls back to the
 * competition's current matchday rather than erroring, because a hand-edited
 * URL should not be able to produce a broken page.
 */
export function DuelsPage() {
  const { leagueId, competitionId } = useActiveLeague()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

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

  const matchday = schedule.data?.matchdays.find(
    (entry) => entry.day === selectedDay,
  )
  const state = matchday === undefined ? undefined : matchdayState(matchday)

  const duels = useDuels(leagueId, selectedDay, { isLive: state === 'live' })

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

  if (schedule.isPending || duels.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeading title="Duelle" />
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

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Duelle"
        subtitle={
          state === 'live'
            ? 'Live-Punkte, minütlich aktualisiert'
            : state === 'finished'
              ? 'Endstand des Spieltags'
              : 'Noch nicht angepfiffen'
        }
      />

      <MatchdayPicker
        schedule={schedule.data}
        selectedDay={selectedDay as number}
        onSelect={(day) => {
          // `replace` keeps the back button meaning "leave the page" rather
          // than walking back through every matchday that was looked at.
          setSearchParams({ day: String(day) }, { replace: true })
        }}
      />

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
              to={`/leagues/${leagueId}/duels/${duel.id}?day=${String(selectedDay)}`}
              hasStarted={hasStarted}
              isFinished={state === 'finished'}
              viewerId={user?.id}
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
    </div>
  )
}
