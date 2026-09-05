import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import {
  toPosition,
  type CompetitionPlayerSummary,
  type TableRow,
} from '@/api/models'
import { qk } from '@/api/queryKeys'
import type {
  CompetitionPlayersResponse,
  CompetitionTableResponse,
} from '@/api/types'

const HOUR = 60 * 60_000

/**
 * **One fixture's players — not the competition's**, whatever the path says.
 *
 * Probed live 2026-09-05 against Bundesliga matchday 2: 25 rows across exactly
 * two clubs, every one carrying the same `mi`. The published documentation
 * calls it "every player in a competition" and this comment did too, which is
 * how the [club page](../../../docs/pages/team.md) came to build a squad by
 * filtering it on `tid` — and got nothing at all for seventeen clubs out of
 * eighteen.
 *
 * **For a club's squad use [`useTeamProfile`](./useTeam.ts)**, which serves the
 * whole thing in one request. There is currently no known endpoint that lists a
 * competition's players; `/players/search` answers 200 and is unprobed.
 *
 * Left in place for the [All players](../../../docs/pages/players.md) stub,
 * which is the only consumer and now knows what it is holding.
 */
export function useCompetitionPlayers(
  competitionId: string | undefined,
): UseQueryResult<CompetitionPlayerSummary[]> {
  return useQuery({
    queryKey: qk.competitionPlayers(competitionId ?? 'none'),
    enabled: competitionId !== undefined,
    staleTime: HOUR,
    queryFn: async () => {
      const data = await get<CompetitionPlayersResponse>(
        endpoints.competitions.players(competitionId as string),
      )
      return (data.it ?? []).map((player) => ({
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
      })) satisfies CompetitionPlayerSummary[]
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
