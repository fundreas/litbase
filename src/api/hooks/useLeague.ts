import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import {
  BATTLE_LABEL,
  type LeagueBattle,
  type LeagueDetails,
  type LeagueManager,
} from '@/api/models'
import { qk } from '@/api/queryKeys'
import type { LeagueMeResponse, LeagueOverviewResponse } from '@/api/types'

/** The signed-in manager inside a league: budget, squad size, unread count. */
export function useLeagueManager(
  leagueId: string | undefined,
): UseQueryResult<LeagueManager> {
  return useQuery({
    queryKey: qk.leagueMe(leagueId ?? 'none'),
    enabled: leagueId !== undefined,
    queryFn: async () => {
      const data = await get<LeagueMeResponse>(
        endpoints.leagues.me(leagueId as string),
      )
      return {
        leagueName: data.lnm,
        competitionId: data.cpi,
        budget: data.b,
        squadSize: data.bs ?? 0,
        unreadCount: data.un ?? 0,
        isAdmin: data.adm ?? false,
      } satisfies LeagueManager
    },
  })
}

/**
 * **Everything the league is** — its name and crest, when it was made, the
 * rules it plays by, who is in it, and the side competitions running inside
 * it.
 *
 * One request, `?includeManagersAndBattles=true`, which buys two things the
 * bare call does not carry: the members' **names** (`us` — the thin `m` list
 * is ids and avatars) and the **battles** (`btls`). The parameter costs
 * nothing, so it is passed unconditionally rather than by a flag the callers
 * would have to agree on: the [market](../../pages/MarketPage.tsx) reads this
 * entry for `upe` alone and the [Liga page](../../pages/LeaguePage.tsx) reads
 * the rest of it, and they share one cache entry.
 *
 * **A battle with no leader is kept, not dropped.** Before anyone has won a
 * matchday there is nothing for `u` to name, and a league that quietly showed
 * six battles instead of seven would be hiding the one nobody leads yet.
 */
export function useLeagueDetails(
  leagueId: string | undefined,
): UseQueryResult<LeagueDetails> {
  return useQuery({
    queryKey: qk.leagueOverview(leagueId ?? 'none'),
    enabled: leagueId !== undefined,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const data = await get<LeagueOverviewResponse>(
        endpoints.leagues.overview(leagueId as string),
        { params: { includeManagersAndBattles: true } },
      )

      // `us` when it came, `m` otherwise — same people either way, but only
      // one of the two lists knows what they are called.
      const named = data.us ?? []
      const members =
        named.length > 0
          ? named.map((member) => ({
              id: member.i,
              name: member.n,
              image: member.uim,
            }))
          : (data.m ?? []).map((member) => ({
              id: member.ui,
              image: member.uim,
            }))

      const battles = (data.btls ?? []).map((battle) => ({
        type: battle.t,
        // The API's own wording first; our fallback only for a code it did
        // not spell out, and the code itself if that is unknown too.
        title:
          battle.n ?? BATTLE_LABEL[battle.t] ?? `Wettkampf ${String(battle.t)}`,
        description: battle.d,
        leader:
          battle.u === undefined
            ? undefined
            : {
                id: battle.u.i,
                // A leader without a name is not a leader anyone can read, so
                // the id never leaks into the UI as one.
                name: battle.u.n ?? '—',
                image: battle.u.uim,
              },
      })) satisfies LeagueBattle[]

      return {
        id: data.i,
        name: data.lnm,
        image: data.lim,
        competitionId: data.cpi,
        competitionName: data.cpn,
        createdAt: data.dt,
        // An admin who wrote nothing leaves an empty string, which is not a
        // description and must not render as a paragraph.
        description:
          data.d === undefined || data.d.trim() === '' ? undefined : data.d,
        memberCount: data.mid?.length ?? members.length,
        managerLimit: data.mgm,
        members,
        startingBudget: data.b,
        gameMode: data.gpm,
        maxPlayers: data.mppu,
        maxPlayersPerClub: data.mpst,
        isAdmin: data.adm ?? false,
        // Permissive when the field is missing: the server enforces the rule
        // anyway, and blocking a legal bid on an absent flag is the worse of
        // the two failures.
        allowsUnderpay: data.upe ?? true,
        battles,
      } satisfies LeagueDetails
    },
  })
}
