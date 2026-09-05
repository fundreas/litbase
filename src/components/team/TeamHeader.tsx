import { House, PlaneTakeoff } from 'lucide-react'
import { Link } from 'react-router'

import type { TeamSummary } from '@/api/hooks/useCompetition'
import {
  fixtureState,
  liveScoreFor,
  teamResult,
  TEAM_RESULT_LABEL,
  type LiveMatch,
  type TeamRecord,
  type TeamSeasonFixture,
  type TeamStanding,
} from '@/api/models'
import { Avatar } from '@/components/ui/Avatar'
import { PlacementChange } from '@/components/ui/PlacementChange'
import { cn } from '@/lib/cn'
import { kickoff as kickoffLabel, minute as minuteLabel } from '@/lib/format'

/**
 * Which club this is, where it stands, and what it is doing right now — above
 * all four tabs.
 *
 * Kept out of the Übersicht for the reason the
 * [player header](../player/PlayerHeader.tsx) is kept out of its Details tab:
 * it is the page's identity, and a roster or a fixture list with no crest above
 * it is a list of nothing. It also means switching tabs never moves it.
 *
 * **No back link.** The page is reached by tapping a crest, and the browser's
 * own back — a system gesture on a phone — already does it.
 *
 * The strip underneath is the part that moves. It carries the club's *most
 * immediate* fixture, which is a running match if there is one, the next one if
 * there is not, and the last one played once the season is over — so it always
 * has something to say and what it says is never stale. Tapping it opens the
 * [match page](../../pages/MatchDetailPage.tsx).
 */
export function TeamHeader({
  team,
  standing,
  record,
  fixture,
  live,
  opponent,
  teamId,
  leagueId,
}: {
  /** Name and crest, from the table-backed directory. */
  team: TeamSummary | undefined
  /** The club's row in the real table, once it has loaded. */
  standing: TeamStanding | undefined
  /** The season's record, derived from the fixture list. */
  record: TeamRecord
  /** The club's most immediate fixture — see {@link teamCurrentFixture}. */
  fixture: TeamSeasonFixture | undefined
  /** That match as it stands, while it is being played. */
  live: LiveMatch | undefined
  /** The other club, so the strip can name it rather than print a crest alone. */
  opponent: TeamSummary | undefined
  /** This club's id — a fixture names only its opponent. See {@link FixtureStrip}. */
  teamId: string
  leagueId: string
}) {
  const row = standing?.row
  const name = team?.name ?? row?.teamName ?? '—'
  // `pcpl − cpl`: the table reports positions, and everything that draws a
  // movement mark in this app speaks in **places gained**, so a club that went
  // from 5th to 3rd has moved `+2`. Subtracting the other way round would put
  // a green arrow on every relegation.
  const movement =
    row?.previousPlacement === undefined
      ? 0
      : row.previousPlacement - row.placement

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar
          src={team?.image ?? row?.teamImage}
          name={name}
          size={64}
          square
          className="bg-transparent"
        />

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold tracking-tight text-ink">
            {name}
          </h1>

          {/* Two quiet lines rather than one long one: where the club stands,
              then what it has actually done. The record is spelled out because
              the table's own goal *difference* hides it — a 14:11 club and a
              5:2 club share a `+3`. */}
          <p className="nums mt-0.5 flex items-center gap-1.5 text-sm text-muted">
            {row === undefined ? (
              <span className="text-faint">Tabelle lädt …</span>
            ) : (
              <>
                <span className="font-semibold text-ink">
                  {row.placement}. Platz
                </span>
                <span aria-hidden="true" className="text-faint">
                  ·
                </span>
                <span>{row.points} Pkt</span>
                <PlacementChange value={movement} />
              </>
            )}
          </p>

          <p className="nums mt-0.5 truncate text-xs text-faint">
            {record.wins}S · {record.draws}U · {record.losses}N ·{' '}
            {record.goalsFor}:{record.goalsAgainst} Tore
          </p>
        </div>
      </div>

      {fixture !== undefined && (
        <FixtureStrip
          fixture={fixture}
          live={live}
          opponent={opponent}
          teamId={teamId}
          leagueId={leagueId}
        />
      )}
    </div>
  )
}

/**
 * The club's most immediate fixture, as a tappable strip.
 *
 * Three states in one shape, so the strip never changes height under a reader
 * watching it tick over:
 *
 * | State | The right-hand side |
 * | ----- | ------------------- |
 * | Not kicked off | the full kick-off, `Sa, 5. Sep. · 18:30` |
 * | Running | the **live score**, a pulsing dot and the minute, in accent |
 * | Over | the final score, tinted by how it went |
 *
 * **The state is the fixture's, the score is the match payload's.** `st` on the
 * season's fixture list is what the app treats as the truth about whether a
 * match is on — and what the live development profile rewrites — while that
 * list is the whole season cached for an hour and so cannot carry a running
 * score. The same division of labour as
 * [`MatchClock`](../matchday/MatchClock.tsx), and the reason a running match
 * reads `liveScoreFor` rather than the fixture's own goals.
 */
function FixtureStrip({
  fixture,
  live,
  opponent,
  teamId,
  leagueId,
}: {
  fixture: TeamSeasonFixture
  live: LiveMatch | undefined
  opponent: TeamSummary | undefined
  /**
   * The club whose page this is.
   *
   * A {@link TeamSeasonFixture} is already resolved from that club's side and
   * so names only the **opponent** — which leaves the club itself as the one
   * thing a home-and-away live payload has to be read against. Reading the
   * opponent's id here instead would invert every running scoreline, and it
   * would look right in exactly the games that finish level.
   */
  teamId: string
  leagueId: string
}) {
  const state = fixtureState(fixture)
  const isRunning = state === 'running'
  const Venue = fixture.isHome ? House : PlaneTakeoff
  const result = teamResult(fixture)

  /*
   * While the match runs the score has to be read from *this* club's side —
   * the payload is home-and-away, and "2:1" under a club's own name has to
   * mean that club is ahead or the strip lies about who is winning.
   */
  const liveScore =
    isRunning && live !== undefined ? liveScoreFor(live, teamId) : undefined
  const goalsFor = liveScore?.for ?? fixture.goalsFor
  const goalsAgainst = liveScore?.against ?? fixture.goalsAgainst

  return (
    <Link
      to={`/leagues/${leagueId}/matchday/${fixture.matchId}`}
      className={cn(
        'flex items-center gap-3 rounded-card border px-3 py-2.5 transition-colors',
        isRunning
          ? 'border-accent/40 bg-accent/10 hover:bg-accent/15'
          : 'border-line bg-surface hover:bg-surface-2',
      )}
    >
      <span className="flex w-5 shrink-0 justify-center">
        <Venue
          size={14}
          aria-label={fixture.isHome ? 'Heimspiel' : 'Auswärtsspiel'}
          className={fixture.isHome ? 'text-positive' : 'text-accent'}
        />
      </span>

      <Avatar
        src={fixture.opponentImage}
        name={opponent?.name ?? fixture.opponentSymbol}
        size={28}
        square
        className="shrink-0 bg-transparent"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {opponent?.name ?? fixture.opponentSymbol}
        </p>
        <p className="nums truncate text-[0.6875rem] text-muted">
          {fixture.day}. Spieltag
          {state === 'finished' && result !== undefined && (
            <> · {TEAM_RESULT_LABEL[result]}</>
          )}
        </p>
      </div>

      {state === 'upcoming' ? (
        <span className="nums shrink-0 text-right text-xs text-muted">
          {kickoffLabel(fixture.kickoff)}
        </span>
      ) : (
        <span className="shrink-0 text-right">
          <span
            className={cn(
              'nums block text-lg leading-none font-bold',
              isRunning
                ? 'text-accent'
                : result === 'win'
                  ? 'text-positive'
                  : result === 'loss'
                    ? 'text-negative'
                    : 'text-ink',
            )}
          >
            {goalsFor ?? '–'}:{goalsAgainst ?? '–'}
          </span>
          {isRunning ? (
            <span className="nums mt-0.5 flex items-center justify-end gap-1 text-[0.625rem] font-semibold text-accent">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
              />
              {live === undefined ? 'Live' : minuteLabel(live.minute)}
            </span>
          ) : (
            <span className="mt-0.5 block text-[0.625rem] text-faint">
              Beendet
            </span>
          )}
        </span>
      )}
    </Link>
  )
}
