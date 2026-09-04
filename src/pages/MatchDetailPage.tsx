import { ListOrdered, Shirt } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router'

import { useMatchDetails } from '@/api/hooks/useMatchDetails'
import { useMatchdayFixtures, useSeasonMatch } from '@/api/hooks/useMatchday'
import { useMatchLineup } from '@/api/hooks/useMatchLineup'
import { fixtureState, type MatchDetail } from '@/api/models'
import { useAuth } from '@/auth/useAuth'
import { MatchLineupTab } from '@/components/matchday/MatchLineupTab'
import { MatchScoreHeader } from '@/components/matchday/MatchScoreHeader'
import { MatchTimelineTab } from '@/components/matchday/MatchTimelineTab'
import { BottomTabBar, type BottomTab } from '@/components/ui/BottomTabBar'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useActiveLeague } from '@/league/useActiveLeague'

/** View value ⇄ route segment, following the squad page's convention. */
const VIEWS = { timeline: 'timeline', lineup: 'lineup' } as const
type ViewValue = (typeof VIEWS)[keyof typeof VIEWS]

/**
 * One match, in detail:
 *
 *   /leagues/:leagueId/matchday/:matchId          → Verlauf (the timeline)
 *   /leagues/:leagueId/matchday/:matchId/lineup   → Aufstellung
 *
 * Two routes, one component — the active view is read out of the segment, so
 * each is linkable and survives a refresh, exactly as on the squad and player
 * pages. The scoreline above them belongs to neither and does not move when the
 * tab changes.
 *
 * **The URL carries a match id and nothing else.** The matchday is looked up
 * from the season's fixture list ([`useSeasonMatch`](../api/hooks/useMatchday.ts)),
 * which is already cached, and everything matchday-scoped on the page hangs off
 * that answer: the fixtures the points hook needs, and the `ph[day - 1]` index
 * itself. A link to a match therefore needs no `?day=` and cannot carry a wrong
 * one.
 *
 * **Opening a match from the [list](./MatchdayPage.tsx) costs no request.** The
 * list already fetched every started match's detail for its scores, and this
 * page reads the same cache entry through a fuller mapping — see
 * [`useMatchDetails`](../api/hooks/useMatchDetails.ts). What the lineup tab
 * adds is the per-player fan-out, and only when that tab is on screen.
 */
export function MatchDetailPage() {
  const { leagueId, competitionId } = useActiveLeague()
  const { matchId } = useParams()
  const { user } = useAuth()
  const location = useLocation()

  const match = useSeasonMatch(competitionId, matchId)
  const detail = useMatchDetails(match.data)

  const view: ViewValue = location.pathname.endsWith(`/${VIEWS.lineup}`)
    ? VIEWS.lineup
    : VIEWS.timeline

  const base = `/leagues/${leagueId}/matchday`
  const tabs: BottomTab[] = [
    {
      value: VIEWS.timeline,
      label: 'Verlauf',
      icon: ListOrdered,
      to: `${base}/${matchId ?? ''}`,
    },
    {
      value: VIEWS.lineup,
      label: 'Aufstellung',
      icon: Shirt,
      to: `${base}/${matchId ?? ''}/${VIEWS.lineup}`,
    },
  ]

  if (match.isPending) {
    return <SkeletonList rows={8} />
  }

  if (match.isError) {
    return (
      <ErrorState
        error={match.error}
        onRetry={() => {
          void match.refetch()
        }}
      />
    )
  }

  // The id is not in the season's fixture list: a hand-edited URL, or a link
  // from a season the account no longer plays. A 404 for this page rather than
  // an error, and the way back is the fixture list.
  if (match.data === undefined) {
    return (
      <EmptyState
        title="Spiel nicht gefunden"
        description="Zu dieser Begegnung hat Kickbase im Spielplan keinen Eintrag."
        action={
          <Link
            to={base}
            className="text-sm font-medium text-accent hover:underline"
          >
            Zurück zum Spieltag
          </Link>
        }
      />
    )
  }

  const state = fixtureState(match.data)

  return (
    /* `min-h-0` on every level of the chain so the lineup's pitch can claim the
       height the page has left — and so the bottom bar stays *at the bottom*
       on the timeline too, where the content is short. */
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* No separate live query: `useMatchDetails` reads the very same cache
          entry `useLiveMatches` fills, with the same polling, so `detail` *is*
          the live source here — score, minute and events from one request. */}
      <MatchScoreHeader match={match.data} detail={detail.data} />

      <div className="flex min-h-0 flex-1 flex-col">
        {detail.isPending ? (
          <SkeletonList rows={8} />
        ) : detail.isError ? (
          <ErrorState
            error={detail.error}
            onRetry={() => {
              void detail.refetch()
            }}
          />
        ) : view === VIEWS.lineup ? (
          <LineupView
            leagueId={leagueId}
            competitionId={competitionId}
            day={match.data.day}
            detail={detail.data}
            viewerId={user?.id}
          />
        ) : (
          <MatchTimelineTab
            detail={detail.data}
            state={state}
            kickoff={match.data.kickoff}
          />
        )}
      </div>

      <BottomTabBar tabs={tabs} active={view} ariaLabel="Spielansicht" />
    </div>
  )
}

/**
 * The lineup tab and the fan-out behind it, in a component of its own.
 *
 * Split out so the **~36 per-player requests only fire while that tab is open**
 * — mounting the hook in the page would have the timeline pay for a lineup
 * nobody is looking at. The same reason the squad page's live view sits outside
 * its shared views.
 */
function LineupView({
  leagueId,
  competitionId,
  day,
  detail,
  viewerId,
}: {
  leagueId: string
  competitionId: string
  day: number
  detail: MatchDetail
  viewerId?: string
}) {
  // The matchday's fixtures, which is how the points hook decides whether a
  // player's match can have produced points yet. Same cache entry as the
  // fixture list this page resolved its own match from.
  const fixtures = useMatchdayFixtures(competitionId, day)
  const lineup = useMatchLineup(leagueId, day, detail, fixtures.data, viewerId)

  if (lineup === undefined) return <SkeletonList rows={8} />

  return (
    <MatchLineupTab
      home={lineup.home}
      away={lineup.away}
      leagueId={leagueId}
      isPointsPending={lineup.isPending}
    />
  )
}
