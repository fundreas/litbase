import { useMatchdayPoints } from '@/api/hooks/useMatchdayPoints'
import { useMatchdayLineups } from '@/api/hooks/useMatchdaySquad'
import { useRanking } from '@/api/hooks/useRanking'
import type {
  MatchDetail,
  MatchdayFixture,
  MatchLineup,
  MatchPlayer,
  MatchPlayerOwner,
  OwnerSource,
} from '@/api/models'

/** Both team sheets, with everything the league knows layered on. */
export interface MatchLineupData {
  home: MatchLineup
  away: MatchLineup
  /** True while per-player points and owners are still arriving. */
  isPending: boolean
}

/**
 * Both team sheets of one match, with **Kickbase points and the owning manager
 * on every player**.
 *
 * `/matches/{id}/details` gives the eleven names per side and nothing else —
 * no points, no notion that a Kickbase league exists. Four sources fill that
 * in, and only one of them is expensive:
 *
 *  - [`useMatchdayLineups`](./useMatchdaySquad.ts) — **one** request, and the
 *    source of ownership: `us` on the matchday snapshot lists every manager in
 *    the league with the players *they* fielded on *that* matchday.
 *  - [`useMatchdayPoints`](./useMatchdayPoints.ts) — one request per player,
 *    which is what carries the points (`ph[day - 1]`), a fallback owner
 *    (`oui`) and, where the match payload omitted it, the position. **Roughly
 *    36 requests** for a full fixture with both benches, and the one caller
 *    that asks before kick-off: the ownership badges are the point of the view
 *    and they are worth seeing the evening before, so `needsOwner` overrides
 *    the "no points yet, do not ask" rule. Everything else that hook does to
 *    keep the cost down still applies — a settled player is fetched once and
 *    held, only players actually on the pitch are polled — and the entries are
 *    the same `qk.playerDetail` ones every other page fills, so a player
 *    already looked at this session is free.
 *  - [`useRanking`](./useRanking.ts) — one cached request, and where a manager
 *    id becomes a name and an avatar.
 *  - The match's own event feed, for who came on and who went off.
 *
 * ## Ownership is the matchday's, not today's
 *
 * The snapshot wins whenever it has lineups, and `oui` is the fallback for the
 * case where it has none — before the first kick-off, where today's owner is
 * also the right answer.
 *
 * The two are **not interchangeable**, which is why they are ordered rather
 * than merged. `oui` is who owns the player *now*: on a matchday from three
 * weeks ago it badges everyone transferred since with his new manager, and
 * quietly reassigns the points they scored. That was the first version of this
 * and it was wrong. `us` is the matchday's own record.
 *
 * Each badge carries which of the two it came from
 * ([`OwnerSource`](../models.ts)), because "had him in his lineup that
 * matchday" and "owns him today" are different claims and the wording has to
 * differ with them.
 *
 * `viewerId` marks the signed-in manager's own players — the first thing
 * anybody looks for on this screen — and doubles as the address for the
 * snapshot request, whose `us` is league-wide whoever is named in the path.
 */
export function useMatchLineup(
  leagueId: string | undefined,
  day: number | undefined,
  detail: MatchDetail | undefined,
  fixtureByTeamId: Map<string, MatchdayFixture> | undefined,
  viewerId: string | undefined,
): MatchLineupData | undefined {
  const ranking = useRanking(leagueId)
  const lineups = useMatchdayLineups(leagueId, viewerId, day)

  /*
   * Every player of the fixture as one fan-out, so the whole match is a single
   * `useQueries` rather than four. Not memoised: `useQueries` hands back a
   * fresh array each render anyway and compares by key, so rebuilding the
   * subject list costs nothing — the same reasoning the duel rosters carry.
   */
  const players = [
    ...(detail?.home11.starters ?? []),
    ...(detail?.home11.substitutes ?? []),
    ...(detail?.away11.starters ?? []),
    ...(detail?.away11.substitutes ?? []),
  ]

  const points = useMatchdayPoints(
    leagueId,
    day,
    players.map((player) => ({
      id: player.id,
      teamId: player.teamId,
      needsPosition: player.position === undefined,
      // The whole reason this page fetches before kick-off.
      needsOwner: true,
    })),
    fixtureByTeamId,
  )

  if (detail === undefined) return undefined

  const managerById = new Map(
    (ranking.data?.managers ?? []).map((manager) => [manager.id, manager]),
  )

  /** The snapshot has real lineups, so it is the answer for this matchday. */
  const hasMatchdayLineups = lineups.data !== undefined && !lineups.data.isEmpty

  const ownerOf = (playerId: string): MatchPlayerOwner | undefined => {
    const [managerId, source]: [string | undefined, OwnerSource] =
      hasMatchdayLineups
        ? [lineups.data?.managerIdByPlayerId.get(playerId), 'matchdayLineup']
        : [points.ownerIdByPlayerId.get(playerId), 'currentOwner']

    if (managerId === undefined) return undefined

    // The standings carry the avatar; the snapshot's own `unm` stands in for
    // the name when the standings have not landed or do not list the manager.
    // A bare id is never shown — better no badge than an unreadable one.
    const manager = managerById.get(managerId)
    const name = manager?.name ?? lineups.data?.nameByManagerId.get(managerId)
    if (name === undefined) return undefined

    return {
      id: managerId,
      name,
      image: manager?.image,
      isViewer: managerId === viewerId,
      source,
    }
  }

  const swaps = resolveSwaps(detail)

  const decorate = (player: MatchPlayer): MatchPlayer => ({
    ...player,
    // The match payload first — it is the club's own team sheet — then the
    // player's own detail, which is the only source when `pos` is absent.
    position: player.position ?? points.positionByPlayerId.get(player.id),
    points: points.byPlayerId.get(player.id),
    owner: ownerOf(player.id),
    events: detail.eventsByPlayerId.get(player.id),
    role: swaps.get(player.id),
  })

  const rebuild = (lineup: MatchLineup): MatchLineup => ({
    ...lineup,
    starters: lineup.starters.map(decorate),
    substitutes: lineup.substitutes.map(decorate),
  })

  return {
    home: rebuild(detail.home11),
    away: rebuild(detail.away11),
    isPending: points.isPending,
  }
}

/**
 * Who came on and who went off, per player id.
 *
 * The feed states the **incoming** player outright: a `substitution` event
 * carries his id, and observed payloads hold one per substitution with no
 * outgoing counterpart at all. So `substitutedIn` is a fact.
 *
 * The player going the other way is only ever a **name** — the nested `rev`
 * entry sets `pi: "0"` even while `pn` names him — so he is matched by last
 * name against the starting eleven of the same club, and **only when that name
 * is unique in it**. Two starters sharing a surname make the match ambiguous,
 * and an arrow on the wrong player is worse than no arrow: neither gets one.
 *
 * If Kickbase ever does emit the outgoing code, it is honoured directly and the
 * name matching never gets a chance to be wrong.
 */
function resolveSwaps(
  detail: MatchDetail,
): Map<string, NonNullable<MatchPlayer['role']>> {
  const roles = new Map<string, NonNullable<MatchPlayer['role']>>()

  const add = (playerId: string, role: 'substitutedIn' | 'substitutedOff') => {
    const current = roles.get(playerId)
    if (current === undefined) {
      roles.set(playerId, role)
      return
    }
    // A substitute who came on and was then taken off again.
    if (current !== role) roles.set(playerId, 'substitutedInAndOff')
  }

  /** Last name → the one starter with it, or `undefined` when shared. */
  const starterByName = new Map<string, MatchPlayer | undefined>()
  for (const lineup of [detail.home11, detail.away11]) {
    for (const player of lineup.starters) {
      const key = `${lineup.team.id}/${player.name}`
      starterByName.set(key, starterByName.has(key) ? undefined : player)
    }
  }

  for (const event of detail.events) {
    if (event.kind !== 'substitution') continue

    if (event.playerId !== undefined) {
      add(
        event.playerId,
        event.swap === 'off' ? 'substitutedOff' : 'substitutedIn',
      )
    }

    // The counterpart, by name, and only when the direction is known.
    if (event.relatedName === undefined || event.teamId === undefined) continue
    const counterpart = starterByName.get(
      `${event.teamId}/${event.relatedName}`,
    )
    if (counterpart === undefined) continue
    add(
      counterpart.id,
      event.swap === 'off' ? 'substitutedIn' : 'substitutedOff',
    )
  }

  return roles
}
