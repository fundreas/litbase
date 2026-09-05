import { CalendarDays, Info, Radio, Users } from 'lucide-react'
import { useMemo } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router'

import {
  useTeamDirectory,
  useCompetitionTable,
} from '@/api/hooks/useCompetition'
import { useLiveMatches } from '@/api/hooks/useLiveMatches'
import { useSeasonSchedule, useTeamSeason } from '@/api/hooks/useMatchday'
import { useTeamPoints, useTeamProfile } from '@/api/hooks/useTeam'
import {
  fixtureState,
  teamCurrentFixture,
  teamRecord,
  teamStanding,
} from '@/api/models'
import { useAuth } from '@/auth/useAuth'
import { TeamHeader } from '@/components/team/TeamHeader'
import { TeamLiveTab } from '@/components/team/TeamLiveTab'
import { TeamMatchesTab } from '@/components/team/TeamMatchesTab'
import { TeamOverviewTab } from '@/components/team/TeamOverviewTab'
import { TeamSquadTab } from '@/components/team/TeamSquadTab'
import { TEAM_TABS, teamTabFromPath } from '@/components/team/teamTabs'
import { BottomTabBar, type BottomTab } from '@/components/ui/BottomTabBar'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useActiveLeague } from '@/league/useActiveLeague'

/**
 * One Bundesliga club, in four views.
 *
 *   /leagues/:leagueId/teams/:teamId           → Übersicht
 *   /leagues/:leagueId/teams/:teamId/squad     → Kader
 *   /leagues/:leagueId/teams/:teamId/matches   → Spiele
 *   /leagues/:leagueId/teams/:teamId/live      → Live, while the club plays
 *
 * Four routes, one component, with the active tab read out of the URL — the
 * arrangement the squad, player, duel and match pages all use, and for the same
 * reasons: every view is linkable and survives a refresh.
 *
 * **Reached by tapping a crest**, on the [player](./PlayerDetailPage.tsx) page's
 * header and on either side of a [match](./MatchDetailPage.tsx)'s scoreline.
 * There is no drawer entry, because the page has no single subject the way
 * *Mannschaft* or *Transfermarkt* do — it is a detail page, like a player's, and
 * its way in is the crest that names it.
 *
 * ## What each view costs
 *
 * The split is the point of the page's structure, so it is worth stating
 * plainly:
 *
 *  - **The page — three requests**, all of them shared: the league table and the
 *    season's fixture list are hour-long entries the squad and matchday pages
 *    have usually already filled, and the club's own `teamprofile` is one
 *    request that carries the entire squad. Übersicht and Kader are both
 *    arithmetic over those, apart from the scorer card's totals.
 *  - **Übersicht and Spiele — one request per player**, twenty-five to thirty,
 *    and **one fan-out between them**: the Spiele column reads `ph`, the
 *    Übersicht's scorer card reads `tp`, and both ride the same response. `ph`
 *    is the one source of a per-matchday score and `teamprofile` carries no
 *    season total, so neither has a cheaper answer. See
 *    [`useTeamPoints`](../api/hooks/useTeam.ts).
 *  - **Live — the match lineup's fan-out**, ~36 players polling at the live
 *    rate, and the same cache entries the match page fills.
 *
 * The gate is `enabled` on the points hook, driven by the tab on screen — the
 * same split [`MatchDetailPage`](./MatchDetailPage.tsx) uses to keep its
 * timeline off the lineup's cost.
 *
 * **The squad does not come from `/v4/competitions/{id}/players`.** That
 * endpoint returns one *fixture's* players despite its name, so filtering it by
 * club found nothing for seventeen clubs out of eighteen — the bug that sent
 * this page looking for `teamprofile` in the first place.
 *
 * ## The Live tab only exists while the club is playing
 *
 * Registered unconditionally, because the route table is built once before any
 * league or matchday is known, and the page redirects to the Übersicht when no
 * fixture of this club is running — so the URL is a dead end exactly when its
 * tab is missing. The same pattern as `squad/live` and as `duels` in a league
 * that does not play them.
 */
export function TeamDetailPage() {
  const { leagueId, competitionId } = useActiveLeague()
  const { teamId } = useParams()
  const { user } = useAuth()
  const location = useLocation()

  const tab = teamTabFromPath(location.pathname)
  const base = `/leagues/${leagueId}/teams/${teamId ?? ''}`

  /*
   * Three shared cache entries and nothing of this page's own. The directory
   * and the table are the *same* entry read two ways — see `useTeamDirectory` —
   * so naming the club costs no request beyond its standings row.
   */
  const teams = useTeamDirectory(competitionId)
  const table = useCompetitionTable(competitionId)
  const season = useTeamSeason(competitionId, teamId)
  const schedule = useSeasonSchedule(competitionId)
  /*
   * The club's whole squad in one request — values, probabilities and owners
   * included. Fetched for every tab rather than gated: it is one request, the
   * Übersicht's scorer card needs it, and the header's fixture strip opens the
   * projected eleven it carries.
   */
  const profile = useTeamProfile(leagueId, teamId, user?.id)

  const fixtures = useMemo(() => season.data ?? [], [season.data])
  const players = profile.data?.players ?? []

  const standing = useMemo(
    () => teamStanding(table.data, teamId),
    [table.data, teamId],
  )

  /*
   * The club's most immediate fixture, for the header's strip, and the running
   * one, which is what decides whether the Live tab exists at all. They are
   * usually the same fixture and deliberately resolved apart: the strip should
   * still say something between matchdays, and the tab should not.
   */
  const current = teamCurrentFixture(fixtures)
  const running = fixtures.find(
    (fixture) => fixtureState(fixture) === 'running',
  )

  /*
   * One match, and only once it has kicked off — `useLiveMatches` skips an
   * upcoming fixture entirely. It is the same `qk.matchDetails` entry the Live
   * tab and the match page read, so the header's minute and the tab's pitch are
   * one request between them.
   */
  const live = useLiveMatches(current === undefined ? undefined : [current])

  /*
   * The per-player fan-out, for the two tabs that read it: the Spiele column
   * and the Übersicht's scorer card. They share the cache entries, so between
   * them it is one fan-out; the Kader and the Live tab stay off it.
   */
  const teamPoints = useTeamPoints(
    leagueId,
    players,
    tab === TEAM_TABS.matches || tab === TEAM_TABS.overview,
  )

  const tabs: BottomTab[] = [
    { value: TEAM_TABS.overview, label: 'Übersicht', icon: Info, to: base },
    {
      value: TEAM_TABS.squad,
      label: 'Kader',
      icon: Users,
      to: `${base}/${TEAM_TABS.squad}`,
    },
    {
      value: TEAM_TABS.matches,
      label: 'Spiele',
      icon: CalendarDays,
      to: `${base}/${TEAM_TABS.matches}`,
    },
    ...(running === undefined
      ? []
      : [
          {
            value: TEAM_TABS.live,
            label: 'Live',
            icon: Radio,
            to: `${base}/${TEAM_TABS.live}`,
          },
        ]),
  ]

  if (season.isPending || table.isPending) {
    return <SkeletonList rows={6} />
  }

  if (season.isError || table.isError) {
    return (
      <ErrorState
        error={season.error ?? table.error}
        onRetry={() => {
          void season.refetch()
          void table.refetch()
        }}
      />
    )
  }

  /*
   * A club id the competition does not know: a hand-edited URL, or a link from
   * a season this competition no longer runs. A 404 for this page rather than
   * an error, and the way back is the fixture list — the same treatment the
   * match page gives an unknown match id.
   */
  if (fixtures.length === 0 && standing === undefined) {
    return (
      <EmptyState
        title="Klub nicht gefunden"
        description="Zu dieser Mannschaft hat Kickbase im aktuellen Wettbewerb keinen Eintrag."
        action={
          <Link
            to={`/leagues/${leagueId}/matchday`}
            className="text-sm font-medium text-accent hover:underline"
          >
            Zum Spieltag
          </Link>
        }
      />
    )
  }

  // The tab is gone, so the URL must be too. `replace`, so the browser's back
  // leaves the page rather than bouncing off the redirect.
  if (tab === TEAM_TABS.live && running === undefined) {
    return <Navigate to={base} replace />
  }

  return (
    /* `min-h-0` down the whole chain so the Live tab's pitch can claim the
       height the page has left — and so the bottom bar stays at the bottom on
       the short tabs too. See `BottomTabBar`. */
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <TeamHeader
        team={teams.data?.get(teamId ?? '')}
        standing={standing}
        record={teamRecord(fixtures)}
        fixture={current}
        live={current === undefined ? undefined : live.get(current.matchId)}
        opponent={
          current === undefined
            ? undefined
            : teams.data?.get(current.opponentId)
        }
        teamId={teamId ?? ''}
        poster={profile.data?.poster}
        leagueId={leagueId}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        {tab === TEAM_TABS.overview && (
          <TeamOverviewTab
            standing={standing}
            table={table.data}
            fixtures={fixtures}
            players={players}
            totalByPlayerId={teamPoints.totalByPlayerId}
            isPointsPending={teamPoints.isPending}
            teams={teams.data}
            leagueId={leagueId}
          />
        )}

        {tab === TEAM_TABS.squad &&
          (profile.isPending ? (
            <SkeletonList rows={8} />
          ) : profile.isError ? (
            <ErrorState
              error={profile.error}
              onRetry={() => {
                void profile.refetch()
              }}
            />
          ) : (
            <TeamSquadTab profile={profile.data} leagueId={leagueId} />
          ))}

        {tab === TEAM_TABS.matches && (
          <TeamMatchesTab
            fixtures={fixtures}
            pointsByDay={teamPoints.byDay}
            isPointsPending={teamPoints.isPending}
            teams={teams.data}
            currentDay={schedule.data?.currentDay}
            leagueId={leagueId}
          />
        )}

        {tab === TEAM_TABS.live && running !== undefined && (
          <TeamLiveTab
            matchId={running.matchId}
            teamId={teamId ?? ''}
            teamName={profile.data?.teamName ?? standing?.row.teamName}
            leagueId={leagueId}
            competitionId={competitionId}
            viewerId={user?.id}
          />
        )}
      </div>

      <BottomTabBar tabs={tabs} active={tab} ariaLabel="Klubansicht" />
    </div>
  )
}
