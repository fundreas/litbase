import { Sigma, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { useCompetitionTable } from '@/api/hooks/useCompetition'
import { useSeasonRecords } from '@/api/hooks/useMatchday'
import {
  clubStandings,
  type ClubStanding,
  type StandingsMode,
} from '@/api/models'
import { PageHeading } from '@/components/PageHeading'
import { Avatar } from '@/components/ui/Avatar'
import { PairToggle } from '@/components/ui/PairToggle'
import { PlacementChange } from '@/components/ui/PlacementChange'
import { SkeletonList } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { useActiveLeague } from '@/league/useActiveLeague'
import { cn } from '@/lib/cn'
import { points as formatPoints } from '@/lib/format'

/**
 * **Every club in the competition, as a table** — the real one, or the same
 * eighteen reordered by what their players have scored in the game.
 *
 * The two are genuinely different tables rather than one table with an extra
 * column, which is why the toggle changes the **order** and not just what is
 * shown: a side that grinds out 1:0s sits high in the Bundesliga and low in
 * Kickbase, and listing Kickbase points against league placements would bury
 * exactly that. Same reasoning as the
 * [Rangliste](RankingPage.tsx)'s duel/total switch.
 *
 * ## Scope: competition, not league
 *
 * The one page whose data is **not** league-scoped. It reads `competitionId`
 * off `useActiveLeague()`, so the cache key sits outside the
 * `['league', leagueId]` namespace and switching leagues does not drop it —
 * two leagues in the same competition share one table, which is correct.
 *
 * ## Two queries, no extra request
 *
 * The table gives the ranking, the points and the Kickbase points; it gives
 * goal **difference** only, so `14:11` and `5:2` are the same `+3` to it, and
 * no endpoint serves the split — see the probe table in
 * [the API docs](../../docs/api/competitions.md). The goals therefore come from
 * the season's fixture list, which every other page has already cached, so the
 * second query is free in practice and the column degrades to `–:–` rather than
 * to `0:0` if it is somehow not.
 */
export function TeamsPage() {
  const { leagueId, competitionId } = useActiveLeague()
  const [mode, setMode] = useState<StandingsMode>('league')

  const table = useCompetitionTable(competitionId)
  // Deliberately not gating the page: the table alone is a complete league
  // table bar one column, and blocking eighteen rows on a second query to
  // print `5:1` instead of `–:–` is the wrong trade. Its error is ignored for
  // the same reason — see `goalsFor` on `ClubStanding`.
  const records = useSeasonRecords(competitionId)

  const standings = useMemo(
    () => clubStandings(table.data, records.data, mode),
    [table.data, records.data, mode],
  )

  if (table.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeading title="Teams" />
        <SkeletonList rows={10} />
      </div>
    )
  }

  if (table.isError) {
    return (
      <ErrorState
        error={table.error}
        onRetry={() => {
          void table.refetch()
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Teams"
        subtitle={
          mode === 'league'
            ? `${String(standings.length)} Klubs · Ligatabelle`
            : `${String(standings.length)} Klubs · nach Kickbase-Punkten`
        }
        action={
          <PairToggle value={mode} onChange={setMode} options={MODE_OPTIONS} />
        }
      />

      <div className="flex flex-col gap-1">
        <ColumnHeader mode={mode} />

        <ul className="flex flex-col gap-1">
          {standings.map((club) => (
            <li key={club.teamId}>
              <ClubRow club={club} mode={mode} leagueId={leagueId} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

const MODE_OPTIONS = [
  // A trophy for the competition anyone means by "the table", a summation sign
  // for the points total — the same glyph the Rangliste already uses for
  // Kickbase points, so the notation is learned once for the whole app.
  { value: 'league', icon: Trophy, label: 'Ligatabelle' },
  { value: 'kickbase', icon: Sigma, label: 'Kickbase-Punkte' },
] as const satisfies readonly [
  { value: StandingsMode; icon: typeof Trophy; label: string },
  { value: StandingsMode; icon: typeof Trophy; label: string },
]

/**
 * The grid every row and the header share, so the columns cannot drift apart.
 *
 * One declaration per mode rather than a shared prefix plus extras: the whole
 * point is that the header and the rows are laid out by the *same* string, and
 * a template assembled from fragments is one edit away from being two
 * templates again.
 *
 * `minmax(0,1fr)` on the name column — not `1fr` — is what actually lets it
 * truncate. A bare `1fr` floors at the content's min-width, so a long club name
 * pushes the numbers off a narrow phone instead of ellipsing.
 */
const GRID: Record<StandingsMode, string> = {
  league:
    'grid grid-cols-[1.5rem_1.75rem_minmax(0,1fr)_1.5rem_2.75rem_2rem] items-center gap-x-2',
  kickbase:
    'grid grid-cols-[1.5rem_1.75rem_minmax(0,1fr)_1.5rem_3.25rem] items-center gap-x-2',
}

/**
 * What the numbers mean, once, above the list.
 *
 * Three unlabelled numeric columns on a phone are a puzzle, and repeating the
 * label in every row is the other, noisier way to solve it. Abbreviated the way
 * a printed table does it — `Sp`, `Tore`, `Pkt` — with the long form on
 * `title`, since the short forms are conventional in German football but not
 * universal.
 */
function ColumnHeader({ mode }: { mode: StandingsMode }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        GRID[mode],
        'px-3 pb-0.5 text-[0.625rem] font-medium tracking-wide text-faint uppercase',
      )}
    >
      <span className="text-center">#</span>
      <span />
      <span>Klub</span>
      <span className="text-right" title="Spiele">
        Sp
      </span>
      {mode === 'league' ? (
        <>
          <span className="text-right" title="Tore : Gegentore">
            Tore
          </span>
          <span className="text-right" title="Punkte">
            Pkt
          </span>
        </>
      ) : (
        <span className="text-right" title="Kickbase-Punkte">
          Punkte
        </span>
      )}
    </div>
  )
}

/**
 * One club — the whole row is the link to its page.
 *
 * A link around the row rather than around the name: the row is what a reader
 * aims at, and on a phone a tap target the width of a club name is a target
 * you miss. It also means the crest, the rank and the numbers all lead
 * somewhere, which is what tapping a table row is expected to do.
 */
function ClubRow({
  club,
  mode,
  leagueId,
}: {
  club: ClubStanding
  mode: StandingsMode
  leagueId: string
}) {
  return (
    <Link
      to={`/leagues/${leagueId}/teams/${club.teamId}`}
      className={cn(
        GRID[mode],
        'rounded-card border border-line bg-surface px-3 py-2 transition-colors',
        'hover:border-accent/40 hover:bg-surface-2',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
      )}
    >
      {/* Rank, and how far it moved. In Kickbase mode there is no movement to
          draw — `pcpl` is a previous *league* placement — so the mark is simply
          absent rather than borrowed from the other table. */}
      <span className="text-center">
        <span className="nums block text-sm font-bold text-faint">
          {club.rank}
        </span>
        {club.movement !== undefined && (
          <PlacementChange value={club.movement} size={10} />
        )}
      </span>

      <Avatar
        src={club.teamImage}
        name={club.teamName}
        size={26}
        square
        className="bg-transparent"
      />

      <span className="truncate text-sm font-semibold text-ink">
        {club.teamName}
      </span>

      <span className="nums text-right text-xs text-muted">
        {club.matchesPlayed}
      </span>

      {mode === 'league' ? (
        <>
          {/* The split, not the difference — which is the column the API's own
              table cannot serve, and the reason this page reads the fixture
              list at all. `–:–` while that query is in flight; never `0:0`,
              which would be a scoreline rather than an absence. */}
          <span
            className="nums text-right text-xs text-muted"
            title={`Tordifferenz ${club.goalDifference > 0 ? '+' : ''}${String(club.goalDifference)}`}
          >
            {club.goalsFor ?? '–'}:{club.goalsAgainst ?? '–'}
          </span>
          <span className="nums text-right text-sm font-bold text-ink">
            {club.points}
          </span>
        </>
      ) : (
        <span className="nums text-right text-sm font-bold text-ink">
          {formatPoints(club.kickbasePoints)}
        </span>
      )}
    </Link>
  )
}
