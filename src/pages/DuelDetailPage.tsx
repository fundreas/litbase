import { Shirt, Trophy } from 'lucide-react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'

import { useDuelRosters } from '@/api/hooks/useDuelRosters'
import { useDuels } from '@/api/hooks/useDuels'
import { useSeasonSchedule } from '@/api/hooks/useMatchday'
import {
  duelLeader,
  matchdayState,
  type DuelRoster,
  type DuelSide,
} from '@/api/models'
import { useAuth } from '@/auth/useAuth'
import { DuelLineupTab } from '@/components/duels/DuelLineupTab'
import { DuelRankingTab } from '@/components/duels/DuelRankingTab'
import { Avatar } from '@/components/ui/Avatar'
import { BottomTabBar, type BottomTab } from '@/components/ui/BottomTabBar'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useActiveLeague } from '@/league/useActiveLeague'
import { cn } from '@/lib/cn'
import { points } from '@/lib/format'

/** Tab value ⇄ route segment, following the squad page's convention. */
const TABS = { lineup: 'lineup', ranking: 'ranking' } as const
type TabValue = (typeof TABS)[keyof typeof TABS]

/**
 * One duel, in detail: both elevens, and every player of the two ranked.
 *
 *   /leagues/:leagueId/duels/:duelId         → Aufstellung
 *   /leagues/:leagueId/duels/:duelId/ranking → Rangliste
 *
 * Two routes, one component — the view is read out of the segment, so each is
 * linkable and survives a refresh, and they are switched by a
 * [`BottomTabBar`](../components/ui/BottomTabBar.tsx), the app's control for
 * views of one page. The scoreline above them belongs to neither and does not
 * move when the tab changes, exactly as on
 * [match detail](./MatchDetailPage.tsx) and the squad.
 *
 * `duelId` is both manager ids joined with `-`, which is what the list page
 * already uses as a React key — so the URL needs no lookup table and a shared
 * link resolves for anyone in the league. The matchday rides along in `?day=`,
 * exactly as on the list, and **on both tab links**, so switching views cannot
 * quietly drop you onto the current matchday.
 *
 * The pairing itself is read from `useDuels`, the same query the list page
 * ran, so arriving here costs nothing extra for the duel — only the rosters
 * are new.
 */
export function DuelDetailPage() {
  const { leagueId, competitionId } = useActiveLeague()
  const { duelId } = useParams()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const location = useLocation()

  const schedule = useSeasonSchedule(competitionId)

  const requestedDay = Number(searchParams.get('day'))
  const selectedDay =
    schedule.data === undefined
      ? undefined
      : schedule.data.matchdays.some((entry) => entry.day === requestedDay)
        ? requestedDay
        : schedule.data.currentDay

  const matchday = schedule.data?.matchdays.find(
    (entry) => entry.day === selectedDay,
  )
  const state = matchday === undefined ? undefined : matchdayState(matchday)

  const duels = useDuels(leagueId, selectedDay, { isLive: state === 'live' })
  const duel = duels.data?.duels.find((entry) => entry.id === duelId)

  // Passed through as-is. A live poll hands back new objects each minute, so
  // memoising on the ids would only pin stale point totals in place — and the
  // totals are exactly what changes.
  const rosters = useDuelRosters(
    leagueId,
    competitionId,
    selectedDay,
    duel?.sides,
  )

  const tab: TabValue = location.pathname.endsWith(`/${TABS.ranking}`)
    ? TABS.ranking
    : TABS.lineup

  const backTo = `/leagues/${leagueId}/duels?day=${String(selectedDay ?? '')}`

  /*
   * The matchday rides along in `?day=` on both tabs, so switching views never
   * drops it — a tab that landed on the current matchday instead of the one
   * being looked at would be a quiet way to show the wrong duel.
   */
  const base = `/leagues/${leagueId}/duels/${duelId ?? ''}`
  const day = `?day=${String(selectedDay ?? '')}`
  const tabs: BottomTab[] = [
    {
      value: TABS.lineup,
      label: 'Aufstellung',
      icon: Shirt,
      to: `${base}${day}`,
    },
    {
      value: TABS.ranking,
      label: 'Rangliste',
      icon: Trophy,
      to: `${base}/${TABS.ranking}${day}`,
    },
  ]

  if (schedule.isPending || duels.isPending) {
    return <SkeletonList rows={8} />
  }

  if (schedule.isError) {
    return (
      <ErrorState
        error={schedule.error}
        onRetry={() => {
          void schedule.refetch()
        }}
      />
    )
  }

  if (duels.isError) {
    return (
      <ErrorState
        error={duels.error}
        onRetry={() => {
          void duels.refetch()
        }}
      />
    )
  }

  // The pairing changes every matchday, so a link kept from another matchday
  // names two managers who are not drawn against each other here.
  if (duel === undefined) {
    return (
      <EmptyState
        title="Duell nicht gefunden"
        description="An diesem Spieltag gibt es diese Paarung nicht."
        action={
          <Link
            to={backTo}
            className="text-sm font-medium text-accent hover:underline"
          >
            Zurück zu den Duellen
          </Link>
        }
      />
    )
  }

  const hasStarted = state === 'live' || state === 'finished'
  const leader = hasStarted ? duelLeader(duel) : undefined

  return (
    /* No back link. It cost a row of height at the very top of a page whose
       whole content wants to be a pitch, to duplicate what the browser's back
       gesture and the drawer already do. */
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div>
        <div className="flex items-start gap-3">
          <Scoreline
            side={duel.sides[0]}
            align="left"
            hasStarted={hasStarted}
            isLeader={leader?.id === duel.sides[0].id}
            isViewer={duel.sides[0].id === user?.id}
            roster={rosters.data?.[0]}
          />
          <span className="shrink-0 pt-2 text-xs font-medium text-faint">
            :
          </span>
          <Scoreline
            side={duel.sides[1]}
            align="right"
            hasStarted={hasStarted}
            isLeader={leader?.id === duel.sides[1].id}
            isViewer={duel.sides[1].id === user?.id}
            roster={rosters.data?.[1]}
          />
        </div>

        <p className="nums mt-1 truncate text-xs text-muted">
          {String(selectedDay)}. Spieltag
          {state === 'live' && ' · Live'}
          {state === 'finished' && ' · Beendet'}
          {state === 'upcoming' && ' · Noch nicht angepfiffen'}
        </p>
      </div>

      {/* `min-h-0 flex-1` so the tab bar below is pushed to the bottom of the
          well on the ranking tab too, where the content is short — sticky only
          pins something that would otherwise be off screen, and without this
          the bar sat under the last row on one tab and at the bottom on the
          other, appearing to move as you switched. */}
      <div className="flex min-h-0 flex-1 flex-col">
        {rosters.isPending ? (
          <SkeletonList rows={8} />
        ) : rosters.isError ? (
          <ErrorState error={rosters.error} onRetry={rosters.refetch} />
        ) : rosters.isEmpty ? (
          /* The snapshot endpoint answers 200 with empty lists for a matchday
             it has nothing for — one before the league existed, most often.
             That is not an error and not an empty team, so it gets its own
             message rather than two blank rosters. */
          <EmptyState
            title="Keine Aufstellung für diesen Spieltag"
            description="Kickbase hat für diesen Spieltag keine Kader — vermutlich lag er vor der Gründung der Liga."
          />
        ) : rosters.data === undefined ? null : tab === TABS.ranking ? (
          <DuelRankingTab rosters={rosters.data} />
        ) : (
          <DuelLineupTab
            rosters={rosters.data}
            viewerId={user?.id}
            summary={<DuelSummary sides={duel.sides} hasStarted={hasStarted} />}
            day={selectedDay}
            leagueId={leagueId}
          />
        )}
      </div>

      <BottomTabBar tabs={tabs} active={tab} ariaLabel="Duell-Ansicht" />
    </div>
  )
}

/*
 * `ViewToggle` used to live here: the two-glyph `PairToggle`-shaped button in
 * the header, which navigated between the two routes. It was the right control
 * while these were two readings of one screen, and the wrong one once they
 * became two sub-pages — a bar at the bottom is where the app switches *views
 * of a page* (the squad's three, the match's three), it names both destinations
 * instead of leaving one to a tooltip, and it sits where a thumb already is.
 *
 * The toggle is not gone, it moved: the ranking now uses one for its own two
 * readings, combined and per manager. Which is the arrangement this page should
 * have had all along — the bar for *where you are*, a toggle for *how it is
 * arranged*.
 */

/**
 * The duel in one line, for the bar of the [full-screen
 * pitch](../components/ui/FullscreenPane.tsx).
 *
 * The page's own {@link Scoreline} does not fit there and should not: full
 * screen, the whole screen is the pitch, and the bar has one row of a 56px
 * strip to say who is playing whom and who is winning. So it keeps the three
 * things the header above the pitch is read for — the two managers and the two
 * totals — and drops the placement, the leader emphasis and the
 * `n laufend · n offen`, all of which are one tap back.
 *
 * The totals are Kickbase's own for the matchday, the same figure the page
 * shows, so the number does not change when the pitch grows.
 */
function DuelSummary({
  sides,
  hasStarted,
}: {
  sides: [DuelSide, DuelSide]
  hasStarted: boolean
}) {
  const [left, right] = sides

  return (
    <div className="flex items-center gap-2">
      <Avatar src={left.image} name={left.name} size={26} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.6875rem] text-muted">{left.name}</p>
        <p className="nums truncate text-sm leading-tight font-bold text-ink">
          {hasStarted ? points(left.matchdayPoints) : '–'}
        </p>
      </div>

      <span aria-hidden="true" className="shrink-0 text-xs text-faint">
        :
      </span>

      <div className="min-w-0 flex-1 text-right">
        <p className="truncate text-[0.6875rem] text-muted">{right.name}</p>
        <p className="nums truncate text-sm leading-tight font-bold text-ink">
          {hasStarted ? points(right.matchdayPoints) : '–'}
        </p>
      </div>
      <Avatar src={right.image} name={right.name} size={26} />
    </div>
  )
}

/*
 * `HistoricalNotice` used to live here: a banner explaining that a past
 * matchday showed *today's* eleven with old points beside it, because the API
 * served squads only as they stood now. That is no longer true —
 * `users/{uid}/teamcenter?dayNumber=` serves the real snapshot (found
 * 2026-09-04) — so the rows are the players who were actually fielded and
 * there is nothing left to apologise for.
 */

/**
 * One half of the header scoreline: name, the manager's matchday total, and
 * what they still have to come.
 *
 * **`n laufend · n offen` lives here**, under the manager it belongs to. It
 * used to sit inside each roster card, which the pitch replaced — and it reads
 * better here anyway: it is the question a live duel raises (40 points behind
 * with four matches to play is winning), so it belongs next to the number it
 * qualifies rather than further down the page.
 *
 * The counts are `undefined` until the rosters land; the line is simply absent
 * until then, rather than claiming `0 laufend · 0 offen`.
 */
function Scoreline({
  side,
  align,
  hasStarted,
  isLeader,
  isViewer,
  roster,
}: {
  side: DuelSide
  align: 'left' | 'right'
  hasStarted: boolean
  isLeader: boolean
  isViewer: boolean
  /** Absent while the rosters are still loading. */
  roster?: DuelRoster
}) {
  const isRight = align === 'right'

  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 items-center gap-2',
        isRight && 'flex-row-reverse',
      )}
    >
      <Avatar src={side.image} name={side.name} size={36} />
      <div className={cn('min-w-0 flex-1', isRight && 'text-right')}>
        <p className="truncate text-sm font-semibold text-ink">
          {side.name}
          {isViewer && <span className="ml-1.5 text-xs text-accent">du</span>}
        </p>
        <p
          className={cn(
            'nums truncate text-lg leading-tight font-bold',
            isLeader ? 'text-ink' : 'text-muted',
          )}
        >
          {hasStarted ? points(side.matchdayPoints) : '–'}
        </p>
        {roster !== undefined && (
          <p className="nums truncate text-[0.6875rem] text-muted">
            {roster.activeMatches} laufend · {roster.openMatches} offen
          </p>
        )}
      </div>
    </div>
  )
}
