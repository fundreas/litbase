import { Trophy } from 'lucide-react'
import { Link } from 'react-router'

import type { TeamSummary } from '@/api/hooks/useCompetition'
import { useMatchdayLineups } from '@/api/hooks/useMatchdaySquad'
import { useRanking } from '@/api/hooks/useRanking'
import type { MatchdayTopScorers, MatchPlayerOwner } from '@/api/models'
import { POSITION_LABEL } from '@/api/models'
import { OwnerBadge } from '@/components/matchday/OwnerBadge'
import { Avatar } from '@/components/ui/Avatar'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { points } from '@/lib/format'

/**
 * The matchday's best players, best first — and **who in the league owns
 * them**.
 *
 * **One request for the list.** `/v4/competitions/{id}/players` is the only
 * bulk source of per-player matchday points in the API and it answers the top
 * 25 already sorted, so the ranking itself costs a single small response where
 * [`useMatchdayPoints`](../../api/hooks/useMatchdayPoints.ts) would have needed
 * one request per player across nine fixtures.
 *
 * **Twenty-five is the API's number, not a slice taken here.** Nothing is
 * dropped and there is no "show more" behind it: the endpoint returns exactly
 * that many and there is no known way to ask for the twenty-sixth. The heading
 * says so, because a list that stops at a round number invites the reader to
 * assume a local `.slice()` they could talk us out of.
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
 */
export function MatchdayRankingTab({
  data,
  teams,
  leagueId,
  viewerId,
  isPending,
}: {
  data: MatchdayTopScorers | undefined
  teams: Map<string, TeamSummary> | undefined
  leagueId: string
  viewerId: string | undefined
  isPending: boolean
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

  if (isPending) return <SkeletonList rows={10} />

  if (data === undefined || data.players.length === 0) {
    return (
      <EmptyState
        icon={<Trophy size={22} />}
        title="Keine Wertung"
        description="Für diesen Spieltag hat noch kein Spieler gepunktet."
      />
    )
  }

  return (
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
}
