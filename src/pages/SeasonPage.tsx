import { ListOrdered, Sigma, Table2, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'

import {
  useCompetitionPlayers,
  useCompetitionTable,
  useTeamDirectory,
} from '@/api/hooks/useCompetition'
import { useSeasonRecords } from '@/api/hooks/useMatchday'
import {
  clubStandings,
  POSITION_LABEL,
  type ClubStanding,
  type PositionKey,
  type StandingsMode,
} from '@/api/models'
import { PageHeading } from '@/components/PageHeading'
import { PlayerRankingTab } from '@/components/ranking/PlayerRankingTab'
import { Avatar } from '@/components/ui/Avatar'
import { BottomTabBar, type BottomTab } from '@/components/ui/BottomTabBar'
import { PairToggle } from '@/components/ui/PairToggle'
import { PlacementChange } from '@/components/ui/PlacementChange'
import { SkeletonList } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { useAuth } from '@/auth/useAuth'
import { useActiveLeague } from '@/league/useActiveLeague'
import { cn } from '@/lib/cn'
import { points as formatPoints } from '@/lib/format'

/** The page's two views, and the URL segment each one is reached by. */
const VIEWS = { table: 'teams', ranking: 'ranking' } as const
type ViewValue = (typeof VIEWS)[keyof typeof VIEWS]

/**
 * `?pos=` → the position the ranking is filtered to. The same parameter, the
 * same spelling and the same fallback as on the
 * [matchday page](./MatchdayPage.tsx): the two rankings are the same list of
 * the same kind of thing, and a reader who learns one URL should not find the
 * other spelled differently.
 */
function toRankingPosition(raw: string | null): PositionKey | undefined {
  return raw !== null && raw in POSITION_LABEL
    ? (raw as PositionKey)
    : undefined
}

/**
 * **The season so far** — the eighteen clubs, and the players who have scored
 * the most across all of it.
 *
 * Two answers to "how is the season going", which is why they are one page:
 * *Tabelle* is the clubs, *Rangliste* is the players. Neither is about a single
 * matchday, which is the whole distinction from
 * [Spieltag](./MatchdayPage.tsx) — that page is one weekend, this one is
 * everything up to now.
 *
 * > It was called **Teams** and was the table alone. The season ranking briefly
 * > lived on the matchday page as a *Saison* toggle, which was the wrong home:
 * > a screen built around one selected matchday should not also answer a
 * > question that has nothing to do with which matchday you picked. Here it has
 * > a sibling that shares its scope.
 *
 * ## Scope: competition, not league
 *
 * The one page whose data is **not** league-scoped. It reads `competitionId`
 * off `useActiveLeague()`, so the cache keys sit outside the
 * `['league', leagueId]` namespace and switching leagues does not drop them —
 * two leagues in the same competition share one table and one ranking, which is
 * correct.
 *
 * The **owner badges** on the ranking are the exception, and are league-scoped
 * as they must be: who owns Kimmich is a fact about your league, not about the
 * Bundesliga.
 *
 * ## The view is a path segment
 *
 * `/teams` and `/teams/ranking`, as on the squad, duel-detail and matchday
 * pages, so each is linkable and survives a refresh. The path stayed `/teams`
 * when the page was renamed because the **club page lives under it** —
 * `/teams/:teamId`, reached by tapping a row — and moving the parent would have
 * meant either orphaning the child or rewriting every crest link in the app for
 * a word in the drawer.
 */
export function SeasonPage() {
  const { leagueId, competitionId } = useActiveLeague()
  const { user } = useAuth()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const view: ViewValue = location.pathname.endsWith(`/${VIEWS.ranking}`)
    ? VIEWS.ranking
    : VIEWS.table

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

  /*
   * The ranking is requested only on the view that shows it — the Tabelle is
   * the page's front door and should not pay for a list it never renders.
   * Passing `undefined` leaves the hook idle, the same way every hook in the
   * app waits for its id.
   *
   * `isLive` is not passed: a season total does move while a matchday runs, but
   * this is not the screen anyone watches it move on. Polling here would be a
   * request every ten seconds for a number nobody is staring at.
   */
  const rankingPosition = toRankingPosition(searchParams.get('pos'))
  const rankingId = view === VIEWS.ranking ? competitionId : undefined
  const ranking = useCompetitionPlayers(rankingId, {
    scope: 'season',
    position: rankingPosition,
  })
  // Club names for the ranking's second line. The same cache entry the table
  // above reads, so it costs nothing on a page that already has it.
  const teams = useTeamDirectory(rankingId)

  const base = `/leagues/${leagueId}/${VIEWS.table}`
  // `?pos=` rides along, so switching to the table and back keeps the filter.
  const suffix =
    rankingPosition === undefined ? '' : `?pos=${String(rankingPosition)}`
  const tabs: BottomTab[] = [
    { value: VIEWS.table, label: 'Tabelle', icon: Table2, to: base },
    {
      value: VIEWS.ranking,
      label: 'Rangliste',
      icon: ListOrdered,
      to: `${base}/${VIEWS.ranking}${suffix}`,
    },
  ]

  /*
   * The table's own states gate the **table view only**. The ranking reads the
   * same query for its club names, but degrades to a name-less second line if
   * it fails — so letting a table error take the ranking down with it would
   * cost a whole working list to avoid one missing word per row.
   */
  if (view === VIEWS.table && table.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeading title="Saison" />
        <SkeletonList rows={10} />
        <BottomTabBar tabs={tabs} active={view} ariaLabel="Saisonansicht" />
      </div>
    )
  }

  if (view === VIEWS.table && table.isError) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeading title="Saison" />
        <ErrorState
          error={table.error}
          onRetry={() => {
            void table.refetch()
          }}
        />
        <BottomTabBar tabs={tabs} active={view} ariaLabel="Saisonansicht" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Saison"
        subtitle={
          view === VIEWS.ranking
            ? 'Die besten Spieler der Saison'
            : mode === 'league'
              ? `${String(standings.length)} Klubs · Ligatabelle`
              : `${String(standings.length)} Klubs · nach Kickbase-Punkten`
        }
        action={
          // The league/Kickbase switch belongs to the table and nothing else,
          // so it is absent on the ranking rather than sitting there inert.
          view === VIEWS.table ? (
            <PairToggle
              value={mode}
              onChange={setMode}
              options={MODE_OPTIONS}
            />
          ) : undefined
        }
      />

      {view === VIEWS.ranking ? (
        ranking.isError ? (
          <ErrorState
            error={ranking.error}
            onRetry={() => {
              void ranking.refetch()
            }}
          />
        ) : (
          <PlayerRankingTab
            data={ranking.data}
            teams={teams.data}
            leagueId={leagueId}
            viewerId={user?.id}
            isPending={ranking.isPending}
            scope="season"
            source="live"
            position={rankingPosition}
            onPositionChange={(next) => {
              const params = new URLSearchParams(searchParams)
              if (next === undefined) params.delete('pos')
              else params.set('pos', next)
              // `replace` keeps the back button meaning "leave the page" rather
              // than walking back through every chip that was tapped.
              setSearchParams(params, { replace: true })
            }}
          />
        )
      ) : (
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
      )}

      <BottomTabBar tabs={tabs} active={view} ariaLabel="Saisonansicht" />
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
