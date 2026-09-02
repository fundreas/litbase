import { Navigate } from 'react-router'

import { loadLastLeagueId } from '@/auth/authStorage'

/**
 * `/` sends the user back to the league they last used, or to the picker.
 * Whether that league still exists is validated by `LeagueProvider`, which
 * bounces to `/leagues` if not — so a stale id here is harmless.
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
