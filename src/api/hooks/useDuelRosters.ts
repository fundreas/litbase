import { useManagerRoster } from '@/api/hooks/useManagerRoster'
import {
  byMatchdayPoints,
  type DuelPlayer,
  type DuelRoster,
  type DuelSide,
} from '@/api/models'

/**
 * Both managers' teams **as they stood on that matchday**, with each player's
 * points and state.
 *
 * Two [manager rosters](./useManagerRoster.ts) side by side, and nothing else:
 * every rule about which source to believe, when to poll and how the points are
 * paid for is a fact about *a* manager's matchday, so it lives there and this
 * hook is the pairing. The [manager page](../../pages/ManagerDetailPage.tsx)
 * mounts one of the same, which is why the split happened — a second copy of
 * that reasoning is the copy that would have drifted.
 *
 * **Two fan-outs, the same requests.** The points used to be fetched for both
 * squads as one list; they are now fetched per side. A player cannot be in two
 * managers' squads at once, and the queries are keyed by player id either way,
 * so the set of requests is identical — it is two `useQueries` calls where
 * there was one.
 */
export function useDuelRosters(
  leagueId: string | undefined,
  competitionId: string | undefined,
  day: number | undefined,
  sides: [DuelSide, DuelSide] | undefined,
): {
  data?: [DuelRoster, DuelRoster]
  isPending: boolean
  isError: boolean
  error: unknown
  /** Neither manager has anything for this matchday — see below. */
  isEmpty: boolean
  /** True while per-player points are still arriving; rows render without them. */
  isPointsPending: boolean
  refetch: () => void
} {
  const a = useManagerRoster(leagueId, competitionId, day, sides?.[0])
  const b = useManagerRoster(leagueId, competitionId, day, sides?.[1])

  return {
    data:
      a.data === undefined || b.data === undefined
        ? undefined
        : [a.data, b.data],
    isPending: a.isPending || b.isPending,
    isError: a.isError || b.isError,
    error: a.error ?? b.error,
    /**
     * **Both** sides came back with nothing: a matchday out of range, or one
     * from before the league existed. Distinct from an error, and the page says
     * so rather than drawing two empty teams. One empty side alone is not this
     * — a manager who has left the league is a real, drawable half.
     */
    isEmpty: a.isEmpty && b.isEmpty,
    isPointsPending: a.isPointsPending || b.isPointsPending,
    refetch: () => {
      a.refetch()
      b.refetch()
    },
  }
}

/**
 * Every player from both sides in one list, best first.
 *
 * Bench players are **included**: they scored what they scored, it just did
 * not count, and leaving them out would make the list disagree with the lineup
 * tab about who exists. Their rows say "Bank", so nothing is misread as having
 * counted. Players with no points yet sort last rather than as zero — not
 * knowing is not the same as nothing.
 */
export function rankDuelPlayers(
  rosters: [DuelRoster, DuelRoster],
): DuelPlayer[] {
  return rosters
    .flatMap((roster) => [...roster.lineup, ...roster.bench])
    .sort(byMatchdayPoints)
}
