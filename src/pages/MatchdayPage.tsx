import { CalendarDays, ListOrdered, Swords } from 'lucide-react'
import { useMemo } from 'react'
import { useLocation, useSearchParams } from 'react-router'

import { useTeamDirectory, type RankingScope } from '@/api/hooks/useCompetition'
import { useLiveMatches } from '@/api/hooks/useLiveMatches'
import { useMatchdayMatches, useSeasonSchedule } from '@/api/hooks/useMatchday'
import { useMatchdayRanking } from '@/api/hooks/useMatchdayRanking'
import {
  matchdayState,
  POSITION_LABEL,
  type MatchdayMatch,
  type PositionKey,
} from '@/api/models'
import { MatchCard } from '@/components/matchday/MatchCard'
import { MatchdayRankingTab } from '@/components/matchday/MatchdayRankingTab'
import { MatchdayPicker } from '@/components/MatchdayPicker'
import { PageHeading } from '@/components/PageHeading'
import { BottomTabBar, type BottomTab } from '@/components/ui/BottomTabBar'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useAuth } from '@/auth/useAuth'
import { useActiveLeague } from '@/league/useActiveLeague'
import { cn } from '@/lib/cn'
import { kickoff as kickoffLabel } from '@/lib/format'

/** The page's two views, and the URL segment each one is reached by. */
const VIEWS = { matches: 'matchday', ranking: 'ranking' } as const
type ViewValue = (typeof VIEWS)[keyof typeof VIEWS]

/**
 * `?pos=` → the position the ranking is filtered to, or `undefined` for the
 * unfiltered list. Anything else in the slot — a typo, an old link — falls
 * back to *Alle* rather than erroring, the same rule `?day=` follows.
 */
function toRankingPosition(raw: string | null): PositionKey | undefined {
  return raw !== null && raw in POSITION_LABEL
    ? (raw as PositionKey)
    : undefined
}

/**
 * `?scope=season` → the season ranking. Anything else, the absent case
 * included, is the matchday — so the default costs no parameter and a
 * hand-edited value cannot produce a broken page.
 */
function toRankingScope(raw: string | null): RankingScope {
  return raw === 'season' ? 'season' : 'matchday'
}

/**
 * The Rangliste's scope, **in place of the page heading**.
 *
 * On this view the heading was doing the toggle's job badly: a title reading
 * *Spieltag* and a subtitle reading *die 25 besten Spieler des Spieltags* said
 * the same thing twice and left the season ranking — the other half of what
 * this endpoint can answer — with nowhere to live. Two labelled segments say
 * which list you are reading *and* that there is another one, in the space the
 * title had.
 *
 * Labelled rather than the icon-only [`PairToggle`](../components/ui/PairToggle.tsx):
 * that control is for a display preference where both states show the same
 * data. These two are **different data**, and which one you are looking at has
 * to be readable at a glance rather than inferred from which glyph is lit.
 *
 * The visual language is [`Tabs`](../components/ui/Tabs.tsx)' — same tray, same
 * accent-filled active segment — but built from buttons with `aria-pressed`
 * rather than Radix tabs, because there are no panels here: both segments
 * render the same component with a different scope.
 *
 * **The matchday segment carries no number.** It said *Spieltag 2* while the
 * ranking could only ever be the current matchday; now the picker below it
 * names the day, and two labels disagreeing about which matchday you are on —
 * which they would, the moment you stepped back one — is worse than one label
 * saying less.
 */
function RankingScopeToggle({
  scope,
  onChange,
}: {
  scope: RankingScope
  onChange: (scope: RankingScope) => void
}) {
  const options: { value: RankingScope; label: string }[] = [
    { value: 'matchday', label: 'Spieltag' },
    { value: 'season', label: 'Saison' },
  ]

  return (
    <div
      className="flex w-full gap-1 rounded-xl border border-line bg-surface p-1"
      role="group"
      aria-label="Wertung"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={scope === option.value}
          onClick={() => {
            onChange(option.value)
          }}
          className={cn(
            'flex h-10 flex-1 items-center justify-center rounded-lg px-2',
            'text-sm whitespace-nowrap transition-colors',
            scope === option.value
              ? 'bg-accent font-semibold text-accent-ink'
              : 'font-medium text-muted hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Every match of one matchday, live while they are being played.
 *
 * The competition's fixtures rather than the league's managers — the one screen
 * in the app that is about football rather than about Kickbase, and the way
 * into [one match in detail](./MatchDetailPage.tsx).
 *
 * The matchday lives in the query string (`?day=`), not in component state, the
 * same as on the [Duels](./DuelsPage.tsx) page and for the same reasons: a
 * weekend can be linked to and survives a refresh. An absent or nonsensical
 * `day` falls back to the competition's current matchday rather than erroring,
 * because a hand-edited URL should not be able to produce a broken page.
 *
 * **Grouped by kick-off**, which is how a Bundesliga matchday is actually
 * experienced: a Friday evening, five o'clock on Saturday, the late one, two on
 * Sunday. A flat list of nine sorted by time says the same thing while making
 * the reader work out where the breaks are, and the group heading carries the
 * date so no row has to repeat it.
 *
 * Everything here reads the **season fixture list** — one request, shared with
 * the squad page, the duel picker and the player pages — plus one request per
 * match that has kicked off, for the live score and the minute.
 *
 * ## Two views
 *
 * *Spiele* is the fixtures above. *Rangliste* is the matchday's best players,
 * which answers the other question a matchday raises — not "how did the games
 * go" but "who actually scored". They are siblings rather than one scrolling
 * page because the second is a competition-wide ranking that has nothing to do
 * with the grouping-by-kick-off the first is built around.
 *
 * The view comes from the **path segment**, as on the squad, duel-detail and
 * match-detail pages, so each is linkable and survives a refresh. `?day=`,
 * `?scope=` and `?pos=` ride along with it, and **both views now carry the
 * matchday picker**: the ranking was pinned to the current matchday only while
 * Kickbase was its only source, and earlier matchdays now come from the app's
 * own files — see
 * [`useMatchdayRanking`](../api/hooks/useMatchdayRanking.ts).
 */
export function MatchdayPage() {
  const { leagueId, competitionId } = useActiveLeague()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()

  const view: ViewValue = location.pathname.endsWith(`/${VIEWS.ranking}`)
    ? VIEWS.ranking
    : VIEWS.matches

  const schedule = useSeasonSchedule(competitionId)

  // Validated against the real schedule: a matchday that is not in the fixture
  // list would select nothing and render as an empty page.
  const requestedDay = Number(searchParams.get('day'))
  const selectedDay =
    schedule.data === undefined
      ? undefined
      : schedule.data.matchdays.some((entry) => entry.day === requestedDay)
        ? requestedDay
        : schedule.data.currentDay

  const matches = useMatchdayMatches(competitionId, selectedDay)

  /** Fresh score and minute per match — nothing for one that has not started. */
  const liveByMatchId = useLiveMatches(matches.data)

  const matchday = schedule.data?.matchdays.find(
    (entry) => entry.day === selectedDay,
  )
  const state = matchday === undefined ? undefined : matchdayState(matchday)

  /*
   * The ranking's scope and position filter live in the query string beside
   * `?day=`, not in component state, for the reason everything else on this
   * page does: a *Saison, Torwarte* is a thing worth linking to, and a refresh
   * should land on the list you were reading. Each combination is its own
   * request — see `useCompetitionPlayers` — so these are also the query key.
   */
  const rankingScope = toRankingScope(searchParams.get('scope'))
  const rankingPosition = toRankingPosition(searchParams.get('pos'))

  /*
   * Kickbase's ranking is the *current* matchday's and can be nothing else —
   * every matchday parameter probed is swallowed. Anything earlier comes from
   * the app's own files under `data/`, and `useMatchdayRanking` is the seam
   * between the two; it is the only thing on this page that knows there are
   * two sources at all.
   *
   * Gating on the view matters: the Spiele view is the page's front door and
   * should not pay for a request it never renders. Passing `undefined` leaves
   * both queries idle, the same way every hook in the app waits for its id.
   */
  const rankingId = view === VIEWS.ranking ? competitionId : undefined

  const ranking = useMatchdayRanking({
    competitionId: rankingId,
    day: selectedDay,
    currentDay: schedule.data?.currentDay,
    scope: rankingScope,
    position: rankingPosition,
    isLive: state === 'live',
  })
  const teams = useTeamDirectory(rankingId)

  /*
   * One group per distinct kick-off. The list arrives sorted by kick-off, so
   * insertion order is already the order to render — no second sort, and the
   * groups cannot disagree with the rows about the sequence.
   */
  const slots = useMemo(() => {
    const byKickoff = new Map<string, MatchdayMatch[]>()
    for (const match of matches.data ?? []) {
      const group = byKickoff.get(match.kickoff) ?? []
      group.push(match)
      byKickoff.set(match.kickoff, group)
    }
    return [...byKickoff]
  }, [matches.data])

  if (schedule.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeading title="Spieltag" />
        <SkeletonList rows={9} />
      </div>
    )
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

  /*
   * `?day=`, `?scope=` and `?pos=` ride along, so switching views keeps the
   * matchday you were looking at rather than snapping back to the current one,
   * and keeps the Rangliste's scope and position filter across a trip to the
   * fixtures and back.
   */
  const linkQuery = new URLSearchParams()
  if (selectedDay !== undefined) linkQuery.set('day', String(selectedDay))
  if (rankingScope === 'season') linkQuery.set('scope', rankingScope)
  if (rankingPosition !== undefined) linkQuery.set('pos', rankingPosition)
  const base = `/leagues/${leagueId}/${VIEWS.matches}`
  const query = linkQuery.toString()
  const suffix = query === '' ? '' : `?${query}`

  /**
   * Change one parameter and keep the rest — the day picker must not silently
   * clear the position filter, and neither the chips nor the scope toggle must
   * clear the day.
   *
   * `replace` keeps the back button meaning "leave the page" rather than
   * walking back through every matchday and every chip that was tapped.
   */
  const patchParams = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(searchParams)
    if (value === undefined) next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
  }
  const tabs: BottomTab[] = [
    {
      value: VIEWS.matches,
      label: 'Spiele',
      icon: Swords,
      to: `${base}${suffix}`,
    },
    {
      value: VIEWS.ranking,
      label: 'Rangliste',
      icon: ListOrdered,
      to: `${base}/${VIEWS.ranking}${suffix}`,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      {view === VIEWS.ranking ? (
        <>
          {/* The toggle is the heading here, so the page still needs one for
              anything that navigates by them. Visually hidden rather than
              shown small: two of them, one above the other, would be the
              duplication the toggle replaced. */}
          <h1 className="sr-only">Spieltag — Rangliste</h1>
          <RankingScopeToggle
            scope={rankingScope}
            onChange={(next) => {
              patchParams('scope', next === 'season' ? next : undefined)
            }}
          />
        </>
      ) : (
        <PageHeading
          title="Spieltag"
          subtitle={
            state === 'live'
              ? 'Live-Ergebnisse, minütlich aktualisiert'
              : state === 'finished'
                ? 'Endergebnisse des Spieltags'
                : 'Noch nicht angepfiffen'
          }
        />
      )}

      {/* **The same picker on both views, and the same `?day=` behind it.**
          It was hidden on the Rangliste while Kickbase's ranking could only be
          the current matchday — a control that visibly does nothing is worse
          than its absence. Now that earlier matchdays are served from `data/`
          it does something on both, and stepping back a matchday keeps
          whichever view you were reading.

          Not on the season scope, though: a season total is not scoped to a
          matchday, so the picker would be back to implying a list had followed
          when it had not. */}
      {(view === VIEWS.matches || rankingScope === 'matchday') && (
        <MatchdayPicker
          schedule={schedule.data}
          selectedDay={selectedDay as number}
          onSelect={(day) => {
            patchParams('day', String(day))
          }}
        />
      )}

      <div className="flex flex-col">
        {view === VIEWS.ranking ? (
          ranking.isError ? (
            <ErrorState error={ranking.error} onRetry={ranking.refetch} />
          ) : ranking.isMissing ? (
            /* Not an error and not an empty list: this matchday simply has no
               file yet. Every matchday is in this state until the seed script
               is run for it, so it says what is missing and what produces it
               rather than offering a retry that cannot help. */
            <EmptyState
              icon={<ListOrdered size={22} />}
              title="Noch nicht archiviert"
              description={`Für Spieltag ${String(selectedDay)} liegt noch keine gespeicherte Rangliste vor. Kickbase liefert nur Spieltag ${String(schedule.data.currentDay)} — ältere werden mit "npm run data:rankings" erzeugt.`}
              action={
                <button
                  type="button"
                  className="mt-1 rounded-lg px-3 py-1.5 text-sm font-medium text-accent hover:bg-surface-2"
                  onClick={() => {
                    patchParams('day', String(schedule.data.currentDay))
                  }}
                >
                  Zu Spieltag {schedule.data.currentDay}
                </button>
              }
            />
          ) : (
            <MatchdayRankingTab
              data={ranking.data}
              teams={teams.data}
              leagueId={leagueId}
              viewerId={user?.id}
              isPending={ranking.isPending}
              scope={rankingScope}
              source={ranking.source}
              position={rankingPosition}
              onPositionChange={(next) => {
                patchParams('pos', next)
              }}
            />
          )
        ) : matches.isPending ? (
          <SkeletonList rows={9} />
        ) : slots.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={22} />}
            title="Keine Spiele"
            description="Für diesen Spieltag hat Kickbase keine Begegnungen."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {slots.map(([kickoff, group]) => (
              <section key={kickoff} className="flex flex-col gap-2">
                <h2 className="nums px-0.5 text-xs font-medium tracking-wide text-faint uppercase">
                  {kickoffLabel(kickoff)}
                </h2>
                <ul className="flex flex-col gap-2">
                  {group.map((match) => (
                    <MatchCard
                      key={match.matchId}
                      match={match}
                      live={liveByMatchId.get(match.matchId)}
                      to={`/leagues/${leagueId}/matchday/${match.matchId}`}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <BottomTabBar tabs={tabs} active={view} ariaLabel="Spieltagsansicht" />
    </div>
  )
}
