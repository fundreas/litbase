import { AlertTriangle, List, Shirt } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { useMatchdayFixtures } from '@/api/hooks/useMatchday'
import { useLiveMatches } from '@/api/hooks/useLiveMatches'
import { useMatchdayPoints } from '@/api/hooks/useMatchdayPoints'
import { useMatchdaySquad } from '@/api/hooks/useMatchdaySquad'
import { breakdownFixtureFrom } from '@/api/hooks/usePlayerMatchEvents'
import { teamSheetRole, useTeamSheets } from '@/api/hooks/useTeamSheets'
import {
  areFixturesSettled,
  byMatchdayPoints,
  canUseMatchdaySquad,
  DUEL_PLAYER_STATUS_LABEL,
  duelPlayerStatus,
  fixtureState,
  isBeforeKickoff,
  playerFigure,
  TEAM_SHEET_ROLE_LABEL,
  type DuelPlayer,
  type MatchdaySquad,
  type MatchdaySquadPlayer,
  type SquadMember,
} from '@/api/models'
import { DuelPlayerRow } from '@/components/duels/DuelPlayerRow'
import {
  figureDescription,
  figureLabel,
  isScore,
} from '@/components/player/playerFigure'
import { PlayerMatchEventsDialog } from '@/components/player/PlayerMatchEventsDialog'
import { TeamSheetCorner } from '@/components/player/TeamSheetMark'
import {
  ExpectedPointsFigure,
  ProjectedPointsFigure,
} from '@/components/squad/ExpectedPointsBadge'
import {
  expectedDescription,
  expectedTextClass,
} from '@/components/squad/expectedPointsLabels'
import { Pitch } from '@/components/squad/Pitch'
import {
  cornerBadgeSize,
  fitPitchMetrics,
  PITCH_BAND_CLASS,
  pitchGridClass,
  pitchSpanClass,
  ROW_ORDER,
  usePitchBox,
  usePitchOrientation,
  type PitchOrientation,
  type PlayerMetrics,
} from '@/components/squad/pitchMetrics'
import { useExpectedPointsView } from '@/components/squad/useExpectedPointsView'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import {
  isProjection,
  projectedPointsTotal,
  type ExpectedPointsEntry,
  type ExpectedPointsView,
} from '@/lib/expectedPoints'
import { points } from '@/lib/format'
import { emptySlotPenalty, LINEUP_SIZE } from '@/lib/lineup'
import { readString, writeString } from '@/lib/storage'
import { useHashModal } from '@/lib/useHashModal'

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
 * **The squad is the matchday's whenever it can be.** The
 * [snapshot](../../api/hooks/useMatchdaySquad.ts) is the only source that
 * knows a squad as it stood, so a player sold after kick-off keeps the points
 * he scored for you. It is used as soon as its lineup looks complete —
 * `canUseMatchdaySquad` holds that test and the measurement behind it — and
 * today's `lineupOrder` stands in until then, which before the first kick-off
 * is the only thing that knows the lineup at all.
 *
 * The fallback is not a formality: `lo` is complete and current for the whole
 * matchday because Kickbase locks the lineup at kick-off, so a view that only
 * ever exists *during* a matchday loses nothing by leaning on it for a few
 * seconds while the snapshot arrives.
 *
 * **Read-only.** Kickbase locks the lineup at the first kick-off, so there is
 * nothing here to edit: no rail, no swap dialog, no save.
 *
 * **Tapping a portrait opens the actions behind its number** — see
 * [`PlayerMatchEventsDialog`](../player/PlayerMatchEventsDialog.tsx). That
 * dialog's header links on to the **match**, not the player: this is your own
 * eleven, so the men are the one thing you already know, and what you do not is
 * what is happening in the fixture. The Rangliste's rows still go to the player
 * pages, so nothing became unreachable.
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
  userId,
  day,
}: {
  /** Today's squad: the fallback roster, and the source of every position. */
  squad: SquadMember[]
  leagueId: string
  competitionId: string
  /** The signed-in manager, whose snapshot is fetched. */
  userId: string
  /** The matchday being played. */
  day: number
}) {
  const [view, setView] = useLiveView()
  /**
   * Which portrait's breakdown is open — `#player:<id>`, the same layer the
   * [match](../matchday/MatchLineupTab.tsx) and
   * [duel](../duels/DuelLineupTab.tsx) pitches use. So the back gesture
   * closes the sheet instead of leaving a running matchday, and a refresh
   * — this view refetches every minute anyway — puts it back. See
   * [`useHashModal`](../../lib/useHashModal.ts).
   */
  const breakdown = useHashModal('player')
  const fixtures = useMatchdayFixtures(competitionId, day)

  /**
   * Position per player, which the snapshot payload does not reliably carry.
   * Today's squad answers for everyone still owned; a player sold since is in
   * neither and keeps `undefined`.
   */
  const positions = useMemo(
    () => new Map(squad.map((player) => [player.id, player.position])),
    [squad],
  )

  /**
   * Is a match actually being played right now? This tab only exists on a live
   * matchday, but "live matchday" spans a Friday evening to a Sunday night and
   * most of that is between matches. The poll follows the matches, not the
   * matchday — and it is the snapshot's own per-player scores it is refreshing,
   * which is what makes this page's points **one request a tick** rather than
   * one per player.
   */
  const isLive = [...(fixtures.data?.values() ?? [])].some(
    (fixture) => fixtureState(fixture) === 'running',
  )

  const snapshot = useMatchdaySquad(leagueId, userId, day, positions, {
    isLive,
  })

  /** Today's squad in the snapshot's shape, as the fallback source. */
  const today = useMemo(() => {
    const players: (MatchdaySquadPlayer & { lineupOrder?: number })[] =
      squad.map((player) => ({
        id: player.id,
        name: player.lastName,
        teamId: player.teamId,
        position: player.position,
        availability: player.status,
        image: player.image,
        wasFielded: player.lineupOrder !== undefined,
        lineupOrder: player.lineupOrder,
        // Today's squad has no notion of a matchday, so no running score either.
        // The per-player fan-out covers whoever ends up here.
        livePoints: undefined,
      }))
    return {
      // `lo` is 0-based and `0` is the goalkeeper, so membership is tested
      // against `undefined` — `lineupOrder > 0` would silently bench the
      // keeper, the trap the squad page documents at length.
      fielded: players
        .filter((player) => player.wasFielded)
        .sort((a, b) => (a.lineupOrder ?? 0) - (b.lineupOrder ?? 0)),
      bench: players.filter((player) => !player.wasFielded),
    }
  }, [squad])

  /**
   * The matchday's squad when it can be believed, today's until then. The
   * "when" is `canUseMatchdaySquad`, which carries the measurement behind it.
   */
  const matchdaySquad: MatchdaySquad | undefined = snapshot.data
  const roster =
    matchdaySquad !== undefined &&
    canUseMatchdaySquad(
      matchdaySquad,
      today.fielded.length,
      areFixturesSettled(fixtures.data),
    )
      ? matchdaySquad
      : today

  // Not memoised: the roster is picked fresh every render, so a memo keyed on
  // it would never hit and one keyed on the queries behind it would be a
  // dependency list that lies. `useQueries` inside the points hook compares by
  // key, so a fresh array of the same ids costs nothing.
  const subjects = [...roster.fielded, ...roster.bench].map((player) => ({
    id: player.id,
    teamId: player.teamId,
    // A player sold since the matchday is in no current squad, so his own
    // detail is the only source of a position — and without one the pitch
    // cannot place him and would drop him silently.
    needsPosition: player.position === undefined,
    // The running score, already in hand from the snapshot. Handing it over
    // switches this player's per-player poll off, and it is still outranked by
    // the settled score once his match is over.
    livePoints: player.livePoints,
  }))
  /** Fresh score, minute and events — one request per match, not per player. */
  const liveByMatchId = useLiveMatches(fixtures.data?.values())

  /**
   * The clubs' own team sheets, for the matches of this matchday that have not
   * kicked off — see [`useTeamSheets`](../../api/hooks/useTeamSheets.ts). On a
   * matchday spread over three days that is most of the eleven on a Saturday
   * evening, and the lineup is already locked, so it is the one thing left to
   * find out.
   */
  const sheetByTeamId = useTeamSheets(fixtures.data?.values())

  /**
   * **What the players whose matches are still to come are expected to
   * bring** — the reader's own guesses where he entered any, the
   * [model's](../../api/hooks/usePointcast.ts) prediction everywhere else.
   *
   * A live matchday spans a Friday evening to a Sunday night, so for most of
   * the time this view is on screen half the eleven has not kicked off. Those
   * are the players whose figure slot said nothing but a kick-off time, and
   * they are exactly the ones the reader is still weighing.
   */
  const expected = useExpectedPointsView(day)

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
  const toPlayer = (
    player: MatchdaySquadPlayer,
    wasFielded: boolean,
  ): DuelPlayer => {
    const fixture = fixtures.data?.get(player.teamId)
    const live =
      fixture === undefined ? undefined : liveByMatchId.get(fixture.matchId)
    return {
      id: player.id,
      name: player.name,
      teamId: player.teamId,
      // Today's squad first, then the player's own detail — which is the only
      // source for someone the manager no longer owns.
      position:
        player.position ?? matchdayPoints.positionByPlayerId.get(player.id),
      lineupOrder: wasFielded ? 0 : undefined,
      status: duelPlayerStatus({
        lineupOrder: wasFielded ? 0 : undefined,
        fixture,
      }),
      points: matchdayPoints.byPlayerId.get(player.id),
      availability: player.availability,
      image: player.image,
      fixture,
      live,
      events: live?.eventsByPlayerId.get(player.id),
      sheet: teamSheetRole(sheetByTeamId, player.teamId, player.id),
    }
  }

  // Straight from whichever source's own split, in its own order.
  const lineup = roster.fielded.map((player) => toPlayer(player, true))
  // The tapped portrait, found back in the eleven on the pitch. A hash naming
  // a player no longer fielded — sold, or benched since — opens nothing.
  const openPlayer = lineup.find((player) => player.id === breakdown.id)
  const ranked = [
    ...lineup,
    ...roster.bench.map((player) => toPlayer(player, false)),
  ].sort(byMatchdayPoints)

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
          void snapshot.refetch()
        }}
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <LiveHeader
        day={day}
        lineup={lineup}
        expected={expected}
        activeMatches={countState('running')}
        openMatches={countState('upcoming')}
        isPointsPending={matchdayPoints.isPending}
        view={view}
        onChangeView={setView}
      />

      {view === 'pitch' ? (
        <LivePitch
          lineup={lineup}
          expected={expected}
          onOpen={(player) => {
            breakdown.open(player.id)
          }}
        />
      ) : (
        <LiveRanking players={ranked} leagueId={leagueId} expected={expected} />
      )}

      {/* The breakdown for whichever portrait was tapped. Its header links to
          the **match**, not the player: you already know your own eleven, so
          the question a live squad leaves open is what is happening in the
          fixture — the opposite of the duel and match pitches, where the man
          is the unknown. */}
      {openPlayer?.fixture !== undefined && (
        <PlayerMatchEventsDialog
          key={openPlayer.id}
          fixture={breakdownFixtureFrom(
            openPlayer.fixture,
            day,
            openPlayer.points,
            { match: openPlayer.live, teamId: openPlayer.teamId },
          )}
          playerId={openPlayer.id}
          playerName={openPlayer.name}
          leagueId={leagueId}
          to={`/leagues/${leagueId}/matchday/${openPlayer.fixture.matchId}`}
          onClose={breakdown.close}
        />
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
 *
 * **The projected chip beside it is where the eleven is heading**: the scored
 * rows plus an expected figure for every match still to come, in the colour of
 * whatever carries it — accent green once the reader has overruled the model
 * anywhere, orange while the projection is all the model's. It does not model
 * the empty-slot penalty; that is the chip next to it, and folding the two
 * together would make one figure that agrees with nothing on the screen.
 */
function LiveHeader({
  day,
  lineup,
  expected,
  activeMatches,
  openMatches,
  isPointsPending,
  view,
  onChangeView,
}: {
  day: number
  lineup: DuelPlayer[]
  /** This matchday's expected points, for the matches still to come. */
  expected: ExpectedPointsView
  activeMatches: number
  openMatches: number
  isPointsPending: boolean
  view: LiveView
  onChangeView: (view: LiveView) => void
}) {
  const total = lineup.reduce((sum, player) => sum + (player.points ?? 0), 0)
  /* Where the eleven is heading: the scored rows, plus an expected figure for
     every match still to come. The chip beside the total rather than a line of
     its own, because it is the same eleven measured at a later time — and it
     is what makes the running total answerable ("200 behind" means nothing
     without "and four still to play"). */
  const projected = projectedPointsTotal(lineup, expected)
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
          {isProjection(projected) && (
            <ProjectedPointsFigure
              projected={projected}
              iconSize={11}
              variant="chip"
              className="text-xs"
            />
          )}
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
  onOpen,
  expected,
}: {
  lineup: DuelPlayer[]
  onOpen: (player: DuelPlayer) => void
  /** This matchday's expected points, for the matches still to come. */
  expected: ExpectedPointsView
}) {
  const { ref, box } = usePitchBox()
  /** Portrait on a phone, on its side from `lg` up — as the editor's pitch is,
      so the two views of the same eleven still agree about everything. */
  const orientation = usePitchOrientation()

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
        { orientation },
      ),
    [box, lineup, orientation],
  )

  return (
    <Pitch orientation={orientation} className="flex-1">
      <div
        ref={ref}
        className={cn(
          'grid min-h-0 min-w-0 flex-1 px-2 py-3',
          pitchGridClass(ROW_ORDER.length, orientation),
        )}
      >
        {lineup.length === 0 ? (
          <p
            className={cn(
              'flex items-center justify-center px-6 text-center text-sm font-medium text-white/80',
              pitchSpanClass(ROW_ORDER.length, orientation),
            )}
          >
            Für diesen Spieltag ist kein Spieler aufgestellt.
          </p>
        ) : (
          ROW_ORDER.map((position) => (
            <LivePitchRow
              key={position}
              players={lineup.filter((player) => player.position === position)}
              metrics={metrics}
              onOpen={onOpen}
              expected={expected}
              orientation={orientation}
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
  onOpen,
  expected,
  orientation,
}: {
  players: DuelPlayer[]
  metrics: PlayerMetrics
  onOpen: (player: DuelPlayer) => void
  /** This matchday's expected points, for the matches still to come. */
  expected: ExpectedPointsView
  /** Which way the band runs — see {@link PitchOrientation}. */
  orientation: PitchOrientation
}) {
  return (
    /* `flex-nowrap` + `overflow-hidden`, as on the editor's pitch: wrapping
       would turn pressure along the band into pressure across it, which feeds
       back into the avatar sizing and oscillates. The sizing already guarantees
       the busiest band fits, so the clipping is a backstop rather than a normal
       state. */
    <div className={PITCH_BAND_CLASS[orientation]}>
      {players.map((player) => (
        <LivePitchPlayer
          key={player.id}
          player={player}
          metrics={metrics}
          onOpen={onOpen}
          expected={expected}
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
 *
 * The corner carries the [club's team sheet](../player/TeamSheetMark.tsx) while
 * one is out and the match has not kicked off, which is the only window in
 * which it appears at all — the pitch is otherwise free of badges, so it costs
 * nothing the rest of the time.
 */
function LivePitchPlayer({
  player,
  metrics,
  onOpen,
  expected,
}: {
  player: DuelPlayer
  metrics: PlayerMetrics
  onOpen: (player: DuelPlayer) => void
  /** This matchday's expected points, for the matches still to come. */
  expected: ExpectedPointsView
}) {
  const isRunning = player.status === 'playing'
  const figure = playerFigure(player)
  /* The expected figure takes the plate's second line while his match is
     still to come, exactly as on the [duel pitch](../roster/RosterPitch.tsx):
     the plate holds one number, and before a kick-off "was he worth picking"
     is a better use of it than the time. It carries the target glyph, so a
     coloured number under a portrait cannot be read as points already scored.
     The kick-off stays in the label. */
  const entry: ExpectedPointsEntry | undefined = isBeforeKickoff(player)
    ? expected.entry(player.id)
    : undefined
  // Nothing to open without a fixture: no match that matchday, no actions.
  const canOpen = player.fixture !== undefined
  const Shell = canOpen ? 'button' : 'span'

  return (
    <Shell
      {...(canOpen
        ? {
            type: 'button' as const,
            onClick: () => {
              onOpen(player)
            },
          }
        : {})}
      title={`${player.name} – Aktionen ansehen`}
      // Spelled out rather than left to the two lines of the plate, which read
      // as "Kane 215" — a number with no unit and no idea whether the match is
      // over.
      aria-label={`${player.name}: ${entry === undefined ? '' : `${expectedDescription(entry)}, `}${figureDescription(figure)}, ${DUEL_PLAYER_STATUS_LABEL[player.status]}${player.sheet === undefined ? '' : `, ${TEAM_SHEET_ROLE_LABEL[player.sheet]}`}`}
      style={{ width: metrics.width }}
      className={cn(
        'flex shrink-0 flex-col items-center rounded-lg p-1',
        canOpen &&
          'transition-colors hover:bg-black/20 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
      )}
    >
      <span className="relative">
        <Avatar
          src={player.image}
          name={player.name}
          size={metrics.avatar}
          className={cn('ring-2', isRunning ? 'ring-accent' : 'ring-white/70')}
        />
        {/* Sized from the portrait, like every other corner mark in the app, so
            it stays legible from a 40px phone avatar up to a 96px desktop one.
            The button already spells the role out, so the badge itself is
            decorative here. */}
        {player.sheet !== undefined && (
          <TeamSheetCorner
            role={player.sheet}
            size={cornerBadgeSize(metrics.avatar)}
            decorative
          />
        )}
      </span>

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
            // A flex row for the same reason the duel plate is one: the
            // expected figure is a glyph and a number, and the number is the
            // half that may be clipped.
            'nums flex max-w-full items-center justify-center gap-0.5 font-bold',
            isRunning
              ? 'text-accent'
              : entry !== undefined
                ? expectedTextClass(entry)
                : isScore(figure)
                  ? 'text-white'
                  : 'text-white/55',
          )}
        >
          {entry === undefined ? (
            <span className="min-w-0 truncate">{figureLabel(figure)}</span>
          ) : (
            <ExpectedPointsFigure
              value={entry.value}
              fontSize={metrics.nameFontSize}
            />
          )}
        </span>
      </span>
    </Shell>
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
  expected,
}: {
  players: DuelPlayer[]
  leagueId: string
  /** This matchday's expected points, for the matches still to come. */
  expected: ExpectedPointsView
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
            <DuelPlayerRow player={player} expected={expected} />
          </Link>
        </li>
      ))}
    </ol>
  )
}
