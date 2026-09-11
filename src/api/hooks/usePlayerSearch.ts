import {
  keepPreviousData,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import { toPosition, type PlayerSearchResult } from '@/api/models'
import { qk } from '@/api/queryKeys'
import type { PlayerSearchPlayer, PlayerSearchResponse } from '@/api/types'

const MINUTE = 60_000

/**
 * The shortest term worth sending.
 *
 * One letter matches a sizeable share of the competition and answers a list
 * nobody scrolls; two is where the result starts to be an answer. It is also
 * what keeps the first keystroke of every search from costing a request.
 */
export const SEARCH_MIN_LENGTH = 2

/**
 * How the wire words "nobody in this league owns him".
 *
 * The game names itself as the owner of a free player rather than omitting
 * the field — the same convention the
 * [transfer log](../../components/player/PlayerTransfersTab.tsx) reads, where
 * a purchase from nobody is a purchase from Kickbase.
 */
const UNOWNED = 'Kickbase'

function mapResult(item: PlayerSearchPlayer): PlayerSearchResult {
  return {
    id: item.pi,
    name: item.n,
    teamId: item.tid,
    position: item.pos === undefined ? undefined : toPosition(item.pos),
    image: item.pim,
    marketValue: item.mv,
    availability: item.st ?? 0,
    owner:
      item.onm === undefined || item.onm === UNOWNED ? undefined : item.onm,
    isListed: item.iotm ?? false,
  }
}

/**
 * **Players whose name matches**, anywhere in the competition.
 *
 * The only search in the app that reaches past what the reader already has in
 * front of them: a squad, a market page and a top-25 are each a list of
 * players who arrived for some other reason, and this one answers "where is
 * *this* player" — which is the question a scouting app is asked most.
 *
 * ## What the caller has to do
 *
 * Pass a term that is already **debounced and trimmed**. This hook does not
 * time anything: the page owns the keystrokes, and a hook that debounced
 * internally would still re-render on every one of them. Terms shorter than
 * {@link SEARCH_MIN_LENGTH} are simply not sent — the query idles rather than
 * erroring, so `isPending` on an empty box is not a loading state and the page
 * has to test the term itself before showing a spinner.
 *
 * Each term caches separately for a couple of minutes and the **previous
 * term's rows stay on screen while the next one is in flight**, so typing
 * through a name refines a list rather than flashing an empty one at every
 * letter. Ownership is the only part of the answer that ages — a player's name
 * and club do not — and two minutes is short enough that a transfer shows up
 * on the next search of the day.
 *
 * ## Unproven ground
 *
 * The response shape comes from the published spec's captured example, not
 * from a probe of this account's league — see
 * {@link PlayerSearchResponse}. What is **not** established: whether the
 * match is a prefix or a substring, whether it reaches first names (the rows
 * carry only a last name, which is no evidence either way), and whether an
 * empty result is `it: []` or a missing `it`. All three are handled
 * defensively here; none of them is worth guessing at in a comment that reads
 * as fact.
 */
export function usePlayerSearch(
  competitionId: string,
  leagueId: string,
  term: string,
): UseQueryResult<PlayerSearchResult[]> {
  return useQuery({
    queryKey: qk.playerSearch(leagueId, term),
    enabled: term.length >= SEARCH_MIN_LENGTH,
    staleTime: 2 * MINUTE,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const data = await get<PlayerSearchResponse>(
        endpoints.competitions.playerSearch(competitionId),
        { params: { leagueId, query: term } },
      )
      return (data.it ?? []).map(mapResult)
    },
  })
}
