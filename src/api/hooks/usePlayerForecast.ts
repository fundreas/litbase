import {
  useQueries,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query'

import type { MarketValueDay, MarketValueForecast } from '@/api/models'
import { qk } from '@/api/queryKeys'
import { env } from '@/lib/env'

/**
 * The only competition the forecast API publishes for: Bundesliga.
 *
 * The nightly run takes `--competition-id`, and the deployed one leaves it at
 * `1`. Checking it here rather than letting the fetch 404 keeps a 2. Bundesliga
 * or La Liga league from asking for a file that provably does not exist — one
 * request per player page, all of them misses.
 */
const FORECAST_COMPETITION_ID = '1'

/**
 * How long a file is trusted before it is worth asking again.
 *
 * The data changes once a day, late in the evening (22:10 / 22:40 Berlin), and
 * Pages puts a ten-minute cache in front of it, so an hour is well inside "no
 * point asking" for an app left open across an afternoon — and short enough
 * that a session still running at midnight picks up the new run.
 */
const FORECAST_STALE_MS = 60 * 60_000

/** One entry of `data/{playerId}.json`. Integer euros, `YYYY-MM-DD`. */
interface ForecastPoint {
  date: string
  mv: number
}

/**
 * Where the forecast files live. `env.forecastBaseUrl`, so a fork or a local
 * `output/` served on another port can be pointed at with
 * `VITE_FORECAST_BASE_URL` and nothing else.
 */
function forecastUrl(playerId: string): string {
  return `${env.forecastBaseUrl}/data/${playerId}.json`
}

/**
 * One entry as a {@link MarketValueDay}.
 *
 * `timestamp` is midnight **UTC** of the date, which is how the Kickbase
 * mapper stamps its own days (`dt × 86 400 000`, days since the epoch), so the
 * two series sort and compare against each other without a timezone in the
 * middle.
 */
function toDay(
  point: ForecastPoint,
  previous: ForecastPoint | undefined,
  isForecast: boolean,
): MarketValueDay {
  const day: MarketValueDay = {
    timestamp: Date.parse(`${point.date}T00:00:00Z`),
    date: point.date,
    value: point.mv,
  }
  if (previous !== undefined) day.change = point.mv - previous.mv
  if (isForecast) day.isForecast = true
  return day
}

/**
 * **One player's file, mapped** — or `null` where there is none.
 *
 * Shared by the two hooks below so that a squad asked for twenty forecasts and
 * a page asking for one parse the same bytes the same way, and land on the
 * same cache entry.
 *
 * **A missing file resolves to `null`, not an error.** A player who joined the
 * competition after the last run simply has no file, and a forecast is an
 * extra on a page that is complete without it — so it must never put an error
 * box where the market history should be. Both shapes of "missing" are caught,
 * the same two `useMatchdayRanking` handles: a 404 from the static host, and a
 * 200 of `<!doctype html>` from a dev server or SPA fallback that rewrote the
 * unknown path.
 */
async function fetchForecast(
  playerId: string,
): Promise<MarketValueForecast | null> {
  const response = await fetch(forecastUrl(playerId))

  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`Prognose: HTTP ${String(response.status)}`)
  }
  if (
    !(response.headers.get('content-type') ?? '').includes('application/json')
  ) {
    return null
  }

  const series = (await response.json()) as ForecastPoint[]
  // Guarded rather than trusted: this is a foreign host, and a truncated or
  // reshaped file must read as "no forecast" instead of throwing inside the
  // render of a page that has everything else it needs.
  if (!Array.isArray(series)) return null

  const points = series.filter(
    (point) =>
      typeof point?.date === 'string' &&
      typeof point.mv === 'number' &&
      Number.isFinite(point.mv),
  )

  const [anchorPoint, ...rest] = points
  if (anchorPoint === undefined) return null

  return {
    anchor: toDay(anchorPoint, undefined, false),
    days: rest.map((point, index) =>
      toDay(point, index === 0 ? anchorPoint : rest[index - 1], true),
    ),
  } satisfies MarketValueForecast
}

/**
 * The query one player's forecast is read through, wherever it is read from.
 *
 * One builder rather than two literals: the squad hook below runs this by the
 * dozen through `useQueries`, and a key or a `staleTime` that drifted from the
 * single-player one would quietly fetch every file twice.
 */
function forecastQuery(competitionId: string | undefined, playerId: string) {
  return {
    queryKey: qk.playerForecast(competitionId ?? 'none', playerId),
    staleTime: FORECAST_STALE_MS,
    // A file that is not there is not there; retrying three times over a
    // second only delays the empty answer.
    retry: false,
    queryFn: () => fetchForecast(playerId),
  }
}

/**
 * **The next five days of a player's market value, predicted.**
 *
 * Not Kickbase: [litbase-foresight](https://github.com/fundreas/litbase-foresight)
 * trains a random forest on the competition's own market-value and performance
 * history every night after the ~20:00 UTC recalculation and publishes one
 * file per player as static JSON on GitHub Pages. No token, no league — CORS
 * is open to anyone, and the axios instance is deliberately not used, because
 * every interceptor on it (bearer token, 401 re-auth, Kickbase error mapping)
 * is wrong for a foreign static host.
 *
 * ```json
 * [{"date":"2026-09-09","mv":67888497},{"date":"2026-09-10","mv":67603766}, …]
 * ```
 *
 * **The first entry is a real value, not a forecast** — the newest market
 * value the run could see, with the date Kickbase stamped it — so it becomes
 * {@link MarketValueForecast.anchor} and only the five behind it are days.
 * That entry can be a day or two old: the run publishes from whatever the API
 * held, so its day-1 prediction is sometimes *today*. Which days are actually
 * still ahead is `forecastAhead`'s job, against the history the app already
 * has; this hook only maps the file.
 *
 * A file that is not there resolves to `null` rather than erroring — see
 * {@link fetchForecast}.
 */
export function usePlayerForecast(
  competitionId: string | undefined,
  playerId: string | undefined,
): UseQueryResult<MarketValueForecast | null> {
  const isCovered = competitionId === FORECAST_COMPETITION_ID

  return useQuery({
    ...forecastQuery(competitionId, playerId ?? 'none'),
    enabled: isCovered && playerId !== undefined,
  })
}

/**
 * **A whole squad's forecasts at once**, by player id, for the
 * [scenario](../../pages/WhatIfPage.tsx)'s target day.
 *
 * One request per player, which sounds worse than it is: these are ~300-byte
 * static files on a CDN behind one connection, and they are the same cache
 * entries the player page fills, so a squad looked at twice is fetched once.
 * The page that asks already fires a Kickbase detail request per player
 * without a lineup probability, which is the same count against a far heavier
 * endpoint.
 *
 * Players **without** a file are simply absent from the map — the caller falls
 * back to the market value Kickbase has for them today, which is the only
 * honest substitute for a prediction nobody made.
 */
export function useSquadForecasts(
  competitionId: string | undefined,
  playerIds: string[],
): Map<string, MarketValueForecast> {
  const isCovered = competitionId === FORECAST_COMPETITION_ID

  const queries = useQueries({
    queries: isCovered
      ? playerIds.map((playerId) => forecastQuery(competitionId, playerId))
      : [],
  })

  // Rebuilt per render rather than memoised, as in `useStartProbabilities`:
  // `useQueries` hands back a fresh array every time, so memoising it needs a
  // surrogate key that is harder to trust than the twenty map writes it saves.
  const byPlayerId = new Map<string, MarketValueForecast>()
  for (const [index, query] of queries.entries()) {
    const playerId = playerIds[index]
    const forecast = query.data
    if (playerId === undefined || forecast === undefined || forecast === null) {
      continue
    }
    byPlayerId.set(playerId, forecast)
  }

  return byPlayerId
}
