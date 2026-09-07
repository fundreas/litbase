import { Trophy } from 'lucide-react'
import { Link } from 'react-router'

import type { RankingScope, TeamSummary } from '@/api/hooks/useCompetition'
import { useMatchdayLineups } from '@/api/hooks/useMatchdaySquad'
import { useRanking } from '@/api/hooks/useRanking'
import type {
  MatchdayTopScorers,
  MatchPlayerOwner,
  PositionKey,
} from '@/api/models'
import { POSITION_LABEL, POSITION_NAME } from '@/api/models'
import { OwnerBadge } from '@/components/matchday/OwnerBadge'
import { Avatar } from '@/components/ui/Avatar'
import { FilterChip } from '@/components/ui/FilterChip'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { points } from '@/lib/format'

/**
 * The chip row, left to right. `undefined` is *Alle* — the unfiltered call —
 * and the four that follow are in the order a lineup is read in, which is the
 * order they appear in everywhere else in the app.
 */
const FILTERS: { key: PositionKey | undefined; label: string }[] = [
  { key: undefined, label: 'Alle' },
  { key: 'gk', label: POSITION_LABEL.gk },
  { key: 'def', label: POSITION_LABEL.def },
  { key: 'mid', label: POSITION_LABEL.mid },
  { key: 'fwd', label: POSITION_LABEL.fwd },
]

/**
 * The competition's best players, best first — and **who in the league owns
 * them**.
 *
 * Of one matchday or of the whole season: `scope` says which, and the toggle
 * that sets it stands where the [page's](../../pages/MatchdayPage.tsx) heading
 * used to. Everything below is identical either way, because the endpoint
 * answers both in the same shape.
 *
 * **One request for the list.** `/v4/competitions/{id}/players` is the only
 * bulk source of per-player matchday points in the API and it answers the top
 * 25 already sorted, so the ranking itself costs a single small response where
 * [`useMatchdayPoints`](../../api/hooks/useMatchdayPoints.ts) would have needed
 * one request per player across nine fixtures.
 *
 * **Twenty-five is the API's number, not a slice taken here.** Nothing is
 * dropped and there is no "show more" behind it: the endpoint returns exactly
 * that many, and no parameter raises the cap.
 *
 * ## The position chips are five requests, not one filter
 *
 * `?position=` is one of the two parameters the endpoint honours, and the cap
 * applies to **each filtered list separately**. So *ABW* is not the defenders
 * out of the overall twenty-five — it is the top twenty-five defenders, most of
 * whom the *Alle* list has no room for. Between them the five chips reach 93
 * distinct players, and they compose with the scope: ten lists in all.
 *
 * That is why this is not a `.filter()` over the list already in hand, which
 * would have been free and would have shown four or five names per position.
 * It costs one request per chip, cached per chip, so a filter looked at once
 * comes straight back.
 *
 * **A short list is not a truncated one.** *TW* comes back with 18 rows on a
 * nine-fixture matchday, because that is every keeper who played — the cap is
 * simply above the population. Nothing here pads it or explains it away.
 *
 * ## The badge is the point
 *
 * The right-hand slot used to carry the player's club crest, which was already
 * redundant: the club is named on the line under his name. It now carries the
 * **owning manager's avatar**, the same [`OwnerBadge`](./OwnerBadge.tsx) the
 * match lineup uses, and that turns a list of strangers into a list about the
 * league — *these two in the top ten are somebody's, and one of them is mine.*
 * The viewer's own players take the accent ring; a manager who owned a player
 * and left him out is drawn faded, which on this screen is its own small story.
 *
 * **An unowned player gets nothing there**, not a crest fallback. Mixing two
 * kinds of thing in one column would make the column mean "either a club or a
 * manager", and then it would take a moment's reading to tell which — where an
 * empty slot reads instantly as "nobody has him". In most leagues that will be
 * most of the twenty-five, which is exactly what makes the filled ones worth
 * looking at.
 *
 * ## What ownership costs
 *
 * The league standings (one cached request, shared with every page that names
 * a manager) plus the [matchday-lineup fan-out](../../api/hooks/useMatchdaySquad.ts)
 * — one request per manager. That is the same fan-out the
 * [match lineup](./MatchLineupTab.tsx) pays and it shares the same cache
 * entries, so a manager already looked at this session is free.
 *
 * It is deliberately **mounted, not gated**: this component only exists while
 * the Rangliste view is open, so the fan-out is scoped by the view existing
 * rather than by a flag somebody has to remember to pass.
 *
 * **The badge means the same thing in the season list**, and it is worth being
 * clear about what that is: ownership is read for the *current* matchday, so a
 * season row says "somebody has him now", not "somebody had him for the goals
 * that got him up here". The current holder is the useful reading — it is the
 * one that tells you whose bench a season-long scorer is sitting on — and the
 * API has no per-matchday ownership history to offer instead.
 */
export function MatchdayRankingTab({
  data,
  teams,
  leagueId,
  viewerId,
  isPending,
  scope,
  position,
  onPositionChange,
}: {
  data: MatchdayTopScorers | undefined
  teams: Map<string, TeamSummary> | undefined
  leagueId: string
  viewerId: string | undefined
  isPending: boolean
  scope: RankingScope
  position: PositionKey | undefined
  onPositionChange: (position: PositionKey | undefined) => void
}) {
  /*
   * Ownership is asked one manager at a time — there is no bulk source, see
   * `useMatchdayLineups`. The standings are fetched for the names and avatars
   * the badge needs anyway, so they add no request beyond the fan-out they
   * feed.
   *
   * `data?.day` rather than the season schedule's current matchday: ownership
   * has to be read for the matchday these *points* are from, and the list is
   * the only thing that knows which that is.
   */
  const standings = useRanking(leagueId)
  const managers = standings.data?.managers ?? []
  const lineups = useMatchdayLineups(
    leagueId,
    data?.day,
    managers.map((manager) => manager.id),
  )

  const managerById = new Map(managers.map((manager) => [manager.id, manager]))

  const ownerOf = (playerId: string): MatchPlayerOwner | undefined => {
    const onTheDay = lineups.byPlayerId.get(playerId)
    if (onTheDay === undefined) return undefined

    // A manager the standings do not list gets no badge rather than one
    // reading a raw id — the same rule the match lineup applies.
    const manager = managerById.get(onTheDay.managerId)
    if (manager === undefined) return undefined

    return {
      id: manager.id,
      name: manager.name,
      image: manager.image,
      isViewer: manager.id === viewerId,
      source: 'matchdayLineup',
      wasFielded: onTheDay.wasFielded,
    }
  }

  /*
   * The chips render above whatever the list is doing — skeleton, empty state
   * or rows. Returning early past them would make the control disappear on the
   * tap that changes it and come back when the request lands, which reads as
   * the page having lost the filter rather than as it fetching one.
   */
  const chips = (
    <div
      className="no-scrollbar flex gap-2 overflow-x-auto"
      role="group"
      aria-label="Position"
    >
      {FILTERS.map((filter) => (
        <FilterChip
          key={filter.key ?? 'all'}
          isActive={position === filter.key}
          onClick={() => {
            onPositionChange(filter.key)
          }}
        >
          {filter.label}
        </FilterChip>
      ))}
    </div>
  )

  const list = isPending ? (
    <SkeletonList rows={10} />
  ) : data === undefined || data.players.length === 0 ? (
    <EmptyState
      icon={<Trophy size={22} />}
      title="Keine Wertung"
      description={`${scope === 'season' ? 'In dieser Saison' : 'Für diesen Spieltag'} hat noch ${position === undefined ? 'kein Spieler' : `kein ${POSITION_NAME[position]}`} gepunktet.`}
    />
  ) : (
    <ol className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {data.players.map((player, index) => {
        const team = teams?.get(player.teamId)
        const owner = ownerOf(player.id)
        const rank = index + 1

        return (
          <li key={player.id}>
            <Link
              to={`/leagues/${leagueId}/players/${player.id}`}
              className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-surface-2/60"
            >
              {/* The top three carry the accent and nothing else does. A
                  podium needs no medal glyphs to read as a podium, and three
                  coloured rows in twenty-five stay legible where three icons
                  would just be more to look at. */}
              <span
                className={cn(
                  'nums w-5 shrink-0 text-right text-xs font-semibold',
                  rank <= 3 ? 'text-accent' : 'text-faint',
                )}
              >
                {rank}
              </span>

              <Avatar
                src={player.image}
                name={player.lastName}
                size={32}
                square
                className="shrink-0 bg-surface-2"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {player.lastName}
                </p>
                <p className="truncate text-[0.6875rem] text-faint">
                  {POSITION_LABEL[player.position]}
                  {team !== undefined && ` · ${team.name}`}
                </p>
              </div>

              {/* Fixed width whether or not it is filled, so the scores stay in
                  a column: a badge that shifted every row it appeared on would
                  cost more than it tells. */}
              <span className="flex w-5 shrink-0 justify-center">
                {owner !== undefined && <OwnerBadge owner={owner} size={20} />}
              </span>

              <p className="nums w-12 shrink-0 text-right text-sm font-semibold text-ink">
                {points(player.points)}
              </p>
            </Link>
          </li>
        )
      })}
    </ol>
  )

  return (
    <div className="flex flex-col gap-3">
      {chips}
      {list}
    </div>
  )
}
