import { useQueries } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import { matchdayEntry } from '@/api/hooks/useMatchdayPoints'
import { useRanking } from '@/api/hooks/useRanking'
import {
  toOwnerId,
  toStartProbability,
  toTrend,
  type CompetitionPlayerSummary,
  type TeamSquadOwner,
  type TeamSquadPlayer,
} from '@/api/models'
import { qk } from '@/api/queryKeys'
import type { PlayerDetailResponse } from '@/api/types'

/**
 * Ligainsider revises the lineup probability a few times a week and a market
 * value moves once a night, so half an hour is fresher than anything on this
 * response. The same figure `usePlayerDetail` and `useStartProbabilities` use,
 * and the same cache entry — so a club whose players have been looked at this
 * session is already half fetched.
 */
const STALE_MS = 30 * 60_000

/** A club's roster, once the league-scoped half has been layered on. */
export interface TeamRoster {
  /** Every player of the club, best first within each position group. */
  players: TeamSquadPlayer[]
  /**
   * **What the club's players scored, per matchday**, summed across the whole
   * roster.
   *
   * The by-product that justifies the fan-out twice over: `ph` on each response
   * is the player's *entire* season, so twenty-six requests yield the club's
   * points for every matchday played rather than for one. Nothing else in the
   * API answers "where were this club's points" at all — there is no bulk
   * per-matchday source, per
   * [`useMatchdayPoints`](./useMatchdayPoints.ts).
   *
   * A matchday nobody scored in is **absent** rather than `0`: before a club
   * kicks off it has not scored nothing, it has not played.
   */
  pointsByDay: Map<number, number>
  /**
   * The club's projected starting eleven as one poster (`plpim`).
   *
   * Taken from the first player who carries one, because it is a fact about the
   * *club* — every player at it carries the identical hash, which is what made
   * it useless on a player page and makes it exactly right here. Absent without
   * Membership, in the off-season, and for a club nobody has assessed.
   */
  lineupPoster?: string
  /** True while any per-player request is in flight; rows render without them. */
  isPending: boolean
}

/**
 * A club's roster, with **market value, lineup probability, availability and
 * the owning manager** on every player.
 *
 * ## One fan-out, four answers
 *
 * The competition's player list is free — it is cached for an hour and every
 * page that annotates a player has already fetched it — but it carries only
 * performance: points, minutes, goals, assists. It has **no market value**, no
 * lineup probability, no notion that a Kickbase league exists.
 *
 * All four of those live on `/v4/leagues/{id}/players/{pid}`, and there is no
 * bulk spelling of it (`/leagues/{id}/players` and `?ids=` both 404). So this
 * is one request per player — **twenty-five to thirty for a Bundesliga club** —
 * and the reason to pay it once is that a single response answers everything
 * the [Kader](../../components/team/TeamSquadTab.tsx) and
 * [Spiele](../../components/team/TeamMatchesTab.tsx) tabs need:
 *
 *  - `mv`/`mvt` — the value, and which way it is moving.
 *  - `prob` — the lineup-probability tier, the same one the squad page badges.
 *  - `st`/`stxt` — injured, suspended, and Kickbase's own words for why.
 *  - `oui` — the manager in *this* league who owns him.
 *  - `ph` — his points for **every matchday of the season**, which is what
 *    {@link TeamRoster.pointsByDay} adds up per club.
 *
 * `oui` is the right owner here and the wrong one on a match page: it is who
 * owns the player **today**, which is the question a club's roster asks and the
 * opposite of what a played matchday wants — see
 * [`useMatchLineup`](./useMatchLineup.ts), where reading it cost two rounds of
 * wrong badges.
 *
 * ## The cost, and where it is paid
 *
 * `enabled` is the whole gate, and the caller sets it from the tab on screen:
 * the club's Übersicht renders entirely out of cached competition payloads and
 * must not pay for this, while Kader and Spiele both need it and, sharing these
 * cache entries, pay for it once between them. The same split
 * [`MatchDetailPage`](../../pages/MatchDetailPage.tsx) uses to keep its
 * timeline off the lineup's fan-out.
 *
 * Nothing here polls. A market value moves once a night and a lineup
 * probability a few times a week; live points are the
 * [Live tab](../../components/team/TeamLiveTab.tsx)'s business, and it goes
 * through the match lineup like every other live view in the app.
 */
export function useTeamRoster(
  leagueId: string | undefined,
  /** The club's players, from the competition list. The free half. */
  base: readonly CompetitionPlayerSummary[] | undefined,
  /** The signed-in manager, whose own players are marked. */
  viewerId: string | undefined,
  enabled: boolean,
): TeamRoster {
  /*
   * Names and avatars for the ownership badges. One cached request the ranking
   * page has usually made already — and it is the only place a manager id
   * becomes a person, exactly as on the match lineup.
   */
  const ranking = useRanking(enabled ? leagueId : undefined)

  const players = base ?? []

  const queries = useQueries({
    queries: players.map((player) => ({
      queryKey: qk.playerDetail(leagueId ?? 'none', player.id),
      enabled: enabled && leagueId !== undefined,
      staleTime: STALE_MS,
      queryFn: () =>
        get<PlayerDetailResponse>(
          endpoints.leagues.player(leagueId as string, player.id),
        ),
    })),
  })

  /*
   * Rebuilt per render rather than memoised — `useQueries` hands back a fresh
   * array every time, so a memo would need a surrogate key harder to trust than
   * the thirty map writes it saves. The same trade-off, and the same reasoning,
   * as `useStartProbabilities` and `useDuelRosters`.
   */
  const managerById = new Map(
    (ranking.data?.managers ?? []).map((manager) => [manager.id, manager]),
  )

  const ownerOf = (ownerId: string | undefined): TeamSquadOwner | undefined => {
    if (ownerId === undefined) return undefined
    // A manager the standings do not list gets no badge rather than one
    // reading a raw id — the same rule the match lineup's badges follow.
    const manager = managerById.get(ownerId)
    if (manager === undefined) return undefined
    return {
      id: manager.id,
      name: manager.name,
      image: manager.image,
      isViewer: manager.id === viewerId,
      // Always `currentOwner`, and therefore never fielded: a roster reads
      // `oui`, which is who owns the player **today** and says nothing about
      // any matchday's lineup. See `OwnerSource` and `ownerLabel`, which word
      // exactly this claim as "Gehört X".
      source: 'currentOwner',
      wasFielded: false,
    }
  }

  const pointsByDay = new Map<number, number>()
  let lineupPoster: string | undefined

  const enriched = players.map((player, index): TeamSquadPlayer => {
    const detail = queries[index]?.data

    if (detail !== undefined) {
      lineupPoster ??= detail.plpim
      addSeasonPoints(pointsByDay, detail)
    }

    return {
      id: player.id,
      name: player.lastName,
      position: player.position,
      image: player.image,
      points: player.points,
      minutesPlayed: player.minutesPlayed,
      goals: player.goals,
      assists: player.assists,

      marketValue: detail?.mv,
      marketValueTrend: detail === undefined ? undefined : toTrend(detail.mvt),
      // `st` is omitted for a fit player on some payloads and sent as `0` on
      // others, so an arrived response means fit unless it says otherwise —
      // `undefined` here has to keep meaning "not fetched yet".
      availability: detail === undefined ? undefined : (detail.st ?? 0),
      availabilityText:
        detail?.stxt?.trim() === '' ? undefined : detail?.stxt?.trim(),
      startProbability: toStartProbability(detail?.prob),
      owner: ownerOf(toOwnerId(detail?.oui)),
    }
  })

  return {
    players: enriched,
    pointsByDay,
    lineupPoster,
    isPending:
      enabled &&
      (ranking.isPending || queries.some((query) => query.isPending)),
  }
}

/**
 * Fold one player's whole season into the club's per-matchday totals.
 *
 * `ph` is **newest first** and indexed off the payload's own `day`, which is
 * the trap [`matchdayEntry`](./useMatchdayPoints.ts) exists to hold in one
 * place — so the days are walked through that function rather than by reading
 * the array directly. Getting it off by one here would be invisible: every
 * matchday would still have a plausible total, just the wrong one.
 *
 * A matchday a player missed carries `hp: false` and no `p`, and contributes
 * nothing rather than a zero — so a day on which the club did not play stays
 * out of the map entirely.
 */
function addSeasonPoints(
  totals: Map<number, number>,
  detail: PlayerDetailResponse,
): void {
  const latest = detail.day ?? detail.ph?.length
  if (latest === undefined) return

  for (let day = 1; day <= latest; day += 1) {
    const entry = matchdayEntry(detail, day)
    if (entry?.hp !== true || entry.p === undefined) continue
    totals.set(day, (totals.get(day) ?? 0) + entry.p)
  }
}
