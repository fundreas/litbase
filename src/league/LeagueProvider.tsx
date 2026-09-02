import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo } from 'react'
import {
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router'

import { useLeagues } from '@/api/hooks/useLeagues'
import { saveLastLeagueId } from '@/auth/authStorage'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { LeagueContext, type LeagueContextValue } from '@/league/leagueContext'

/**
 * Resolves `/leagues/:leagueId/*` into a league and puts it on context.
 *
 * The URL is the source of truth for which league is active — that is what
 * makes a refresh, a bookmark and a shared link all land in the right place.
 * This component only validates the id against the user's memberships and
 * remembers it so `/` can restore the last league on the next visit.
 */
export function LeagueProvider() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const leaguesQuery = useLeagues()

  const leagues = leaguesQuery.data
  const league = useMemo(
    () => leagues?.find((candidate) => candidate.id === leagueId),
    [leagues, leagueId],
  )

  useEffect(() => {
    if (league) saveLastLeagueId(league.id)
  }, [league])

  const switchLeague = useCallback(
    (nextLeagueId: string) => {
      if (nextLeagueId === leagueId) return
      saveLastLeagueId(nextLeagueId)
      // Cached data for the league being left is worthless to the new one; drop
      // it so a stale squad can never flash under the new league's name.
      if (leagueId !== undefined) {
        queryClient.removeQueries({ queryKey: ['league', leagueId] })
      }
      // Stay on the equivalent page in the new league: /leagues/A/market
      // becomes /leagues/B/market.
      const prefix = `/leagues/${leagueId ?? ''}`
      const subPath = location.pathname.startsWith(prefix)
        ? location.pathname.slice(prefix.length)
        : ''
      void navigate(
        `/leagues/${nextLeagueId}${subPath === '' ? '/dashboard' : subPath}`,
        { replace: true },
      )
    },
    [leagueId, location.pathname, navigate, queryClient],
  )

  if (leaguesQuery.isPending) {
    return <LoadingState label="Ligen werden geladen …" />
  }

  if (leaguesQuery.isError) {
    return (
      <ErrorState
        error={leaguesQuery.error}
        onRetry={() => void leaguesQuery.refetch()}
      />
    )
  }

  // Unknown or no-longer-joined league: hand off to /leagues, which forwards
  // to a league that does exist, rather than render a page full of 404s.
  if (league === undefined) {
    return <Navigate to="/leagues" replace />
  }

  const value: LeagueContextValue = {
    league,
    leagueId: league.id,
    competitionId: league.competitionId,
    leagues: leagues ?? [],
    switchLeague,
  }

  return (
    <LeagueContext.Provider value={value}>
      <Outlet />
    </LeagueContext.Provider>
  )
}
