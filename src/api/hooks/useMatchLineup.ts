import { useMatchdayPoints } from '@/api/hooks/useMatchdayPoints'
import { useRanking } from '@/api/hooks/useRanking'
import type {
  MatchDetail,
  MatchdayFixture,
  MatchLineup,
  MatchPlayer,
  MatchPlayerOwner,
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
 * no points, no notion that a Kickbase league exists. Three sources fill that
 * in, and only one of them is expensive:
 *
 *  - [`useMatchdayPoints`](./useMatchdayPoints.ts) — one request per player,
 *    which is what carries the points (`ph[day - 1]`), the owner (`oui`) and,
 *    where the match payload omitted it, the position. **Roughly 36 requests**
 *    for a full fixture with both benches, and the one caller that asks before
 *    kick-off: the ownership badges are the point of the view and they are
 *    worth seeing the evening before, so `needsOwner` overrides the
 *    "no points yet, do not ask" rule. Everything else that hook does to keep
 *    the cost down still applies — a settled player is fetched once and held,
 *    only players actually on the pitch are polled — and the entries are the
 *    same `qk.playerDetail` ones every other page fills, so a player already
 *    looked at this session is free.
 *  - [`useRanking`](./useRanking.ts) — one cached request, and where an owner
 *    id becomes a name and an avatar. Managers not in the standings are
 *    dropped rather than badged with a bare id.
 *  - The match's own event feed, for who came on and who went off.
 *
 * `viewerId` marks the signed-in manager's own players, which is the first
 * thing anybody looks for on this screen.
 */
export function useMatchLineup(
  leagueId: string | undefined,
  day: number | undefined,
  detail: MatchDetail | undefined,
  fixtureByTeamId: Map<string, MatchdayFixture> | undefined,
  viewerId: string | undefined,
): MatchLineupData | undefined {
  const ranking = useRanking(leagueId)

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

  const ownerOf = (playerId: string): MatchPlayerOwner | undefined => {
    const ownerId = points.ownerIdByPlayerId.get(playerId)
    if (ownerId === undefined) return undefined
    const manager = managerById.get(ownerId)
    // A player owned by somebody the standings do not list — another league's
    // manager cannot happen, but a response mid-refresh can. Better no badge
    // than one reading a raw id.
    if (manager === undefined) return undefined
    return {
      id: manager.id,
      name: manager.name,
      image: manager.image,
      isViewer: manager.id === viewerId,
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
