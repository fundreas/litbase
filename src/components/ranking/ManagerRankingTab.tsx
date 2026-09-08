import { ListOrdered } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'

import { duelResultOf } from '@/api/hooks/useRanking'
import {
  duelIdOf,
  type DuelResult,
  type MatchdayStandings,
  type RankedManager,
} from '@/api/models'
import { DuelOutcomeLine } from '@/components/ranking/DuelOutcomeLine'
import { Avatar } from '@/components/ui/Avatar'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { placement, points } from '@/lib/format'

/**
 * **Every manager of the league, ranked by what they scored on one matchday.**
 *
 * The counterpart of [`PlayerRankingTab`](./PlayerRankingTab.tsx): that one
 * ranks the competition's *players* for a matchday, this one ranks the
 * league's *managers* for it. Between them they answer the two questions a
 * played matchday raises — "who scored" and "who won the weekend".
 *
 * Not the same table as the [season standings](../../pages/RankingPage.tsx),
 * and deliberately so. That page is the league as it stands, cumulative and
 * duel-table-ordered; this is one matchday in isolation, which is the reading
 * the [duels page](../../pages/DuelsPage.tsx) is already about — its other tab
 * shows the same managers paired off for the same day.
 *
 * **The row is the duel.** In a duel league every manager has an opponent for
 * the matchday, so each row names them, says how the duel went, and links to
 * [that duel in detail](../../pages/DuelDetailPage.tsx) — the id is rebuilt
 * from the pair with {@link duelIdOf}, the same string the pairing mapper
 * produces, so no lookup table is needed. A manager without an opponent (an
 * odd-sized league) is a plain row: there is nothing to open.
 *
 * **The outcome is only claimed once the matchday is over.** *Gewonnen* is
 * past tense and a duel under way has not been won by anybody — level at `0`
 * in the third minute would read as *Remis*, which is the one thing it is not.
 * While a matchday runs the row names the opponent and stops there; who is
 * ahead is what the list's own order says.
 *
 * ## The placement is Kickbase's where there is one
 *
 * `mdpl` is the API's own placement for the matchday, and it is preferred over
 * counting rows so that two managers level on points share a place instead of
 * being told apart by the sort. It reads `0` for a matchday nobody has scored
 * in yet — early in a live matchday, most of all — and the row index stands in
 * then, which keeps a ranking of zeroes numbered `1…10` rather than `0…0`.
 */
export function ManagerRankingTab({
  standings,
  leagueId,
  viewerId,
  isFinished,
  isPending,
}: {
  standings: MatchdayStandings | undefined
  leagueId: string
  viewerId: string | undefined
  /** Is the matchday played out? Gates the duel outcome — see above. */
  isFinished: boolean
  isPending: boolean
}) {
  // Duel outcomes are resolved against the opponent named in `hhoui`, so the
  // whole field has to be addressable by id — exactly as on the season table.
  const byId = useMemo(
    () =>
      new Map(
        (standings?.managers ?? []).map((manager) => [manager.id, manager]),
      ),
    [standings],
  )

  if (isPending) return <SkeletonList rows={10} />

  const managers = standings?.managers ?? []

  if (managers.length === 0) {
    return (
      <EmptyState
        icon={<ListOrdered size={22} />}
        title="Keine Wertung"
        description="Für diesen Spieltag liefert Kickbase keine Punkte."
      />
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {managers.map((manager, index) => (
        <ManagerRow
          key={manager.id}
          manager={manager}
          rank={
            manager.matchdayPlacement > 0
              ? manager.matchdayPlacement
              : index + 1
          }
          isMe={manager.id === viewerId}
          duelResult={
            standings?.isDuelMode === true && isFinished
              ? duelResultOf(manager, byId)
              : undefined
          }
          opponent={
            manager.duelOpponentId === undefined
              ? undefined
              : byId.get(manager.duelOpponentId)
          }
          leagueId={leagueId}
          day={standings?.day}
        />
      ))}
    </ul>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * One manager's matchday — **two destinations in one row.**
 *
 * The row used to be a single link to the duel, which was right while the duel
 * was the only thing behind it. Now that a manager has
 * [a page of their own](../../pages/ManagerDetailPage.tsx) there are two things
 * a reader could mean by tapping here, and nested links are not HTML — so the
 * row splits along the line the layout already drew:
 *
 *  - **the manager** — placement, face, name, outcome — opens the manager, with
 *    the matchday riding along, so their eleven for *this* day is what comes up;
 *  - **the figures** — the points and the duel points they earned — open
 *    [the duel](../../pages/DuelDetailPage.tsx) those numbers were scored in.
 *
 * Both targets clear the 44px minimum, and each sits under what it is about,
 * which is the only way two targets in one row can be guessed rather than
 * learned. Without an opponent (an odd-sized league) the second half is not a
 * link: there is no duel to open.
 */
function ManagerRow({
  manager,
  rank,
  isMe,
  duelResult,
  opponent,
  leagueId,
  day,
}: {
  manager: RankedManager
  rank: number
  isMe: boolean
  duelResult: DuelResult | undefined
  opponent: RankedManager | undefined
  leagueId: string
  day: number | undefined
}) {
  const dayQuery = `?day=${String(day ?? '')}`
  const managerTo = `/leagues/${leagueId}/managers/${manager.id}${dayQuery}`
  const duelTo =
    opponent === undefined
      ? undefined
      : `/leagues/${leagueId}/duels/${duelIdOf(manager.id, opponent.id)}${dayQuery}`

  /* The matchday's points are the headline — that is what the list is ranked
     by — with the duel points they earned under it, where the league awards
     any. */
  const figures = (
    <>
      <span className="nums block text-sm font-semibold text-ink">
        {points(manager.matchdayPoints)}
      </span>
      <span className="nums block text-xs text-muted">
        {manager.duelMatchdayPoints === undefined
          ? 'Pkt'
          : `${points(manager.duelMatchdayPoints)} Duellpkt`}
      </span>
    </>
  )

  return (
    <li
      className={cn(
        'flex items-stretch gap-1 rounded-card border bg-surface',
        isMe ? 'border-accent/50' : 'border-line',
      )}
    >
      <Link
        to={managerTo}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3 rounded-l-card px-3 py-2.5',
          'transition-colors hover:bg-surface-2',
        )}
      >
        {/* Placement and avatar are one group with a tight gap of their own, so
            the row's `gap-3` separates them from the text rather than pushing
            the number away from the face it belongs to — the season table's
            arrangement, and for the same reason. */}
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="nums w-6 text-center text-base font-bold text-faint">
            {placement(rank)}
          </span>
          <Avatar src={manager.image} name={manager.name} size={44} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">
            {manager.name}
            {isMe && <span className="ml-1.5 text-xs text-accent">du</span>}
          </span>
          {/* Renders nothing outside a duel league, where there is no duel and
              no opponent to name — so the row is then the points and nothing
              else, which is all the data says. */}
          <DuelOutcomeLine result={duelResult} opponentName={opponent?.name} />
        </span>
      </Link>

      {duelTo === undefined ? (
        <span className="shrink-0 self-center px-3 text-right">{figures}</span>
      ) : (
        <Link
          to={duelTo}
          title={`Duell gegen ${opponent?.name ?? ''} ansehen`}
          className={cn(
            'flex shrink-0 flex-col items-end justify-center rounded-r-card px-3 py-2.5',
            'border-l border-line/70 transition-colors hover:bg-surface-2',
          )}
        >
          {figures}
          <span className="sr-only">Duell ansehen</span>
        </Link>
      )}
    </li>
  )
}
