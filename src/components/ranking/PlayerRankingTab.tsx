import { Trophy } from 'lucide-react'
import { Link } from 'react-router'

import type { RankingScope, TeamSummary } from '@/api/hooks/useCompetition'
import {
  ARCHIVE_LIMIT,
  type RankingSource,
} from '@/api/hooks/useMatchdayRanking'
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
 * **One list, three callers.** It is the Rangliste of
 * [Spieltag](../../pages/MatchdayPage.tsx) — for the matchday being played, and
 * for any earlier one out of the app's own archive — and the Rangliste of
 * [Saison](../../pages/SeasonPage.tsx). `scope` and `source` say which; nothing
 * else here branches on either, because the hooks hand over one shape whichever
 * side answered. This component is deliberately not the place where the sources
 * are told apart.
 *
 * **What differs is the row count, and that is on purpose.** Kickbase caps its
 * ranking at 25 and no parameter raises it; our own files hold every player who
 * scored, so an archived matchday shows 100. Padding the live list or trimming
 * the archived one to match would be inventing a consistency the data does not
 * have — so the footnote under the list says which you are reading instead.
 *
 * ## The position chips are five lists, and how they are made depends
 *
 * Live, `?position=` is a **request**: it is the only way past the 25-row cap,
 * because the cap applies per filtered list. *ABW* is then not the defenders
 * out of the overall twenty-five but the top twenty-five defenders, most of
 * whom the *Alle* list has no room for — a `.filter()` over the rows already in
 * hand would have shown four or five names and called it a ranking.
 *
 * In the archive it *is* a filter, and for the mirror-image reason: the file
 * holds every player of that matchday, so there is no cap to get past and four
 * more fetches would buy nothing.
 *
 * Live, the chips **compose with the scope**, so a season list has its own five
 * cache entries and the matchday's five are not disturbed by a trip to the
 * other page.
 *
 * **A short list is not a truncated one.** *TW* comes back with 18 rows on a
 * live nine-fixture matchday, because that is every keeper who played — the cap
 * is simply above the population. Nothing here pads it or explains it away.
 *
 * ## The badge is the point
 *
 * The right-hand slot used to carry the player's club crest, which was already
 * redundant: the club is named on the line under his name. It now carries the
 * **owning manager's avatar**, the same [`OwnerBadge`](../matchday/OwnerBadge.tsx) the
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
 * [match lineup](../matchday/MatchLineupTab.tsx) pays and it shares the same cache
 * entries, so a manager already looked at this session is free.
 *
 * It is deliberately **mounted, not gated**: this component only exists while
 * the Rangliste view is open, so the fan-out is scoped by the view existing
 * rather than by a flag somebody has to remember to pass.
 *
 * **On a matchday list the badge follows that matchday, not the calendar**,
 * which is worth saying because it is the one thing on the screen that could
 * quietly have been "now" instead: the fan-out reads `teamcenter?dayNumber=`
 * for `data.day`, the lineup *as it stood*, so a row from matchday 1 shows who
 * fielded him on matchday 1 rather than who happens to own him today.
 *
 * **On the season list it is the most recent matchday's**, which is the closest
 * thing to "now" that costs no extra request. `data.day` under `sorting=1` is
 * the endpoint's own notion of where the season has got to — probed 2026-09-07
 * it read `2` while the fixture list's `currentDay` was already `3`, so it
 * tracks the last matchday with points rather than the next one to be played,
 * which is exactly the lineup worth asking about. A season row therefore says
 * *this is whose team he was in last weekend*, not *somebody had him for the
 * goals that got him up here* — and no season-long ownership history exists in
 * the API to offer instead.
 */
export function PlayerRankingTab({
  data,
  teams,
  leagueId,
  viewerId,
  isPending,
  scope,
  source,
  position,
  onPositionChange,
}: {
  data: MatchdayTopScorers | undefined
  teams: Map<string, TeamSummary> | undefined
  leagueId: string
  viewerId: string | undefined
  isPending: boolean
  scope: RankingScope
  source: RankingSource
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
              className="flex items-stretch transition-colors hover:bg-surface-2/60"
            >
              {/* The rank is a rail, the same flush left-hand column the squad
                  row puts its shirt in — which is what lets the portrait beside
                  it butt against an edge rather than end on a cut.

                  The top three carry the accent and nothing else does. A podium
                  needs no medal glyphs to read as a podium, and three coloured
                  numbers in twenty-five stay legible where three icons would
                  just be more to look at. */}
              <span
                className={cn(
                  'nums flex w-7 shrink-0 items-center justify-center self-stretch',
                  'border-r border-line bg-surface-2/40 text-xs font-semibold',
                  rank <= 3 ? 'text-accent' : 'text-faint',
                )}
              >
                {rank}
              </span>

              {/* Flush portrait, as on the squad, market and activity rows: the
                  Kickbase cutouts are transparent PNGs, so a wash grounds the
                  figure and the inner edge is masked to dissolve into the row
                  instead of ending on a line. The figure gets the row's full
                  height, which at this width is the difference between a
                  thumbnail of a face and a player standing in the list. */}
              <span className="flex w-14 shrink-0 self-stretch">
                <Avatar
                  src={player.image}
                  name={player.lastName}
                  fill
                  className={cn(
                    'w-full self-stretch bg-transparent',
                    'bg-linear-to-t from-surface-2/60 to-transparent to-70%',
                    '[mask-image:linear-gradient(to_right,#000_65%,transparent)]',
                  )}
                />
              </span>

              <span className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 pr-3 pl-1">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {player.lastName}
                  </span>
                  <span className="block truncate text-[0.6875rem] text-faint">
                    {POSITION_LABEL[player.position]}
                    {team !== undefined && ` · ${team.name}`}
                  </span>
                </span>

                {/* Fixed width whether or not it is filled, so the scores stay
                    in a column: a badge that shifted every row it appeared on
                    would cost more than it tells. */}
                <span className="flex w-5 shrink-0 justify-center">
                  {owner !== undefined && (
                    <OwnerBadge owner={owner} size={20} />
                  )}
                </span>

                <span className="nums w-12 shrink-0 text-right text-sm font-semibold text-ink">
                  {points(player.points)}
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ol>
  )

  /*
   * Where the numbers came from, and therefore why the list is as long as it
   * is. Without it the 25 of a live matchday and the 100 of an archived one
   * look like a bug in one of them — and the archived list is our arithmetic
   * rather than Kickbase's, which a reader comparing it against the app is
   * entitled to know.
   */
  const footnote =
    data === undefined || data.players.length === 0
      ? undefined
      : source === 'archive'
        ? `Eigene Auswertung aus den Spieltagsdaten — die besten ${String(ARCHIVE_LIMIT)} je Kategorie.`
        : 'Kickbase liefert die besten 25 je Kategorie.'

  return (
    <div className="flex flex-col gap-3">
      {chips}
      {list}
      {footnote !== undefined && (
        <p className="px-0.5 text-[0.6875rem] text-faint">{footnote}</p>
      )}
    </div>
  )
}
