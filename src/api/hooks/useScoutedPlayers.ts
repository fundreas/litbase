import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import { useMemo } from 'react'

import { api, get, post } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import { qk } from '@/api/queryKeys'

/**
 * The scout list changes only when *this* account changes it, and the toggle
 * that does so writes the cache itself — so nothing here needs a short leash.
 * Ten minutes, the cadence the other per-league tables (the club directory,
 * the league settings) are read at.
 */
const STALE_MS = 10 * 60_000

/**
 * **The players this account has marked in one league** — Kickbase's scout
 * list, the wishlist a player is put on from his own page.
 *
 * Ids only, and deliberately: the response shape is **not known**. The
 * published spec declares `GET /v4/leagues/{id}/scoutedplayers` with an empty
 * schema, no example and generated prose — see
 * [`ScoutedPlayersResponse`](../types.ts) — so this hook reads the payload as
 * `unknown` and digs ids out of it with {@link scoutedIds} rather than
 * trusting a shape nobody has seen. A list of bare strings, an `it` of player
 * objects, or some third thing all produce the same answer to the only
 * question the app asks: *is he on the list?*
 *
 * **A failure is not an error anybody is shown.** Every consumer draws a star
 * or draws nothing, and "nothing" is also what an un-scouted league looks
 * like, so a market page whose scout list 404s is a market page without stars
 * rather than a market page with a banner across it. The toggle on a player's
 * page is the one place that cares, and it waits for this query before
 * claiming he is *not* on the list.
 */
export function useScoutedPlayers(
  leagueId: string | undefined,
): UseQueryResult<string[]> {
  return useQuery({
    queryKey: qk.scoutedPlayers(leagueId ?? 'none'),
    enabled: leagueId !== undefined,
    staleTime: STALE_MS,
    queryFn: async () => {
      const data = await get<unknown>(
        endpoints.leagues.scoutedPlayers(leagueId as string),
      )
      return scoutedIds(data)
    },
  })
}

/**
 * The same list as a set, for the rows that ask about one player at a time.
 *
 * Empty while the query is in flight and after a failure — a star that is not
 * drawn yet and a star there is no reason to draw look alike, which is the
 * right trade for a mark that decorates a row rather than carrying it.
 */
export function useScoutedSet(leagueId: string | undefined): Set<string> {
  const { data } = useScoutedPlayers(leagueId)
  return useMemo(() => new Set(data ?? []), [data])
}

/** Marking a player, or taking the mark off again. */
export interface ScoutVariables {
  playerId: string
  /** `true` adds him to the list, `false` removes him. */
  scouted: boolean
}

/**
 * **Put a player on the scout list, or take him off it.**
 *
 * One mutation for both directions: they are the same decision seen from two
 * sides, they hit the same path with two verbs (`POST` adds, `DELETE`
 * removes), and neither carries a body — the player id is the whole request.
 *
 * **The only Kickbase write in the app behind a plain toggle.** Everything
 * else that writes — bidding, listing, selling — moves money and opens a
 * dialog first. A scout mark moves nothing, is invisible to the rest of the
 * league, and is undone by tapping the same control again, so a confirmation
 * step would be ceremony around a bookmark.
 *
 * The cache is written **before** the request, because the star is the entire
 * feedback: a toggle that waits a round trip to fill in reads as a tap that
 * did not land. A rejected write puts the previous list back, and the list is
 * re-read either way — the server is what the next page load believes.
 */
export function useScoutPlayer(
  leagueId: string | undefined,
): UseMutationResult<void, Error, ScoutVariables, { previous?: string[] }> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ playerId, scouted }: ScoutVariables) => {
      if (leagueId === undefined) {
        throw new Error('Cannot scout a player without a league.')
      }
      const path = endpoints.leagues.scoutedPlayer(leagueId, playerId)
      if (scouted) {
        // No body: the spec declares none, and the id is already in the path.
        await post<unknown>(path)
      } else {
        // `DELETE`, which the shared helpers do not cover — the same route
        // `useWithdrawOffer` takes, straight through the axios instance.
        await api.delete(path)
      }
    },
    onMutate: async ({ playerId, scouted }) => {
      if (leagueId === undefined) return {}
      const key = qk.scoutedPlayers(leagueId)
      // Otherwise a refetch already in flight lands after the optimistic write
      // and restores the state the tap just changed.
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<string[]>(key)
      if (previous !== undefined) {
        queryClient.setQueryData<string[]>(
          key,
          scouted
            ? previous.includes(playerId)
              ? previous
              : [...previous, playerId]
            : previous.filter((id) => id !== playerId),
        )
      }
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (leagueId === undefined || context?.previous === undefined) return
      queryClient.setQueryData(qk.scoutedPlayers(leagueId), context.previous)
    },
    onSettled: async () => {
      if (leagueId === undefined) return
      await queryClient.invalidateQueries({
        queryKey: qk.scoutedPlayers(leagueId),
      })
    },
  })
}

/**
 * Every player id in a scout-list response, whatever the response looks like.
 *
 * Written against an **unseen payload**. What is certain is that the endpoint
 * answers with the players this account has marked; what shape they arrive in
 * is not, so this walks the three ways this API has ever expressed a
 * collection and takes the first that holds something:
 *
 *  - the payload is the array itself;
 *  - it is an object with the house envelope `it` — or `players`, or any
 *    other array-valued key, which is what makes this survive a field name
 *    nobody has guessed;
 *  - and each entry is either a bare id or an object carrying one under `i`,
 *    `pi`, `id` or `playerId`.
 *
 * Anything it cannot read becomes no ids rather than an exception: the worst
 * case is a market page without stars, which is what the page looked like
 * before this feature existed. **Replace it with a plain mapper the day a real
 * response is captured** — see
 * [docs/api/players.md](../../../docs/api/players.md#the-scout-list).
 */
export function scoutedIds(data: unknown): string[] {
  const ids: string[] = []
  for (const entry of listIn(data)) {
    const id = idOf(entry)
    if (id !== undefined && !ids.includes(id)) ids.push(id)
  }
  return ids
}

/** The first array in the payload, under any name. */
function listIn(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (typeof data !== 'object' || data === null) return []

  const record = data as Record<string, unknown>
  for (const key of ['it', 'players', 'sp', 'scoutedPlayers']) {
    const named = record[key]
    if (Array.isArray(named)) return named
  }
  for (const value of Object.values(record)) {
    if (Array.isArray(value)) return value
  }
  return []
}

/** One entry's player id — the entry itself, or the id inside it. */
function idOf(entry: unknown): string | undefined {
  if (typeof entry === 'string') return entry === '' ? undefined : entry
  if (typeof entry === 'number') return String(entry)
  if (typeof entry !== 'object' || entry === null) return undefined

  const record = entry as Record<string, unknown>
  for (const key of ['i', 'pi', 'id', 'playerId']) {
    const value = record[key]
    if (typeof value === 'string' && value !== '') return value
    if (typeof value === 'number') return String(value)
  }
  return undefined
}
