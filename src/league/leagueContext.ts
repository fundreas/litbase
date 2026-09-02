import { createContext } from 'react'

import type { League } from '@/api/models'

export interface LeagueContextValue {
  /** The league from the URL. Guaranteed present inside `<LeagueProvider>`. */
  league: League
  leagueId: string
  competitionId: string
  /** Every league the user can switch to. */
  leagues: League[]
  /** Navigate to the same page in a different league. */
  switchLeague: (leagueId: string) => void
}

export const LeagueContext = createContext<LeagueContextValue | null>(null)
