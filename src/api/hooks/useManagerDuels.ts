import { useQueries } from '@tanstack/react-query'

import { rankingDayQueryOptions } from '@/api/hooks/useDuels'
import { useManagerPerformance } from '@/api/hooks/useManagerPerformance'
import { duelResultOf, toRankedManager } from '@/api/hooks/useRanking'
import {
  chicagoPointsOf,
  duelRecordOf,
  duelSideOf,
  matchdayState,
  type DuelRecord,
  type ManagerHistory,
  type ManagerSeasonDuel,
  type SeasonMatchday,
} from '@/api/models'
import type { RankingResponse } from '@/api/types'

/** A manager's whole season of duels, plus what it adds up to. */
export interface ManagerSeasonDuels {
  /** **Newest first** — the matchday a reader arrives asking about. */
  duels: ManagerSeasonDuel[]
  /** Won / drawn / lost over the duels that are over. */
  record: DuelRecord
  /** Duel points over the season, summed from the matchdays that have landed. */
  duelPoints: number
  /**
   * **Chicago points over the season** — the margin of every duel this manager
   * won, added up; see [`chicagoPointsOf`](../models.ts). The app's own
   * scoring, not Kickbase's, and the same figure the standings'
   * [Chicago table](../../pages/RankingPage.tsx) ranks the league by.
   */
  chicagoPoints: number
  /**
   * What this manager has averaged per duel **that is over** — `undefined`
   * before the first one is.
   */
  averagePoints: number | undefined
  /** What their opponents have averaged, over the same duels. */
  averageOpponentPoints: number | undefined
  /** Matchdays still in flight — the list fills in as they land. */
  pendingCount: number
  /** Nothing to show yet: the history, or every matchday, still on the way. */
  isPending: boolean
  /** The history failed, or every matchday did. */
  isError: boolean
  error: unknown
  refetch: () => void
}

/**
 * Which matchdays to ask about — **the ones the manager actually played**,
 * plus the one being played right now.
 *
 * The naive list is "every matchday that has kicked off", which late in a
 * season is 34 requests, most of them for matchdays before this manager even
 * joined the league. `/managers/{id}/performance` already answers that question
 * in one request the [Details tab](../../components/manager/ManagerDetailsTab.tsx)
 * has usually made anyway: its entries start where the manager joined, and a
 * matchday they sat out is `0` rather than missing — only the **future** ones
 * are absent.
 *
 * The live matchday is unioned in because the history is the one thing that may
 * not have it yet: a matchday whose first whistle has gone but which has scored
 * nobody anything is a matchday without `mdp`, and dropping it would blank out
 * the one duel a reader is most likely to be watching.
 */
function playedDays(
  history: ManagerHistory | undefined,
  matchdays: SeasonMatchday[],
): number[] {
  const days = new Set(
    (history?.current?.matchdays ?? []).map((matchday) => matchday.day),
  )
  for (const matchday of matchdays) {
    if (matchdayState(matchday) === 'live') days.add(matchday.day)
  }
  return [...days].sort((a, b) => a - b)
}

/**
 * One matchday's standings, read as *this* manager's duel.
 *
 * `undefined` when the payload does not know the manager at all — a matchday
 * before they joined, which the history can still list if they were in another
 * league's season. A row claiming a 0:0 bye for a week the manager was not
 * there would be worse than no row.
 */
function toManagerDuel(
  data: RankingResponse,
  day: number,
  managerId: string,
  { isLive, isFinished }: { isLive: boolean; isFinished: boolean },
): ManagerSeasonDuel | undefined {
  const users = data.us ?? []
  const own = users.find((user) => user.i === managerId)
  if (own === undefined) return undefined

  const manager = toRankedManager(own)
  const opponentUser =
    manager.duelOpponentId === undefined
      ? undefined
      : users.find((user) => user.i === manager.duelOpponentId)
  const opponent =
    opponentUser === undefined ? undefined : toRankedManager(opponentUser)

  const duel: ManagerSeasonDuel = {
    day,
    points: manager.matchdayPoints,
    opponentPoints: opponent?.matchdayPoints ?? 0,
    isLive,
  }

  if (manager.duelMatchdayPoints !== undefined) {
    duel.duelPoints = manager.duelMatchdayPoints
  }

  if (opponent !== undefined) {
    duel.opponent = duelSideOf(opponent)
    /*
     * Decided by comparing the two managers' matchday points, through the same
     * `duelResultOf` the standings use — not by reading `hhmp` against an
     * assumed 3/1/0 scale. And only once the matchday is over: *Gewonnen* is
     * past tense.
     */
    if (isFinished) {
      duel.result = duelResultOf(manager, new Map([[opponent.id, opponent]]))
    }
  }

  return duel
}

/**
 * **Every duel a manager has played this season**, matchday by matchday.
 *
 * What the manager page's
 * [Duelle tab](../../components/manager/ManagerPerformanceTab.tsx) is: the
 * counterpart of a club's [season of fixtures](./useTeam.ts) and of a player's
 * season of matches, for the one competition a duel league is actually played
 * for. Until it existed, a rival's duel record lived nowhere — the standings
 * carry the running total (`hhsp`) and the current matchday's opponent, and
 * nothing in the app could say *who they beat to get there*.
 *
 * ## What it costs
 *
 * **One request per played matchday**, because there is no endpoint that
 * answers for a season: `ranking?dayNumber=` carries the pairing for *one*
 * matchday and `/performance` carries points without an opponent, so a season
 * of duels is the first fanned out over the second. See {@link playedDays} for
 * why that is the manager's matchdays rather than the competition's.
 *
 * Both halves are **shared cache entries**, which is most of what keeps the
 * bill down:
 *
 *  - the history is the same entry the Details tab reads — opening the two
 *    tabs in either order costs one request between them;
 *  - each matchday is the same entry the [duels page](../../pages/DuelsPage.tsx)
 *    and the manager page's own header fill for that `?day=`, through
 *    [`rankingDayQueryOptions`](./useDuels.ts). So stepping through a season on
 *    this tab leaves every one of those matchdays loaded for the duels page,
 *    and the duel a row opens is already in hand when it gets there.
 *
 * The live matchday polls, the settled ones are held for five minutes. The
 * whole fan-out is gated on `matchdays` being passed at all, which is how the
 * page keeps it off the other four tabs.
 *
 * ## Rows arrive as they land
 *
 * `useQueries` reports per-matchday, so the list renders what has arrived
 * rather than waiting for all of it — {@link ManagerSeasonDuels.pendingCount}
 * is what the tab draws its "still loading" line from. A single matchday that
 * fails is simply a row that is not there yet; `isError` is reserved for the
 * history failing or **every** matchday failing, which is the only case where
 * retrying is the reader's move.
 */
export function useManagerSeasonDuels(
  leagueId: string | undefined,
  managerId: string | undefined,
  /** The season's matchdays. `undefined` switches the whole hook off. */
  matchdays: SeasonMatchday[] | undefined,
): ManagerSeasonDuels {
  const isOn =
    leagueId !== undefined && managerId !== undefined && matchdays !== undefined

  const history = useManagerPerformance(leagueId, isOn ? managerId : undefined)
  const days = isOn ? playedDays(history.data, matchdays) : []

  // The matchday's own clock, for the live poll and for whether a result may
  // be claimed. Keyed by day so the fan-out below can look each one up.
  const byDay = new Map((matchdays ?? []).map((entry) => [entry.day, entry]))

  const results = useQueries({
    queries: days.map((day) => {
      const matchday = byDay.get(day)
      const state = matchday === undefined ? undefined : matchdayState(matchday)
      return rankingDayQueryOptions(leagueId, day, state === 'live')
    }),
  })

  const duels: ManagerSeasonDuel[] = []
  let pendingCount = 0
  let errorCount = 0

  days.forEach((day, index) => {
    const result = results[index]
    if (result === undefined) return
    if (result.isPending) pendingCount += 1
    if (result.isError) errorCount += 1
    if (result.data === undefined || managerId === undefined) return

    const matchday = byDay.get(day)
    const state = matchday === undefined ? undefined : matchdayState(matchday)
    const duel = toManagerDuel(result.data, day, managerId, {
      isLive: state === 'live',
      isFinished: state === 'finished',
    })
    if (duel !== undefined) duels.push(duel)
  })

  // Newest first. The days were walked ascending so the matchday lookup reads
  // in season order; the list a reader wants starts at last weekend.
  duels.reverse()

  /*
   * What the two averages are taken over: duels that **happened**. A bye has no
   * opponent to average against, and a matchday still being played is a pair of
   * part-scores — folding 20:15 from the third minute into a season averaging
   * three hundred would halve the figure and tell the reader nothing true. The
   * record above excludes it for the same reason.
   */
  const played = duels.filter(
    (duel) => duel.opponent !== undefined && !duel.isLive,
  )
  const average = (total: number) =>
    played.length === 0 ? undefined : Math.round(total / played.length)

  return {
    duels,
    record: duelRecordOf(duels),
    duelPoints: duels.reduce((sum, duel) => sum + (duel.duelPoints ?? 0), 0),
    /*
     * Over the duels that are **over**, like the record and the averages: a
     * margin taken from a matchday still being played is a lead, not a result.
     */
    chicagoPoints: played.reduce(
      (sum, duel) => sum + chicagoPointsOf(duel.points, duel.opponentPoints),
      0,
    ),
    averagePoints: average(played.reduce((sum, duel) => sum + duel.points, 0)),
    averageOpponentPoints: average(
      played.reduce((sum, duel) => sum + duel.opponentPoints, 0),
    ),
    pendingCount,
    isPending: history.isPending || (duels.length === 0 && pendingCount > 0),
    isError:
      history.isError || (results.length > 0 && errorCount === results.length),
    error: history.error ?? results.find((result) => result.isError)?.error,
    refetch: () => {
      void history.refetch()
      for (const result of results) void result.refetch()
    },
  }
}
