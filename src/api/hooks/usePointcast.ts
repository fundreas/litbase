import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import type { PointcastMatchday, PointcastPrediction } from '@/api/models'
import { qk } from '@/api/queryKeys'
import { env } from '@/lib/env'

/**
 * The only competition the pointcast run publishes for: Bundesliga.
 *
 * Checked here rather than left to a 404, for the same reason
 * [the forecast](./usePlayerForecast.ts) checks it: a 2. Bundesliga or La Liga
 * league would otherwise pull a 160 kB file of players it does not own, once
 * per screen, and hit on none of them.
 */
const POINTCAST_COMPETITION_ID = '1'

/**
 * How long a file is trusted before it is worth asking again.
 *
 * The run is nightly and Pages puts a ten-minute cache in front of it, so an
 * hour is well inside "no point asking" — and short enough that a session left
 * open overnight picks the new matchday up by itself.
 */
const POINTCAST_STALE_MS = 60 * 60_000

/** One entry of `v1/matchday/{md}.json`, as the file writes it. */
interface PointcastWirePlayer {
  playerId?: unknown
  xP?: unknown
  p20?: unknown
  p50?: unknown
  p80?: unknown
  pStart?: unknown
  pPlay?: unknown
}

/** The file itself. */
interface PointcastWireMatchday {
  matchday?: unknown
  generatedAt?: unknown
  players?: unknown
}

/**
 * Where the files live. `env.pointcastBaseUrl`, so a fork or a local `output/`
 * on another port can be pointed at with `VITE_POINTCAST_BASE_URL` and nothing
 * else.
 */
function pointcastUrl(matchday: number): string {
  return `${env.pointcastBaseUrl}/v1/matchday/${String(matchday)}.json`
}

/** A finite number, or `undefined` for anything else the file might hold. */
function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/**
 * One wire entry as a {@link PointcastPrediction}, or `undefined` if it is not
 * one.
 *
 * Only `playerId` and `xP` are load-bearing: the rest of the figures describe
 * the prediction rather than being it, and a file that ever drops one of them
 * should cost the reader the detail line in the sheet, not the default on his
 * row. They fall back to `xP`, which is the one thing every consumer needs to
 * be a number.
 */
function toPrediction(
  entry: PointcastWirePlayer,
): PointcastPrediction | undefined {
  const playerId = entry.playerId
  const expected = finite(entry.xP)
  if (typeof playerId !== 'string' || playerId === '') return undefined
  if (expected === undefined) return undefined

  const round = (value: unknown): number =>
    Math.round(finite(value) ?? expected)
  const chance = (value: unknown): number => {
    const raw = finite(value)
    // Clamped rather than trusted: these are printed as percentages, and the
    // model has no business producing 1.02 — but a file is a file.
    return raw === undefined ? 0 : Math.min(1, Math.max(0, raw))
  }

  return {
    playerId,
    expected: Math.round(expected),
    low: round(entry.p20),
    median: round(entry.p50),
    high: round(entry.p80),
    startChance: chance(entry.pStart),
    playChance: chance(entry.pPlay),
  }
}

/**
 * **Every player's expected points for one matchday, predicted.**
 *
 * Not Kickbase: [litbase-pointcast](https://github.com/fundreas/litbase-pointcast)
 * trains a two-stage LightGBM model on the competition's own points, minutes
 * and market-value history — `P(plays)`, `P(starts)`, points given an
 * appearance, then quantiles — and publishes one static JSON file per matchday
 * on GitHub Pages. No token, no league; CORS is open to anyone, and the axios
 * instance is deliberately not used, because every interceptor on it (bearer
 * token, 401 re-auth, Kickbase error mapping) is wrong for a foreign static
 * host. Same shape of dependency, and same handling, as
 * [`usePlayerForecast`](./usePlayerForecast.ts).
 *
 * ```json
 * { "matchday": 3, "players": [{ "playerId": "1685", "xP": 230.9, … }] }
 * ```
 *
 * **The whole competition in one request, on purpose.** That is how the file
 * is published, and every screen that wants a prediction wants a squad's worth
 * at once — twenty rows would otherwise be twenty requests. One cache entry
 * per matchday serves the Kader, a rival's Kader, a club's roster and the
 * sheet on top of any of them.
 *
 * **A missing file resolves to `null`, not an error.** The run publishes the
 * *coming* matchday, so asking for the one after it — or for any matchday
 * before the model existed — is a plain 404, and the reader loses a default he
 * never typed. Nothing here surfaces an error: the expected-points feature is
 * an extra on screens that are complete without it.
 */
export function usePointcast(
  competitionId: string | undefined,
  matchday: number | undefined,
): UseQueryResult<PointcastMatchday | null> {
  const isCovered = competitionId === POINTCAST_COMPETITION_ID

  return useQuery({
    queryKey: qk.pointcast(competitionId ?? 'none', matchday ?? 0),
    enabled: isCovered && matchday !== undefined,
    staleTime: POINTCAST_STALE_MS,
    // A file that is not there is not there; three retries only delay the
    // empty answer.
    retry: false,
    queryFn: async () => {
      const day = matchday as number
      const response = await fetch(pointcastUrl(day))

      if (response.status === 404) return null
      if (!response.ok) {
        throw new Error(`Prognose: HTTP ${String(response.status)}`)
      }
      // The two shapes of "missing" a static host produces: a 404, and a 200
      // of `<!doctype html>` from a dev server or SPA fallback that rewrote
      // the unknown path. Same guard as `usePlayerForecast`.
      if (
        !(response.headers.get('content-type') ?? '').includes(
          'application/json',
        )
      ) {
        return null
      }

      const file = (await response.json()) as PointcastWireMatchday
      if (file === null || typeof file !== 'object') return null
      if (!Array.isArray(file.players)) return null

      const byPlayerId = new Map<string, PointcastPrediction>()
      for (const entry of file.players as PointcastWirePlayer[]) {
        const prediction = toPrediction(entry ?? {})
        if (prediction !== undefined) {
          byPlayerId.set(prediction.playerId, prediction)
        }
      }
      if (byPlayerId.size === 0) return null

      return {
        // The file's own number, falling back to the one asked for: what the
        // sheet prints has to be what the file is about, not what the caller
        // hoped it was.
        matchday: finite(file.matchday) ?? day,
        ...(typeof file.generatedAt === 'string'
          ? { generatedAt: file.generatedAt }
          : {}),
        byPlayerId,
      } satisfies PointcastMatchday
    },
  })
}
