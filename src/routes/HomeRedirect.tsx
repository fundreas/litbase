import { Navigate } from 'react-router'

import { loadLastLeagueId } from '@/auth/authStorage'

/**
 * `/` sends the user back to the league they last used. With nothing
 * remembered it falls through to `/leagues`, which resolves to their first
 * league.
 *
 * A stale id here is harmless: `LeagueProvider` validates it against the
 * user's memberships and bounces to `/leagues` if it no longer matches, and
 * that route then forwards to a league that does exist. No loop, because the
 * second hop only ever targets an id taken from the live list.
 */
export function HomeRedirect() {
  const lastLeagueId = loadLastLeagueId()
  return (
    <Navigate
      to={
        lastLeagueId === null
          ? '/leagues'
          : `/leagues/${lastLeagueId}/dashboard`
      }
      replace
    />
  )
}
