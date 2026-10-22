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

/** Where a manager's fielded eleven stands in a matchday being played. */
export interface MatchdayPlayerCount {
  /** On the pitch right now. */
  playing: number
  /** Still to kick off — the points that have not had their chance yet. */
  open: number
}

/**
 * **Where each manager's fielded eleven stands in a matchday being played** —
 * how many are on the pitch, and how many have not kicked off.
 *
 * The [duels overview](../../../docs/pages/duels.md) asks it of every manager
 * at once, because a score on a live matchday is a half-sentence. Forty points behind with eight players still playing is a
 * different position from forty behind with none, and forty behind with four
 * clubs yet to kick off is a third — the first number says what is *happening*
 * and the second says what is still *coming*, and neither is on the scoreline.
 *
 * The third state, **finished**, is deliberately not counted: it is already in
 * the score. A number for it would be the one figure on the card that says
 * nothing the figure above it does not.
 *
 * ## What it costs, and when
 *
 * One request per manager — `managers/{userId}/squad`, there being no bulk
 * source of who is fielded — and **only while the matchday is live**, which
 * the caller decides and passes in.
 *
 * That gate used to be narrower: *any fixture actually running*, on the
 * reasoning that between the Saturday blocks nobody is on a pitch and the
 * answer is zero for everybody. True of `playing` and wrong about `open` — the
 * gap between the 15:30 block and the 18:30 kick-off is exactly when *who has
 * somebody left* is the whole question. So the window is now the matchday's,
 * and a card between blocks reads `0 playing, 4 open` rather than nothing.
 *
 * Before the first whistle the hook is off: every fielded player is open then,
 * which is eleven for everybody and not news — the card shows the standings
 * instead. After the last one it is off too, there being nothing left to say.
 *
 * The requests are the *same query key* `useManagerSquad` uses, so opening a
 * duel from this list finds both its managers' squads already in cache, and
 * the counts here cost nothing on the way back.
 *
 * ## Which players count
 *
 * The **fielded** ones (`lo !== undefined`), looked up by their club's fixture
 * on this matchday. A player on the manager's bench is in the stadium too, but
 * he cannot move the duel — and these numbers exist to qualify a score. `lo`
 * is 0-based with `0` the goalkeeper, so membership is tested against
 * `undefined`; `lo > 0` would quietly drop every keeper.
 *
 * A fielded player whose club has no fixture at all — a bye, a rescheduled
 * game — counts in neither: he is not playing and he is not going to.
 *
 * Managers whose squad has not arrived yet are **absent from the map**, not
 * zero, so the card shows nothing rather than claiming a manager has nobody
 * left.
 */
export function useMatchdayPlayerCounts(
  leagueId: string | undefined,
  competitionId: string | undefined,
  day: number | undefined,
  userIds: string[],
  /** Is this matchday being played? `false` switches the fan-out off. */
  isLive: boolean,
): Map<string, MatchdayPlayerCount> {
  const fixtures = useMatchdayFixtures(competitionId, day)

  // Fixtures arrive keyed by team, which is the lookup this needs: a player
  // carries his club, not his match.
  const stateByTeamId = new Map<string, 'playing' | 'open'>()
  for (const [teamId, fixture] of fixtures.data ?? []) {
    const state = fixtureState(fixture)
    if (state === 'running') stateByTeamId.set(teamId, 'playing')
    else if (state === 'upcoming') stateByTeamId.set(teamId, 'open')
  }

  const squads = useQueries({
    queries: userIds.map((userId) => ({
      queryKey: qk.managerSquad(leagueId ?? 'none', userId),
      enabled: leagueId !== undefined && isLive,
      staleTime: STALE_MS,
      queryFn: () =>
        get<ManagerSquadResponse>(
          endpoints.leagues.managerSquad(leagueId as string, userId),
        ),
    })),
  })

  const byManagerId = new Map<string, MatchdayPlayerCount>()
  if (!isLive) return byManagerId

  userIds.forEach((userId, index) => {
    const squad = squads[index]?.data
    if (squad === undefined) return

    const count: MatchdayPlayerCount = { playing: 0, open: 0 }
    for (const player of squad.it ?? []) {
      if (player.lo === undefined) continue
      const state = stateByTeamId.get(player.tid)
      if (state !== undefined) count[state] += 1
    }
    byManagerId.set(userId, count)
  })

  return byManagerId
}
