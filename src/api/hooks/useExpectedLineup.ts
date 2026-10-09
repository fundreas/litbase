import {
  useQueries,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query'

import type {
  ExpectedCounterpart,
  ExpectedLineup,
  ExpectedPlayer,
  ExpectedStatus,
  ExpectedTier,
  PositionKey,
} from '@/api/models'
import { qk } from '@/api/queryKeys'
import { env } from '@/lib/env'

/**
 * The only competition the pointcast run publishes for: Bundesliga.
 *
 * Checked here rather than left to a 404, for the same reason
 * [the prediction](./usePointcast.ts) and
 * [the ranking](./usePlayerRanking.ts) check it: a 2. Bundesliga or La Liga
 * league would otherwise ask for eighteen files that cannot exist, two per
 * match page, and show nothing either way.
 */
const POINTCAST_COMPETITION_ID = '1'

/**
 * How long a file is trusted before it is worth asking again.
 *
 * Shorter than the hour the [points prediction](./usePointcast.ts) keeps,
 * and deliberately: an expected lineup is read in the hours before kick-off,
 * which is exactly when the run's own inputs — a club's press conference, a
 * late injury — are still moving. Ten minutes is also what Pages caches in
 * front of the file, so a shorter window here would be asking the CDN for an
 * answer it has already decided not to change.
 */
const LINEUP_STALE_MS = 10 * 60_000

/** The positions as the files spell them, to the keys the app uses. */
const POSITION_BY_WIRE: Record<string, PositionKey> = {
  GK: 'gk',
  DEF: 'def',
  MID: 'mid',
  FWD: 'fwd',
}

/** The tiers the file may carry — anything else is dropped to `coin_flip`. */
const TIERS = new Set<ExpectedTier>([
  'sure',
  'likely',
  'coin_flip',
  'bench',
  'out',
])

/** The statuses the file may carry. `null` and anything unknown vanish. */
const STATUSES = new Set<ExpectedStatus>([
  'absent',
  'fit',
  'injured',
  'questionable',
  'rehab',
  'suspended',
  'unknown',
])

/** One entry of a team file, as the file writes it. */
interface WirePlayer {
  playerId?: unknown
  name?: unknown
  position?: unknown
  status?: unknown
  tier?: unknown
  depthRank?: unknown
  inLineup?: unknown
  pStart?: unknown
  pPlay?: unknown
  pSquad?: unknown
  replaces?: unknown
  replacedBy?: unknown
  xP?: unknown
  marketValue?: unknown
}

/** The file itself. */
interface WireLineup {
  matchday?: unknown
  generatedAt?: unknown
  predictor?: unknown
  teamId?: unknown
  teamName?: unknown
  opponentTeamId?: unknown
  opponentTeamName?: unknown
  isHome?: unknown
  kickoff?: unknown
  summary?: unknown
  lineup?: unknown
  bench?: unknown
  out?: unknown
}

/** `/v1/lineups/{matchday}/{teamId}.json` — see {@link useExpectedLineup}. */
function lineupUrl(matchday: number, teamId: string): string {
  return `${env.pointcastBaseUrl}/v1/lineups/${String(matchday)}/${teamId}.json`
}

function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** A share, clamped — these are printed as percentages. */
function chance(value: unknown): number | undefined {
  const raw = finite(value)
  return raw === undefined ? undefined : Math.min(1, Math.max(0, raw))
}

/** A figure the app prints whole — the run's own decimals are noise here. */
function round(value: unknown): number | undefined {
  const raw = finite(value)
  return raw === undefined ? undefined : Math.round(raw)
}

/** The other end of a swap, or `undefined` for the `null` the file writes. */
function counterpart(value: unknown): ExpectedCounterpart | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const entry = value as { playerId?: unknown; name?: unknown }
  const playerId = text(entry.playerId)
  const name = text(entry.name)
  if (playerId === undefined || name === undefined) return undefined
  return { playerId, name }
}

/**
 * One wire entry as an {@link ExpectedPlayer}, or `undefined` if it is not one.
 *
 * Three fields are load-bearing — the id, the name and the position — because
 * without any one of them the player cannot be drawn on a pitch at all.
 * Everything else qualifies him, and a file that ever drops one of those
 * should cost the reader a line of detail rather than the eleven.
 */
function toPlayer(entry: WirePlayer): ExpectedPlayer | undefined {
  const id = text(entry.playerId)
  const name = text(entry.name)
  const position =
    typeof entry.position === 'string'
      ? POSITION_BY_WIRE[entry.position]
      : undefined
  if (id === undefined || name === undefined || position === undefined) {
    return undefined
  }

  const tier =
    typeof entry.tier === 'string' && TIERS.has(entry.tier as ExpectedTier)
      ? (entry.tier as ExpectedTier)
      : 'coin_flip'
  const status =
    typeof entry.status === 'string' &&
    STATUSES.has(entry.status as ExpectedStatus)
      ? (entry.status as ExpectedStatus)
      : undefined

  return {
    id,
    name,
    position,
    tier,
    inLineup: entry.inLineup === true,
    depthRank: finite(entry.depthRank) ?? 99,
    startChance: chance(entry.pStart),
    playChance: chance(entry.pPlay),
    squadChance: chance(entry.pSquad),
    expected: round(entry.xP),
    status,
    replaces: counterpart(entry.replaces),
    replacedBy: counterpart(entry.replacedBy),
    marketValue: finite(entry.marketValue),
  }
}

/** Every entry of one array that parses, in the order the file wrote them. */
function toPlayers(value: unknown): ExpectedPlayer[] {
  if (!Array.isArray(value)) return []
  return (value as WirePlayer[])
    .map((entry) => toPlayer(entry ?? {}))
    .filter((player): player is ExpectedPlayer => player !== undefined)
}

/**
 * The whole file as an {@link ExpectedLineup}, or `null` when it is not one.
 *
 * **An eleven is the minimum.** The pitch has nothing to draw without one, and
 * a file holding four players is a file the run wrote while something was
 * wrong — better to fall back to "no prediction" than to draw half a team and
 * let the reader assume the other seven were dropped.
 */
function toLineup(file: WireLineup, matchday: number): ExpectedLineup | null {
  const teamId = text(file.teamId)
  if (teamId === undefined) return null

  const lineup = (file.lineup ?? {}) as Record<string, unknown>
  // Keeper first and then up the pitch, which is the order a lineup is read
  // and written in — the bands pick their own players out of it either way.
  const starters = [
    ...toPlayers(lineup.GK),
    ...toPlayers(lineup.DEF),
    ...toPlayers(lineup.MID),
    ...toPlayers(lineup.FWD),
  ]
  if (starters.length < 11) return null

  const summary = (file.summary ?? {}) as {
    formation?: unknown
    usualFormation?: unknown
    formationSource?: unknown
    confidence?: unknown
  }
  const source = summary.formationSource
  const formationSource: ExpectedLineup['formationSource'] =
    source === 'team' || source === 'league' || source === 'default'
      ? source
      : 'default'

  return {
    // The file's own number, falling back to the one asked for: what the note
    // under the pitch prints has to be what the file is about.
    matchday: finite(file.matchday) ?? matchday,
    generatedAt: text(file.generatedAt),
    predictor: text(file.predictor),
    teamId,
    teamName: text(file.teamName),
    opponentTeamId: text(file.opponentTeamId),
    opponentTeamName: text(file.opponentTeamName),
    isHome: typeof file.isHome === 'boolean' ? file.isHome : undefined,
    kickoff: text(file.kickoff),
    formation: text(summary.formation) ?? '',
    usualFormation: text(summary.usualFormation),
    formationSource,
    confidence: chance(summary.confidence),
    starters,
    bench: toPlayers(file.bench),
    out: toPlayers(file.out),
  }
}

/** One file, fetched and parsed. `null` is "not published", never an error. */
async function fetchLineup(
  matchday: number,
  teamId: string,
): Promise<ExpectedLineup | null> {
  const response = await fetch(lineupUrl(matchday, teamId))

  // The run publishes the matchday it is currently predicting and no other, so
  // a 404 is the normal answer for every matchday but one — the reader loses a
  // prediction he never asked for, not a feature.
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`Aufstellungs-Prognose: HTTP ${String(response.status)}`)
  }
  // The two shapes of "missing" a static host produces: a 404, and a 200 of
  // `<!doctype html>` from a dev server that rewrote the unknown path. The
  // same guard every other foreign-host hook here carries.
  if (
    !(response.headers.get('content-type') ?? '').includes('application/json')
  ) {
    return null
  }

  const file = (await response.json()) as WireLineup
  if (file === null || typeof file !== 'object') return null
  return toLineup(file, matchday)
}

/**
 * **One club's expected lineup for a matchday**, predicted.
 *
 * Not Kickbase, and not a team sheet.
 * [litbase-pointcast](https://github.com/fundreas/litbase-pointcast) runs its
 * two-stage model over every squad each night and publishes, per club, the
 * eleven it expects, the bench it expects behind them, and for each bench
 * player the starter he would most likely come on for. One static file per
 * club per matchday on GitHub Pages; no token, no league, and the axios
 * instance deliberately unused, exactly as
 * [`usePointcast`](./usePointcast.ts) documents.
 *
 * **Only the matchday being predicted exists.** Every other matchday is a
 * plain 404 and resolves to `null` — which is also what a competition the run
 * does not cover looks like, and what the two callers treat as "there is
 * nothing to show here":
 *
 *  - the [match page](../../pages/MatchDetailPage.tsx), where it stands in for
 *    the official sheets until the clubs publish them around an hour before
 *    kick-off;
 *  - the [club page](../../pages/TeamDetailPage.tsx), where it sits beside
 *    Ligainsider's poster as a second, independent opinion.
 *
 * `enabled` is how a caller says "this fixture is still ahead of us". Once a
 * match has kicked off the prediction is not wrong so much as pointless — the
 * real eleven is on the pitch — and the file for a played matchday is gone by
 * the next night's run anyway.
 */
export function useExpectedLineup(
  competitionId: string | undefined,
  teamId: string | undefined,
  matchday: number | undefined,
  enabled = true,
): UseQueryResult<ExpectedLineup | null> {
  const isCovered = competitionId === POINTCAST_COMPETITION_ID

  return useQuery({
    queryKey: qk.pointcastLineup(
      competitionId ?? 'none',
      matchday ?? 0,
      teamId ?? 'none',
    ),
    enabled:
      enabled &&
      isCovered &&
      matchday !== undefined &&
      teamId !== undefined &&
      teamId !== '',
    staleTime: LINEUP_STALE_MS,
    // A file that is not there is not there; three retries only delay the
    // empty answer.
    retry: false,
    queryFn: () => fetchLineup(matchday as number, teamId as string),
  })
}

/** Both clubs of a fixture, by club id — see {@link useExpectedLineups}. */
export interface ExpectedLineups {
  byTeamId: Map<string, ExpectedLineup>
  /** True while either file is still on its way. */
  isPending: boolean
  /** True once both have answered and neither had anything. */
  isEmpty: boolean
}

/**
 * **Several clubs' expected lineups at once** — in practice the two sides of a
 * fixture.
 *
 * A fan-out rather than two calls to {@link useExpectedLineup} because the
 * caller draws one pitch out of both and has to know when *both* have
 * answered: two independent `isPending` flags would flicker an eleven onto the
 * grass against an empty half.
 *
 * The entries are the same ones the single-club hook fills, so a reader who
 * opens the match from a club page pays for one of the two files again and
 * nothing for the other.
 */
export function useExpectedLineups(
  competitionId: string | undefined,
  teamIds: (string | undefined)[],
  matchday: number | undefined,
  enabled = true,
): ExpectedLineups {
  const isCovered = competitionId === POINTCAST_COMPETITION_ID
  const wanted = teamIds.filter(
    (id): id is string => id !== undefined && id !== '',
  )
  const isAsking = enabled && isCovered && matchday !== undefined

  // Rebuilt per render, as everywhere `useQueries` is used here: it hands back
  // a fresh array each time and compares by key, so a memo would buy nothing.
  const queries = useQueries({
    queries: (isAsking ? wanted : []).map((teamId) => ({
      queryKey: qk.pointcastLineup(
        competitionId ?? 'none',
        matchday ?? 0,
        teamId,
      ),
      staleTime: LINEUP_STALE_MS,
      retry: false,
      queryFn: () => fetchLineup(matchday as number, teamId),
    })),
  })

  const byTeamId = new Map<string, ExpectedLineup>()
  for (const query of queries) {
    const lineup = query.data
    if (lineup != null) byTeamId.set(lineup.teamId, lineup)
  }

  const isPending = queries.some((query) => query.isPending)

  return { byTeamId, isPending, isEmpty: !isPending && byTeamId.size === 0 }
}
