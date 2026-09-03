import { useLocation, useParams } from 'react-router'

import { useTeamDirectory } from '@/api/hooks/useCompetition'
import {
  useOwnership,
  usePlayerDetail,
  usePlayerMarketValue,
  usePlayerPerformance,
} from '@/api/hooks/usePlayer'
import { useRanking } from '@/api/hooks/useRanking'
import type { PlayerOwnership } from '@/api/models'
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
 *  - the **performance** history, only once the Leistung tab is opened;
 *  - the **market values**, only once the Markt tab is opened;
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

  // Both are `enabled` only for the tab that renders them: the market history
  // is a year of daily values and the performance list is a full career, and
  // neither is worth fetching for someone who opened the page to read a
  // market value off the header.
  const performance = usePlayerPerformance(
    leagueId,
    tab === PLAYER_TABS.performance ? playerId : undefined,
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
      <PlayerHeader player={player.data} />

      <div className="flex-1">
        {tab === PLAYER_TABS.details && (
          <PlayerDetailsTab
            player={player.data}
            ownership={resolved}
            teams={teams.data}
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
            <PlayerMarketTab
              player={player.data}
              history={marketValue.data}
              ownership={resolved}
            />
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
