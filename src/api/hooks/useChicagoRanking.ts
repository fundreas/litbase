import { useQueries } from '@tanstack/react-query'

import { rankingDayQueryOptions } from '@/api/hooks/useDuels'
import {
  chicagoPointsOf,
  matchdayState,
  type SeasonMatchday,
} from '@/api/models'
import type { RankingResponse } from '@/api/types'

/** A league's Chicago table — see {@link useLeagueChicagoPoints}. */
export interface LeagueChicagoPoints {
  /**
   * Manager id → Chicago points over the matchdays that have **landed**. A
   * manager who has never won a duel is absent rather than `0`, so read it
   * through `?? 0`.
   */
  byManagerId: Map<string, number>
  /** How many matchdays are in the figures so far. */
  countedDays: number
  /** Matchdays still in flight — the table firms up as they land. */
  pendingCount: number
  /** Nothing has landed yet, and something is on the way. */
  isPending: boolean
  /** Every matchday failed, which is the only case worth a retry. */
  isError: boolean
  error: unknown
  refetch: () => void
}

/**
 * One matchday's standings, added to the running totals.
 *
 * Both sides of every duel are in this one payload, so the pairing is resolved
 * from `hhoui` and the margin taken straight off the two `mdp` — the same
 * ground truth [`duelResultOf`](./useRanking.ts) uses, and for the same reason:
 * nothing here has to assume anything about how Kickbase scores a duel.
 *
 * A manager whose opponent is missing from the payload — a bye, or an
 * odd-sized league — scored nothing to compare and is skipped. Their points
 * still count towards the Kickbase table; they simply had no duel to win.
 */
function addDay(data: RankingResponse, into: Map<string, number>): void {
  const users = data.us ?? []
  const byId = new Map(users.map((user) => [user.i, user]))

  for (const user of users) {
    const opponent = user.hhoui === undefined ? undefined : byId.get(user.hhoui)
    if (opponent === undefined || opponent.i === user.i) continue

    const gained = chicagoPointsOf(user.mdp, opponent.mdp)
    if (gained === 0) continue
    into.set(user.i, (into.get(user.i) ?? 0) + gained)
  }
}

/**
 * **Every manager's Chicago points for the season** — the margin of each duel
 * they won, added up.
 *
 * The third table the [standings](../../pages/RankingPage.tsx) can be read as,
 * beside Kickbase's duel table and its points table. Where a duel league gives
 * three points for a win however narrow, Chicago gives the winner *the
 * difference* and the loser nothing, which ranks a season of routs above a
 * season of one-pointers — see [`chicagoPointsOf`](../models.ts).
 *
 * ## What it costs
 *
 * **One request per finished matchday**, for the reason the manager page's
 * [season of duels](./useManagerDuels.ts) costs one: `ranking?dayNumber=` is
 * the only payload that carries a pairing, and it carries exactly one
 * matchday's. Unlike that hook there is no history to narrow the list with —
 * this is about the whole league, not one manager — so the fan-out is over the
 * competition's finished matchdays and every league member is read out of each
 * response at once.
 *
 * They are the **same cache entries** the duels page, the matchday page and
 * every manager's Duelle tab fill, through `rankingDayQueryOptions`. So the
 * bill is shared both ways: a season already walked on another screen makes
 * this table instant, and this table leaves those screens loaded.
 *
 * It is still a season of requests, which is why the caller hands `matchdays`
 * only while the Chicago table is actually being shown — `undefined` switches
 * the whole hook off, as it does on the manager page.
 *
 * ## Only matchdays that are **over**
 *
 * A live matchday is a pair of part-scores: a 20:15 in the third minute would
 * hand somebody five points that the final whistle may well take back, and the
 * table would churn under the reader all afternoon. The same gate the record,
 * the averages and every outcome mark in the app apply — a duel has no result
 * until it has one.
 *
 * ## The totals firm up as matchdays land
 *
 * `useQueries` reports per matchday, so the table is drawn from what has
 * arrived with a line saying how much is still coming, rather than from a
 * skeleton until the last one. Rows do move while that happens, which is why
 * the page says so.
 */
export function useLeagueChicagoPoints(
  leagueId: string | undefined,
  /** The season's matchdays. `undefined` switches the whole hook off. */
  matchdays: SeasonMatchday[] | undefined,
): LeagueChicagoPoints {
  const days =
    leagueId === undefined || matchdays === undefined
      ? []
      : matchdays
          .filter((matchday) => matchdayState(matchday) === 'finished')
          .map((matchday) => matchday.day)

  const results = useQueries({
    queries: days.map((day) => rankingDayQueryOptions(leagueId, day, false)),
  })

  const byManagerId = new Map<string, number>()
  let countedDays = 0
  let pendingCount = 0
  let errorCount = 0

  for (const result of results) {
    if (result.isPending) pendingCount += 1
    if (result.isError) errorCount += 1
    if (result.data === undefined) continue
    addDay(result.data, byManagerId)
    countedDays += 1
  }

  return {
    byManagerId,
    countedDays,
    pendingCount,
    isPending: countedDays === 0 && pendingCount > 0,
    isError: results.length > 0 && errorCount === results.length,
    error: results.find((result) => result.isError)?.error,
    refetch: () => {
      for (const result of results) void result.refetch()
    },
  }
}
