import {
  Search,
  Store,
  TrendingDown,
  TrendingUp,
  UserRound,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { useTeamDirectory, type TeamSummary } from '@/api/hooks/useCompetition'
import { useLeagueDetails } from '@/api/hooks/useLeague'
import { useMarketValueChanges } from '@/api/hooks/useMarketValueChanges'
import { SEARCH_MIN_LENGTH, usePlayerSearch } from '@/api/hooks/usePlayerSearch'
import {
  POSITION_LABEL,
  POSITION_NAME,
  type MatchPlayerOwner,
  type PlayerSearchResult,
} from '@/api/models'
import { useAuth } from '@/auth/useAuth'
import { OwnerBadge } from '@/components/matchday/OwnerBadge'
import { PlayerStatusBadge } from '@/components/squad/PlayerStatusBadge'
import { Avatar } from '@/components/ui/Avatar'
import { Input } from '@/components/ui/Input'
import { SkeletonList } from '@/components/ui/Skeleton'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useActiveLeague } from '@/league/useActiveLeague'
import { cn } from '@/lib/cn'
import { money, moneyDelta } from '@/lib/format'
import { useDebouncedValue } from '@/lib/useDebouncedValue'

/**
 * How long the typing has to stop before the search is sent.
 *
 * Long enough that a name typed at speed costs one request rather than eight,
 * short enough that a reader who has stopped to read does not notice waiting.
 */
const DEBOUNCE_MS = 500

/**
 * How many rows get their overnight market-value move looked up.
 *
 * The figure is `tfhmvt` and it lives **only on a player's own detail**, so
 * every one of them is a request — see
 * [`useMarketValueChanges`](../api/hooks/useMarketValueChanges.ts). A market
 * page can afford that because a market is twenty listings; a two-letter
 * search term is not bounded by anything, and the day it matches a hundred
 * players is the day this page fires a hundred requests per keystroke that
 * settles.
 *
 * Twenty-five is the top of the list, which is the part anybody reads — the
 * rows below simply show no second line, exactly as a row whose lookup has
 * not landed yet does.
 */
const MAX_CHANGE_LOOKUPS = 25

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
 * No filters, no sorting, no position chips, and **no page heading**: a name
 * search returns a handful of rows, the reader already knows which one they
 * meant, and a title over a search box is a line of type between the tap that
 * opened the page and the keyboard. The field is at the top, the results are
 * under it, and the row carries what tells two players of the same name
 * apart — club, position, value and its overnight move, and **whose he is** —
 * and nothing else.
 *
 * ## Two lookups the search cannot answer itself
 *
 * The payload is thin, so two things on the row come from elsewhere: the
 * owner's **face**, joined by name against the league's member list (one
 * cached request, the [Liga page](./LeaguePage.tsx)'s), and the **24-hour
 * market-value move**, which exists only on a player's own detail and is
 * therefore a request per row — capped at {@link MAX_CHANGE_LOOKUPS}.
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
  const league = useLeagueDetails(leagueId)
  const { user } = useAuth()

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

  /*
   * The overnight move, for the top of the list — one request per player and
   * none of them bulk, which is what {@link MAX_CHANGE_LOOKUPS} is about. The
   * slice is memoised so the hook's `useQueries` is not handed a new array on
   * every keystroke.
   */
  const lookedUp = useMemo(
    () => (results ?? []).slice(0, MAX_CHANGE_LOOKUPS),
    [results],
  )
  const changes = useMarketValueChanges(leagueId, lookedUp)

  /*
   * Managers by name, because a search row identifies its owner by **name and
   * nothing else** — no id, no avatar. The league's own member list has all
   * three, so the name is the join, and `undefined` (a renamed manager, a
   * member list still loading) costs the face and not the row.
   *
   * Lower-cased on both sides: the two lists come from different endpoints
   * and there is no promise they agree on capitalisation.
   */
  const managersByName = useMemo(() => {
    const byName = new Map<
      string,
      { id: string; name?: string; image?: string }
    >()
    for (const member of league.data?.members ?? []) {
      if (member.name !== undefined)
        byName.set(member.name.toLowerCase(), member)
    }
    return byName
  }, [league.data])

  return (
    <div className="flex flex-col gap-4">
      {/* No page heading. The field is the whole page, and a title over a
          search box says what the reader has just tapped a magnifier to do —
          a line of type between the tap and the keyboard. The label stays for
          screen readers, which have no magnifier to have tapped. */}
      <Input
        label="Spieler suchen"
        hideLabel
        type="search"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
        }}
        placeholder="Name, z. B. Kane"
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
          managersByName={managersByName}
          changes={changes}
          viewerId={user?.id}
          term={term}
        />
      )}
    </div>
  )
}

interface LeagueMember {
  id: string
  name?: string
  image?: string
}

function ResultList({
  results,
  leagueId,
  teamById,
  managersByName,
  changes,
  viewerId,
  term,
}: {
  results: PlayerSearchResult[]
  leagueId: string
  teamById: Map<string, TeamSummary> | undefined
  managersByName: Map<string, LeagueMember>
  /** The overnight move per player id, for as far as the lookups reach. */
  changes: Map<string, number>
  viewerId: string | undefined
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
              owner={toOwner(player.owner, managersByName, viewerId)}
              change={changes.get(player.id)}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * The owning manager, as the badge every other list in the app draws — built
 * out of a **name** and the league's member list.
 *
 * The search payload names the owner and gives neither an id nor an avatar,
 * so the face has to be looked up. When the lookup misses, the badge is still
 * drawn: {@link Avatar} falls back to initials, and a circle with the right
 * two letters and the right tooltip is a better answer than an empty column.
 * The id is then the name, which nothing on this page reads — the badge is
 * not a link, because a row is already one.
 *
 * `source: 'currentOwner'` is the honest claim: `onm` is who holds him
 * **today**, which is exactly what [`ownerLabel`](../components/matchday/ownerLabel.ts)
 * words as *Gehört X*.
 */
function toOwner(
  name: string | undefined,
  managersByName: Map<string, LeagueMember>,
  viewerId: string | undefined,
): MatchPlayerOwner | undefined {
  if (name === undefined) return undefined
  const member = managersByName.get(name.toLowerCase())

  return {
    id: member?.id ?? name,
    name: member?.name ?? name,
    image: member?.image,
    isViewer: member !== undefined && member.id === viewerId,
    source: 'currentOwner',
    wasFielded: false,
  }
}

/**
 * One hit: portrait, name over club and position, then **whose he is** and
 * what he costs.
 *
 * **The owner is a face, in a column of its own.** It was a *Gehört X* on the
 * second line, which is the one thing on the row that does not fit there: a
 * long manager name pushed the club and the position out of a line that is
 * supposed to identify the player, and it read as a sentence where every
 * other list in this app shows a portrait. As an
 * [`OwnerBadge`](../components/matchday/OwnerBadge.tsx) at the right-hand
 * end, a column of faces answers *what is still free here* in one sweep —
 * which is what a scouting list is scanned for — and the reader's own players
 * carry the accent ring they carry everywhere else. A player nobody holds
 * keeps the column's width with a **dashed outline**, so *frei* is a shape
 * rather than a missing thing.
 *
 * **Under the market value is the overnight move**, the same 24-hour figure
 * and the same treatment as a market row's, because a value without its
 * direction is half a fact on a page about finding somebody to buy. It costs
 * a request per player, which is why only the top {@link MAX_CHANGE_LOOKUPS}
 * rows have one and a row without it simply shows nothing.
 */
function ResultRow({
  player,
  leagueId,
  team,
  owner,
  change,
}: {
  player: PlayerSearchResult
  leagueId: string
  team: TeamSummary | undefined
  /** The manager holding him, already resolved against the member list. */
  owner: MatchPlayerOwner | undefined
  /** His move over the last 24 hours; `undefined` until (or unless) it lands. */
  change: number | undefined
}) {
  const ChangeIcon =
    change !== undefined && change < 0 ? TrendingDown : TrendingUp

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
            <span className="truncate" title={POSITION_NAME[player.position]}>
              {POSITION_LABEL[player.position]}
            </span>
          )}
        </span>
      </div>

      {/* Whose he is, between the name and the money — the order a scouting
          list is read in: who, then whether he can be had, then for how
          much. */}
      {owner === undefined ? (
        <span
          role="img"
          aria-label="Frei — niemand in dieser Liga besitzt ihn"
          title="Frei — niemand in dieser Liga besitzt ihn"
          className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-dashed border-line text-faint"
        >
          <UserRound size={12} aria-hidden="true" />
        </span>
      ) : (
        <OwnerBadge owner={owner} size={22} />
      )}

      <span className="w-[5.5rem] shrink-0 text-right">
        <span className="nums block text-sm font-semibold text-ink">
          {money(player.marketValue)}
        </span>

        {/* The overnight move, drawn as the market draws it: the arrow says
            the same thing as the sign, so the two cannot contradict each
            other, and a flat day gets the figure without one. Absent — the
            lookup has not landed, or this row is past the cap — the line is
            left out rather than filled with a dash, which on a list this
            short would read as "no change". */}
        {change !== undefined && (
          <span
            title="Marktwertänderung in den letzten 24 Stunden"
            className={cn(
              'nums flex items-center justify-end gap-0.5 text-[0.6875rem] whitespace-nowrap',
              change > 0 && 'text-positive',
              change < 0 && 'text-negative',
              change === 0 && 'text-faint',
            )}
          >
            {change !== 0 && (
              <ChangeIcon size={11} aria-hidden="true" className="shrink-0" />
            )}
            {moneyDelta(change)}
            <span className="sr-only"> in den letzten 24 Stunden</span>
          </span>
        )}
      </span>
    </Link>
  )
}
