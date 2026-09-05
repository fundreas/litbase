import { House, PlaneTakeoff } from 'lucide-react'
import { Link } from 'react-router'

import type { TeamSummary } from '@/api/hooks/useCompetition'
import {
  fixtureState,
  teamResult,
  TEAM_RESULT_LABEL,
  type TeamResult,
  type TeamSeasonFixture,
} from '@/api/models'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { points, time, weekdayDate } from '@/lib/format'

const RESULT_COLOR: Record<TeamResult, string> = {
  win: 'text-positive',
  draw: 'text-ink',
  loss: 'text-negative',
}

/**
 * The club's whole season, **with what its players scored on each matchday.**
 *
 * The fixture list on its own would be the least interesting card on the page —
 * a Bundesliga calendar, available anywhere. The right-hand column is what
 * makes it worth a tab: how many Kickbase points that club produced on each
 * matchday, so a season reads as *where the points were* rather than as a run
 * of scorelines. A 0:0 that yielded 480 points and a 4:1 that yielded 260 are
 * the sort of thing only this column says out loud, and they are the weeks a
 * manager wants to know about.
 *
 * **The column is the reason this tab shares the Kader's fan-out.** `ph` on
 * every player's detail carries his whole season, so the same twenty-six
 * requests that price the roster also add up to the club's points for all 34
 * matchdays — see [`useTeamRoster`](../../api/hooks/useTeam.ts). Flicking
 * between the two tabs therefore costs nothing; the Übersicht, which needs
 * neither, pays for neither.
 *
 * A matchday with no total is drawn as `–`, never `0`. Before a club kicks off
 * it has not scored nothing, and the whole point of the column is the size of
 * the number.
 *
 * The bar under each figure is scaled to the club's **own best matchday**, not
 * to a fixed ceiling: Kickbase points have no natural maximum, and the useful
 * comparison is between this club's weeks rather than against an absolute
 * nobody knows the shape of.
 */
export function TeamMatchesTab({
  fixtures,
  pointsByDay,
  isPointsPending,
  teams,
  currentDay,
  leagueId,
}: {
  /** The club's season, ascending. */
  fixtures: TeamSeasonFixture[]
  /** Club Kickbase points per matchday, from the roster fan-out. */
  pointsByDay: Map<number, number>
  /** The fan-out is still arriving; the figures fill in. */
  isPointsPending: boolean
  teams: Map<string, TeamSummary> | undefined
  /** The competition's current matchday, which the list marks. */
  currentDay: number | undefined
  leagueId: string
}) {
  const best = Math.max(1, ...pointsByDay.values())

  return (
    <div className="flex flex-col gap-2">
      {isPointsPending && (
        <p className="flex items-center gap-2 px-0.5 text-xs text-muted">
          <Spinner size={12} />
          <span>Punkte je Spieltag werden geladen …</span>
        </p>
      )}

      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {fixtures.map((fixture) => (
          <li key={fixture.matchId}>
            <FixtureRow
              fixture={fixture}
              teamPoints={pointsByDay.get(fixture.day)}
              best={best}
              opponent={teams?.get(fixture.opponentId)}
              isCurrent={fixture.day === currentDay}
              leagueId={leagueId}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function FixtureRow({
  fixture,
  teamPoints,
  best,
  opponent,
  isCurrent,
  leagueId,
}: {
  fixture: TeamSeasonFixture
  teamPoints: number | undefined
  /** The club's best matchday, which the bar is scaled against. */
  best: number
  opponent: TeamSummary | undefined
  isCurrent: boolean
  leagueId: string
}) {
  const state = fixtureState(fixture)
  const result = teamResult(fixture)
  const Venue = fixture.isHome ? House : PlaneTakeoff

  return (
    <Link
      to={`/leagues/${leagueId}/matchday/${fixture.matchId}`}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-surface-2/60',
        // The current matchday is the row a reader is looking for when the
        // list is 34 long. A left edge rather than a filled row: a tinted
        // background at this density reads as a selection the tap did not make.
        isCurrent && 'border-l-2 border-l-accent pl-2.5',
      )}
    >
      <span className="nums w-7 shrink-0 text-[0.6875rem] text-faint">
        {fixture.day}.
      </span>

      <Venue
        size={13}
        aria-label={fixture.isHome ? 'Heimspiel' : 'Auswärtsspiel'}
        className={cn(
          'shrink-0',
          fixture.isHome ? 'text-positive' : 'text-accent',
        )}
      />

      <Avatar
        src={fixture.opponentImage}
        name={fixture.opponentSymbol}
        size={24}
        square
        className="shrink-0 bg-transparent"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">
          {opponent?.name ?? fixture.opponentSymbol}
        </p>
        <p className="nums truncate text-[0.625rem] text-faint">
          {weekdayDate(fixture.kickoff)} · {time(fixture.kickoff)}
        </p>
      </div>

      {/* The scoreline, or where the match stands instead. Fixed width so the
          points column to its right lines up down all 34 rows. */}
      <span className="w-14 shrink-0 text-center">
        {state === 'upcoming' ? (
          <span className="text-[0.6875rem] text-faint">offen</span>
        ) : state === 'running' ? (
          <span className="flex items-center justify-center gap-1 text-[0.6875rem] font-semibold text-accent">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
            />
            Läuft
          </span>
        ) : (
          <span
            title={result === undefined ? undefined : TEAM_RESULT_LABEL[result]}
            className={cn(
              'nums text-sm font-semibold',
              result === undefined ? 'text-ink' : RESULT_COLOR[result],
            )}
          >
            {fixture.goalsFor ?? '–'}:{fixture.goalsAgainst ?? '–'}
          </span>
        )}
      </span>

      <TeamPoints value={teamPoints} best={best} />
    </Link>
  )
}

/**
 * What the club's players scored that matchday, with a bar for the shape of it.
 *
 * The bar is the reason the column works at a glance: 34 four-digit numbers
 * down a phone screen are unreadable as a series, while 34 bars are a season's
 * form curve that happens to be labelled.
 */
function TeamPoints({
  value,
  best,
}: {
  value: number | undefined
  best: number
}) {
  const label =
    value === undefined
      ? 'Noch keine Punkte'
      : `${points(value)} Kickbase-Punkte`

  return (
    <span title={label} className="flex w-16 shrink-0 flex-col items-end gap-1">
      <span
        aria-hidden="true"
        className={cn(
          'nums text-[0.6875rem] font-semibold',
          value === undefined ? 'text-faint' : 'text-ink',
        )}
      >
        {value === undefined ? '–' : points(value)}
      </span>
      <span
        aria-hidden="true"
        className="h-1 w-full overflow-hidden rounded-full bg-surface-2"
      >
        <span
          className="block h-full rounded-full bg-accent/70"
          style={{
            width: `${String(Math.round(((value ?? 0) / best) * 100))}%`,
          }}
        />
      </span>
      <span className="sr-only">{label}</span>
    </span>
  )
}
