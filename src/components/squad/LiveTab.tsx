import { AlertTriangle, List, Shirt } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { useMatchdayFixtures } from '@/api/hooks/useMatchday'
import { useMatchdayPoints } from '@/api/hooks/useMatchdayPoints'
import {
  byMatchdayPoints,
  DUEL_PLAYER_STATUS_LABEL,
  duelPlayerStatus,
  fixtureState,
  playerFigure,
  type DuelPlayer,
  type SquadMember,
} from '@/api/models'
import { DuelPlayerRow } from '@/components/duels/DuelPlayerRow'
import {
  figureDescription,
  figureLabel,
  isScore,
} from '@/components/player/playerFigure'
import { Pitch } from '@/components/squad/Pitch'
import {
  fitPitchMetrics,
  ROW_ORDER,
  usePitchBox,
  type PlayerMetrics,
} from '@/components/squad/pitchMetrics'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { points } from '@/lib/format'
import { emptySlotPenalty, LINEUP_SIZE } from '@/lib/lineup'
import { readString, writeString } from '@/lib/storage'

/** Which of the two live layouts is on screen. */
type LiveView = 'pitch' | 'list'

const VIEW_STORAGE_KEY = 'litbase.squad.live.view'

/**
 * The manager's own team on the **running** matchday, scoring as it happens.
 *
 * Only mounted while the current matchday is being played — see
 * `liveMatchday()` in [`models.ts`](../../api/models.ts) — so everything here
 * can assume there is something to show.
 *
 * Two layouts, one set of data:
 *
 *  - **Aufstellung** — the pitch, fielded players only, each portrait carrying
 *    the points it has scored so far. This is the "how is my eleven doing"
 *    view, and it is the default.
 *  - **Rangliste** — every player *including the bench*, best first. Bench
 *    players scored what they scored, it just did not count; seeing a 90-point
 *    substitute next to a fielded 12 is the single most useful thing this page
 *    can tell a manager, and leaving them out would make the list disagree
 *    with the pitch about who exists.
 *
 * **Why this view does *not* read the matchday snapshot.** It would be the
 * obvious source — the duel page uses it for past matchdays, and it is the
 * only thing that knows a squad as it stood — but it cannot be trusted while a
 * matchday runs. Measured on a real payload: for a matchday that has not
 * kicked off, the snapshot's `lp` is **empty** while the squad plainly has
 * eleven fielded (`lo` `0…10`). So `lp` fills at or after kick-off, and a view
 * that read it at 15:45 on a Saturday would draw a partial eleven, bench the
 * rest, and invoice the manager for empty slots that are not empty.
 *
 * Today's `lineupOrder` is the right source here precisely because this view
 * only exists *during* the matchday: Kickbase locks the lineup at the first
 * kick-off, so `lo` is both complete and current. The gap that remains is
 * narrow — a player transferred away mid-matchday drops out of the list along
 * with his points — and closing it means learning whether `lp` fills with all
 * eleven at the matchday's start or only per match. One probe during a running
 * matchday settles it; see
 * [duel detail](../../../docs/pages/duel-detail.md#a-settled-matchday-shows-what-was-actually-fielded).
 *
 * **Read-only.** Kickbase locks the lineup at the first kick-off, so there is
 * nothing here to edit: no rail, no swap dialog, no save. Tapping a player
 * opens his own page, which is where the per-match detail lives.
 *
 * The players are modelled as {@link DuelPlayer}, the duel page's row model,
 * because a live squad *is* one side of a duel with the opponent left out —
 * same statuses, same unknown-versus-zero rule on the points, same bench. The
 * list rows are literally that page's rows.
 */
export function LiveTab({
  squad,
  leagueId,
  competitionId,
  day,
}: {
  squad: SquadMember[]
  leagueId: string
  competitionId: string
  /** The matchday being played. */
  day: number
}) {
  const [view, setView] = useLiveView()
  const fixtures = useMatchdayFixtures(competitionId, day)

  // Only the ids and clubs go to the points hook, so it is not re-keyed by
  // every market-value tick the squad query brings back.
  const subjects = useMemo(
    () => squad.map((player) => ({ id: player.id, teamId: player.teamId })),
    [squad],
  )
  const matchdayPoints = useMatchdayPoints(
    leagueId,
    day,
    subjects,
    fixtures.data,
  )

  // Rebuilt each render, like the duel rosters and for the same reason: the
  // points map behind it is a fresh object on every poll, so memoising this
  // would need a surrogate key harder to trust than the twenty allocations it
  // saves. This view re-renders once a minute.
  const players: DuelPlayer[] = squad.map((player) => {
    const fixture = fixtures.data?.get(player.teamId)
    return {
      id: player.id,
      name: player.lastName,
      teamId: player.teamId,
      position: player.position,
      lineupOrder: player.lineupOrder,
      status: duelPlayerStatus({ lineupOrder: player.lineupOrder, fixture }),
      points: matchdayPoints.byPlayerId.get(player.id),
      availability: player.status,
      image: player.image,
      fixture,
    }
  })

  // `lo` is 0-based and `0` is the goalkeeper, so membership is tested against
  // `undefined` — `lineupOrder > 0` would silently bench the keeper, the trap
  // the squad page documents at length.
  const lineup = players
    .filter((player) => player.lineupOrder !== undefined)
    .sort((a, b) => (a.lineupOrder ?? 0) - (b.lineupOrder ?? 0))
  const ranked = [...players].sort(byMatchdayPoints)

  const countState = (state: 'running' | 'upcoming') =>
    lineup.filter(
      (player) =>
        player.fixture !== undefined && fixtureState(player.fixture) === state,
    ).length

  if (fixtures.isError) {
    return (
      <ErrorState
        error={fixtures.error}
        onRetry={() => {
          void fixtures.refetch()
        }}
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <LiveHeader
        day={day}
        lineup={lineup}
        activeMatches={countState('running')}
        openMatches={countState('upcoming')}
        isPointsPending={matchdayPoints.isPending}
        view={view}
        onChangeView={setView}
      />

      {view === 'pitch' ? (
        <LivePitch lineup={lineup} leagueId={leagueId} />
      ) : (
        <LiveRanking players={ranked} leagueId={leagueId} />
      )}
    </div>
  )
}

/**
 * Which live layout is on screen, remembered across visits.
 *
 * Same treatment as the Kader view's list/grid choice: through the app's safe
 * localStorage wrapper, so a blocked store degrades to the default instead of
 * throwing, and deliberately **not** in the URL — a layout is a preference,
 * not a place.
 */
function useLiveView(): [LiveView, (view: LiveView) => void] {
  const [view, setViewState] = useState<LiveView>(
    () => (readString(VIEW_STORAGE_KEY) as LiveView | null) ?? 'pitch',
  )

  const setView = (next: LiveView) => {
    setViewState(next)
    writeString(VIEW_STORAGE_KEY, next)
  }

  return [view, setView]
}

/**
 * The running total, and what is still to come.
 *
 * **The figure is the sum of the fielded rows**, not Kickbase's own matchday
 * total from the standings. On a live matchday the two describe the same
 * eleven — this is today's lineup, being played right now — and summing the
 * rows keeps the header consistent with the players underneath it as they
 * fill in, one request at a time. It is also why the spinner matters: a total
 * that is still climbing should say so rather than look settled.
 *
 * `n laufend · n offen` is the question a live view actually raises: 200 points
 * behind with four matches still to kick off is not the same position as 200
 * points behind with none.
 *
 * The penalty chip appears when fewer than eleven are fielded, because that is
 * the one way this sum and Kickbase's official total legitimately differ —
 * every empty slot costs 100 points and the standings will subtract them.
 */
function LiveHeader({
  day,
  lineup,
  activeMatches,
  openMatches,
  isPointsPending,
  view,
  onChangeView,
}: {
  day: number
  lineup: DuelPlayer[]
  activeMatches: number
  openMatches: number
  isPointsPending: boolean
  view: LiveView
  onChangeView: (view: LiveView) => void
}) {
  const total = lineup.reduce((sum, player) => sum + (player.points ?? 0), 0)
  const missing = LINEUP_SIZE - lineup.length
  const penalty = emptySlotPenalty(lineup.length)
  const penaltyMessage = `${missing === 1 ? 'Ein leerer Platz kostet' : `${String(missing)} leere Plätze kosten`} dich ${points(penalty)} Punkte — Kickbase zieht sie vom Gesamtergebnis ab.`

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 px-0.5">
      <div className="min-w-0">
        <p className="flex items-center gap-2">
          <span className="nums text-lg leading-tight font-bold text-ink">
            {points(total)}
          </span>
          <span className="text-xs text-muted">Punkte</span>
          {isPointsPending && <Spinner size={12} />}
          {missing > 0 && (
            <span
              title={penaltyMessage}
              className="flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning"
            >
              <AlertTriangle size={12} aria-hidden="true" />
              <span aria-hidden="true">−{points(penalty)}</span>
              <span className="sr-only">{penaltyMessage}</span>
            </span>
          )}
        </p>
        <p className="nums truncate text-xs text-muted">
          {day}. Spieltag · {activeMatches} laufend · {openMatches} offen
        </p>
      </div>

      <LiveViewToggle view={view} onChange={onChangeView} />
    </div>
  )
}

/**
 * Pitch or ranked list, as **one button showing both symbols** — the same
 * control the Kader view uses for list/grid, for the same reasons: two buttons
 * would double the target area to say one thing, and a lone glyph cannot
 * answer "is this where I am or where I would go?". The lit symbol is the
 * current view.
 */
function LiveViewToggle({
  view,
  onChange,
}: {
  view: LiveView
  onChange: (view: LiveView) => void
}) {
  const next: LiveView = view === 'pitch' ? 'list' : 'pitch'
  const label = next === 'list' ? 'Zur Punkte-Rangliste' : 'Zur Aufstellung'

  return (
    <button
      type="button"
      onClick={() => {
        onChange(next)
      }}
      title={label}
      aria-label={label}
      className={cn(
        'flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-2',
        'transition-colors hover:border-accent/40 hover:bg-surface-2',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
      )}
    >
      <Shirt
        size={15}
        aria-hidden="true"
        className={view === 'pitch' ? 'text-accent' : 'text-faint'}
      />
      <span aria-hidden="true" className="h-4 w-px bg-line" />
      <List
        size={15}
        aria-hidden="true"
        className={view === 'list' ? 'text-accent' : 'text-faint'}
      />
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/* Aufstellung                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The fielded eleven on the grass, each portrait carrying its score.
 *
 * The same four fixed bands and the same card sizing as the
 * [editor's pitch](./LineupTab.tsx) — both go through
 * [`pitchMetrics`](./pitchMetrics.ts), so the two views of the same eleven
 * draw players at identical size rather than differing for no visible reason.
 *
 * **No placeholders for the empty slots.** The editor draws them because they
 * are places you can still fill; here the lineup is locked and a dashed slot
 * saying *offen* would invite a tap that cannot do anything. The missing
 * points are named once, in the header's penalty chip, which is the part that
 * actually matters now.
 */
function LivePitch({
  lineup,
  leagueId,
}: {
  lineup: DuelPlayer[]
  leagueId: string
}) {
  const { ref, box } = usePitchBox()

  const metrics = useMemo(
    () =>
      fitPitchMetrics(
        box,
        Math.max(
          1,
          ...ROW_ORDER.map(
            (position) =>
              lineup.filter((player) => player.position === position).length,
          ),
        ),
      ),
    [box, lineup],
  )

  return (
    <Pitch className="flex-1">
      <div ref={ref} className="grid min-h-0 flex-1 grid-rows-4 px-2 py-3">
        {lineup.length === 0 ? (
          <p className="row-span-4 flex items-center justify-center px-6 text-center text-sm font-medium text-white/80">
            Für diesen Spieltag ist kein Spieler aufgestellt.
          </p>
        ) : (
          ROW_ORDER.map((position) => (
            <LivePitchRow
              key={position}
              players={lineup.filter((player) => player.position === position)}
              metrics={metrics}
              leagueId={leagueId}
            />
          ))
        )}
      </div>
    </Pitch>
  )
}

function LivePitchRow({
  players,
  metrics,
  leagueId,
}: {
  players: DuelPlayer[]
  metrics: PlayerMetrics
  leagueId: string
}) {
  return (
    /* `flex-nowrap` + `overflow-hidden`, as on the editor's pitch: wrapping
       would turn width pressure into height, which feeds back into the avatar
       sizing and oscillates. The sizing already guarantees the busiest band
       fits, so the clipping is a backstop rather than a normal state. */
    <div className="flex min-h-0 flex-nowrap items-center justify-center gap-1 overflow-hidden">
      {players.map((player) => (
        <LivePitchPlayer
          key={player.id}
          player={player}
          metrics={metrics}
          leagueId={leagueId}
        />
      ))}
    </div>
  )
}

/**
 * One fielded player: portrait, name, and one figure — the points, or the
 * **kick-off time** while his match is still to come
 * ([`playerFigure()`](../../api/models.ts), shared with the duel pitch).
 *
 * Never `0` for a player who has not scored: that distinction is the whole
 * reason the model's `points` is optional, and on grass it is the difference
 * between "hasn't played" and "played badly".
 *
 * A **running** match tints the ring and the figure with the accent colour,
 * and nothing else does. It is the one state that is going to change, so it is
 * the one worth spotting from across the pitch; if every state were coloured,
 * eleven portraits would read as a warning light.
 */
function LivePitchPlayer({
  player,
  metrics,
  leagueId,
}: {
  player: DuelPlayer
  metrics: PlayerMetrics
  leagueId: string
}) {
  const isRunning = player.status === 'playing'
  const figure = playerFigure(player)

  return (
    <Link
      to={`/leagues/${leagueId}/players/${player.id}`}
      title={`${player.name} – Spielerseite öffnen`}
      // Spelled out rather than left to the two lines of the plate, which read
      // as "Kane 215" — a number with no unit and no idea whether the match is
      // over.
      aria-label={`${player.name}: ${figureDescription(figure)}, ${DUEL_PLAYER_STATUS_LABEL[player.status]}`}
      style={{ width: metrics.width }}
      className="flex shrink-0 flex-col items-center rounded-lg p-1 transition-colors hover:bg-black/20"
    >
      <Avatar
        src={player.image}
        name={player.name}
        size={metrics.avatar}
        className={cn('ring-2', isRunning ? 'ring-accent' : 'ring-white/70')}
      />

      <span
        aria-hidden="true"
        style={{ width: metrics.plateWidth, marginTop: -metrics.plateOverlap }}
        className="relative flex flex-col items-center rounded bg-black/70 px-1 py-0.5 leading-tight"
      >
        <span
          style={{ fontSize: metrics.nameFontSize }}
          className="max-w-full truncate font-semibold text-white"
        >
          {player.name}
        </span>
        <span
          style={{ fontSize: metrics.nameFontSize }}
          className={cn(
            'nums max-w-full truncate font-bold',
            isRunning
              ? 'text-accent'
              : isScore(figure)
                ? 'text-white'
                : 'text-white/55',
          )}
        >
          {figureLabel(figure)}
        </span>
      </span>
    </Link>
  )
}

/* -------------------------------------------------------------------------- */
/* Rangliste                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Every player of the squad, best first, bench included.
 *
 * The bench is the point of this view. Those players scored what they scored
 * and it did not count, and the only way to know whether the lineup was right
 * is to see them ranked against the eleven that played — so each row keeps its
 * status word (*Läuft*, *Beendet*, *Offen*, *Bank*) rather than the list being
 * split into two sections that hide the comparison.
 *
 * Players without a score sort **last**, not as zero: a match that has not
 * kicked off is not a blank performance.
 */
function LiveRanking({
  players,
  leagueId,
}: {
  players: DuelPlayer[]
  leagueId: string
}) {
  return (
    <ol className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      {players.map((player, index) => (
        <li key={player.id} className="flex items-center">
          <span className="nums w-8 shrink-0 pl-3 text-right text-xs font-semibold text-faint">
            {index + 1}
          </span>
          <Link
            to={`/leagues/${leagueId}/players/${player.id}`}
            className="min-w-0 flex-1 transition-colors hover:bg-surface-2/60"
          >
            <DuelPlayerRow player={player} />
          </Link>
        </li>
      ))}
    </ol>
  )
}
