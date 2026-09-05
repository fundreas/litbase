import { House, PlaneTakeoff } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'

import type { TeamSummary } from '@/api/hooks/useCompetition'
import {
  fixtureDifficulty,
  fixtureState,
  POSITION_LABEL,
  teamRecord,
  teamResult,
  teamStreak,
  TEAM_RESULT_LABEL,
  TEAM_RESULT_LETTER,
  type FixtureDifficulty,
  type TableRow,
  type TeamRecord,
  type TeamResult,
  type TeamSeasonFixture,
  type TeamSquadPlayer,
  type TeamStanding,
} from '@/api/models'
import { Avatar } from '@/components/ui/Avatar'
import { Card, CardHeader, StatTile } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import {
  delta,
  money,
  placement,
  points,
  time,
  weekdayDate,
} from '@/lib/format'

/** How many results the form strip shows, and how many fixtures the ticker does. */
const WINDOW = 5

/**
 * The club at a glance — and **entirely out of payloads the app already
 * caches.**
 *
 * That is the design constraint this tab is built to, not an accident: the
 * league table, the season's fixture list and the competition's player list are
 * all shared, hour-long cache entries that the squad, matchday and market pages
 * have usually filled before anyone opens a club. So arriving here costs
 * nothing, and the expensive per-player fan-out is deferred to the tabs that
 * genuinely need it — see [`useTeamRoster`](../../api/hooks/useTeam.ts).
 *
 * Five cards, in the order the questions actually get asked:
 *
 *  1. **Where they stand** — including the one column a newspaper table has
 *     not got, and the reason this page is in a fantasy app at all.
 *  2. **Form** — the last five, because a table position six matchdays old says
 *     less about next Saturday than the last fortnight does.
 *  3. **The fixture ticker**, graded by how good the opponent is. The question
 *     a manager brings here is "should I buy one of these", and that question
 *     is mostly about who they play next.
 *  4. **Season facts** the table cannot show: the home/away split, the current
 *     run, clean sheets, the biggest win.
 *  5. **Who is producing the points**, which is where a scouting trail starts.
 */
export function TeamOverviewTab({
  standing,
  table,
  fixtures,
  players,
  teams,
  leagueId,
}: {
  standing: TeamStanding | undefined
  /** The whole table, for grading the ticker's opponents. */
  table: TableRow[] | undefined
  /** The club's season, ascending. */
  fixtures: TeamSeasonFixture[]
  /** The club's squad, from its profile. Empty until that request lands. */
  players: TeamSquadPlayer[]
  teams: Map<string, TeamSummary> | undefined
  leagueId: string
}) {
  const placementByTeamId = useMemo(
    () => new Map((table ?? []).map((row) => [row.teamId, row.placement])),
    [table],
  )

  const played = fixtures.filter((fixture) => teamResult(fixture) !== undefined)
  const form = played.slice(-WINDOW).reverse()
  const upcoming = fixtures
    .filter((fixture) => fixtureState(fixture) !== 'finished')
    .slice(0, WINDOW)

  return (
    <div className="flex flex-col gap-4">
      <StandingTiles standing={standing} record={teamRecord(fixtures)} />

      <FormCard
        form={form}
        teams={teams}
        leagueId={leagueId}
        streak={streakText(fixtures)}
      />

      <TickerCard
        fixtures={upcoming}
        teams={teams}
        placementByTeamId={placementByTeamId}
        tableSize={table?.length ?? 0}
        leagueId={leagueId}
      />

      <FactsCard fixtures={fixtures} teams={teams} />

      <ScorersCard players={players} leagueId={leagueId} />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Where they stand                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Four tiles, and the fourth is the one worth having.
 *
 * Placement, points and goals are a league table, available anywhere. **The
 * Kickbase-points tile is the reason this page exists in this app**: `sp` on
 * the very same table row is what that club's players have produced, and its
 * rank routinely disagrees with the club's real one. A 9th-placed side sitting
 * 3rd for fantasy points is a buy signal that no football table can express,
 * and the hint under the figure is what makes the disagreement visible without
 * a second screen.
 */
function StandingTiles({
  standing,
  record,
}: {
  standing: TeamStanding | undefined
  record: TeamRecord
}) {
  const row = standing?.row

  return (
    <div className="grid grid-cols-2 gap-2">
      <StatTile
        label="Tabellenplatz"
        value={placement(row?.placement)}
        hint={
          row === undefined
            ? undefined
            : `${String(row.matchesPlayed)} Spiele · ${delta(row.goalDifference)}`
        }
      />
      <StatTile
        label="Punkte"
        value={points(row?.points)}
        hint={`${String(record.wins)}S ${String(record.draws)}U ${String(record.losses)}N`}
      />
      <StatTile
        label="Tore"
        value={`${String(record.goalsFor)}:${String(record.goalsAgainst)}`}
        hint={
          record.played === 0
            ? undefined
            : `${(record.goalsFor / record.played).toFixed(1).replace('.', ',')} pro Spiel`
        }
      />
      <StatTile
        label="Kickbase-Punkte"
        value={points(row?.kickbasePoints)}
        // Spelled out rather than left as a bare rank: "3." beside a number
        // could be read as the club's league position, which is the one thing
        // this tile is here to *contradict*.
        hint={
          standing === undefined
            ? undefined
            : `${placement(standing.kickbasePointsRank)} von ${String(standing.size)} Klubs`
        }
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Form                                                                       */
/* -------------------------------------------------------------------------- */

const RESULT_STYLE: Record<TeamResult, string> = {
  win: 'bg-positive/20 text-positive border-positive/40',
  draw: 'bg-surface-2 text-muted border-line',
  loss: 'bg-negative/20 text-negative border-negative/40',
}

/**
 * The last five, newest first, each a tap away from its match.
 *
 * **Newest first** because that is the direction the question runs: "how are
 * they doing *now*" is answered by the left-hand end, and a strip read
 * chronologically buries the most recent result at the far edge where a phone
 * runs out of width.
 *
 * A letter *and* a colour, never colour alone — the same rule the
 * [probability badge](../squad/StartProbabilityBadge.tsx) follows, and for the
 * same reason. The score underneath keeps the strip from being a row of
 * verdicts with no evidence.
 */
function FormCard({
  form,
  teams,
  leagueId,
  streak,
}: {
  form: TeamSeasonFixture[]
  teams: Map<string, TeamSummary> | undefined
  leagueId: string
  /** `3 Siege in Folge`, from {@link streakText}. */
  streak: string | undefined
}) {
  return (
    <Card>
      <CardHeader
        title="Form"
        action={
          streak === undefined ? undefined : (
            <span className="text-xs text-muted">{streak}</span>
          )
        }
      />

      {form.length === 0 ? (
        <p className="px-4 py-5 text-center text-sm text-muted">
          Noch kein Spiel gespielt.
        </p>
      ) : (
        <ul className="no-scrollbar flex gap-2 overflow-x-auto p-3">
          {form.map((fixture) => {
            const result = teamResult(fixture) as TeamResult
            const opponent = teams?.get(fixture.opponentId)
            const label = `${String(fixture.day)}. Spieltag ${fixture.isHome ? 'gegen' : 'bei'} ${opponent?.name ?? fixture.opponentSymbol}: ${TEAM_RESULT_LABEL[result]} ${String(fixture.goalsFor ?? 0)}:${String(fixture.goalsAgainst ?? 0)}`

            return (
              <li key={fixture.matchId}>
                <Link
                  to={`/leagues/${leagueId}/matchday/${fixture.matchId}`}
                  title={label}
                  aria-label={label}
                  className="flex w-14 flex-col items-center gap-1"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold',
                      RESULT_STYLE[result],
                    )}
                  >
                    {TEAM_RESULT_LETTER[result]}
                  </span>
                  <Avatar
                    src={fixture.opponentImage}
                    name={fixture.opponentSymbol}
                    size={18}
                    square
                    className="bg-transparent"
                  />
                  <span
                    aria-hidden="true"
                    className="nums text-[0.625rem] text-muted"
                  >
                    {fixture.goalsFor ?? 0}:{fixture.goalsAgainst ?? 0}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

/** `3 Siege in Folge` — or nothing at all before a club has played. */
function streakText(fixtures: TeamSeasonFixture[]): string | undefined {
  const streak = teamStreak(fixtures)
  if (streak === undefined) return undefined

  const noun =
    streak.result === 'win'
      ? streak.length === 1
        ? 'Sieg'
        : 'Siege'
      : streak.result === 'loss'
        ? streak.length === 1
          ? 'Niederlage'
          : 'Niederlagen'
        : streak.length === 1
          ? 'Remis'
          : 'Remis'

  return streak.length === 1
    ? `Zuletzt ${noun === 'Remis' ? 'Remis' : noun}`
    : `${String(streak.length)} ${noun} in Folge`
}

/* -------------------------------------------------------------------------- */
/* Fixture ticker                                                             */
/* -------------------------------------------------------------------------- */

const DIFFICULTY_STYLE: Record<
  FixtureDifficulty,
  { dot: string; label: string }
> = {
  hard: { dot: 'bg-negative', label: 'schwer' },
  even: { dot: 'bg-warning', label: 'machbar' },
  easy: { dot: 'bg-positive', label: 'dankbar' },
}

/**
 * The next five fixtures, **graded by how good the opponent is**.
 *
 * The card this page is really for. "Heidenheim (H)" and "Bayern (A)" are the
 * same three words and completely different weeks, and the decision a manager
 * arrives with — is one of these players worth buying — is mostly a question
 * about the next month of fixtures rather than about the last one.
 *
 * The grade is the opponent's own table position, in three bands: see
 * [`fixtureDifficulty`](../../api/models.ts) for why three and not eighteen. It
 * is a crude measure and an honest one — the only strength signal the API
 * serves, and the one everybody already reads a table as.
 *
 * Colour is never the only cue: each row prints the opponent's placement beside
 * the dot, which is both the evidence for the grade and the finer answer for
 * anyone who wants it.
 */
function TickerCard({
  fixtures,
  teams,
  placementByTeamId,
  tableSize,
  leagueId,
}: {
  fixtures: TeamSeasonFixture[]
  teams: Map<string, TeamSummary> | undefined
  placementByTeamId: Map<string, number>
  tableSize: number
  leagueId: string
}) {
  return (
    <Card>
      <CardHeader title="Nächste Spiele" />

      {fixtures.length === 0 ? (
        <p className="px-4 py-5 text-center text-sm text-muted">
          Die Saison ist gespielt.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {fixtures.map((fixture) => {
            const opponent = teams?.get(fixture.opponentId)
            const opponentPlacement = placementByTeamId.get(fixture.opponentId)
            const grade = fixtureDifficulty(opponentPlacement, tableSize)
            const Venue = fixture.isHome ? House : PlaneTakeoff
            const isRunning = fixtureState(fixture) === 'running'

            return (
              <li key={fixture.matchId}>
                <Link
                  to={`/leagues/${leagueId}/matchday/${fixture.matchId}`}
                  className="flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-surface-2/60"
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

                  <span className="min-w-0 flex-1 truncate text-sm text-ink">
                    {opponent?.name ?? fixture.opponentSymbol}
                  </span>

                  {grade !== undefined && opponentPlacement !== undefined && (
                    <span
                      title={`Gegner steht auf Platz ${String(opponentPlacement)} — ${DIFFICULTY_STYLE[grade].label}`}
                      className="flex shrink-0 items-center gap-1.5"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          DIFFICULTY_STYLE[grade].dot,
                        )}
                      />
                      <span className="nums text-[0.6875rem] text-muted">
                        {placement(opponentPlacement)}
                      </span>
                    </span>
                  )}

                  <span
                    className={cn(
                      'nums w-24 shrink-0 text-right text-[0.6875rem]',
                      isRunning ? 'font-semibold text-accent' : 'text-muted',
                    )}
                  >
                    {isRunning
                      ? 'Läuft'
                      : `${weekdayDate(fixture.kickoff)} · ${time(fixture.kickoff)}`}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/* Season facts                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The four things the table has and cannot say.
 *
 * Every one of them is arithmetic over the same fixture list the rest of the
 * page runs on, and every one answers a question the standings quietly swallow:
 * a club's points column merges its home and away seasons into one number, its
 * goal difference merges goals scored with goals conceded, and neither has any
 * notion of a run or of a defence that keeps clean sheets.
 *
 * A club that has taken thirteen of its fifteen points at home is a completely
 * different proposition on the next away Saturday, and that is exactly the sort
 * of thing a fantasy manager is trying to price.
 */
function FactsCard({
  fixtures,
  teams,
}: {
  fixtures: TeamSeasonFixture[]
  teams: Map<string, TeamSummary> | undefined
}) {
  const home = teamRecord(fixtures.filter((fixture) => fixture.isHome))
  const away = teamRecord(fixtures.filter((fixture) => !fixture.isHome))
  const best = biggestWin(fixtures)
  const total = teamRecord(fixtures)

  return (
    <Card>
      <CardHeader title="Saison-Fakten" />

      <dl className="divide-y divide-line">
        <Fact
          term="Heim"
          detail={`${String(home.wins)}S ${String(home.draws)}U ${String(home.losses)}N · ${String(home.goalsFor)}:${String(home.goalsAgainst)}`}
          value={`${points(home.points)} Pkt`}
        />
        <Fact
          term="Auswärts"
          detail={`${String(away.wins)}S ${String(away.draws)}U ${String(away.losses)}N · ${String(away.goalsFor)}:${String(away.goalsAgainst)}`}
          value={`${points(away.points)} Pkt`}
        />
        <Fact
          term="Zu Null"
          detail={
            total.played === 0
              ? 'noch kein Spiel'
              : `von ${String(total.played)} Spielen`
          }
          value={points(total.cleanSheets)}
        />
        <Fact
          term="Höchster Sieg"
          detail={
            best === undefined
              ? 'noch keiner'
              : `${String(best.day)}. Spieltag ${best.isHome ? 'gegen' : 'bei'} ${teams?.get(best.opponentId)?.name ?? best.opponentSymbol}`
          }
          value={
            best === undefined
              ? '–'
              : `${String(best.goalsFor ?? 0)}:${String(best.goalsAgainst ?? 0)}`
          }
        />
      </dl>
    </Card>
  )
}

function Fact({
  term,
  detail,
  value,
}: {
  term: string
  detail: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <dt className="text-sm text-ink">{term}</dt>
        <dd className="nums truncate text-[0.6875rem] text-faint">{detail}</dd>
      </div>
      <dd className="nums shrink-0 text-sm font-semibold text-ink">{value}</dd>
    </div>
  )
}

/**
 * The win with the largest margin, ties broken by goals scored.
 *
 * A 4:0 and a 5:1 are both `+4`; the 5:1 is the more remarkable afternoon, and
 * a card that had to pick one should pick that.
 */
function biggestWin(
  fixtures: readonly TeamSeasonFixture[],
): TeamSeasonFixture | undefined {
  let best: TeamSeasonFixture | undefined
  let bestMargin = 0

  for (const fixture of fixtures) {
    if (teamResult(fixture) !== 'win') continue
    const margin = (fixture.goalsFor ?? 0) - (fixture.goalsAgainst ?? 0)
    if (
      margin > bestMargin ||
      (margin === bestMargin && (fixture.goalsFor ?? 0) > (best?.goalsFor ?? 0))
    ) {
      best = fixture
      bestMargin = margin
    }
  }

  return best
}

/* -------------------------------------------------------------------------- */
/* Who is scoring the points                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The club's five most productive players, by **points per appearance**.
 *
 * `ap` rather than a season total, and not only because the total is not on
 * this payload: the total rewards whoever has been fit longest. A substitute
 * averaging 80 and a starter averaging 78 are the same player for the purpose
 * of buying one, and in a season column they look nothing alike — while the
 * cheaper of the two is the one nobody has noticed yet, which is the whole
 * point of a scouting list.
 *
 * The market value rides alongside, because on a club page the two are read
 * together: a high average on a low value is the row worth tapping, and the
 * [Kader](./TeamSquadTab.tsx) is one tab away for the rest of the squad.
 *
 * Free — the same `teamprofile` response the Kader is built on.
 */
function ScorersCard({
  players,
  leagueId,
}: {
  players: TeamSquadPlayer[]
  leagueId: string
}) {
  const top = [...players]
    .filter((player) => player.averagePoints > 0)
    .sort(
      (a, b) =>
        b.averagePoints - a.averagePoints || b.marketValue - a.marketValue,
    )
    .slice(0, WINDOW)

  return (
    <Card>
      <CardHeader
        title="Punktesammler"
        action={
          <span className="text-[0.6875rem] text-faint">Ø pro Einsatz</span>
        }
      />

      {top.length === 0 ? (
        <p className="px-4 py-5 text-center text-sm text-muted">
          Noch hat kein Spieler dieses Klubs gepunktet.
        </p>
      ) : (
        <ol className="divide-y divide-line">
          {top.map((player, index) => (
            <li key={player.id}>
              <Link
                to={`/leagues/${leagueId}/players/${player.id}`}
                className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-surface-2/60"
              >
                <span className="nums w-4 shrink-0 text-right text-xs font-semibold text-faint">
                  {index + 1}
                </span>
                <Avatar
                  src={player.image}
                  name={player.name}
                  size={32}
                  square
                  className="shrink-0 bg-surface-2"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {player.name}
                  </p>
                  <p className="nums truncate text-[0.6875rem] text-faint">
                    {POSITION_LABEL[player.position]} ·{' '}
                    {money(player.marketValue)}
                  </p>
                </div>
                <span className="nums shrink-0 text-sm font-semibold text-ink">
                  {points(player.averagePoints)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
