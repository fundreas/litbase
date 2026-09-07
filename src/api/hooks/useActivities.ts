import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from '@tanstack/react-query'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import type { LeagueActivity } from '@/api/models'
import { qk } from '@/api/queryKeys'
import {
  ACTIVITY_TYPE,
  type ActivitiesFeedResponse,
  type ActivityAchievementData,
  type ActivityBonusData,
  type ActivityItem,
  type ActivityLeagueData,
  type ActivityListingData,
  type ActivityManagerData,
  type ActivityMatchdayData,
  type ActivityTransferData,
} from '@/api/types'

/**
 * How many entries one request asks for.
 *
 * The API's own default, and about two screens of rows. A page that is
 * **shorter than this** is the end of the feed — the response carries no
 * total and no cursor, so that is the only signal there is.
 */
export const ACTIVITIES_PAGE_SIZE = 25

/**
 * The event types the feed asks for — **everything but a player being
 * listed** (`3`).
 *
 * Listings are nine entries in ten: Kickbase puts a player on the market about
 * once an hour, so a feed that carried them was a market log with the odd
 * transfer in it, and the market page already shows the same players. Sent as
 * the API's `filter`, so the pages that arrive are the rows that render — a
 * page filtered client-side could come back empty and stop the scroll while
 * the feed still had entries.
 *
 * Only decoded types are listed; a code this list does not name will never
 * arrive, which is also why `unknown` is a mapper fallback rather than a row.
 */
const FEED_TYPES = [
  ACTIVITY_TYPE.MANAGER_JOINED,
  ACTIVITY_TYPE.MANAGER_LEFT,
  ACTIVITY_TYPE.TRANSFER,
  ACTIVITY_TYPE.MATCHDAY_FINISHED,
  ACTIVITY_TYPE.LOGIN_BONUS,
  ACTIVITY_TYPE.ACHIEVEMENT,
  ACTIVITY_TYPE.LEAGUE_FOUNDED,
].join(',')

/**
 * The league's event log, one page at a time.
 *
 * An **infinite query**: `?start=` is the page parameter, the offset of the
 * first entry wanted, and the next offset is simply the number of entries
 * fetched so far. The cache entry is the pages themselves, so scrolling back
 * to the dashboard shows everything already loaded rather than the first page
 * again; `select` flattens and maps them, and — as everywhere — is a
 * module-level constant so it is memoised on identity.
 *
 * The first page goes stale after a minute rather than the default two: the
 * feed is the one place a transfer someone else just made shows up, and it is
 * read right after making one's own.
 */
export function useActivities(
  leagueId: string | undefined,
): UseInfiniteQueryResult<LeagueActivity[]> {
  return useInfiniteQuery({
    queryKey: qk.activities(leagueId ?? 'none'),
    enabled: leagueId !== undefined,
    staleTime: 60_000,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) =>
      get<ActivitiesFeedResponse>(
        endpoints.leagues.activitiesFeed(leagueId as string),
        {
          params: {
            start: pageParam,
            max: ACTIVITIES_PAGE_SIZE,
            filter: FEED_TYPES,
          },
        },
      ),
    getNextPageParam: (lastPage, pages) =>
      (lastPage.af ?? []).length < ACTIVITIES_PAGE_SIZE
        ? undefined
        : pages.reduce((count, page) => count + (page.af ?? []).length, 0),
    select: selectActivities,
  })
}

function selectActivities(
  data: InfiniteData<ActivitiesFeedResponse>,
): LeagueActivity[] {
  return data.pages.flatMap((page) => (page.af ?? []).map(toActivity))
}

/**
 * Decode one entry by its type code. `data` is typed loosely on the wire
 * because its shape depends on `t`; the cast happens here, once, against the
 * shapes documented in `types.ts`.
 */
export function toActivity(item: ActivityItem): LeagueActivity {
  const base = { id: item.i, at: item.dt }
  const data = item.data ?? {}

  switch (item.t) {
    case ACTIVITY_TYPE.PLAYER_LISTED: {
      const listing = data as unknown as ActivityListingData
      return {
        ...base,
        kind: 'listed',
        playerId: listing.pi,
        playerName: playerName(listing.fn, listing.ln),
        teamId: listing.tid,
        marketValue: listing.mv,
        playerImage: listing.pim,
        teamImage: listing.tim,
      }
    }
    case ACTIVITY_TYPE.TRANSFER: {
      const transfer = data as unknown as ActivityTransferData
      const isSale = transfer.t === 2
      return {
        ...base,
        kind: 'transfer',
        playerId: transfer.pi,
        playerName: transfer.pn,
        teamId: transfer.tid,
        direction: isSale ? 'sold' : 'bought',
        managerName: (isSale ? transfer.slr : transfer.byr) ?? '',
        price: transfer.trp,
        playerImage: transfer.pim,
        teamImage: transfer.tim,
      }
    }
    case ACTIVITY_TYPE.MANAGER_JOINED:
    case ACTIVITY_TYPE.MANAGER_LEFT: {
      const manager = data as unknown as ActivityManagerData
      return {
        ...base,
        kind: item.t === ACTIVITY_TYPE.MANAGER_JOINED ? 'joined' : 'left',
        managerId: manager.i,
        managerName: manager.n,
        managerImage: manager.uim,
      }
    }
    case ACTIVITY_TYPE.MATCHDAY_FINISHED: {
      const matchday = data as unknown as Partial<ActivityMatchdayData>
      // `data` is `{}` when the viewer sat the matchday out; the entry still
      // marks the moment the matchday was scored, so it is kept — without a
      // day the label falls back to the generic form.
      return {
        ...base,
        kind: 'matchday',
        day: matchday.day ?? 0,
        label: matchday.mdln ?? 'Spieltag',
        placement: matchday.pl,
      }
    }
    case ACTIVITY_TYPE.ACHIEVEMENT: {
      const achievement = data as unknown as ActivityAchievementData
      return {
        ...base,
        kind: 'achievement',
        achievementType: achievement.t,
        title: achievement.n,
        description: achievement.d,
      }
    }
    case ACTIVITY_TYPE.LOGIN_BONUS: {
      const bonus = data as unknown as ActivityBonusData
      return { ...base, kind: 'bonus', amount: bonus.bn, day: bonus.day }
    }
    case ACTIVITY_TYPE.LEAGUE_FOUNDED: {
      const league = data as unknown as ActivityLeagueData
      return { ...base, kind: 'founded', leagueName: league.lnm }
    }
    default:
      return { ...base, kind: 'unknown', type: item.t }
  }
}

/** `"Tom Bischof"`, or just `"Bernardo"` for a player with no first name. */
function playerName(first: string | undefined, last: string): string {
  return first === undefined || first === '' ? last : `${first} ${last}`
}
