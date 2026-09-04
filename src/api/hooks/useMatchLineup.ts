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
  /** True while either fan-out — the points or the owners — is still arriving. */
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
 *  - [`useMatchdayLineups`](./useMatchdaySquad.ts) — the source of ownership:
 *    each manager's squad **as it stood on this matchday**, one request per
 *    manager in the league.
 *  - [`useMatchdayPoints`](./useMatchdayPoints.ts) — one request per player,
 *    which is what carries the points (`ph[day - 1]`), a last-resort owner
 *    (`oui`) and, where the match payload omitted it, the position. **Roughly
 *    36 requests** for a full fixture with both benches. Everything that hook
 *    does to keep the cost down applies — a player whose match cannot have
 *    produced points is skipped, a settled one is fetched once and held, only
 *    players actually on the pitch are polled — and the entries are the same
 *    `qk.playerDetail` ones every other page fills, so a player already looked
 *    at this session is free.
 *  - [`useRanking`](./useRanking.ts) — one cached request. It names every
 *    manager in the league, which is both the fan-out's input and where a
 *    manager id becomes a name and an avatar.
 *  - The match's own event feed, for who came on and who went off.
 *
 * ## Ownership is the matchday's, not today's
 *
 * This took three attempts and the two failures are worth keeping, because both
 * wrong answers looked right:
 *
 *  1. **`oui` on the player detail** — free, since the points fan-out fetches
 *     that response anyway. It is who owns the player *now*: a matchday from
 *     three weeks ago badged everyone transferred since with his new manager
 *     and reassigned the points they scored.
 *  2. **`us` on the matchday snapshot** — one request, and it reads as a
 *     league-wide gift: every manager with the players in their lineup. But it
 *     **ignores `dayNumber`** and reports the lineups as they stand today, so a
 *     past matchday showed the current elevens. Same class of bug as (1), one
 *     layer deeper.
 *  3. **Each manager's own `lp`/`nlp` under `?dayNumber=`** — verified to
 *     honour the parameter, and therefore the only honest source. It costs one
 *     request per manager, which is what the API charges for the truth here.
 *
 * `oui` survives as the fallback for a matchday the snapshot has nothing at all
 * for, and `needsOwner` is set only in that case, so the expensive
 * before-kick-off fetch happens only when it is the only option.
 *
 * Each badge carries which source it came from
 * ([`OwnerSource`](../models.ts)) plus whether the player was actually
 * **fielded**, because "he played for me", "I owned him and left him out" and
 * "he is mine today" are three different claims.
 *
 * `viewerId` marks the signed-in manager's own players — the first thing
 * anybody looks for on this screen.
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
   * Every manager in the league, because ownership on a matchday can only be
   * asked one manager at a time — see `useMatchdayLineups`. The standings are
   * already fetched for the names and avatars, so this adds no request of its
   * own beyond the fan-out it feeds.
   */
  const managerIds = (ranking.data?.managers ?? []).map((manager) => manager.id)
  const lineups = useMatchdayLineups(leagueId, day, managerIds)

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
      /*
       * Only when the matchday snapshot has nothing at all — `oui` is the
       * last-resort owner, and asking for it otherwise would fetch thirty-six
       * players before kick-off to answer a question the snapshot has already
       * answered better.
       *
       * The standings have to have resolved first: until they do there are no
       * manager ids, so the fan-out is empty and *looks* like "the snapshot
       * found nothing" — which would fire the expensive fallback on every
       * first render and then withdraw it.
       */
      needsOwner: !ranking.isPending && !lineups.isPending && lineups.isEmpty,
    })),
    fixtureByTeamId,
  )

  if (detail === undefined) return undefined

  const managerById = new Map(
    (ranking.data?.managers ?? []).map((manager) => [manager.id, manager]),
  )

  const ownerOf = (playerId: string): MatchPlayerOwner | undefined => {
    /*
     * The matchday's own record first. `oui` is the last resort, for a matchday
     * the snapshot has nothing at all for — and only then, because it answers
     * "who owns him today", which on a played matchday is a different and
     * misleading fact.
     */
    const onTheDay = lineups.byPlayerId.get(playerId)
    const [managerId, source, wasFielded]: [
      string | undefined,
      OwnerSource,
      boolean,
    ] = lineups.isEmpty
      ? [points.ownerIdByPlayerId.get(playerId), 'currentOwner', false]
      : [onTheDay?.managerId, 'matchdayLineup', onTheDay?.wasFielded ?? false]

    if (managerId === undefined) return undefined

    // Names and avatars come from the standings. A manager the standings do not
    // list gets no badge rather than one reading a raw id.
    const manager = managerById.get(managerId)
    if (manager === undefined) return undefined

    return {
      id: managerId,
      name: manager.name,
      image: manager.image,
      isViewer: managerId === viewerId,
      source,
      wasFielded,
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
    // Both fan-outs, because both fill things the rows show: the points and
    // the ownership badges. A pitch that has drawn its portraits but is still
    // collecting badges should say so.
    isPending: points.isPending || lineups.isPending,
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
