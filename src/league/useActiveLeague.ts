import { useContext } from 'react'

import { LeagueContext, type LeagueContextValue } from '@/league/leagueContext'

/** The league the current route is scoped to. Throws outside a league route. */
export function useActiveLeague(): LeagueContextValue {
  const context = useContext(LeagueContext)
  if (context === null) {
    throw new Error(
      'useActiveLeague must be used inside a /leagues/:leagueId route.',
    )
  }
  return context
}
