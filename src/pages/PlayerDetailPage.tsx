import { useMemo } from 'react'
import { useLocation, useParams } from 'react-router'

import { useTeamDirectory } from '@/api/hooks/useCompetition'
import { useSeasonSchedule } from '@/api/hooks/useMatchday'
import {
  useOwnership,
  usePlayerDetail,
  usePlayerMarketValue,
  usePlayerPerformance,
} from '@/api/hooks/usePlayer'
import { useRanking } from '@/api/hooks/useRanking'
import {
  matchdayState,
  pointsScaleFor,
  type PlayerOwnership,
} from '@/api/models'
import { PlayerDetailsTab } from '@/components/player/PlayerDetailsTab'
import { PlayerHeader } from '@/components/player/PlayerHeader'
import { PlayerMarketTab } from '@/components/player/PlayerMarketTab'
import { PlayerPerformanceTab } from '@/components/player/PlayerPerformanceTab'
import { PlayerTabBar } from '@/components/player/PlayerTabBar'
import { PLAYER_TABS, playerTabFromPath } from '@/components/player/playerTabs'
import { SkeletonList } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { useActiveLeague } from '@/league/useActiveLeague'

/**
 * One player, in three views.
 *
 *   /leagues/:leagueId/players/:playerId              → Details
 *   /leagues/:leagueId/players/:playerId/performance  → Leistung
 *   /leagues/:leagueId/players/:playerId/market       → Markt
 *
 * Three routes, one component, with the active tab read out of the URL — the
 * same arrangement as the squad and duel-detail pages, and for the same
 * reasons: every view is linkable and survives a refresh.
 *
 * Reached by tapping a row on the squad page. There is no in-page back link —
 * the browser's own back, which is a system gesture on a phone, already does
 * it.
 *
 * ## What each tab costs
 *
 * Four requests in total, all cached under `qk.playerDetail`, none of them
 * blocking the others:
 *
 *  - the **profile**, which the squad page has usually already fetched for its
 *    lineup-probability badges, so arriving here is often free;
 *  - the **performance** history on Details and Leistung — Details needs it
 *    for the matchday strip and for the points and minutes on the Spiele rows;
 *  - the **market values** on Details and Markt;
 *  - the **transfer history**, which pairs with the market values to say what
 *    the owner paid.
 *
 * The header renders as soon as the profile lands, so switching tabs never
 * blanks the page — only the panel below it waits.
 */
export function PlayerDetailPage() {
  const { leagueId, competitionId } = useActiveLeague()
  const { playerId } = useParams()
  const location = useLocation()

  const tab = playerTabFromPath(location.pathname)
  const basePath = `/leagues/${leagueId}/players/${playerId ?? ''}`

  const player = usePlayerDetail(leagueId, playerId)
  const teams = useTeamDirectory(competitionId)

  // The career history backs both the Leistung tab and, on Details, the
  // current-matchday strip in the header and the points and minutes on the
  // Spiele rows — so it is fetched for either. It is the page's largest
  // response (a twelve-season career runs to ~110 kB uncompressed), which is
  // why the Markt tab, which needs none of it, does not pull it.
  const performance = usePlayerPerformance(
    leagueId,
    tab === PLAYER_TABS.market ? undefined : playerId,
  )
  const marketValue = usePlayerMarketValue(
    leagueId,
    tab === PLAYER_TABS.details || tab === PLAYER_TABS.market
      ? playerId
      : undefined,
  )

  const ownership = useOwnership(
    leagueId,
    player.data?.ownerId === undefined ? undefined : playerId,
    marketValue.data,
  )
  // `transferHistory` names the owner, but a manager who has never renamed
  // themselves arrives without `unm` on some entries — the standings always
  // have a name and an avatar, so they fill the gaps.
  const ranking = useRanking(leagueId)
  const resolved = withManagerFromRanking(ownership, ranking.data?.managers)

  // The running season is the first entry — the hook reverses the API's
  // oldest-first order. Its matches are indexed by matchday so the header and
  // the Spiele card can look up the one they need without scanning.
  const currentSeason = performance.data?.[0]
  // The bar under a match row is scaled to the player's own career best, so
  // both tabs measure him against the same number.
  const pointsScale = pointsScaleFor(performance.data ?? [])
  const matchesByDay = useMemo(() => {
    if (currentSeason === undefined) return undefined
    return new Map(currentSeason.matches.map((match) => [match.day, match]))
  }, [currentSeason])

  // The header's matchday strip appears **only while the matchday is being
  // played** — between matchdays it would be a permanent line saying nothing
  // the Spiele card does not. "Being played" is the schedule's own reading:
  // the first kick-off has passed and not every fixture reports finished. The
  // matchday list is the same cache entry the squad page fills, so this costs
  // no request of its own.
  const schedule = useSeasonSchedule(competitionId)
  const currentMatchday = schedule.data?.matchdays.find(
    (entry) => entry.day === schedule.data?.currentDay,
  )
  const isMatchdayLive =
    currentMatchday !== undefined && matchdayState(currentMatchday) === 'live'

  const currentFixture = isMatchdayLive
    ? player.data?.fixtures.find((fixture) => fixture.isCurrent)
    : undefined
  const currentMatch =
    currentFixture === undefined
      ? undefined
      : matchesByDay?.get(currentFixture.day)

  if (player.isPending) {
    return <SkeletonList rows={6} />
  }

  if (player.isError) {
    return (
      <ErrorState
        error={player.error}
        onRetry={() => {
          void player.refetch()
        }}
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PlayerHeader
        player={player.data}
        currentFixture={currentFixture}
        currentMatch={currentMatch}
        teams={teams.data}
        showStartProbability={tab === PLAYER_TABS.details}
      />

      {/* Claims the leftover height so the bottom bar stays at the bottom on
          a short tab as well as a long one — see `BottomTabBar`. */}
      <div className="flex min-h-0 flex-1 flex-col">
        {tab === PLAYER_TABS.details && (
          <PlayerDetailsTab
            player={player.data}
            ownership={resolved}
            teams={teams.data}
            matchesByDay={matchesByDay}
            appearances={currentSeason?.appearances}
            pointsScale={pointsScale}
            isLoadingMatches={performance.isPending}
          />
        )}

        {tab === PLAYER_TABS.performance &&
          (performance.isPending ? (
            <SkeletonList rows={8} />
          ) : performance.isError ? (
            <ErrorState
              error={performance.error}
              onRetry={() => {
                void performance.refetch()
              }}
            />
          ) : (
            <PlayerPerformanceTab
              seasons={performance.data}
              teams={teams.data}
            />
          ))}

        {tab === PLAYER_TABS.market &&
          (marketValue.isPending ? (
            <SkeletonList rows={8} />
          ) : marketValue.isError ? (
            <ErrorState
              error={marketValue.error}
              onRetry={() => {
                void marketValue.refetch()
              }}
            />
          ) : (
            <PlayerMarketTab player={player.data} history={marketValue.data} />
          ))}
      </div>

      <PlayerTabBar basePath={basePath} active={tab} />
    </div>
  )
}

/**
 * Fill in the owner's name and avatar from the standings when the transfer
 * history did not carry them.
 *
 * Returns the ownership unchanged when there is nothing to add, so the object
 * identity is stable and the tabs below do not re-render for nothing.
 */
function withManagerFromRanking(
  ownership: PlayerOwnership | undefined,
  managers: Array<{ id: string; name: string; image?: string }> | undefined,
): PlayerOwnership | undefined {
  if (ownership === undefined) return undefined
  if (
    ownership.managerName !== undefined &&
    ownership.managerImage !== undefined
  ) {
    return ownership
  }

  const manager = managers?.find((entry) => entry.id === ownership.managerId)
  if (manager === undefined) return ownership

  return {
    ...ownership,
    managerName: ownership.managerName ?? manager.name,
    managerImage: ownership.managerImage ?? manager.image,
  }
}
