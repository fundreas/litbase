import { CalendarDays } from 'lucide-react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'

import { useLiveMatches } from '@/api/hooks/useLiveMatches'
import { useMatchdayMatches, useSeasonSchedule } from '@/api/hooks/useMatchday'
import { matchdayState, type MatchdayMatch } from '@/api/models'
import { MatchCard } from '@/components/matchday/MatchCard'
import { MatchdayPicker } from '@/components/MatchdayPicker'
import { PageHeading } from '@/components/PageHeading'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useActiveLeague } from '@/league/useActiveLeague'
import { kickoff as kickoffLabel } from '@/lib/format'

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
 */
export function MatchdayPage() {
  const { leagueId, competitionId } = useActiveLeague()
  const [searchParams, setSearchParams] = useSearchParams()

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

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Spieltag"
        subtitle={
          state === 'live'
            ? 'Live-Ergebnisse, minütlich aktualisiert'
            : state === 'finished'
              ? 'Endergebnisse des Spieltags'
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

      {matches.isPending ? (
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
  )
}
