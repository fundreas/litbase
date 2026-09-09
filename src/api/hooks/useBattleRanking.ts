import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import type { BattleRanking, BattleRankedManager } from '@/api/models'
import { qk } from '@/api/queryKeys'
import type { BattleRankingResponse } from '@/api/types'

/**
 * `v` arrives as **text** — `"12"`, `"543"`, `"-10"` — and is absent for a
 * battle that does not exist. Anything unparseable is treated as absent
 * rather than as `0`: a row reading zero transfers is a claim, an empty one
 * is not.
 */
function toValue(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}

/**
 * **One battle's standings** — every manager in the league, placed, with the
 * figure that placed them.
 *
 * The overview's `btls` names only the manager *leading* each battle; this is
 * the table behind it, and there is no call that answers for every battle at
 * once — seven battles would be seven requests, so the
 * [Battles view](../../components/ranking/BattleRankingTab.tsx) asks only for
 * the one chip that is active. Each type is therefore its own cache entry,
 * and flicking back to a battle already looked at costs nothing.
 *
 * **The response is sorted and it is kept that way.** Unlike
 * [`/ranking`](./useRanking.ts), whose `us` arrives in some internal order,
 * `us` here is already in placement order — so `pl` is read for the number
 * printed and the array order for the sequence, with no client-side sort to
 * disagree with either.
 *
 * **A `type` the league does not run still answers 200.** The endpoint does
 * not validate the code: it comes back with the members in id order, no name,
 * no description and no `v` on any row. `title` is left `undefined` in that
 * case, which is the only signal there is, and the view treats it as "no such
 * battle" rather than as an empty one.
 *
 * Held five minutes. The figures move when a matchday is scored or a transfer
 * goes through, neither of which happens while somebody is looking at the
 * list — and the chips are meant to be flicked through.
 */
export function useBattleRanking(
  leagueId: string | undefined,
  type: number | undefined,
): UseQueryResult<BattleRanking> {
  return useQuery({
    queryKey: qk.battle(leagueId ?? 'none', type ?? 0),
    enabled: leagueId !== undefined && type !== undefined,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const data = await get<BattleRankingResponse>(
        endpoints.leagues.battleRanking(leagueId as string, type as number),
      )

      const managers = (data.us ?? []).map(
        (entry, index) =>
          ({
            id: entry.u.i,
            // A manager without a name is not a manager anyone can read, so
            // the id never leaks into the UI as one — as on `btls`.
            name: entry.u.n ?? '—',
            image: entry.u.uim,
            // `pl` is Kickbase's own place and is preferred, with the row
            // index standing in should it ever arrive as `0` — a ranking
            // numbered `0…0` would read as broken rather than as unplaced.
            placement: entry.pl > 0 ? entry.pl : index + 1,
            value: toValue(entry.v),
          }) satisfies BattleRankedManager,
      )

      return {
        type: type as number,
        title: data.n,
        description: data.d,
        managerCount: data.tc ?? managers.length,
        managers,
      } satisfies BattleRanking
    },
  })
}
