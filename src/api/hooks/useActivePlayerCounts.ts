import { useQueries } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import { useMatchdayFixtures } from '@/api/hooks/useMatchday'
import { fixtureState } from '@/api/models'
import { qk } from '@/api/queryKeys'
import type { ManagerSquadResponse } from '@/api/types'

/**
 * A squad payload does not change while a matchday runs — Kickbase locks the
 * lineup at the first kick-off — so this is held rather than polled. The same
 * five minutes `useManagerSquad` uses, and the same cache entry.
 */
const STALE_MS = 5 * 60_000

/**
 * **How many of each manager's fielded players are on the pitch right now.**
 *
 * The [duels overview](../../../docs/pages/duels.md#players-on-the-pitch)
 * asks it of every manager at once: a manager 40 points behind with eight
 * players still playing is in a different position from one with none, and
 * that is the question a live duel list raises before any of the detail.
 *
 * ## What it costs, and when
 *
 * One request per manager — `managers/{userId}/squad`, there being no bulk
 * source of who is fielded — but **only while a match is actually being
 * played**. Not "the matchday is live": between the Saturday blocks every
 * fixture is either finished or still to come, nothing is on the pitch, and
 * the answer is zero for everybody without asking. That gate is what keeps a
 * page of ten duels from spending ten requests to render ten zeroes.
 *
 * The requests are the *same query key* `useManagerSquad` uses, so opening a
 * duel from this list finds both its managers' squads already in cache, and
 * the counts here cost nothing on the way back.
 *
 * ## Which players count
 *
 * The **fielded** ones (`lo !== undefined`) whose club is in a running
 * fixture. A player on the manager's bench is in the stadium too, but he
 * cannot move the duel — and this number exists to qualify a score. `lo` is
 * 0-based with `0` the goalkeeper, so membership is tested against
 * `undefined`; `lo > 0` would quietly drop every keeper.
 *
 * Managers whose squad has not arrived yet are **absent from the map**, not
 * zero: the card then shows nothing rather than claiming a manager has nobody
 * playing.
 */
export function useActivePlayerCounts(
  leagueId: string | undefined,
  competitionId: string | undefined,
  day: number | undefined,
  userIds: string[],
): Map<string, number> {
  const fixtures = useMatchdayFixtures(competitionId, day)

  // Fixtures arrive keyed by team, which is the lookup this needs: a player
  // carries his club, not his match.
  const runningTeamIds = new Set<string>()
  for (const [teamId, fixture] of fixtures.data ?? []) {
    if (fixtureState(fixture) === 'running') runningTeamIds.add(teamId)
  }

  const isAnyMatchRunning = runningTeamIds.size > 0

  const squads = useQueries({
    queries: userIds.map((userId) => ({
      queryKey: qk.managerSquad(leagueId ?? 'none', userId),
      enabled: leagueId !== undefined && isAnyMatchRunning,
      staleTime: STALE_MS,
      queryFn: () =>
        get<ManagerSquadResponse>(
          endpoints.leagues.managerSquad(leagueId as string, userId),
        ),
    })),
  })

  const byManagerId = new Map<string, number>()
  if (!isAnyMatchRunning) return byManagerId

  userIds.forEach((userId, index) => {
    const squad = squads[index]?.data
    if (squad === undefined) return
    byManagerId.set(
      userId,
      (squad.it ?? []).filter(
        (player) => player.lo !== undefined && runningTeamIds.has(player.tid),
      ).length,
    )
  })

  return byManagerId
}
