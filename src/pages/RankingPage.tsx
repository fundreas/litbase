import {
  Award,
  Diff,
  ListOrdered,
  Sigma,
  Swords,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'

import { useLeagueChicagoPoints } from '@/api/hooks/useChicagoRanking'
import { useSeasonSchedule } from '@/api/hooks/useMatchday'
import { duelResultOf, useRanking } from '@/api/hooks/useRanking'
import type { DuelResult, RankedManager } from '@/api/models'
import { useAuth } from '@/auth/useAuth'
import { PageHeading } from '@/components/PageHeading'
import { BattleRankingTab } from '@/components/ranking/BattleRankingTab'
import { DuelOutcomeLine } from '@/components/ranking/DuelOutcomeLine'
import { ManagerAvatar } from '@/components/manager/ManagerAvatar'
import { BottomTabBar, type BottomTab } from '@/components/ui/BottomTabBar'
import { Card } from '@/components/ui/Card'
import { PlacementChange } from '@/components/ui/PlacementChange'
import { SkeletonList } from '@/components/ui/Skeleton'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/States'
import { useActiveLeague } from '@/league/useActiveLeague'
import { cn } from '@/lib/cn'
import { placement, points } from '@/lib/format'

/**
 * Which of the three tables the list is showing.
 *
 * `duel` and `total` are Kickbase's own — the head-to-head table and the raw
 * points table, both of which arrive ranked on the payload. `chicago` is the
 * app's: the same duels scored by their margin, computed here over a season of
 * matchdays. See [Ranking](../../docs/pages/ranking.md#chicago-mode).
 */
type SortKey = 'duel' | 'total' | 'chicago'

/**
 * The page's two views, and the URL segment each one is reached by.
 *
 * `ranking` is the **bare** route (`/leagues/:leagueId/ranking`), so its value
 * only ever names the view and is never appended to a URL.
 */
const VIEWS = { ranking: 'ranking', battles: 'battles' } as const
type View = (typeof VIEWS)[keyof typeof VIEWS]

/**
 * **The league's standings — the season table, and its side competitions.**
 *
 *   /leagues/:leagueId/ranking            the table
 *   /leagues/:leagueId/ranking/battles    one battle's ranking, ?battle=<type>
 *
 * ## Two views, because they rank the same managers by different things
 *
 * The table is the league as it stands. *Battles* is the same field re-sorted
 * by one of Kickbase's side competitions — most transfers, most points with
 * defenders, most matchdays won — and it belongs here rather than on
 * [Liga](./LeaguePage.tsx) for exactly that reason: it is a standings list,
 * with the standings' rows, one tap from the table it is a variation of. The
 * Liga page keeps the *Wettkämpfe* card that names who leads each one, and
 * every row of it now opens the matching battle here.
 *
 * The view is a **path segment** switched by a
 * [`BottomTabBar`](../components/ui/BottomTabBar.tsx), as on the market, squad
 * and season pages, and the battle itself rides in **`?battle=<type>`** — the
 * same arrangement [Saison](./SeasonPage.tsx) uses for `?pos=`. So a battle is
 * linkable, survives a refresh, and comes back unchanged when you switch to
 * the table and back.
 *
 * The bar is unconditional, unlike the [market](./MarketPage.tsx)'s: whether a
 * league runs battles is in a payload no route can see, and the battles view
 * says so itself rather than having its tab quietly disappear.
 */
export function RankingPage() {
  const { leagueId, competitionId } = useActiveLeague()
  const { user } = useAuth()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const view: View = location.pathname.endsWith(`/${VIEWS.battles}`)
    ? VIEWS.battles
    : VIEWS.ranking
  const { data, isPending, isError, error, refetch } = useRanking(leagueId)
  const [sortBy, setSortBy] = useState<SortKey>('duel')

  // In a duel league the tables genuinely disagree, so the toggle switches the
  // whole view at once — order, placement number and headline figure. Listing
  // duel placements in points order would just look broken.
  const isDuelView = data?.isDuelMode === true && sortBy === 'duel'
  const isChicagoView =
    data?.isDuelMode === true && sortBy === 'chicago' && view === VIEWS.ranking

  /*
   * Chicago is the one table Kickbase does not send: it is every finished
   * matchday's pairings, scored by their margin, which costs the competition's
   * calendar plus one request per matchday — see
   * [`useLeagueChicagoPoints`](../api/hooks/useChicagoRanking.ts). Both are
   * handed `undefined` unless that table is the one actually on screen, which
   * is what keeps a season of requests off the other two tables, off the
   * battles view and off every league that plays no duels.
   */
  const schedule = useSeasonSchedule(isChicagoView ? competitionId : undefined)
  const chicago = useLeagueChicagoPoints(
    leagueId,
    isChicagoView ? schedule.data?.matchdays : undefined,
  )

  const managers = useMemo(() => {
    const list = data?.managers ?? []
    // The hook already sorted by the league's own table, so only the
    // non-default views need re-sorting.
    if (data?.isDuelMode !== true || sortBy === 'duel') return list
    if (sortBy === 'chicago') {
      const chicagoOf = (manager: RankedManager) =>
        chicago.byManagerId.get(manager.id) ?? 0
      // Ties fall back to the league's own table rather than to the array
      // order: before the first matchday lands every manager is on nought,
      // and a random order would read as a ranking.
      return [...list].sort(
        (a, b) =>
          chicagoOf(b) - chicagoOf(a) ||
          (b.duelPoints ?? 0) - (a.duelPoints ?? 0) ||
          b.seasonPoints - a.seasonPoints,
      )
    }
    return [...list].sort(
      (a, b) =>
        a.seasonPlacement - b.seasonPlacement ||
        b.seasonPoints - a.seasonPoints,
    )
  }, [data, sortBy, chicago.byManagerId])

  // Duel results are resolved against the opponent named in `hhoui`, so the
  // whole field has to be addressable by id.
  const byId = useMemo(
    () =>
      new Map((data?.managers ?? []).map((manager) => [manager.id, manager])),
    [data],
  )

  /* Title stars for the battles view's faces. `swc` is on the standings and
     nowhere else — the battle payload has no such field — so the count is
     lifted out of the query this page makes anyway and handed over, which is
     what keeps a champion looking like one on both tabs without a request of
     its own. */
  const titlesById = useMemo(
    () =>
      new Map(
        (data?.managers ?? []).map((manager) => [manager.id, manager.titles]),
      ),
    [data],
  )

  const battleParam = searchParams.get('battle')
  const base = `/leagues/${leagueId}/${VIEWS.ranking}`
  // `?battle=` rides along, so switching to the table and back returns to the
  // battle that was open rather than to the first one.
  const suffix =
    battleParam === null ? '' : `?battle=${encodeURIComponent(battleParam)}`
  const tabs: BottomTab[] = [
    { value: VIEWS.ranking, label: 'Rangliste', icon: ListOrdered, to: base },
    {
      value: VIEWS.battles,
      label: 'Battles',
      icon: Award,
      to: `${base}/${VIEWS.battles}${suffix}`,
    },
  ]

  const heading = (
    <PageHeading
      title="Rangliste"
      subtitle={
        data === undefined
          ? undefined
          : data.isDuelMode && view === VIEWS.ranking
            ? `${String(managers.length)} Manager · ${
                isChicagoView ? 'Chicago-Modus' : 'Duell-Modus'
              }`
            : `${String(managers.length)} Manager`
      }
      action={
        // The toggle sorts the season table and means nothing over a battle's
        // own ranking, so it belongs to that view rather than to the page.
        data?.isDuelMode === true && view === VIEWS.ranking ? (
          <SortToggle value={sortBy} onChange={setSortBy} />
        ) : undefined
      }
    />
  )

  /* The Chicago table's own two states. A single matchday that failed is a
     margin missing from one row, which the totals absorb; it is only *every*
     matchday failing — or the calendar they are read from — that leaves
     nothing to rank by. */
  const chicagoError = !isChicagoView
    ? undefined
    : schedule.isError
      ? schedule.error
      : chicago.isError
        ? chicago.error
        : undefined

  const chicagoPending = !isChicagoView
    ? undefined
    : schedule.isPending
      ? 'Spieltage werden geladen …'
      : chicago.pendingCount === 0
        ? undefined
        : chicago.pendingCount === 1
          ? 'Noch ein Spieltag wird ausgewertet …'
          : `Noch ${String(chicago.pendingCount)} Spieltage werden ausgewertet …`

  /* The standings' own states gate the **table only**. The battles view reads
     a different endpoint and carries its own states, so a failed table must
     not take the other tab down with it — and its stars degrade to none. */
  const body =
    view === VIEWS.battles ? (
      <BattleRankingTab
        leagueId={leagueId}
        viewerId={user?.id}
        battle={battleParam}
        onBattleChange={(type) => {
          const params = new URLSearchParams(searchParams)
          params.set('battle', String(type))
          // `replace`, so back leaves the page rather than walking through
          // every chip that was tapped — as on the season ranking's `?pos=`.
          setSearchParams(params, { replace: true })
        }}
        titlesById={titlesById}
      />
    ) : isPending ? (
      // Inside the card the rows will land in, so the page's shape does not
      // change when the standings arrive — only its contents.
      <Card className="p-3">
        <SkeletonList rows={8} />
      </Card>
    ) : isError ? (
      <ErrorState
        error={error}
        onRetry={() => {
          void refetch()
        }}
      />
    ) : isChicagoView && chicagoError !== undefined ? (
      /* Every matchday failed, or the calendar did — so there is no margin for
         anybody. The table would be the whole league on nought, which looks
         like a season nobody has won a duel in rather than like a request that
         did not land. */
      <ErrorState
        error={chicagoError}
        onRetry={() => {
          void schedule.refetch()
          chicago.refetch()
        }}
      />
    ) : (
      /* One card, rows flush inside it — the shape the
         [market](./MarketPage.tsx), the Kader and the
         [feed](../components/events/ActivityFeed.tsx) have, and the one a
         standings table wants most: these rows are a single ranked sequence,
         and 8px of page between two placements said they were separate
         things. */
      <div className="flex flex-col gap-2">
        {/* The Chicago table is summed from matchdays that arrive one at a
            time, so rows do move while they land — the same line the manager
            page's season of duels draws, and for the same reason: a table
            reordering itself under the reader has to say why. */}
        {isChicagoView && chicagoPending !== undefined && (
          <p className="flex items-center gap-2 px-0.5 text-xs text-muted">
            <Spinner size={12} />
            <span>{chicagoPending}</span>
          </p>
        )}
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {managers.map((manager, index) => (
              <ManagerRow
                key={manager.id}
                manager={manager}
                leagueId={leagueId}
                isMe={manager.id === user?.id}
                mode={data.isDuelMode ? sortBy : 'total'}
                /* Chicago is ranked here rather than by Kickbase, so the
                   number down the left is the row's own position. */
                place={
                  isChicagoView
                    ? index + 1
                    : isDuelView
                      ? (manager.duelPlacement ?? index + 1)
                      : manager.seasonPlacement
                }
                chicagoPoints={chicago.byManagerId.get(manager.id) ?? 0}
                duelResult={
                  data.isDuelMode ? duelResultOf(manager, byId) : undefined
                }
                duelOpponentName={
                  manager.duelOpponentId === undefined
                    ? undefined
                    : byId.get(manager.duelOpponentId)?.name
                }
              />
            ))}
          </ul>
        </Card>
      </div>
    )

  return (
    <div className="flex flex-col gap-4">
      {heading}
      {body}
      <BottomTabBar tabs={tabs} active={view} ariaLabel="Ranglistenansicht" />
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/** Only rendered for duel leagues — elsewhere all three mean the same. */
function SortToggle({
  value,
  onChange,
}: {
  value: SortKey
  onChange: (next: SortKey) => void
}) {
  // Crossed swords for the head-to-head table, a summation sign for the
  // points total, a difference sign for Chicago — where a win is worth the
  // difference between the two scores. Icon-only keeps the control out of the
  // heading's way; the meaning rides on `title` plus screen-reader text rather
  // than labels that would need truncating on a phone.
  const options: Array<{ key: SortKey; Icon: LucideIcon; label: string }> = [
    { key: 'duel', Icon: Swords, label: 'Nach Duellpunkten sortieren' },
    { key: 'total', Icon: Sigma, label: 'Nach Kickbase-Punkten sortieren' },
    {
      key: 'chicago',
      Icon: Diff,
      label: 'Chicago-Modus: nach Siegdifferenz sortieren',
    },
  ]

  return (
    <div
      role="group"
      aria-label="Sortierung"
      className="flex shrink-0 gap-0.5 rounded-full border border-line bg-surface p-0.5"
    >
      {options.map(({ key, Icon, label }) => {
        const isActive = key === value
        return (
          <button
            key={key}
            type="button"
            aria-pressed={isActive}
            title={label}
            onClick={() => {
              onChange(key)
            }}
            className={cn(
              'flex h-8 w-9 items-center justify-center rounded-full transition-colors',
              isActive
                ? 'bg-accent text-accent-ink'
                : 'text-muted hover:text-ink',
            )}
          >
            <Icon size={15} aria-hidden="true" />
            <span className="sr-only">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * One manager's row — **and a link to their page.**
 *
 * The whole row, because every part of it is about the one manager: a list row
 * on a phone is a big target and there is nothing else here it could mean. That
 * is what this table was missing — a name and two numbers, and no way to ask
 * what was behind them; the [manager page](./ManagerDetailPage.tsx) is the
 * answer, with their eleven, their squad and their transfers.
 */
function ManagerRow({
  manager,
  leagueId,
  isMe,
  mode,
  place,
  chicagoPoints,
  duelResult,
  duelOpponentName,
}: {
  manager: RankedManager
  leagueId: string
  isMe: boolean
  /** Which table this row is part of — it decides both figures on the right. */
  mode: SortKey
  /** The number down the left, already resolved for the table in view. */
  place: number
  /** The margin of every duel this manager has won, `0` until they win one. */
  chicagoPoints: number
  duelResult: DuelResult | undefined
  duelOpponentName: string | undefined
}) {
  /*
   * The bold figure is what the table is sorted by and the muted one is a
   * total that does not decide it — which is what makes the ordering
   * self-explaining. Chicago's companion is the duel table it argues with: a
   * manager who leads on margin while sitting third on duel points is the
   * whole reason the mode exists, and the row says so without being opened.
   */
  const headline =
    mode === 'chicago'
      ? chicagoPoints
      : mode === 'duel'
        ? manager.duelPoints
        : manager.seasonPoints
  const companion =
    manager.duelPoints === undefined
      ? undefined
      : mode === 'duel'
        ? {
            text: `${points(manager.seasonPoints)} Pkt`,
            title: 'Kickbase-Punkte insgesamt',
          }
        : {
            text: `${points(manager.duelPoints)} Duell`,
            title: 'Duellpunkte insgesamt',
          }

  return (
    <li>
      <Link
        to={`/leagues/${leagueId}/managers/${manager.id}`}
        className={cn(
          // No card of its own — the rows are flush in one, divided by
          // hairlines. The viewer's own row takes the mark every list in the
          // app now uses: a tinted ground and a 2px accent edge down the left,
          // transparent on every other row so nothing shifts sideways. See
          // [`MarketRow`](../components/market/MarketRow.tsx).
          'flex items-center gap-3 border-l-2 bg-surface px-3 py-2.5',
          'transition-colors hover:bg-surface-2',
          isMe ? 'border-l-accent bg-accent/5' : 'border-l-transparent',
        )}
      >
        {/* Placement and avatar are one group with a tight gap of their own, so
          the row's `gap-3` separates them from the text rather than pushing
          the number away from the face it belongs to. */}
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="w-6 text-center">
            <span className="nums block text-base font-bold text-faint">
              {placement(place)}
            </span>
            {/* Only when it actually moved — a lone dash was a line saying
              nothing. And never in Chicago, where `ppc` is movement in
              Kickbase's table, not in this one: an arrow beside a placement it
              does not describe would be the row's one outright lie. */}
            {mode !== 'chicago' && (
              <PlacementChange value={manager.placementChange} />
            )}
          </span>
          <ManagerAvatar manager={manager} size={48} />
        </span>

        {/* Name, then two subtitles: what was scored this matchday, then how
          the duel it fed into went. */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">
            {manager.name}
            {isMe && <span className="ml-1.5 text-xs text-accent">du</span>}
          </p>
          {/* The manager's real Kickbase points for the matchday — not their
            duel points, which are the headline figure on the right. */}
          <p className="nums truncate text-xs text-muted">
            {points(manager.matchdayPoints)} Pkt am Spieltag
          </p>
          <DuelOutcomeLine
            result={duelResult}
            opponentName={duelOpponentName}
          />
        </div>

        {/* Two figures stacked — see the note above where they are chosen. */}
        <div className="shrink-0 text-right">
          <p className="nums text-sm font-semibold text-ink">
            {points(headline)}
          </p>
          {companion !== undefined && (
            <p className="nums text-xs text-muted" title={companion.title}>
              {companion.text}
            </p>
          )}
        </div>
      </Link>
    </li>
  )
}
