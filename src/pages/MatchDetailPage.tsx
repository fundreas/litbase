import { ListOrdered, Shirt, Trophy } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router'

import { useMatchDetails } from '@/api/hooks/useMatchDetails'
import { useMatchdayFixtures, useSeasonMatch } from '@/api/hooks/useMatchday'
import { useMatchLineup } from '@/api/hooks/useMatchLineup'
import { fixtureState, type FixtureState, type MatchDetail } from '@/api/models'
import { useAuth } from '@/auth/useAuth'
import { MatchLineupTab } from '@/components/matchday/MatchLineupTab'
import { MatchRankingTab } from '@/components/matchday/MatchRankingTab'
import { MatchScoreHeader } from '@/components/matchday/MatchScoreHeader'
import { MatchTimelineTab } from '@/components/matchday/MatchTimelineTab'
import { BottomTabBar, type BottomTab } from '@/components/ui/BottomTabBar'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useActiveLeague } from '@/league/useActiveLeague'

/** View value ⇄ route segment, following the squad page's convention. */
const VIEWS = {
  events: 'events',
  lineup: 'lineup',
  ranking: 'ranking',
} as const
type ViewValue = (typeof VIEWS)[keyof typeof VIEWS]

/**
 * One match, in detail:
 *
 *   /leagues/:leagueId/matchday/:matchId           → Events (the timeline)
 *   /leagues/:leagueId/matchday/:matchId/lineup    → Aufstellung
 *   /leagues/:leagueId/matchday/:matchId/ranking   → Ranking
 *
 * Three routes, one component — the active view is read out of the segment, so
 * each is linkable and survives a refresh, exactly as on the squad and player
 * pages. The scoreline above them belongs to none of them and does not move
 * when the tab changes.
 *
 * The three answer three different questions about the same match: *what
 * happened*, *how were the two teams set up*, and *who actually scored the
 * points*. The last is the [duel detail](../../docs/pages/duel-detail.md) page's
 * combined ranking applied to a fixture instead of a pairing.
 *
 * **The URL carries a match id and nothing else.** The matchday is looked up
 * from the season's fixture list ([`useSeasonMatch`](../api/hooks/useMatchday.ts)),
 * which is already cached, and everything matchday-scoped on the page hangs off
 * that answer: the fixtures the points hook needs, and the matchday its `ph`
 * lookup is for. A link to a match therefore needs no `?day=` and cannot carry
 * a wrong one.
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
    : location.pathname.endsWith(`/${VIEWS.ranking}`)
      ? VIEWS.ranking
      : VIEWS.events

  const base = `/leagues/${leagueId}/matchday`
  const matchBase = `${base}/${matchId ?? ''}`
  const tabs: BottomTab[] = [
    {
      value: VIEWS.events,
      label: 'Events',
      icon: ListOrdered,
      to: matchBase,
    },
    {
      value: VIEWS.lineup,
      label: 'Aufstellung',
      icon: Shirt,
      to: `${matchBase}/${VIEWS.lineup}`,
    },
    {
      value: VIEWS.ranking,
      label: 'Ranking',
      icon: Trophy,
      to: `${matchBase}/${VIEWS.ranking}`,
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
      <MatchScoreHeader
        match={match.data}
        detail={detail.data}
        leagueId={leagueId}
      />

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
        ) : view === VIEWS.events ? (
          <MatchTimelineTab
            detail={detail.data}
            state={state}
            kickoff={match.data.kickoff}
          />
        ) : (
          <SquadsView
            view={view}
            leagueId={leagueId}
            competitionId={competitionId}
            day={match.data.day}
            detail={detail.data}
            state={state}
            viewerId={user?.id}
          />
        )}
      </div>

      <BottomTabBar tabs={tabs} active={view} ariaLabel="Spielansicht" />
    </div>
  )
}

/**
 * The two views that need the **team sheets with points and owners**, and the
 * fan-out behind them.
 *
 * Split out from the page for one reason: the fan-out is ~36 per-player
 * requests plus one per manager, and mounting it in the page would have the
 * Events tab pay for data nobody is looking at. The same split the squad page
 * uses to keep its live view's requests off the Kader.
 *
 * Both tabs sit **inside** it, so flicking between the pitch and the ranking
 * costs nothing — they are two readings of one set of queries, exactly as the
 * duel page's two views are.
 */
function SquadsView({
  view,
  leagueId,
  competitionId,
  day,
  detail,
  state,
  viewerId,
}: {
  view: ViewValue
  leagueId: string
  competitionId: string
  day: number
  detail: MatchDetail
  /** From the fixture, not from `detail` — see {@link useMatchLineup}. */
  state: FixtureState
  viewerId?: string
}) {
  // The matchday's fixtures, which is how the points hook decides whether a
  // player's match can have produced points yet. Same cache entry as the
  // fixture list this page resolved its own match from.
  const fixtures = useMatchdayFixtures(competitionId, day)
  const lineup = useMatchLineup(
    leagueId,
    day,
    detail,
    state,
    fixtures.data,
    viewerId,
  )

  if (lineup === undefined) return <SkeletonList rows={8} />

  if (view === VIEWS.ranking) {
    return (
      <MatchRankingTab
        home={lineup.home}
        away={lineup.away}
        leagueId={leagueId}
      />
    )
  }

  return (
    <MatchLineupTab
      home={lineup.home}
      away={lineup.away}
      leagueId={leagueId}
      isPointsPending={lineup.isPending}
    />
  )
}
