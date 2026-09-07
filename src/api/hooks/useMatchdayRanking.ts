import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useMemo } from 'react'

import { useCompetitionPlayers } from '@/api/hooks/useCompetition'
import type {
  CompetitionPlayerSummary,
  MatchdayTopScorers,
  PositionKey,
} from '@/api/models'
import { qk } from '@/api/queryKeys'

/**
 * How many rows an archived matchday shows.
 *
 * The files hold **every** player who scored that day — around three hundred —
 * so this is a display decision rather than a data one, and it applies per
 * position as much as overall: *ABW* is the hundred best defenders, not the
 * defenders among the hundred best players. Raising it costs no re-seed.
 *
 * The live endpoint's own 25 is not raised to match. That cap is Kickbase's
 * and cannot be argued with; pretending otherwise by padding would be worse
 * than the honest difference between the two sources.
 */
export const ARCHIVE_LIMIT = 100

/** One row as `scripts/build-matchday-rankings.mjs` writes it. */
interface ArchivedPlayer {
  id: string
  name: string
  team: string
  pos: PositionKey
  points: number
  minutes: number
  goals: number
  assists: number
  matchId?: string
  image?: string
}

/** One `data/rankings/{competitionId}/matchday-{day}.json`. */
interface ArchivedRanking {
  competitionId: string
  seasonId?: string
  season?: string
  day: number
  generatedAt: string
  playerCount: number
  players: ArchivedPlayer[]
}

/**
 * Where the app's own ranking files live once built.
 *
 * `BASE_URL` rather than a leading slash: the Pages deploy is served from
 * `/litbase/`, and a root-relative path would 404 there while working
 * perfectly in `npm run dev` — the sort of difference that only shows up after
 * a push.
 */
function archiveUrl(competitionId: string, day: number): string {
  return `${import.meta.env.BASE_URL}data/rankings/${competitionId}/matchday-${String(day)}.json`
}

/**
 * **A past matchday's ranking, from the repo rather than from Kickbase.**
 *
 * Kickbase serves one ranking and it is always the current matchday's, so
 * everything before it is assembled by
 * [`scripts/build-matchday-rankings.mjs`](../../../scripts/build-matchday-rankings.mjs)
 * out of per-player performance histories and committed under `data/`. This
 * hook is the read side of that.
 *
 * **A missing file resolves to `null`, not an error.** "Nobody has run the
 * script for matchday 7 yet" is an ordinary state — every matchday is in it
 * until the script runs — and it deserves a sentence on screen, not a red
 * error box with a retry button that cannot help.
 *
 * Two ways a file can be missing, and both have to be caught:
 *
 *  - **404**, which is what a static host answers. Straightforward.
 *  - **200 with HTML**, which is what a dev server or a Pages SPA fallback
 *    answers when it rewrites an unknown path to `index.html`. Trusting the
 *    status alone here means `JSON.parse` throwing on `<!doctype html>` and a
 *    parse error standing in for "not seeded" — so the content type is
 *    checked too.
 *
 * Cached **forever**: a settled matchday's points do not change, and the file
 * only moves when someone re-runs the script and redeploys, which reloads the
 * app anyway.
 */
function useArchivedRanking(
  competitionId: string | undefined,
  day: number | undefined,
): UseQueryResult<MatchdayTopScorers | null> {
  return useQuery({
    queryKey: qk.competitionRankingArchive(competitionId ?? 'none', day ?? 0),
    enabled: competitionId !== undefined && day !== undefined,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    queryFn: async () => {
      const response = await fetch(
        archiveUrl(competitionId as string, day as number),
      )

      if (response.status === 404) return null
      if (!response.ok) {
        throw new Error(`Rangliste-Datei: HTTP ${String(response.status)}`)
      }
      if (
        !(response.headers.get('content-type') ?? '').includes(
          'application/json',
        )
      ) {
        return null
      }

      const file = (await response.json()) as ArchivedRanking
      return {
        day: file.day,
        players: file.players.map(
          (player) =>
            ({
              id: player.id,
              lastName: player.name,
              teamId: player.team,
              position: player.pos,
              points: player.points,
              minutesPlayed: player.minutes,
              goals: player.goals,
              assists: player.assists,
              // Not knowable after the fact, and nothing on this screen reads
              // it — a past matchday's injury list is not a thing the API
              // keeps.
              isInjured: false,
              image: player.image,
              matchId: player.matchId,
            }) satisfies CompetitionPlayerSummary,
        ),
      } satisfies MatchdayTopScorers
    },
  })
}

/** Where a ranking on screen came from. */
export type RankingSource = 'live' | 'archive'

export interface MatchdayRankingResult {
  data: MatchdayTopScorers | undefined
  isPending: boolean
  isError: boolean
  error: Error | null
  /** The archive has no file for this matchday yet. Not an error. */
  isMissing: boolean
  source: RankingSource
  refetch: () => void
}

/**
 * **The ranking for whichever matchday is selected**, from whichever of the two
 * sources can answer for it.
 *
 * | Selection | Source | Rows | Position filter |
 * | --------- | ------ | ---- | --------------- |
 * | The matchday being played | Kickbase, live | 25 | a request per position |
 * | Any earlier matchday | `data/`, ours | 100 | a slice of one fetch |
 *
 * **The current matchday always comes from Kickbase**, whether it is under way
 * or already played out. It is the one matchday the API can answer for, it is
 * the only source that moves while matches are running, and no file is written
 * for it — the [seed script](../../../scripts/build-matchday-rankings.mjs)
 * stops at `currentDay - 1` precisely so nothing can shadow the live list.
 *
 * **Both queries are always mounted, one of them idle**, because hooks cannot
 * be called conditionally. The idle one is passed `undefined` for its id, which
 * is how every hook in this app waits — so switching matchdays costs exactly
 * one request and neither source ever fetches for the other's turn.
 *
 * The position filter is deliberately handled *differently* on each side, and
 * that is not an inconsistency to tidy up. Live, it is the only way past the
 * 25-row cap, so it has to be a request. In the archive there is no cap to get
 * past — the file holds everyone — so a request would be four more files for
 * data already in memory.
 */
export function useMatchdayRanking({
  competitionId,
  day,
  currentDay,
  position,
  isLive,
}: {
  competitionId: string | undefined
  day: number | undefined
  currentDay: number | undefined
  position: PositionKey | undefined
  isLive: boolean
}): MatchdayRankingResult {
  /*
   * `currentDay === undefined` means the schedule has not landed. Reading that
   * as "an earlier matchday" would fire an archive fetch for the current one
   * and show a "not seeded" message for a second — so an unknown day counts as
   * live, which is the source that can always answer.
   */
  const source: RankingSource =
    day === undefined || currentDay === undefined || day === currentDay
      ? 'live'
      : 'archive'

  const live = useCompetitionPlayers(
    source === 'live' ? competitionId : undefined,
    { isLive, position },
  )
  const archive = useArchivedRanking(
    source === 'archive' ? competitionId : undefined,
    day,
  )

  /*
   * One `useMemo` over the whole result rather than one per field: the
   * consumer holds `data` across renders, and a fresh array every time would
   * re-run the ownership fan-out's dependency arrays for nothing.
   */
  const archiveData = archive.data
  const filtered = useMemo(() => {
    if (archiveData === null || archiveData === undefined) return undefined
    const players =
      position === undefined
        ? archiveData.players
        : archiveData.players.filter((player) => player.position === position)
    return { day: archiveData.day, players: players.slice(0, ARCHIVE_LIMIT) }
  }, [archiveData, position])

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
    isPending: archive.isPending,
    isError: archive.isError,
    error: archive.error,
    isMissing: archive.data === null,
    source,
    refetch: () => {
      void archive.refetch()
    },
  }
}
