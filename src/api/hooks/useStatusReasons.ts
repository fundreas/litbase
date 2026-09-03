import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import type { SquadMember } from '@/api/models'
import { qk } from '@/api/queryKeys'
import type { PlayerDetailResponse } from '@/api/types'

/**
 * An injury report changes on the club's schedule, not the minute's. Matches
 * `useStartProbabilities`, which shares these responses.
 */
const STALE_MS = 30 * 60_000

/**
 * Why each unavailable player is unavailable.
 *
 * The squad payload's `st` says only *that* someone is out; the reason lives on
 * the player detail as `stxt` — "Wadenprobleme – verpasst BMG (H)" — and
 * nowhere else. That text is what lets one badge stand for every status
 * without the app having to decide which numeric code means a torn hamstring
 * and which means a second yellow.
 *
 * **Only the unavailable are fetched.** A fit squad costs zero requests and a
 * typical one costs two or three, so this stays a targeted lookup rather than
 * a fan-out over 25 players. The key is `qk.playerDetail`, the same one
 * `useStartProbabilities` uses, so a player who is both unassessed and injured
 * is fetched once between the two hooks, not twice.
 *
 * A missing entry is the normal case, not an error: plenty of statuses carry
 * no text at all. Nothing here surfaces a failure — the badge falls back to
 * its generic label and the row renders unchanged.
 */
export function useStatusReasons(
  leagueId: string | undefined,
  squad: SquadMember[] | undefined,
): Map<string, string> {
  const unavailable = useMemo(
    () =>
      (squad ?? [])
        .filter((player) => player.status !== 0)
        .map((player) => player.id),
    [squad],
  )

  const queries = useQueries({
    queries: unavailable.map((playerId) => ({
      queryKey: qk.playerDetail(leagueId ?? 'none', playerId),
      enabled: leagueId !== undefined,
      staleTime: STALE_MS,
      queryFn: () =>
        get<PlayerDetailResponse>(
          endpoints.leagues.player(leagueId as string, playerId),
        ),
    })),
  })

  // Rebuilt per render for the same reason as `useStartProbabilities`:
  // `useQueries` returns a fresh array every time, and a handful of map writes
  // is cheaper than a surrogate key worth trusting.
  const byPlayerId = new Map<string, string>()

  for (const query of queries) {
    const detail = query.data
    // Guard the empty string too — an absent reason and a blank one should
    // both leave the badge on its generic label.
    if (detail?.stxt) byPlayerId.set(detail.i, detail.stxt)
  }

  return byPlayerId
}
