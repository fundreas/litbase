import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import {
  didPlay,
  toEventTallies,
  toOwnerId,
  toPosition,
  toStartProbability,
  toTrend,
  type MarketValueDay,
  type MarketValueHistory,
  type MatchOutcome,
  type PlayerDetail,
  type PlayerFixture,
  type PlayerMatch,
  type PlayerMatchRole,
  type PlayerOwnership,
  type PlayerSeason,
} from '@/api/models'
import { qk } from '@/api/queryKeys'
import {
  MATCH_EVENT,
  PLAYER_MATCH_STATUS,
  TRANSFER_TYPE,
  type PlayerDetailResponse,
  type PlayerMarketValueResponse,
  type PlayerPerformanceMatch,
  type PlayerPerformanceResponse,
  type PlayerTransferHistoryResponse,
} from '@/api/types'

/** Fixture status code for a match that has been played to the end. */
const FIXTURE_FINISHED = 2

/** The only window `/marketvalue/{days}` actually serves — see `endpoints`. */
const MARKET_VALUE_DAYS = 365

const DAY_MS = 24 * 60 * 60_000

const MINUTE = 60_000

/* -------------------------------------------------------------------------- */
/* Profile                                                                    */
/* -------------------------------------------------------------------------- */

function mapFixtures(data: PlayerDetailResponse): PlayerFixture[] {
  const teamId = data.tid

  return (data.mdsum ?? [])
    .map((fixture): PlayerFixture | undefined => {
      // A fixture the API returns for this player is one of their club's, so
      // the club is whichever side it is not. Falling back to "home" when
      // `tid` is missing would silently mirror every result.
      if (teamId === undefined) return undefined
      const isHome = fixture.t1 === teamId
      if (!isHome && fixture.t2 !== teamId) return undefined

      return {
        day: fixture.day,
        kickoff: fixture.md,
        isHome,
        opponentId: isHome ? fixture.t2 : fixture.t1,
        opponentImage: isHome ? fixture.t2im : fixture.t1im,
        isFinished: fixture.mdst === FIXTURE_FINISHED,
        goalsFor: (isHome ? fixture.t1g : fixture.t2g) ?? 0,
        goalsAgainst: (isHome ? fixture.t2g : fixture.t1g) ?? 0,
        isCurrent: fixture.cur ?? false,
      }
    })
    .filter((fixture) => fixture !== undefined)
    .sort((a, b) => a.day - b.day)
}

function mapPlayerDetail(data: PlayerDetailResponse): PlayerDetail {
  const fullName = [data.fn, data.ln].filter(Boolean).join(' ')

  return {
    id: data.i,
    firstName: data.fn,
    lastName: data.ln,
    fullName: fullName === '' ? data.ln : fullName,
    shirtNumber: data.shn,
    teamId: data.tid ?? '',
    teamName: data.tn,
    teamImage: data.tim,
    position: toPosition(data.pos ?? 0),
    image: data.pim,
    status: data.st ?? 0,
    statusText: data.stxt?.trim() === '' ? undefined : data.stxt?.trim(),
    startProbability: toStartProbability(data.prob),
    probabilitySource: data.plpt,
    probabilitySourceLogo: data.plpurl,
    probabilityUpdatedAt: data.ts,
    lineupPoster: data.plpim,
    // `oui` is `"0"` rather than absent when nobody owns them — the trap lives
    // in `toOwnerId`, shared with the match lineup's ownership badges.
    ownerId: toOwnerId(data.oui),

    marketValue: data.mv ?? 0,
    marketValueTrend: toTrend(data.mvt),
    marketValueChangeDay: data.tfhmvt ?? 0,

    totalPoints: data.tp ?? 0,
    averagePoints: data.ap ?? 0,
    // The wire counts seconds; every consumer wants minutes.
    minutesPlayed: Math.round((data.sec ?? 0) / 60),
    goals: data.g ?? 0,
    assists: data.a ?? 0,
    yellowCards: data.y ?? 0,
    redCards: data.r ?? 0,
    cleanSheets: data.cs ?? 0,

    fixtures: mapFixtures(data),
  }
}

/**
 * One player's profile, in the context of a league.
 *
 * The league-scoped endpoint rather than the competition-scoped one because
 * only this spelling carries `oui`, the owning manager — everything else in
 * the two responses is identical.
 *
 * The same query key the squad page's `useStartProbabilities` already uses, so
 * arriving here from a squad row usually costs no request at all.
 */
export function usePlayerDetail(
  leagueId: string | undefined,
  playerId: string | undefined,
): UseQueryResult<PlayerDetail> {
  return useQuery({
    queryKey: qk.playerDetail(leagueId ?? 'none', playerId ?? 'none'),
    enabled: leagueId !== undefined && playerId !== undefined,
    // Ligainsider revises the lineup probability a few times a week and the
    // market value moves once a day, so half an hour is still fresher than
    // anything on this response.
    staleTime: 30 * MINUTE,
    select: mapPlayerDetail,
    queryFn: () =>
      get<PlayerDetailResponse>(
        endpoints.leagues.player(leagueId as string, playerId as string),
      ),
  })
}

/* -------------------------------------------------------------------------- */
/* Performance                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Where the player was in this match.
 *
 * The wire's `st` gets four of the states; the fifth — a starter taken off —
 * exists only as a `SUBSTITUTED_OFF` event, so it is resolved here. See
 * {@link PLAYER_MATCH_STATUS} for how the codes were established.
 */
function toRole(match: PlayerPerformanceMatch): PlayerMatchRole {
  const wasSubstitutedOff = (match.k ?? []).includes(
    MATCH_EVENT.SUBSTITUTED_OFF,
  )

  switch (match.st) {
    case PLAYER_MATCH_STATUS.STARTED:
      return wasSubstitutedOff ? 'substitutedOff' : 'started'
    case PLAYER_MATCH_STATUS.SUBSTITUTE:
      return wasSubstitutedOff ? 'substitutedInAndOff' : 'substitutedIn'
    case PLAYER_MATCH_STATUS.INJURED:
      return 'injured'
    case PLAYER_MATCH_STATUS.DID_NOT_PLAY:
      return 'didNotPlay'
    default:
      return 'upcoming'
  }
}

/** `"96'"` → `96`. Absent or unparseable minutes count as none. */
function toMinutes(minutes: string | undefined): number {
  if (minutes === undefined) return 0
  const parsed = Number.parseInt(minutes, 10)
  return Number.isNaN(parsed) ? 0 : parsed
}

function toOutcome(
  goalsFor: number | undefined,
  goalsAgainst: number | undefined,
): MatchOutcome | undefined {
  if (goalsFor === undefined || goalsAgainst === undefined) return undefined
  if (goalsFor > goalsAgainst) return 'win'
  if (goalsFor < goalsAgainst) return 'loss'
  return 'draw'
}

/**
 * Which side of a fixture the player's club was on.
 *
 * `pt` names it, but **only for matches they actually played** — for the rest
 * the payload gives no direct answer. The club is recovered from the season as
 * a whole instead: it is the one team id that appears in every fixture, which
 * is true by construction, since the list *is* that club's season.
 *
 * Returns `undefined` for a season with no fixtures, or one where two ids
 * somehow appear throughout — better a row without a home/away marker than a
 * row asserting the wrong one.
 */
function resolveClubId(matches: PlayerPerformanceMatch[]): string | undefined {
  const stated = matches.find((match) => match.pt !== undefined)?.pt
  if (stated !== undefined) return stated

  const counts = new Map<string, number>()
  for (const match of matches) {
    for (const teamId of [match.t1, match.t2]) {
      counts.set(teamId, (counts.get(teamId) ?? 0) + 1)
    }
  }

  const ubiquitous = [...counts.entries()]
    .filter(([, count]) => count === matches.length)
    .map(([teamId]) => teamId)

  return ubiquitous.length === 1 ? ubiquitous[0] : undefined
}

function mapSeason(
  season: PlayerPerformanceResponse['it'][number],
): PlayerSeason {
  const clubId = resolveClubId(season.ph)

  const matches: PlayerMatch[] = season.ph
    .map((match) => {
      // `pt` wins where it exists — a player who changed clubs mid-season
      // makes the season-wide answer wrong for some of the fixtures.
      const isHome = (match.pt ?? clubId) === match.t1
      const isFinished = match.mdst === FIXTURE_FINISHED
      const goalsFor = isHome ? match.t1g : match.t2g
      const goalsAgainst = isHome ? match.t2g : match.t1g

      return {
        matchId: match.mi,
        day: match.day,
        kickoff: match.md,
        isFinished,
        isHome,
        opponentId: isHome ? match.t2 : match.t1,
        opponentImage: isHome ? match.t2im : match.t1im,
        goalsFor: isFinished ? goalsFor : undefined,
        goalsAgainst: isFinished ? goalsAgainst : undefined,
        outcome: isFinished ? toOutcome(goalsFor, goalsAgainst) : undefined,
        role: toRole(match),
        points: match.p,
        minutes: toMinutes(match.mp),
        events: toEventTallies(match.k),
      } satisfies PlayerMatch
    })
    .sort((a, b) => a.day - b.day)

  const played = matches.filter((match) => didPlay(match.role))

  return {
    id: season.sid,
    label: season.ti,
    competition: season.n,
    matches,
    appearances: played.length,
    totalPoints: played.reduce((sum, match) => sum + (match.points ?? 0), 0),
    goals: countEvents(played, 'goal'),
    assists: countEvents(played, 'assist'),
  }
}

function countEvents(matches: PlayerMatch[], kind: string): number {
  return matches.reduce(
    (sum, match) =>
      sum + (match.events.find((event) => event.kind === kind)?.count ?? 0),
    0,
  )
}

/**
 * Every season the player has appeared in, **newest first**.
 *
 * The API returns them oldest first, which is the wrong end for a picker that
 * should open on the running season.
 */
export function usePlayerPerformance(
  leagueId: string | undefined,
  playerId: string | undefined,
): UseQueryResult<PlayerSeason[]> {
  return useQuery({
    queryKey: qk.playerPerformance(leagueId ?? 'none', playerId ?? 'none'),
    enabled: leagueId !== undefined && playerId !== undefined,
    // A decade of seasons that only changes when a match is played.
    staleTime: 30 * MINUTE,
    select: (data: PlayerPerformanceResponse) =>
      (data.it ?? []).map(mapSeason).reverse(),
    queryFn: () =>
      get<PlayerPerformanceResponse>(
        endpoints.leagues.playerPerformance(
          leagueId as string,
          playerId as string,
        ),
      ),
  })
}

/* -------------------------------------------------------------------------- */
/* Market value                                                               */
/* -------------------------------------------------------------------------- */

function mapMarketValue(data: PlayerMarketValueResponse): MarketValueHistory {
  // Days before the player entered the competition come back as `mv: 0`.
  // They are not a valuation, and leaving them in drags every chart to zero
  // and makes the all-time low meaningless — `lmv` on the payload has exactly
  // that bug, which is why the low is recomputed here instead of read off it.
  const raw = (data.it ?? []).filter((point) => point.mv > 0)

  const days: MarketValueDay[] = raw.map((point, index) => {
    const previous = raw[index - 1]
    return {
      timestamp: point.dt * DAY_MS,
      date: new Date(point.dt * DAY_MS).toISOString().slice(0, 10),
      value: point.mv,
      // A gap in `dt` means the days between were dropped as placeholders, so
      // the difference across it is not a day's change.
      change:
        previous === undefined || point.dt - previous.dt !== 1
          ? undefined
          : point.mv - previous.mv,
    }
  })

  let high: MarketValueDay | undefined
  let low: MarketValueDay | undefined
  for (const day of days) {
    if (high === undefined || day.value > high.value) high = day
    if (low === undefined || day.value < low.value) low = day
  }

  return { days, high, low }
}

/**
 * A year of daily market values, with the all-time high and low over it.
 *
 * One request serves every window the UI offers: `/marketvalue/{days}` only
 * answers for `365`, so 1, 3 and 6 months are slices — see `windowSlice`.
 */
export function usePlayerMarketValue(
  leagueId: string | undefined,
  playerId: string | undefined,
): UseQueryResult<MarketValueHistory> {
  return useQuery({
    queryKey: qk.playerMarketValue(leagueId ?? 'none', playerId ?? 'none'),
    enabled: leagueId !== undefined && playerId !== undefined,
    // Values move once a day, at night.
    staleTime: 30 * MINUTE,
    select: mapMarketValue,
    queryFn: () =>
      get<PlayerMarketValueResponse>(
        endpoints.leagues.playerMarketValue(
          leagueId as string,
          playerId as string,
          MARKET_VALUE_DAYS,
        ),
      ),
  })
}

/* -------------------------------------------------------------------------- */
/* Ownership                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Who owns the player and what it has cost them.
 *
 * Assembled from **three** responses, because no single one has it:
 *
 *  - `/marketvalue/365` carries the money — `trp`, `prlo`, `iso`, `idp` — but
 *    names nobody.
 *  - `/transferHistory` names the owner and dates the purchase, but reports
 *    `trp: 0` for a squad dealt out at league start, so it is not the price.
 *  - the history itself supplies the market value on the purchase day, which
 *    is what turns a price into an over- or underpay.
 *
 * Returns `undefined` while any part is still loading and for an unowned
 * player, so the caller renders nothing rather than a half-filled panel.
 */
export function useOwnership(
  leagueId: string | undefined,
  playerId: string | undefined,
  history: MarketValueHistory | undefined,
): PlayerOwnership | undefined {
  const transfers = useQuery({
    queryKey: qk.playerTransfers(leagueId ?? 'none', playerId ?? 'none'),
    enabled: leagueId !== undefined && playerId !== undefined,
    staleTime: 30 * MINUTE,
    queryFn: () =>
      get<PlayerTransferHistoryResponse>(
        endpoints.leagues.playerTransfers(
          leagueId as string,
          playerId as string,
        ),
      ),
  })

  const money = useQuery({
    queryKey: qk.playerMarketValue(leagueId ?? 'none', playerId ?? 'none'),
    enabled: leagueId !== undefined && playerId !== undefined,
    staleTime: 30 * MINUTE,
    // Reads the same cache entry as `usePlayerMarketValue`; the `select`
    // differs, so this costs a second mapping and not a second request.
    select: (data: PlayerMarketValueResponse) => ({
      purchasePrice: data.trp,
      profitLoss: data.prlo,
      wasGranted: data.idp ?? false,
      isViewer: data.iso ?? false,
    }),
    queryFn: () =>
      get<PlayerMarketValueResponse>(
        endpoints.leagues.playerMarketValue(
          leagueId as string,
          playerId as string,
          MARKET_VALUE_DAYS,
        ),
      ),
  })

  if (money.data === undefined || transfers.data === undefined) return undefined

  // The last entry that handed the player to somebody is the current owner;
  // a `RELEASED` entry names nobody and must not be read as one.
  const current = [...(transfers.data.it ?? [])]
    .reverse()
    .find(
      (entry) => entry.t !== TRANSFER_TYPE.RELEASED && entry.u !== undefined,
    )

  if (current?.u === undefined) return undefined

  const purchaseDate = current.dt.slice(0, 10)

  return {
    managerId: current.u,
    managerName: current.unm,
    managerImage: current.uim,
    purchasePrice: money.data.purchasePrice,
    profitLoss: money.data.profitLoss,
    wasGranted: money.data.wasGranted,
    isViewer: money.data.isViewer,
    since: current.dt,
    marketValueAtPurchase: history?.days.find(
      (day) => day.date === purchaseDate,
    )?.value,
  }
}
