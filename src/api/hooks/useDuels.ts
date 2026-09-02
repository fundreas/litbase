import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import type { Duel, DuelSide, MatchdayDuels } from '@/api/models'
import { qk } from '@/api/queryKeys'
import type { RankingResponse, RankingUser } from '@/api/types'

/** How often the standings are re-read while a matchday is being played. */
const LIVE_POLL_MS = 60_000

/** A settled matchday cannot change, so it is held for a while. */
const SETTLED_STALE_MS = 5 * 60_000

function toSide(user: RankingUser): DuelSide {
  return {
    id: user.i,
    name: user.n,
    image: user.uim,
    matchdayPoints: user.mdp,
    duelPlacement: user.hhpl,
    duelPoints: user.hhsp,
    seasonPlacement: user.spl,
    duelMatchdayPoints: user.hhmp,
  }
}

/** The placement a duel league is actually ranked by. */
function tablePosition(side: DuelSide): number {
  return side.duelPlacement ?? side.seasonPlacement
}

/**
 * Pair the managers up from the opponent each one names.
 *
 * `hhoui` is mutual — verified across a live league, where every manager's
 * opponent named them back and ten managers resolved to exactly five duels —
 * but the pairing is still built defensively: a manager is only consumed once,
 * and one whose opponent is missing from the payload (or absent altogether)
 * ends up in `byes` rather than in a half-empty duel or silently dropped.
 */
function mapDuels(data: RankingResponse, day: number): MatchdayDuels {
  const users = data.us ?? []
  const isDuelMode = users.some((user) => user.hhpl !== undefined)
  const byId = new Map(users.map((user) => [user.i, user]))

  const paired = new Set<string>()
  const duels: Duel[] = []
  const byes: DuelSide[] = []

  for (const user of users) {
    if (paired.has(user.i)) continue

    const opponent = user.hhoui === undefined ? undefined : byId.get(user.hhoui)

    if (opponent === undefined || opponent.i === user.i) {
      paired.add(user.i)
      byes.push(toSide(user))
      continue
    }

    paired.add(user.i)
    paired.add(opponent.i)

    // Sides are ordered by the table, so the better-placed manager is always
    // on the left. The id is built from the sorted pair so it is the same
    // string no matter which of the two the loop reached first.
    const sides: [DuelSide, DuelSide] = [toSide(user), toSide(opponent)]
    sides.sort((a, b) => tablePosition(a) - tablePosition(b))

    duels.push({
      id: [user.i, opponent.i].sort((a, b) => a.localeCompare(b)).join(':'),
      sides,
    })
  }

  duels.sort((a, b) => tablePosition(a.sides[0]) - tablePosition(b.sides[0]))
  byes.sort((a, b) => tablePosition(a) - tablePosition(b))

  return { day, isDuelMode, duels, byes }
}

/**
 * The duel pairings of one matchday, with each manager's points for it.
 *
 * There is no duel endpoint — `/v4/leagues/{id}/ranking?dayNumber={day}` is
 * the whole source. It returns the same standings payload with `hhoui` set to
 * that matchday's opponent and `mdp` to that matchday's points, live while it
 * runs. Every other candidate path (`/duels`, `/ranking/{day}`,
 * `/matchdays/{day}`, `/battles`, `/h2h`) answers 404.
 *
 * `isLive` turns on a one-minute poll. It is the caller's to decide because
 * only the caller knows the clock: the endpoint reports nothing about whether
 * the matchday is under way, so that comes from the competition's fixtures.
 *
 * The day is **not** clamped here — out-of-range values answer 200 with the
 * per-matchday fields stripped, so `day` must already be a real matchday.
 */
export function useDuels(
  leagueId: string | undefined,
  day: number | undefined,
  { isLive = false }: { isLive?: boolean } = {},
): UseQueryResult<MatchdayDuels> {
  return useQuery({
    queryKey: qk.rankingDay(leagueId ?? 'none', day ?? 0),
    enabled: leagueId !== undefined && day !== undefined,
    staleTime: isLive ? 0 : SETTLED_STALE_MS,
    refetchInterval: isLive ? LIVE_POLL_MS : false,
    queryFn: async () =>
      mapDuels(
        await get<RankingResponse>(
          endpoints.leagues.ranking(leagueId as string),
          { params: { dayNumber: day } },
        ),
        day as number,
      ),
  })
}
