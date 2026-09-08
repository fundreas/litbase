import { useMemo } from 'react'
import { useLocation, useParams } from 'react-router'

import { useTeamDirectory } from '@/api/hooks/useCompetition'
import { useSeasonSchedule } from '@/api/hooks/useMatchday'
import {
  useOwnership,
  usePlayerDetail,
  usePlayerMarketValue,
  usePlayerPerformance,
  usePlayerTransfers,
} from '@/api/hooks/usePlayer'
import { useRanking } from '@/api/hooks/useRanking'
import {
  matchdayState,
  pointsScaleFor,
  type PlayerOwnership,
  type PlayerTransfer,
  type TransferParty,
} from '@/api/models'
import { useAuth } from '@/auth/useAuth'
import { PlayerDetailsTab } from '@/components/player/PlayerDetailsTab'
import { PlayerHeader } from '@/components/player/PlayerHeader'
import { PlayerMarketTab } from '@/components/player/PlayerMarketTab'
import { PlayerPerformanceTab } from '@/components/player/PlayerPerformanceTab'
import { PlayerTabBar } from '@/components/player/PlayerTabBar'
import { PLAYER_TABS, playerTabFromPath } from '@/components/player/playerTabs'
import { PlayerTransfersTab } from '@/components/player/PlayerTransfersTab'
import { SkeletonList } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { useActiveLeague } from '@/league/useActiveLeague'

/**
 * One player, in four views.
 *
 *   /leagues/:leagueId/players/:playerId              → Details
 *   /leagues/:leagueId/players/:playerId/performance  → Leistung
 *   /leagues/:leagueId/players/:playerId/market       → Markt
 *   /leagues/:leagueId/players/:playerId/transfers    → Transfers
 *
 * Four routes, one component, with the active tab read out of the URL — the
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
 *  - the **market values** everywhere but Leistung — the owner panel, the
 *    chart, and the value each transfer is measured against;
 *  - the **transfer history**, which pairs with those values to say what the
 *    owner paid, and which the Transfers tab lists in full.
 *
 * The header renders as soon as the profile lands, so switching tabs never
 * blanks the page — only the panel below it waits.
 */
export function PlayerDetailPage() {
  const { leagueId, competitionId } = useActiveLeague()
  const { playerId } = useParams()
  const location = useLocation()
  const { user } = useAuth()

  const tab = playerTabFromPath(location.pathname)
  const basePath = `/leagues/${leagueId}/players/${playerId ?? ''}`

  const player = usePlayerDetail(leagueId, playerId)
  const teams = useTeamDirectory(competitionId)

  // The career history backs both the Leistung tab and, on Details, the
  // current-matchday strip in the header and the points and minutes on the
  // Spiele rows — so it is fetched for either. It is the page's largest
  // response (a twelve-season career runs to ~110 kB uncompressed), which is
  // why the two tabs that need none of it — Markt and Transfers — do not pull
  // it.
  const performance = usePlayerPerformance(
    leagueId,
    tab === PLAYER_TABS.market || tab === PLAYER_TABS.transfers
      ? undefined
      : playerId,
  )
  // Transfers wants it for the same reason Details does: a fee only means
  // something next to the market value of the day it was paid.
  const marketValue = usePlayerMarketValue(
    leagueId,
    tab === PLAYER_TABS.performance ? undefined : playerId,
  )

  const ownership = useOwnership(
    leagueId,
    player.data?.ownerId === undefined ? undefined : playerId,
    marketValue.data,
  )
  // One cache entry serves the owner panel and the Transfers tab; asking for it
  // here only widens what is mapped out of it, and only on the tab that lists
  // the lot.
  const transfers = usePlayerTransfers(
    leagueId,
    tab === PLAYER_TABS.transfers ? playerId : undefined,
    marketValue.data,
  )

  // `transferHistory` names the owner, but a manager who has never renamed
  // themselves arrives without `unm` on some entries — the standings always
  // have a name and an avatar, so they fill the gaps.
  const ranking = useRanking(leagueId)
  const resolved = withManagerFromRanking(ownership, ranking.data?.managers)
  const transferRows = useMemo(
    () => withManagersOnTransfers(transfers.data, ranking.data?.managers),
    [transfers.data, ranking.data],
  )

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
        leagueId={leagueId}
      />

      {/* Claims the leftover height, so a short tab fills the well rather
          than leaving it half empty. The bottom bar asks nothing of this any
          more — it is fixed to the viewport, see `BottomTabBar`. */}
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
            leagueId={leagueId}
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
              playerId={playerId ?? ''}
              playerName={player.data?.fullName ?? ''}
              leagueId={leagueId}
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

        {/* The market values are not waited for: the rows carry their fees
            without them and grow the comparison when they land. Only the
            history itself gates the panel. */}
        {tab === PLAYER_TABS.transfers &&
          (transfers.isPending ? (
            <SkeletonList rows={6} />
          ) : transfers.isError ? (
            <ErrorState
              error={transfers.error}
              onRetry={() => {
                void transfers.refetch()
              }}
            />
          ) : (
            <PlayerTransfersTab transfers={transferRows} viewerId={user?.id} />
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

/**
 * The same fill, applied to both parties of every transfer.
 *
 * The history is stingier with faces than the owner panel makes it look: `uim`
 * arrived on one manager in five across the leagues probed, so without this the
 * Transfers tab is a column of initials. A manager who has **left the league**
 * is not in the standings any more and keeps whatever the history carried,
 * which is the honest answer rather than a blank.
 */
function withManagersOnTransfers(
  transfers: PlayerTransfer[] | undefined,
  managers: Array<{ id: string; name: string; image?: string }> | undefined,
): PlayerTransfer[] {
  if (transfers === undefined) return []
  if (managers === undefined) return transfers

  const byId = new Map(managers.map((manager) => [manager.id, manager]))

  const fill = (party: TransferParty | undefined) => {
    if (party?.id === undefined) return party
    const manager = byId.get(party.id)
    if (manager === undefined) return party
    return {
      ...party,
      name: party.name ?? manager.name,
      image: party.image ?? manager.image,
    }
  }

  return transfers.map((transfer) => ({
    ...transfer,
    to: fill(transfer.to),
    from: fill(transfer.from),
  }))
}
