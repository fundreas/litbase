import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'

import { get, post } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import { qk } from '@/api/queryKeys'
import type { ActivityCommentItem, ActivityCommentsResponse } from '@/api/types'

/**
 * A thread nobody is watching live. Long enough that reopening a sheet is
 * free, short enough that a comment posted from the Kickbase app shows up
 * within a session.
 */
const STALE_MS = 60_000

/** One comment, as far as it can be made out — see {@link toActivityComment}. */
export interface ActivityComment {
  /** The API's id where it has one, the index where it does not. */
  id: string
  /** `undefined` when no field this recognises held it — see the mapper. */
  text?: string
  authorName?: string
  authorImage?: string
  /** ISO 8601. */
  at?: string
}

/**
 * **The comment thread on one feed entry.**
 *
 * `GET /v4/leagues/{lid}/activitiesFeed/{aid}/comments` answers
 * `{ coc, it }` — the count beside the list, which is the strongest evidence
 * `coc` on a feed entry means the same thing.
 *
 * ## It is only asked for when there is something to ask for
 *
 * `enabled` is the caller saying the entry's own `coc` is above zero. Every
 * entry of both probed leagues reads `0`, so fetching on open would be one
 * request per sheet to be told "none" every time. Posting flips it on, because
 * by then there is one.
 *
 * The endpoint takes `start` and `max` — the published spec marks both
 * required and the live endpoint does not, answering the whole thread without
 * either. Nothing here pages: a thread long enough to need it has never been
 * seen, and inventing pagination for it would be inventing the shape of the
 * problem too.
 */
export function useActivityComments(
  leagueId: string | undefined,
  activityId: string | undefined,
  { enabled = true }: { enabled?: boolean } = {},
): UseQueryResult<ActivityComment[]> {
  return useQuery({
    queryKey: qk.activityComments(leagueId ?? 'none', activityId ?? 'none'),
    enabled: enabled && leagueId !== undefined && activityId !== undefined,
    staleTime: STALE_MS,
    select: (data: ActivityCommentsResponse) =>
      (data.it ?? []).map(toActivityComment),
    queryFn: () =>
      get<ActivityCommentsResponse>(
        endpoints.leagues.activityComments(
          leagueId as string,
          activityId as string,
        ),
      ),
  })
}

/**
 * **Write a comment on a feed entry.**
 *
 * `POST` to the same path, body `{ comm }`.
 *
 * **This is the one write in the app that has never been fired.** The body is
 * Kickbase's own published shape rather than a measurement, and it stayed that
 * way on purpose: a comment lands in a real league in front of real people,
 * and the surface is `GET` and `POST` and nothing else — `OPTIONS` on the
 * collection answers `allow: GET, POST`, there is no `DELETE` and no
 * single-comment route. A probe would have been permanent.
 *
 * So the first real exercise of this is a person writing a real comment they
 * meant to write, which is the only test that was ever going to be honest.
 *
 * On success both the thread and the feed are invalidated: the thread to show
 * the new comment, the feed because the entry's own `coc` moves with it.
 */
export function usePostActivityComment(
  leagueId: string | undefined,
  activityId: string | undefined,
): UseMutationResult<unknown, Error, string> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (text: string) => {
      if (leagueId === undefined || activityId === undefined) {
        throw new Error('Cannot comment without a league and an entry.')
      }
      return post<unknown>(
        endpoints.leagues.activityComments(leagueId, activityId),
        { comm: text },
      )
    },
    onSuccess: () => {
      if (leagueId === undefined) return
      void queryClient.invalidateQueries({
        queryKey: qk.activities(leagueId),
      })
    },
  })
}

/**
 * One wire comment, read as far as it can be.
 *
 * **Every field name here is a guess, and the guessing is the point.** There is
 * no live example — `coc` is `0` on every entry of both probed leagues, so
 * nobody has ever commented — and the published spec leaves the item schema
 * empty. Two sources, neither of which knows.
 *
 * So rather than betting on one spelling, this reads the ones this API uses for
 * the same things elsewhere: `comm` for the text, because that is what the
 * `POST` body calls it and a round trip usually echoes its own vocabulary;
 * `c` and `cmt` behind it; and `unm`/`uim`/`dt` for the author and the time,
 * which is how every other payload in this API names them.
 *
 * A field that matches nothing comes back `undefined` and simply is not drawn,
 * so a wrong guess costs a missing line rather than a broken sheet — and the
 * [thread](../../components/events/ActivityDialogs.tsx) says so plainly when it
 * has rows whose text it could not find, which is the signal that this needs
 * correcting rather than a silent blank.
 *
 * **Delete the hedging the moment a real comment is seen.** One is enough.
 */
export function toActivityComment(
  item: ActivityCommentItem,
  index: number,
): ActivityComment {
  return {
    id: item.i ?? String(index),
    text: item.comm ?? item.c ?? item.cmt,
    authorName: item.unm,
    authorImage: item.uim,
    at: item.dt,
  }
}
