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
import {
  pointsColor,
  pointsFraction,
  TEAM_POINTS_BANDS,
} from '@/components/player/pointsScale'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { points, time, weekdayDate } from '@/lib/format'

/**
 * What a full bar means before any club has beaten it — **where gold begins**.
 *
 * A club's matchday yield has no ceiling, so the bars are scaled to the best
 * one this club has actually managed — except at the start of a season, when
 * "the best so far" is one matchday and every bar would be full or nearly so,
 * which says nothing.
 *
 * Taken from the top of {@link TEAM_POINTS_BANDS} rather than written out
 * again, so the length and the colour cannot drift apart: a bar that fills its
 * track is exactly a bar that has turned gold, and the two say one thing. It is
 * 2000 — roughly a Bundesliga squad's good week — so early matchdays sit
 * sensibly under it and the scale only grows once a club earns it.
 */
const FALLBACK_SCALE = TEAM_POINTS_BANDS[2]

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
 * **The bar is the row's bottom edge**, not a track inside it — the treatment
 * [`PlayerMatchRow`](../player/PlayerMatchRow.tsx) uses for a player's season,
 * and it is worth copying for exactly the reason it exists there: a column of
 * rows each ending in a filled edge reads as a bar chart on its side, without
 * anything having to draw a chart or spend width on one. The colour is the
 * app's shared [points scale](../player/pointsScale.ts), so a hue means the
 * same thing here as on a player's match row.
 *
 * Scaled to the club's **own best matchday**, or {@link FALLBACK_SCALE} while
 * that is still small — Kickbase points have no natural maximum, and the useful
 * comparison is between this club's weeks rather than against an absolute
 * nobody knows the shape of.
 *
 * Only played matchdays get a bar. An empty track under every upcoming fixture
 * would be a row of nothing, seventeen times over.
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
  const best = Math.max(FALLBACK_SCALE, ...pointsByDay.values())

  return (
    <div className="flex flex-col gap-2">
      {isPointsPending && (
        <p className="flex items-center gap-2 px-0.5 text-xs text-muted">
          <Spinner size={12} />
          <span>Punkte je Spieltag werden geladen …</span>
        </p>
      )}

      <ul className="flex flex-col gap-1.5">
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
  const color =
    teamPoints === undefined
      ? undefined
      : pointsColor(teamPoints, TEAM_POINTS_BANDS)

  return (
    <Link
      to={`/leagues/${leagueId}/matchday/${fixture.matchId}`}
      className={cn(
        'flex flex-col overflow-hidden rounded-card border bg-surface transition-colors',
        'hover:bg-surface-2/60',
        // The current matchday is the row a reader is looking for when the
        // list is 34 long. An accent border rather than a filled row: a tinted
        // background at this density reads as a selection the tap did not make.
        isCurrent ? 'border-accent/50' : 'border-line',
      )}
    >
      <span className="flex items-center gap-2.5 px-3 py-2">
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

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-ink">
            {opponent?.name ?? fixture.opponentSymbol}
          </span>
          <span className="nums block truncate text-[0.625rem] text-faint">
            {weekdayDate(fixture.kickoff)} · {time(fixture.kickoff)}
          </span>
        </span>

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
              title={
                result === undefined ? undefined : TEAM_RESULT_LABEL[result]
              }
              className={cn(
                'nums text-sm font-semibold',
                result === undefined ? 'text-ink' : RESULT_COLOR[result],
              )}
            >
              {fixture.goalsFor ?? '–'}:{fixture.goalsAgainst ?? '–'}
            </span>
          )}
        </span>

        <TeamPoints value={teamPoints} color={color} />
      </span>

      {/* Flush against the card's bottom edge, so a column of these reads as a
          bar chart on its side without anything drawing a chart. Only for
          matchdays that were actually played — an empty track under every
          upcoming fixture would be seventeen rows of nothing. */}
      {teamPoints !== undefined && color !== undefined && (
        <span
          aria-hidden="true"
          className="block h-1 w-full shrink-0 bg-surface-2"
        >
          <span
            className="block h-full rounded-r-full transition-[width]"
            style={{
              width: `${String(pointsFraction(teamPoints, best) * 100)}%`,
              background: color,
            }}
          />
        </span>
      )}
    </Link>
  )
}

/**
 * What the club's players scored that matchday.
 *
 * The figure alone — the shape of it is the bar along the card's bottom edge,
 * and a second track beside the number would say the same thing twice in a
 * quarter of the width. Tinted by the same
 * [points scale](../player/pointsScale.ts) that colours the bar, so the number
 * and the edge under it can never disagree.
 */
function TeamPoints({
  value,
  color,
}: {
  value: number | undefined
  color: string | undefined
}) {
  const label =
    value === undefined
      ? 'Noch keine Punkte'
      : `${points(value)} Kickbase-Punkte`

  return (
    <span
      title={label}
      style={color === undefined ? undefined : { color }}
      className={cn(
        'nums w-14 shrink-0 text-right text-sm font-bold',
        value === undefined && 'text-faint',
      )}
    >
      <span aria-hidden="true">
        {value === undefined ? '–' : points(value)}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  )
}
