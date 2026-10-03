import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useMemo } from 'react'

import { playerPortraitUrl } from '@/api/cdn'
import {
  useCompetitionPlayers,
  type RankingScope,
} from '@/api/hooks/useCompetition'
import type {
  CompetitionPlayerSummary,
  MatchdayTopScorers,
  PositionKey,
} from '@/api/models'
import { qk } from '@/api/queryKeys'
import { env } from '@/lib/env'

/**
 * The only competition the pointcast run publishes for: Bundesliga.
 *
 * Checked here rather than left to a 404, for the same reason
 * [the prediction](./usePointcast.ts) checks it: a 2. Bundesliga or La Liga
 * league would otherwise ask for a file that cannot exist, once per chip, and
 * fall back to the live list anyway — so ask the live list first.
 */
const POINTCAST_COMPETITION_ID = '1'

/**
 * How many rows a pointcast list shows.
 *
 * Not a slice taken here: the files are published at exactly this depth,
 * overall *and* per position, so this number is documentation of what arrives
 * rather than a limit applied to it. A tie at the hundredth place is kept
 * whole, so a list can run a row or two over — which is why nothing truncates
 * to it.
 */
export const POINTCAST_LIMIT = 100

/**
 * How long a file is trusted before it is worth asking again.
 *
 * The run is nightly and Pages puts a ten-minute cache in front of it, so an
 * hour is well inside "no point asking". Not `Infinity`, even for a matchday
 * long settled: **a settled matchday's points still move.** Kimmich's matchday
 * 2 read `253` on 2026-09-07 and `254` a day later — Kickbase revising a
 * score, which the next nightly run picks up and a cache held forever would
 * never see.
 */
const RANKING_STALE_MS = 60 * 60_000

/** The positions as the files spell them, to the keys the app uses. */
const POSITION_BY_WIRE: Record<string, PositionKey> = {
  GK: 'gk',
  DEF: 'def',
  MID: 'mid',
  FWD: 'fwd',
}

/** One entry of an `overall` or a `byPosition` list, as the file writes it. */
interface WireEntry {
  rank?: unknown
  playerId?: unknown
  name?: unknown
  teamId?: unknown
  position?: unknown
  points?: unknown
  minutes?: unknown
}

/** One `v1/rankings/{matchday|season}/{md|current}.json`. */
interface WireRanking {
  matchday?: unknown
  complete?: unknown
  overall?: unknown
  byPosition?: unknown
}

/**
 * Where the files live. `env.pointcastBaseUrl`, so a fork or a local `output/`
 * on another port can be pointed at with `VITE_POINTCAST_BASE_URL` and nothing
 * else — the same knob [the prediction](./usePointcast.ts) turns.
 */
function rankingUrl(scope: RankingScope, matchday: number | 'current'): string {
  const file = matchday === 'current' ? 'current' : String(matchday)
  return `${env.pointcastBaseUrl}/v1/rankings/${scope}/${file}.json`
}

/** A finite number, or `undefined` for anything else the file might hold. */
function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/**
 * One wire entry as a row, or `undefined` if it is not one.
 *
 * Only the id, the name and the points are load-bearing. Everything else
 * describes the row rather than being it, and a file that ever drops one of
 * them should cost the reader a detail, not the row.
 *
 * `goals` and `assists` are **zero, not unknown** — the ranking files do not
 * carry them and nothing on this screen reads them. They are on
 * {@link CompetitionPlayerSummary} because the live list has them; widening
 * the model to `number | undefined` for a field no ranking renders would push
 * the question onto every consumer to answer the same way.
 */
function toRow(entry: WireEntry): CompetitionPlayerSummary | undefined {
  const id = entry.playerId
  const name = entry.name
  const points = finite(entry.points)
  if (typeof id !== 'string' || id === '') return undefined
  if (typeof name !== 'string' || name === '') return undefined
  if (points === undefined) return undefined

  const position =
    typeof entry.position === 'string'
      ? POSITION_BY_WIRE[entry.position]
      : undefined
  const rank = finite(entry.rank)

  return {
    id,
    lastName: name,
    // A player with no club — one who left mid-season — gets an empty id,
    // which the club lookup misses and the row then draws without a crest.
    teamId: typeof entry.teamId === 'string' ? entry.teamId : '',
    position: position ?? 'mid',
    points: Math.round(points),
    minutesPlayed: finite(entry.minutes) ?? 0,
    goals: 0,
    assists: 0,
    // Not knowable after the fact, and nothing on this screen reads it — a
    // past matchday's injury list is not a thing anyone keeps.
    isInjured: false,
    // The files name players without picturing them; the id is the only
    // handle on a face. Misses for a fifth of the list, which falls back to
    // initials — see `playerPortraitUrl`.
    image: playerPortraitUrl(id),
    ...(rank === undefined ? {} : { rank }),
  }
}

/** One list of the file, mapped — `overall`, or one of the four positions. */
function toRows(value: unknown): CompetitionPlayerSummary[] {
  if (!Array.isArray(value)) return []
  return (value as WireEntry[])
    .map((entry) => toRow(entry ?? {}))
    .filter((row): row is CompetitionPlayerSummary => row !== undefined)
}

/**
 * One file, mapped: the overall list in `players`, and the four position lists
 * beside it.
 *
 * The position lists sit **on the cache entry** rather than being derived at
 * render, because they are not derivable — each is its own top 100 and the
 * overall list does not contain them. That is the whole reason one request can
 * answer five chips.
 */
interface PointcastRanking extends MatchdayTopScorers {
  byPosition: Record<PositionKey, CompetitionPlayerSummary[]>
}

/**
 * **A points ranking from pointcast** — one matchday's, or the season's.
 *
 * Not Kickbase. [litbase-pointcast](https://github.com/fundreas/litbase-pointcast)
 * folds the competition's own matchday points into a top 100 per scope and
 * publishes it as static JSON on GitHub Pages, rebuilt nightly. No token, no
 * league; CORS is open to anyone, and the axios instance is deliberately not
 * used, because every interceptor on it — bearer token, 401 re-auth, Kickbase
 * error mapping — is wrong for a foreign static host. Same shape of
 * dependency, and same handling, as [`usePointcast`](./usePointcast.ts).
 *
 * ```json
 * { "matchday": 4, "complete": true,
 *   "overall":    [{ "rank": 1, "playerId": "8329", "points": 663, … }],
 *   "byPosition": { "GK": [ … ], "DEF": [ … ], "MID": [ … ], "FWD": [ … ] } }
 * ```
 *
 * **One request answers all five chips.** The file carries the overall list
 * *and* a real top 100 per position — *ABW* is the hundred best defenders,
 * not the defenders among the hundred best players — so the chips are five
 * readings of one cache entry rather than five requests. That is the mirror
 * image of the live list, where the position **is** the request because it is
 * the only way past Kickbase's 25-row cap.
 *
 * **A missing file resolves to `null`, not an error.** Before the season's
 * first kickoff there is nothing to rank, and a matchday the run has not
 * reached yet is an ordinary state — it deserves a sentence on screen, not a
 * red box with a retry button that cannot help.
 *
 * Two ways a file can be missing, and both have to be caught:
 *
 *  - **404**, which is what a static host answers. Straightforward.
 *  - **200 with HTML**, which is what a dev server or an SPA fallback answers
 *    when it rewrites an unknown path to `index.html`. Trusting the status
 *    alone means `JSON.parse` throwing on `<!doctype html>` and a parse error
 *    standing in for "not published" — so the content type is checked too.
 */
function usePointcastRanking(
  competitionId: string | undefined,
  scope: RankingScope,
  matchday: number | 'current' | undefined,
): UseQueryResult<PointcastRanking | null> {
  return useQuery({
    queryKey: qk.pointcastRanking(
      competitionId ?? 'none',
      scope,
      matchday ?? 0,
    ),
    enabled: competitionId !== undefined && matchday !== undefined,
    staleTime: RANKING_STALE_MS,
    // A file that is not there is not there; three retries only delay the
    // empty answer.
    retry: false,
    queryFn: async (): Promise<PointcastRanking | null> => {
      const key = matchday as number | 'current'
      const response = await fetch(rankingUrl(scope, key))

      if (response.status === 404) return null
      if (!response.ok) {
        throw new Error(`Rangliste: HTTP ${String(response.status)}`)
      }
      if (
        !(response.headers.get('content-type') ?? '').includes(
          'application/json',
        )
      ) {
        return null
      }

      const file = (await response.json()) as WireRanking
      if (typeof file !== 'object') return null

      const overall = toRows(file.overall)
      if (overall.length === 0) return null

      const byPosition = (file.byPosition ?? {}) as Record<string, unknown>

      return {
        /*
         * The file's own matchday, falling back to the one asked for. For
         * `current` there is nothing to fall back to — that URL is a
         * redirect in file form and only the payload knows where it lands —
         * so `0` stands for "the file did not say", which the footnote reads
         * as "do not print a matchday".
         */
        day: finite(file.matchday) ?? (key === 'current' ? 0 : key),
        players: overall,
        ...(typeof file.complete === 'boolean'
          ? { isComplete: file.complete }
          : {}),
        /*
         * Mapped eagerly, all four, rather than on the chip that is tapped:
         * the whole file is already in memory and parsed, and doing it in the
         * `queryFn` means one cache entry holds every answer the chips can
         * ask for. Four lists of a hundred rows is nothing beside the file
         * that was just downloaded to produce them.
         */
        byPosition: {
          gk: toRows(byPosition.GK),
          def: toRows(byPosition.DEF),
          mid: toRows(byPosition.MID),
          fwd: toRows(byPosition.FWD),
        },
      }
    },
  })
}

/** Where a ranking on screen came from. */
export type RankingSource = 'live' | 'pointcast'

export interface PlayerRankingResult {
  data: MatchdayTopScorers | undefined
  isPending: boolean
  isError: boolean
  error: Error | null
  /** Pointcast has no file for this scope yet. Not an error. */
  isMissing: boolean
  source: RankingSource
  refetch: () => void
}

/**
 * **The competition's best players**, from whichever of the two sources can
 * answer for the scope on screen.
 *
 * | Selection | Source | Rows | Position filter |
 * | --------- | ------ | ---- | --------------- |
 * | The matchday being played | Kickbase, live | 25 | a request per position |
 * | Any earlier matchday | pointcast | 100 | a reading of one file |
 * | The season | pointcast | 100 | a reading of one file |
 *
 * This is the **one place in the app that knows there are two sources**. Both
 * pages hand it a scope and take back a single shape;
 * [`PlayerRankingTab`](../../components/ranking/PlayerRankingTab.tsx) renders
 * it without branching on where it came from, bar the footnote that says so.
 *
 * ## Why the current matchday is still Kickbase's
 *
 * Kickbase serves exactly one ranking and it is always the **current**
 * matchday's — every matchday parameter it was offered is swallowed in
 * silence, which is why everything earlier needs another source at all. But
 * it is also the only source that **moves while matches are running**:
 * pointcast rebuilds once a night, so during a matchday its file is last
 * night's and would show a live list that never changes.
 *
 * So the split is by *time*, not by preference: the matchday in play comes
 * from the API, everything settled from the files. Season totals are the one
 * place that is a judgement rather than a rule — they move during a matchday
 * too, but nobody watches a season total move, and a hundred rows with real
 * placements beats twenty-five rows that are current to the minute.
 *
 * ## Two queries, one of them always idle
 *
 * Hooks cannot be called conditionally, so both are mounted and the one not
 * answering is passed `undefined` for its id — which is how every hook in
 * this app waits. Switching matchday or scope therefore costs exactly one
 * request, and neither source ever fetches for the other's turn.
 *
 * ## A competition pointcast does not cover
 *
 * It publishes for the Bundesliga and nothing else. A 2. Bundesliga or La Liga
 * league falls back to the live list for **every** matchday, not just the
 * current one, which is the same 25 rows those leagues have always had.
 */
export function usePlayerRanking({
  competitionId,
  scope,
  day,
  currentDay,
  position,
  isLive = false,
}: {
  competitionId: string | undefined
  scope: RankingScope
  /** The matchday to rank. Ignored for `scope: 'season'`. */
  day?: number | undefined
  /** The matchday being played, from the schedule. */
  currentDay?: number | undefined
  position: PositionKey | undefined
  isLive?: boolean
}): PlayerRankingResult {
  const isCovered = competitionId === POINTCAST_COMPETITION_ID

  /*
   * `currentDay === undefined` means the schedule has not landed. Reading that
   * as "an earlier matchday" would fire a pointcast fetch for the current one
   * and flash a "not published yet" message — so an unknown day counts as
   * live, which is the source that can always answer.
   */
  const isCurrentMatchday =
    scope === 'matchday' &&
    (day === undefined || currentDay === undefined || day === currentDay)

  const source: RankingSource =
    isCovered && !isCurrentMatchday ? 'pointcast' : 'live'

  const live = useCompetitionPlayers(
    source === 'live' ? competitionId : undefined,
    { isLive, position, scope },
  )
  const pointcast = usePointcastRanking(
    source === 'pointcast' ? competitionId : undefined,
    scope,
    // The season file is only ever read as "through wherever the season has
    // got to" — a season ranking through matchday 2 is a historical curio no
    // screen offers a way to ask for.
    scope === 'season' ? 'current' : day,
  )

  /*
   * One `useMemo` over the whole result rather than one per field: the
   * consumer holds `data` across renders, and a fresh object every time would
   * re-run the ownership fan-out's dependency arrays for nothing.
   */
  const file = pointcast.data
  const filtered = useMemo(() => {
    if (file === null || file === undefined) return undefined
    if (position === undefined) return file
    return { ...file, players: file.byPosition[position] }
  }, [file, position])

  if (source === 'live') {
    return {
      data: live.data,
      isPending: live.isPending,
      isError: live.isError,
      error: live.error,
      isMissing: false,
      source,
      refetch: () => {
        void live.refetch()
      },
    }
  }

  return {
    data: filtered,
    isPending: pointcast.isPending,
    isError: pointcast.isError,
    error: pointcast.error,
    isMissing: pointcast.data === null,
    source,
    refetch: () => {
      void pointcast.refetch()
    },
  }
}
