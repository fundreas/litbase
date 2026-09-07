import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import {
  POSITION_CODE,
  toPosition,
  type MatchdayTopScorers,
  type PositionKey,
  type TableRow,
} from '@/api/models'
import { LIVE_POLL_MS } from '@/api/polling'
import { qk } from '@/api/queryKeys'
import type {
  CompetitionPlayersResponse,
  CompetitionTableResponse,
} from '@/api/types'

const HOUR = 60 * 60_000

/**
 * **The current matchday's twenty-five best players**, points descending.
 *
 * Not "every player in a competition", which is what the published
 * documentation calls it — but not "one fixture's players" either, which is
 * what this comment claimed until 2026-09-06 and what the endpoint looks like
 * if you probe it at the wrong moment.
 *
 * The earlier reading came from a probe taken *mid-matchday*, when exactly one
 * fixture had been played: all 25 rows carried that one `mi`, across its two
 * clubs, because those were the only players who had scored anything yet. Read
 * back the morning after the same matchday it spans **seven matches and nine
 * clubs**, still 25 rows, still sorted by points. The list was never scoped to
 * a fixture; it was scoped to *having points*, and early on a matchday that is
 * nearly the same thing.
 *
 * What the old reading got right is that **it is not a way to enumerate a
 * club's squad** — filtering it on `tid` is what gave the
 * [club page](../../../docs/pages/team.md) an empty Kader for seventeen clubs
 * out of eighteen. A top-25 list simply does not contain most players. For a
 * club's squad use [`useTeamProfile`](./useTeam.ts).
 *
 * ## The current matchday, and no way to ask for another
 *
 * `?dayNumber=`, `?matchId=`, `?mi=` and six more spellings of "which
 * matchday" were each probed and each answered the identical rows. So this is
 * always the competition's *current* matchday, which is why the
 * [matchday page](../../../docs/pages/matchday.md) reads every earlier one out
 * of the app's own files instead — see
 * [`useMatchdayRanking`](./useMatchdayRanking.ts), which is the only place that
 * chooses between the two.
 *
 * `day` is returned alongside the players for exactly that reason: the caller
 * needs the endpoint's own answer to "which matchday is this", not the
 * schedule's.
 *
 * **`position` is the one parameter that bites**, and the twenty-five cap
 * applies to each filtered list separately — so the four positions are four
 * top-25s and reach 93 players between them where the unfiltered call reaches
 * 25. That is what the chips on the Rangliste are: not a client-side filter
 * over a list of 25, which would only ever shrink it, but four more requests
 * that each go deeper than the unfiltered one can.
 *
 * A **keeper list comes back short** — 18 on a nine-fixture matchday, two per
 * fixture — because that is every keeper who played, not a slice of them. So a
 * list under 25 rows is not a signal that anything was truncated or dropped.
 *
 * The endpoint's other parameter, `sorting=1`, swaps the matchday for **season
 * totals**. It is not sent: the Rangliste is about one matchday at a time, and
 * a season leaderboard was tried there and removed for saying something the
 * screen was not asking. The path builder still takes it, and
 * [docs/api/competitions.md](../../../docs/api/competitions.md) records what it
 * does, so wiring it back up is a parameter rather than a re-probe.
 *
 * ## Cost
 *
 * Polls at the live rate while a matchday is running — it is one small
 * response, and it is the only bulk source of matchday points in the API, so
 * the ranking moves without the per-player fan-out
 * [`useMatchdayPoints`](./useMatchdayPoints.ts) pays for.
 *
 * Only the position on screen polls; the other four sit in the cache going
 * stale, and are refetched on the tap that brings one back.
 */
export function useCompetitionPlayers(
  competitionId: string | undefined,
  {
    isLive = false,
    position,
  }: {
    isLive?: boolean
    position?: PositionKey
  } = {},
): UseQueryResult<MatchdayTopScorers> {
  return useQuery({
    queryKey: qk.competitionPlayers(competitionId ?? 'none', position),
    enabled: competitionId !== undefined,
    // While a matchday runs the list reorders every few minutes; between
    // matchdays it cannot change at all until the next one kicks off.
    staleTime: isLive ? 0 : HOUR,
    refetchInterval: isLive ? LIVE_POLL_MS : (false as const),
    queryFn: async () => {
      const data = await get<CompetitionPlayersResponse>(
        endpoints.competitions.players(competitionId as string, {
          position:
            position === undefined ? undefined : POSITION_CODE[position],
        }),
      )
      return {
        day: data.day,
        players: (data.it ?? []).map((player) => ({
          id: player.pi,
          lastName: player.n,
          teamId: player.tid,
          position: toPosition(player.pos),
          points: player.p,
          minutesPlayed: player.mt ?? 0,
          goals: player.g ?? 0,
          assists: player.a ?? 0,
          isInjured: player.il ?? false,
          image: player.pim,
          matchId: player.mi,
        })),
      } satisfies MatchdayTopScorers
    },
  })
}

/** A club, as anything that only needs to name one sees it. */
export interface TeamSummary {
  id: string
  name: string
  image?: string
}

/**
 * A real table only moves on a matchday, and the club names and crests in it
 * never move at all. One figure for both readings below, because they are one
 * cache entry — see {@link useTableQuery}.
 */
const TABLE_STALE_MS = 10 * 60_000

/*
 * Module-level so React Query can memoise `select` on identity — an arrow
 * created during render would re-map on every one and hand consumers a fresh
 * array (or Map) each time, quietly breaking every `useMemo` downstream.
 * Same reason, and the same shape, as the selectors in `useMatchday`.
 */

function selectTeamDirectory(
  data: CompetitionTableResponse,
): Map<string, TeamSummary> {
  const byId = new Map<string, TeamSummary>()
  for (const row of data.it ?? []) {
    byId.set(row.tid, { id: row.tid, name: row.tn, image: row.tim })
  }
  return byId
}

function selectTable(data: CompetitionTableResponse): TableRow[] {
  return (data.it ?? []).map((row) => ({
    teamId: row.tid,
    teamName: row.tn,
    teamImage: row.tim,
    placement: row.cpl,
    previousPlacement: row.pcpl,
    points: row.cp,
    matchesPlayed: row.mc,
    goalDifference: row.gd,
    kickbasePoints: row.sp ?? 0,
  })) satisfies TableRow[]
}

/**
 * The league table — one request, two views.
 *
 * **The cache holds the raw payload and every reading is a `select`.** That is
 * not a style choice: both hooks below key on `qk.competitionTable`, so React
 * Query gives them one entry between them, and an entry can only hold one
 * shape. Mapping inside `queryFn` instead — as the table hook did until
 * 2026-09-05 — means whichever query resolves *first* decides what is stored,
 * and the other one then reads a shape it was never written for:
 *
 *  - directory first → the entry holds `{ it: [...] }`, and the table hook,
 *    having no `select` of its own, hands that object straight out as its
 *    `TableRow[]`. Every consumer's `.find` / `.map` throws.
 *  - table first → the entry holds `TableRow[]`, and `selectTeamDirectory`
 *    reads `data.it` off an array, gets `undefined`, and returns an **empty
 *    map**. No error at all: every club silently loses its name.
 *
 * Neither hook was wrong on its own, and nothing hit it while no screen called
 * both. The [club page](../../../docs/pages/team.md) calls both — the header
 * needs the club's name, the Übersicht needs its standings row — and crashed on
 * the first of the two orderings.
 *
 * The same arrangement `useMatchdaysQuery` uses for the season payload, and for
 * the same reason: two readings of one response, one network cost.
 */
function useTableQuery<T>(
  competitionId: string | undefined,
  select: (data: CompetitionTableResponse) => T,
): UseQueryResult<T> {
  return useQuery({
    queryKey: qk.competitionTable(competitionId ?? 'none'),
    enabled: competitionId !== undefined,
    staleTime: TABLE_STALE_MS,
    select,
    queryFn: () =>
      get<CompetitionTableResponse>(
        endpoints.competitions.table(competitionId as string),
      ),
  })
}

/**
 * Team id → name and crest, built from the league table.
 *
 * The one lookup of its kind: there is no `/v4/competitions/{id}/teams`
 * endpoint (404), and the fixture payloads carry crests and three-letter
 * symbols but never a full name.
 *
 * **It only knows this season's clubs.** A relegated side in a player's older
 * seasons resolves to nothing, which is why every consumer pairs it with the
 * crest the payload itself carries and treats the name as the optional half.
 *
 * Reads the same cache entry as {@link useCompetitionTable}, so a page showing
 * both pays for one request.
 */
export function useTeamDirectory(
  competitionId: string | undefined,
): UseQueryResult<Map<string, TeamSummary>> {
  return useTableQuery(competitionId, selectTeamDirectory)
}

/** The real-world league table. */
export function useCompetitionTable(
  competitionId: string | undefined,
): UseQueryResult<TableRow[]> {
  return useTableQuery(competitionId, selectTable)
}
