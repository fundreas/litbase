import { Search, Store } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { useTeamDirectory, type TeamSummary } from '@/api/hooks/useCompetition'
import { SEARCH_MIN_LENGTH, usePlayerSearch } from '@/api/hooks/usePlayerSearch'
import {
  POSITION_LABEL,
  POSITION_NAME,
  type PlayerSearchResult,
} from '@/api/models'
import { PageHeading } from '@/components/PageHeading'
import { PlayerStatusBadge } from '@/components/squad/PlayerStatusBadge'
import { Avatar } from '@/components/ui/Avatar'
import { Input } from '@/components/ui/Input'
import { SkeletonList } from '@/components/ui/Skeleton'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useActiveLeague } from '@/league/useActiveLeague'
import { money } from '@/lib/format'
import { useDebouncedValue } from '@/lib/useDebouncedValue'

/**
 * How long the typing has to stop before the search is sent.
 *
 * Long enough that a name typed at speed costs one request rather than eight,
 * short enough that a reader who has stopped to read does not notice waiting.
 */
const DEBOUNCE_MS = 500

/**
 * **Find a player by name** — anywhere in the competition, owned or not.
 *
 * Reached from the magnifier in the [header](../components/layout/Header.tsx),
 * beside the avatar, rather than from the drawer: like
 * [Einstellungen](./PreferencesPage.tsx) it is a tool the reader carries from
 * page to page, not one of the league's pages, and search that lives behind a
 * navigation menu is search nobody uses.
 *
 * Every other list of players in this app is a list somebody else assembled —
 * a squad, a market, a top-25, a club's roster — and each answers a different
 * question than *where is this player*. That question had no answer at all
 * until now: a player in no squad and on no market was unreachable except by
 * knowing his id. This page is the way in, and it hands off immediately —
 * every row is a link to [his own page](./PlayerDetailPage.tsx), which is
 * where the history, the chart and the ownership detail already live.
 *
 * ## The term lives in the URL
 *
 * `?q=` carries it, written on the **settled** term rather than the keystroke
 * and with `replace`, so a search is linkable and survives a reload while the
 * back button still leaves the page instead of walking back through half a
 * name. The box is seeded from it on arrival, which is what makes a shared
 * link show its results rather than an empty field.
 *
 * ## What it does not do
 *
 * No filters, no sorting, no position chips. A name search returns a handful
 * of rows and the reader already knows which one they meant; chips over a
 * five-row list are furniture. The row carries the four things that tell two
 * players of the same name apart — club, position, value, and **who in this
 * league owns him** — and nothing else.
 */
export function PlayersPage() {
  const { leagueId, competitionId } = useActiveLeague()
  const [searchParams, setSearchParams] = useSearchParams()

  /*
   * The box is seeded from the URL once, at mount. It is not *bound* to it:
   * the URL follows the settled term below, and a field that read back from
   * the query string every render would fight the debounce.
   */
  const [draft, setDraft] = useState(() => searchParams.get('q') ?? '')
  const term = useDebouncedValue(draft.trim(), DEBOUNCE_MS)
  const isTooShort = term.length < SEARCH_MIN_LENGTH

  const search = usePlayerSearch(competitionId, leagueId, term)
  const teams = useTeamDirectory(competitionId)

  /* Rows carry `tid` and no crest, so the club is resolved against the table's
     directory — one cached request the Saison page has usually paid for
     already, and rows render without it rather than waiting. */
  const teamById = teams.data

  useEffect(() => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (term === '') next.delete('q')
        else next.set('q', term)
        return next
      },
      { replace: true },
    )
  }, [term, setSearchParams])

  /* A request is in flight, or one is about to be: the settled term has not
     caught up with the box yet. Both are the same thing to the reader — the
     answer on screen is not the answer to what they have typed. */
  const isWorking =
    search.isFetching || (draft.trim() !== term && draft.trim() !== '')

  const results = isTooShort ? undefined : search.data

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Spieler suchen"
        subtitle="Jeder Spieler der Liga — mit Marktwert und Besitzer."
      />

      <Input
        label="Name"
        type="search"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
        }}
        placeholder="z. B. Kane"
        autoFocus
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        trailing={
          <span className="flex h-11 w-11 items-center justify-center text-faint">
            {isWorking ? <Spinner size={18} /> : <Search size={18} />}
          </span>
        }
      />

      {isTooShort ? (
        <EmptyState
          icon={<Search size={22} />}
          title="Nach einem Spieler suchen"
          description={`Ab ${String(SEARCH_MIN_LENGTH)} Buchstaben wird gesucht — die Suche startet von allein.`}
        />
      ) : search.isError ? (
        <ErrorState
          error={search.error}
          onRetry={() => {
            void search.refetch()
          }}
        />
      ) : results === undefined ? (
        <SkeletonList rows={5} />
      ) : results.length === 0 ? (
        <EmptyState
          icon={<Search size={22} />}
          title={`Keine Treffer für „${term}“`}
          description="Kickbase sucht nach dem Nachnamen — vielleicht ist er anders geschrieben."
        />
      ) : (
        <ResultList
          results={results}
          leagueId={leagueId}
          teamById={teamById}
          term={term}
        />
      )}
    </div>
  )
}

function ResultList({
  results,
  leagueId,
  teamById,
  term,
}: {
  results: PlayerSearchResult[]
  leagueId: string
  teamById: Map<string, TeamSummary> | undefined
  term: string
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <p className="px-0.5 text-[0.6875rem] text-faint">
        <span className="nums font-semibold text-muted">{results.length}</span>{' '}
        Treffer für „{term}“
      </p>

      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {results.map((player) => (
          <li key={player.id}>
            <ResultRow
              player={player}
              leagueId={leagueId}
              team={
                player.teamId === undefined
                  ? undefined
                  : teamById?.get(player.teamId)
              }
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * One hit: portrait, name over club and position, and the money.
 *
 * **The owner is a name, not a badge.** Every other list in the app draws an
 * [`OwnerBadge`](../components/matchday/OwnerBadge.tsx) here, and this row
 * cannot: the search payload carries the manager's *name* and neither their id
 * nor their avatar, so there is nothing to draw and nowhere to link. Saying
 * *Frei* for the rest is the half worth having anyway — on a scouting list the
 * first question about a player one has just found is whether he can be had.
 */
function ResultRow({
  player,
  leagueId,
  team,
}: {
  player: PlayerSearchResult
  leagueId: string
  team: TeamSummary | undefined
}) {
  return (
    <Link
      to={`/leagues/${leagueId}/players/${player.id}`}
      className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-surface-2/60"
    >
      <Avatar
        src={player.image}
        name={player.name}
        size={36}
        square
        className="shrink-0 bg-surface-2"
      />

      <div className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-sm font-medium text-ink">
            {player.name}
          </span>
          {/* No `stxt` on this payload, so the badge words itself from the
              code — the same fallback a club's Kader relies on. */}
          <PlayerStatusBadge status={player.availability} size={13} />
          {player.isListed && (
            <Store
              size={12}
              className="shrink-0 text-accent"
              aria-label="Auf dem Transfermarkt"
            />
          )}
        </span>

        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted">
          {team !== undefined && (
            <Avatar
              src={team.image}
              name={team.name}
              size={14}
              square
              className="bg-transparent"
            />
          )}
          {player.position !== undefined && (
            <span title={POSITION_NAME[player.position]}>
              {POSITION_LABEL[player.position]}
            </span>
          )}
          <span className="truncate">
            {player.owner === undefined ? 'Frei' : `Gehört ${player.owner}`}
          </span>
        </span>
      </div>

      <span className="nums shrink-0 text-sm font-semibold text-ink">
        {money(player.marketValue)}
      </span>
    </Link>
  )
}
