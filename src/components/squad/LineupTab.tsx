import { AlertTriangle, Armchair, Info, Target, UserMinus } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'

import {
  POSITION_LABEL,
  POSITION_NAME,
  type PositionKey,
  type SquadMember,
  type StartProbability,
  type TeamFixture,
} from '@/api/models'
import { ExpectedPointsFigure } from '@/components/squad/ExpectedPointsBadge'
import { expectedTextClass } from '@/components/squad/expectedPointsLabels'
import { FixtureBadge } from '@/components/squad/FixtureBadge'
import { FormationsDialog } from '@/components/squad/FormationsDialog'
import { Pitch } from '@/components/squad/Pitch'
import {
  cornerBadgeSize,
  fitPitchMetrics,
  PITCH_BAND_CLASS,
  pitchGridClass,
  ROW_ORDER,
  singleTeamOrder,
  usePitchBox,
  usePitchOrientation,
  type PitchOrientation,
  type PlayerMetrics,
} from '@/components/squad/pitchMetrics'
import { PlayerStatusBadge } from '@/components/squad/PlayerStatusBadge'
import { StartProbabilityCorner } from '@/components/squad/StartProbabilityBadge'
import {
  LONG_PRESS_MS,
  useLineupDrag,
  type DragHandleProps,
  type LineupDrag,
} from '@/components/squad/useLineupDrag'
import type { LineupEditor } from '@/components/squad/useLineupEditor'
import { useExpectedPointsView } from '@/components/squad/useExpectedPointsView'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import {
  expectedPointsTotal,
  type ExpectedPointsEntry,
  type ExpectedPointsView,
} from '@/lib/expectedPoints'
import { points } from '@/lib/format'
import {
  emptySlotPenalty,
  formationLabel,
  LINEUP_SIZE,
  missingAtPosition,
} from '@/lib/lineup'
import { useHashModal } from '@/lib/useHashModal'

/** Bench grouping, and the order player ids are sent to the API in. */
const BENCH_ORDER: PositionKey[] = ['gk', 'def', 'mid', 'fwd']

/**
 * How long the card takes to fall off the pitch — mirrors `--animate-bench-drop`
 * in [`index.css`](../../index.css).
 *
 * The edit itself waits for it. Removing the player the instant the hold lands
 * would reflow the row out from under the animation, and the card would vanish
 * mid-fall instead of arriving anywhere.
 */
const BENCH_DROP_MS = 240

/** How long the card that just landed on the bench stays marked as new. */
const BENCH_LAND_MS = 700

/**
 * How long a press stays silent before the hold shows itself.
 *
 * Every gesture starts as a press — a drag included — so without this the
 * bench mark and its ring would flash over the portrait at the start of every
 * drag, which is a warning about something the manager is not doing. A drag is
 * already moving well inside this window, and the hold is nowhere near
 * finishing: the sweep simply starts late and still lands exactly on
 * {@link LONG_PRESS_MS}.
 */
const PRESS_HINT_DELAY_MS = 120

/**
 * Interactive lineup, persisted to Kickbase.
 *
 * Every change is saved via `POST /v4/leagues/{id}/lineup`, which replaces the
 * lineup wholesale. Two consequences shape the code below:
 *
 *  - **Edits are coalesced.** Building an eleven from scratch is eleven taps;
 *    without debouncing that is eleven requests, each superseded by the next.
 *  - **Requests are serialised.** Because each payload is the complete state,
 *    an out-of-order response would leave the server holding a stale lineup.
 *    A save waits for the in-flight one and then sends whatever the *current*
 *    state is, so the last write always matches the last edit.
 *
 * Partial lineups save too: `players` is always eleven positional slots with
 * `""` for the empty ones, declared inside a legal container formation. See
 * the note on `write` below and `lib/lineup.ts`.
 *
 * The initial lineup is seeded from the squad's `lo` slot index, where slot 0
 * is the goalkeeper and benched players have no `lo` at all. See
 * {@link seedLineup}, whose earlier `lo > 0` test is exactly why the keeper
 * used to disappear on reload.
 */
export function LineupTab({
  squad,
  editor,
  leagueId,
  fixtureByTeamId,
  matchday,
  startProbabilities,
  statusReasons,
  onShowLegend,
}: {
  squad: SquadMember[]
  editor: LineupEditor
  /** Where a tapped portrait leads — his page lives under the league. */
  leagueId: string
  fixtureByTeamId: Map<string, TeamFixture> | undefined
  /** The matchday the expected points on the chip are filed under. */
  matchday: number | undefined
  startProbabilities: Map<string, StartProbability>
  /** `stxt` per unavailable player; empty until the lookups land. */
  statusReasons: Map<string, string>
  /**
   * Opens the symbol legend. It rides on the bench heading here rather than in
   * a page header, because this view has none — see the comment on
   * {@link Bench}.
   */
  onShowLegend: () => void
}) {
  const { lineup, counts, formation } = editor

  /**
   * **Taking a player off the pitch, as a movement rather than a deletion.**
   *
   * The hold has already committed by the time this runs, so the question is
   * only how the manager sees it happen. The card tips, falls and shrinks
   * towards the bench strip; the edit lands when it gets there, and the bench
   * card it becomes rises into place marked as new for a moment. Without the
   * pause the row would close over him instantly and the two halves of the
   * movement would look like one card blinking out and an unrelated one
   * blinking in somewhere else.
   *
   * Reduced motion skips the fall and keeps the result: the same edit, with
   * the choreography dropped rather than played at full speed.
   */
  const [leavingId, setLeavingId] = useState<string | null>(null)
  const [landedId, setLandedId] = useState<string | null>(null)

  /**
   * The choreography's pending steps, so unmounting cancels them.
   *
   * A set rather than one timer per step: two players can be in flight at once
   * — a second hold while the first card is still falling — and a single slot
   * would drop the first player's own removal on the floor. Each entry removes
   * itself when it fires, so the set holds what is actually outstanding.
   */
  const timersRef = useRef(new Set<number>())
  const later = useCallback((run: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current.delete(id)
      run()
    }, ms)
    timersRef.current.add(id)
  }, [])
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const id of timers) window.clearTimeout(id)
      timers.clear()
    }
  }, [])

  const { remove } = editor
  const bench = useCallback(
    (playerId: string) => {
      const isReduced = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches
      setLeavingId(playerId)
      later(
        () => {
          setLeavingId((current) => (current === playerId ? null : current))
          setLandedId(playerId)
          remove(playerId)
          later(() => {
            setLandedId((current) => (current === playerId ? null : current))
          }, BENCH_LAND_MS)
        },
        isReduced ? 0 : BENCH_DROP_MS,
      )
    },
    [later, remove],
  )

  /**
   * Dragging reorders a player *within his row*; holding takes him off it.
   *
   * Rows are positions, and the slot a player occupies inside his row is what
   * the API stores — so the drag is the one lineup edit that changes nothing
   * about who plays, only about where. Cross-row drops are refused by the hook
   * rather than corrected here: a midfielder posted into a defender slot is
   * silently discarded by Kickbase.
   *
   * The third gesture, a plain tap, never reaches this hook: it falls through
   * as a click on the link the portrait is, and opens the player's page.
   */
  const drag = useLineupDrag({
    items: lineup,
    onReorder: editor.reorder,
    onLongPress: (player) => {
      bench(player.id)
    },
  })

  /**
   * The formation reference — `#formations`, so the back gesture closes the
   * sheet instead of leaving the pitch, and a refresh under it puts it back.
   * See [`useHashModal`](../../lib/useHashModal.ts).
   *
   * The swap dialog the editor raises stays local: it is a question about the
   * player just tapped, which no URL carries.
   */
  const formations = useHashModal('formations')

  // The pitch is measured rather than guessed at, so the avatars scale with
  // whatever height the flex chain actually hands it.
  const { ref: pitchRef, box: pitchBox } = usePitchBox()
  /**
   * Portrait on a phone, on its side from `lg` up — keeper at the left edge,
   * the attack at the right, the way a formation is written down. The bands
   * become columns and every card turns with them; nothing about a drag
   * changes, since a drop is decided by what is under the pointer rather than
   * by which way the band runs.
   */
  const orientation = usePitchOrientation()
  /** Keeper-first when the pitch is on its side — see `singleTeamOrder`. */
  const bands = singleTeamOrder(orientation)

  /**
   * An incomplete lineup is legal and it saves — but every empty slot costs
   * 100 points, so the warning quotes the actual figure rather than the count.
   * "2 Plätze sind leer" is easy to shrug at; "das kostet dich 200 Punkte" is
   * not, and 200 points is a bigger swing than most transfer decisions.
   *
   * The two causes need different wording. Usually the squad is big enough and
   * players simply have not been picked. But a squad of fewer than eleven
   * cannot be completed at all, and telling someone to "pick more players"
   * when they own nine is useless — that case names the real problem instead.
   */
  const missing = LINEUP_SIZE - lineup.length
  const isIncomplete = missing > 0
  const isSquadTooSmall = squad.length < LINEUP_SIZE
  const penalty = emptySlotPenalty(lineup.length)

  const cost = `${missing === 1 ? 'Ein leerer Platz kostet' : `${String(missing)} leere Plätze kosten`} dich ${points(penalty)} Punkte.`

  const incompleteMessage = isSquadTooSmall
    ? `Unvollständige Aufstellung: dein Kader hat nur ${String(squad.length)} von ${String(LINEUP_SIZE)} nötigen Spielern. ${cost} Kaufe Spieler auf dem Transfermarkt.`
    : `Unvollständige Aufstellung: ${cost}`

  /**
   * How large an avatar can be without crowding its band.
   *
   * The busiest band counts the **placeholders too** — a mandatory place still
   * to fill takes exactly the room a player would, so leaving it out of the
   * count would oversize the cards on a half-built lineup.
   */
  /**
   * **What each fielded player is expected to score** — his own guess where
   * the reader entered one, the [model's](../../api/hooks/usePointcast.ts)
   * prediction everywhere else. The same view the
   * [list](./PlayerListTab.tsx) reads, so the crest chip on a row and the
   * plate on the grass are the same figure for the same man.
   */
  const expected = useExpectedPointsView(matchday)

  const metrics = useMemo(
    () =>
      fitPitchMetrics(
        pitchBox,
        Math.max(
          ...ROW_ORDER.map(
            (position) =>
              lineup.filter((player) => player.position === position).length +
              missingAtPosition(counts, position),
          ),
        ),
        { orientation },
      ),
    [pitchBox, lineup, counts, orientation],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between gap-3 px-0.5">
        <p
          className={cn(
            'nums flex items-center gap-2 text-sm',
            isIncomplete ? 'text-warning' : 'text-muted',
          )}
        >
          <span>
            <span
              className={cn(
                'font-semibold',
                isIncomplete ? 'text-warning' : 'text-ink',
              )}
            >
              {lineup.length}/{LINEUP_SIZE}
            </span>{' '}
            aufgestellt
          </span>

          {isIncomplete && (
            /* The count and this chip are the whole warning — there is no
               banner any more. The glyphs are `aria-hidden` and the full
               sentence rides along as screen-reader text, so nothing is lost
               to assistive tech by compressing it to "−200". */
            <span
              title={incompleteMessage}
              className="flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning"
            >
              <AlertTriangle size={12} aria-hidden="true" />
              <span aria-hidden="true">−{points(penalty)}</span>
              <span className="sr-only">{incompleteMessage}</span>
            </span>
          )}

          {/* What the eleven is expected to bring in, if anything has been
              guessed at — the point of entering the guesses one by one on the
              Kader is reading them added up here. */}
          <ExpectedTotal lineup={lineup} expected={expected} />

          {editor.isSaving && (
            <span className="flex items-center gap-1 text-xs text-faint">
              <Spinner size={12} />
              Speichern …
            </span>
          )}
        </p>
        {/* The chip was already the one place the formation is named, so it
            is also where "which formations exist?" gets answered. The icon is
            what tells it apart from the read-only counters beside it. */}
        <button
          type="button"
          onClick={() => {
            formations.open()
          }}
          title="Alle Formationen anzeigen"
          aria-label={`Formation ${formationLabel(formation)} – alle Formationen anzeigen`}
          className={cn(
            'nums flex shrink-0 cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1',
            'border-line bg-surface text-xs font-semibold text-accent transition-colors',
            'hover:border-accent/40 hover:bg-surface-2 active:bg-line',
          )}
        >
          {formationLabel(formation)}
          <Info size={12} aria-hidden="true" className="text-muted" />
        </button>
      </div>

      <FormationsDialog
        open={formations.isOpen}
        onOpenChange={formations.setOpen}
        current={formation}
      />

      {editor.saveError !== null && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-negative/30 bg-negative/10 px-3 py-2.5 text-sm text-negative"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {editor.saveError}
        </p>
      )}

      <Pitch orientation={orientation} className="flex-1">
        {/* Four equal bands, one per position, always rendered.
            Distributing rows with `justify-around` instead made the geometry
            depend on how many rows happened to exist, so a lineup missing a
            position sat at a different height from one that had it — obvious
            on a big screen. Fixed bands keep every player where the position
            says they belong. Each band always has content: the mandatory
            minimums guarantee at least one avatar or placeholder in all
            four. */}
        {/* `flex-1`, not `h-full`. As a flex item this grid's `height: 100%`
            resolved against its own content rather than the parent, so it sat
            at its natural 394px inside a 479px pitch and left a band of empty
            grass under the keeper. Growing into the space is the reliable
            way to fill it. */}
        <div
          ref={pitchRef}
          className={cn(
            'grid min-h-0 min-w-0 flex-1 px-2 py-3',
            pitchGridClass(ROW_ORDER.length, orientation),
          )}
        >
          {bands.map((position) => (
            <PitchRow
              key={position}
              position={position}
              // `drag.order`, not `lineup`: while a drag is in flight this is
              // the preview, so the row reflows under the finger and the drop
              // holds no surprise.
              players={drag.order.filter(
                (player) => player.position === position,
              )}
              placeholders={missingAtPosition(counts, position)}
              leagueId={leagueId}
              fixtureByTeamId={fixtureByTeamId}
              startProbabilities={startProbabilities}
              statusReasons={statusReasons}
              expected={expected}
              metrics={metrics}
              drag={drag}
              leavingId={leavingId}
              orientation={orientation}
            />
          ))}
        </div>
      </Pitch>

      {drag.dragging !== null && (
        <DragGhost
          player={drag.dragging}
          fixture={fixtureByTeamId?.get(drag.dragging.teamId)}
          startProbability={startProbabilities.get(drag.dragging.id)}
          statusReason={statusReasons.get(drag.dragging.id)}
          expected={expected.entry(drag.dragging.id)}
          metrics={metrics}
          ghostRef={drag.ghostRef}
        />
      )}

      <Bench
        squad={squad}
        isFielded={editor.isFielded}
        fixtureByTeamId={fixtureByTeamId}
        startProbabilities={startProbabilities}
        expected={expected}
        landedId={landedId}
        onAdd={editor.toggle}
        onShowLegend={onShowLegend}
      />
    </div>
  )
}

/**
 * **What the eleven is expected to score**, added up — beside the count that
 * says how many of them are actually picked.
 *
 * The guesses are entered one player at a time, on the Kader, against a single
 * fixture. This is the only place they become one figure, which is the whole
 * reason for entering them: an eleven is chosen against the alternatives, and
 * the alternatives are other elevens.
 *
 * **Mostly the model's arithmetic, until you overrule it.** Every fielded
 * player carries a figure from the moment the
 * [pointcast](../../api/hooks/usePointcast.ts) file lands — his prediction
 * where no guess has been entered — so this chip says something on a squad
 * nobody has touched, which is the whole point of having defaults. A guess
 * always replaces the prediction it stands in for, one player at a time.
 *
 * **The fraction is not decoration.** 640 points off four figures and 640 off
 * eleven are wildly different claims, and the total alone cannot tell them
 * apart — so how many of the fielded players carry one is printed next to it,
 * in a quieter weight, always. Only the players *on the pitch* are counted:
 * the bench scores nothing. How many of them are the reader's own guesses is
 * in the label rather than on the chip: it changes what the total *means*, but
 * a third figure in a pill this size would make it unreadable.
 *
 * **The colour says whose total it is**, the same way the chips on the rows
 * do: orange while every figure in it is the model's, accent green from the
 * first guess the reader enters over one. A pure prediction wearing the
 * colour the app gives to the reader's own numbers would be the one place
 * this feature could mislead — the total is where a figure stops being about
 * one player and starts being the thing an eleven is chosen on.
 *
 * Absent until at least one figure exists — an untouched squad in a
 * competition the model does not cover, or a file that has not arrived. A `0`
 * over eleven players would read as a prediction of nothing.
 */
function ExpectedTotal({
  lineup,
  expected,
}: {
  lineup: readonly SquadMember[]
  /** This matchday's figures, resolved once for the whole tab. */
  expected: ExpectedPointsView
}) {
  const { total, count, ownCount } = expectedPointsTotal(lineup, expected)
  if (count === 0) return null

  const isForecast = ownCount === 0
  const label =
    `Erwartete Punkte der Aufstellung: ${points(total)} aus ${String(count)} von ${String(lineup.length)} Spielern` +
    (isForecast
      ? ' — alles Prognosen'
      : `, davon ${String(ownCount)} eigene Schätzungen`)

  return (
    <span
      title={label}
      className={cn(
        'nums flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold',
        isForecast
          ? 'border-dashed border-warning/45 bg-warning/10 text-warning'
          : 'border-accent/40 bg-accent/10 text-accent',
      )}
    >
      <Target size={12} aria-hidden="true" />
      <span aria-hidden="true">{points(total)}</span>
      <span aria-hidden="true" className="font-medium text-muted">
        {count}/{lineup.length}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Pitch                                                                      */
/* -------------------------------------------------------------------------- */

function PitchRow({
  position,
  players,
  placeholders,
  leagueId,
  fixtureByTeamId,
  startProbabilities,
  statusReasons,
  expected,
  metrics,
  drag,
  leavingId,
  orientation,
}: {
  position: PositionKey
  players: SquadMember[]
  /** Mandatory places of this position still to fill. */
  placeholders: number
  leagueId: string
  fixtureByTeamId: Map<string, TeamFixture> | undefined
  startProbabilities: Map<string, StartProbability>
  statusReasons: Map<string, string>
  /** This matchday's figures, for the plate's third line. */
  expected: ExpectedPointsView
  metrics: PlayerMetrics
  drag: LineupDrag<SquadMember>
  /** The player falling towards the bench, while he is still falling. */
  leavingId: string | null
  /** Which way the band runs — see {@link PitchOrientation}. */
  orientation: PitchOrientation
}) {
  return (
    /* Deliberately `flex-nowrap` + `overflow-hidden`.
     *
     * Wrapping turned a width overflow into extra height, which fed straight
     * back into the avatar sizing: wider avatars → the band wraps → the band
     * is taller → the height budget allows a wider avatar → it wraps harder.
     * That loop settled with a 854px pitch on an 844px screen. With nowrap,
     * pressure along the band can never become pressure across it, so the
     * pitch's size stays purely flex-driven and the calculation has a fixed
     * point.
     *
     * The size calculation already guarantees the busiest band fits, so the
     * clipping here is a backstop, not a normal state.
     */
    <div className={PITCH_BAND_CLASS[orientation]}>
      {players.map((player) => (
        <PitchPlayer
          key={player.id}
          player={player}
          fixture={fixtureByTeamId?.get(player.teamId)}
          startProbability={startProbabilities.get(player.id)}
          statusReason={statusReasons.get(player.id)}
          expected={expected.entry(player.id)}
          metrics={metrics}
          to={`/leagues/${leagueId}/players/${player.id}`}
          isDragging={drag.dragging?.id === player.id}
          isPressing={drag.pressingId === player.id}
          isLeaving={leavingId === player.id}
          dragProps={drag.dragProps(player)}
          onClick={(event) => {
            // Neither the click that ends a drag nor the one that ends a hold
            // is a tap, and opening the player's page is the last thing the
            // manager meant by either — he has just moved him, or benched him.
            if (!drag.isTap()) event.preventDefault()
          }}
        />
      ))}
      {Array.from({ length: placeholders }, (_, index) => (
        <EmptySlot key={index} position={position} metrics={metrics} />
      ))}
    </div>
  )
}

/**
 * A place the lineup still has to fill. Not interactive: tapping it could not
 * do anything unambiguous, and the bench below is where players are picked.
 */
function EmptySlot({
  position,
  metrics,
}: {
  position: PositionKey
  metrics: PlayerMetrics
}) {
  const label = `Noch kein ${POSITION_NAME[position]} aufgestellt`
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      // Matches PitchPlayer exactly, so an open place holds the same ground a
      // filled one would.
      style={{ width: metrics.width }}
      className="flex shrink-0 flex-col items-center p-1"
    >
      <span
        style={{
          width: metrics.avatar,
          height: metrics.avatar,
          fontSize: metrics.nameFontSize,
        }}
        className="flex items-center justify-center rounded-full border-2 border-dashed border-white/45 font-semibold text-white/70"
      >
        {POSITION_LABEL[position]}
      </span>
      <span
        style={{
          width: metrics.plateWidth,
          marginTop: -metrics.plateOverlap,
          fontSize: metrics.nameFontSize,
        }}
        className="relative truncate rounded bg-black/50 px-1 py-0.5 text-center font-medium text-white/70"
      >
        offen
      </span>
    </span>
  )
}

/**
 * One fielded player: a link to his page that is also a drag handle and a
 * hold target.
 *
 * **A link, not a button**, even though two of its three gestures edit the
 * lineup. The tap goes to the player's page, and a page is worth a real `href`
 * — a middle click opens him in a tab, a long-press menu is refused but
 * "Link öffnen" still exists on a desktop, and the browser shows where it
 * goes. The gestures that are not taps cancel the navigation in `onClick`
 * instead of the markup pretending the link is not one.
 */
function PitchPlayer({
  player,
  fixture,
  startProbability,
  statusReason,
  expected,
  metrics,
  to,
  isDragging,
  isPressing,
  isLeaving,
  dragProps,
  onClick,
}: {
  player: SquadMember
  fixture: TeamFixture | undefined
  startProbability: StartProbability | undefined
  statusReason: string | undefined
  /** What he is expected to score, when anything expects anything. */
  expected: ExpectedPointsEntry | undefined
  metrics: PlayerMetrics
  /** His page. A tap is a navigation; the other two gestures cancel it. */
  to: string
  /** This portrait is the one being carried; the ghost shows it instead. */
  isDragging: boolean
  /** A finger is down on him and the hold has not finished — ring filling. */
  isPressing: boolean
  /** The hold finished; he is on his way to the bench. */
  isLeaving: boolean
  dragProps: DragHandleProps
  onClick: (event: ReactMouseEvent<HTMLElement>) => void
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      {...dragProps}
      title={`${player.lastName} – tippen für sein Profil, gedrückt halten für die Bank, ziehen zum Verschieben`}
      aria-label={`${player.lastName} – Profil öffnen. Entf nimmt ihn aus der Aufstellung, die Pfeiltasten verschieben ihn nach links oder rechts.`}
      // Width follows the avatar exactly. A minimum floor here would fight
      // the size calculation, which already solves for the busiest band —
      // a 64px floor is what made five defenders wrap on a phone.
      style={{
        width: metrics.width,
        // The lift waits for the hint, and lets go of it the instant the
        // press does — the delay belongs to arriving, never to leaving.
        transitionDelay: isPressing
          ? `${String(PRESS_HINT_DELAY_MS)}ms`
          : '0ms',
      }}
      className={cn(
        'group flex shrink-0 flex-col items-center rounded-lg p-1',
        // `cursor-pointer`, not `grab`: the portrait's plain click now goes
        // to the player's page, which is what a pointer promises. It turns
        // into a grabbing hand once a button is actually down on it, where
        // moving him is the gesture in play.
        'cursor-pointer transition-[transform,opacity] duration-150',
        'active:cursor-grabbing',
        // `touch-none`, or the first millimetre of a drag is swallowed by the
        // browser as a scroll and the gesture never reaches us. Safe here
        // because the pitch is sized to fit rather than to scroll.
        'touch-none select-none [-webkit-touch-callout:none]',
        // Kept in place rather than hidden: the row is mid-reflow around it,
        // and removing the slot would make everything else jump.
        isDragging && 'opacity-25',
        // The card lifts under a held finger, on the same delay as the mark
        // it wears — a drag has already taken the press away by then, and a
        // card that flinched at the start of every drag would read as noise.
        isPressing && 'scale-105',
        // The fall, and no more gestures on the way down.
        isLeaving && 'pointer-events-none animate-bench-drop',
      )}
    >
      <PlayerFace
        player={player}
        fixture={fixture}
        startProbability={startProbability}
        statusReason={statusReason}
        expected={expected}
        metrics={metrics}
        isPressing={isPressing}
      />
    </Link>
  )
}

/**
 * The ring that fills under a held finger, and the mark of what the hold will
 * do when it closes.
 *
 * It is the only part of this gesture the manager can see before it commits,
 * so it says *both* things: the ring is a clock, and the `UserMinus` under it
 * is the verb. Drawn in `warning` rather than `negative` — the player is being
 * moved to the bench, not deleted, and he is one tap on the bench away from
 * coming straight back.
 *
 * The sweep is timed from {@link LONG_PRESS_MS} in JavaScript rather than from
 * a duration in the stylesheet, because a ring that finishes before or after
 * the hold does is worse than no ring: it would be a progress bar that lies.
 */
function PressRing({ size }: { size: number }) {
  const stroke = Math.max(2.5, size * 0.07)
  const radius = (size - stroke) / 2
  const length = 2 * Math.PI * radius
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      // `-rotate-90`, so the sweep starts at twelve o'clock rather than at
      // three, which is where an SVG circle's path happens to begin.
      className="pointer-events-none absolute inset-0 -rotate-90 text-warning"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={length}
        style={
          {
            '--press-ring-length': `${String(length)}px`,
            strokeDashoffset: length,
            // Starts late and still closes on time: the sweep is the hold's
            // remaining time, not its whole length.
            animation: `lineup-press-ring ${String(LONG_PRESS_MS - PRESS_HINT_DELAY_MS)}ms linear ${String(PRESS_HINT_DELAY_MS)}ms forwards`,
          } as CSSProperties
        }
      />
    </svg>
  )
}

/**
 * The portrait and its name plate — everything inside a pitch player except
 * the button. Shared with the drag ghost so the thing under the finger is
 * literally the thing that was picked up.
 *
 * **The plate takes a third line for the expected points** when there is a
 * figure for the player: the target glyph and the number, accent green for the
 * reader's own guess and orange for the model's, exactly as on the row the
 * same player has in the [list](./PlayerListTab.tsx). An eleven is chosen
 * against the alternatives, and this is the pitch the choosing happens on —
 * the figure that lives one tab away on a row belongs here most of all.
 *
 * A line rather than a corner badge: both corners of this portrait are taken,
 * by the status mark and the lineup probability, and the middle of it is where
 * the hold shows what it is about to do. The plate is where this card's
 * figures live.
 */
function PlayerFace({
  player,
  fixture,
  startProbability,
  statusReason,
  expected,
  metrics,
  isPressing = false,
}: {
  player: SquadMember
  fixture: TeamFixture | undefined
  startProbability: StartProbability | undefined
  statusReason: string | undefined
  /** What he is expected to score, when anything expects anything. */
  expected: ExpectedPointsEntry | undefined
  metrics: PlayerMetrics
  /** Held right now: the ring sweeps and the bench mark shows through. */
  isPressing?: boolean
}) {
  return (
    <>
      <span className="relative">
        <Avatar
          src={player.image}
          name={player.lastName}
          size={metrics.avatar}
          className="ring-2 ring-white/70"
        />
        {/* Top-*left*. This mark had the top-right corner first; the
            probability badge is the busier of the two and wants the corner
            that reads most easily against the pitch, so the mark moved rather
            than the badge taking a weaker spot. */}
        <PlayerStatusBadge
          status={player.status}
          reason={statusReason}
          size={cornerBadgeSize(metrics.avatar)}
          onImage
          className="absolute -top-0.5 -left-0.5"
        />
        {/* Sized from the portrait, so it stays legible from a 40px phone
            avatar up to a 96px one on a desktop pitch. */}
        {startProbability !== undefined && (
          <StartProbabilityCorner
            tier={startProbability}
            size={cornerBadgeSize(metrics.avatar)}
          />
        )}
        {/* Only while a finger or a mouse button is actually down on him.
            It used to show on hover, back when a plain click took the player
            off the pitch — a hover hint for a gesture that no longer exists
            would now promise the wrong thing to a mouse. The ghost passes no
            `isPressing`, so it never appears there either. */}
        {isPressing && (
          <>
            {/* `backwards`, so the delay is spent at the keyframe's own
                `opacity: 0` rather than at full black — see
                {@link PRESS_HINT_DELAY_MS}. */}
            <span
              style={{ animationDelay: `${String(PRESS_HINT_DELAY_MS)}ms` }}
              className={cn(
                'absolute inset-0 flex items-center justify-center rounded-full bg-black/55',
                'animate-fade-in [animation-fill-mode:backwards]',
              )}
            >
              <UserMinus size={metrics.removeIcon} className="text-white" />
            </span>
            <PressRing size={metrics.avatar} />
          </>
        )}
      </span>

      {/* One plate, two lines: the name, then the fixture **and** what he is
          expected to score against it. Two separate chips read as unrelated
          badges floating over the grass.

          The two belong on one line because they are one thought — *Bayern
          away, 141* — and because the alternative costs the portrait: a third
          line is about 13px of card, and the cards are sized by a search that
          fits the busiest band, so every pitch on a phone would have shrunk to
          carry it. The crest is the tallest thing on the line either way, so
          the figure rides along inside a budget that was already solved. */}
      {/* The plate scales with the portrait, spans its full width, and rides
          up over its lower edge so the two read as one object rather than a
          caption floating beneath a circle. `relative` puts it above the
          portrait in paint order. */}
      <span
        style={{
          // Every plate now spans the card rather than the face, which is
          // where this line's crest, glyph and three digits used to need a
          // bleed of their own.
          width: metrics.plateWidth,
          marginTop: -metrics.plateOverlap,
        }}
        /* `px-0.5` rather than `px-1`: the second line is a crest, a glyph
           and three digits, and on a phone's 50px plate those four pixels of
           padding are the difference between the figure fitting and the last
           digit being clipped. */
        className="relative flex flex-col items-center gap-0.5 rounded bg-black/70 px-0.5 py-0.5 leading-tight"
      >
        <span
          style={{ fontSize: metrics.nameFontSize }}
          className="max-w-full truncate font-semibold text-white"
        >
          {player.lastName}
        </span>
        <span className="flex max-w-full items-center gap-0.5">
          <FixtureBadge
            fixture={fixture}
            tone="onPitch"
            size={metrics.badgeCrest}
          />
          {expected !== undefined && (
            <span
              style={{ fontSize: metrics.nameFontSize }}
              className={cn(
                'nums flex min-w-0 items-center gap-0.5 leading-none font-bold',
                expectedTextClass(expected),
              )}
            >
              <ExpectedPointsFigure
                value={expected.value}
                fontSize={metrics.nameFontSize}
              />
            </span>
          )}
        </span>
      </span>
    </>
  )
}

/**
 * The portrait that follows the pointer.
 *
 * In a portal on `document.body` because both the pitch and each row clip
 * their overflow — inside them the ghost would be cut off the moment it left
 * its own row, which is the entire journey. `pointer-events-none` keeps it out
 * of the hit test that finds what it is being dropped on.
 */
function DragGhost({
  player,
  fixture,
  startProbability,
  statusReason,
  expected,
  metrics,
  ghostRef,
}: {
  player: SquadMember
  fixture: TeamFixture | undefined
  startProbability: StartProbability | undefined
  statusReason: string | undefined
  /** What he is expected to score — the ghost is the card, figure included. */
  expected: ExpectedPointsEntry | undefined
  metrics: PlayerMetrics
  ghostRef: (node: HTMLElement | null) => void
}) {
  return createPortal(
    <div
      ref={ghostRef}
      aria-hidden="true"
      style={{ width: metrics.width }}
      className="pointer-events-none fixed top-0 left-0 z-50 flex flex-col items-center p-1"
    >
      <span className="flex scale-110 flex-col items-center drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)]">
        <PlayerFace
          player={player}
          fixture={fixture}
          startProbability={startProbability}
          statusReason={statusReason}
          expected={expected}
          metrics={metrics}
        />
      </span>
    </div>,
    document.body,
  )
}

/* -------------------------------------------------------------------------- */
/* Bench                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The unfielded players, and the only heading this view has.
 *
 * The lineup view carries **no page header** — no title, no squad count, no
 * total value, no budget. The pitch is the page, and on a phone every one of
 * those lines was height taken from it for information that is either obvious
 * (you are looking at your team) or belongs on the Kader view next to the
 * decisions it informs. The legend button was the one thing worth keeping, so
 * it rides on the right of this heading, which is the only chrome left.
 */
function Bench({
  squad,
  isFielded,
  fixtureByTeamId,
  startProbabilities,
  expected,
  landedId,
  onAdd,
  onShowLegend,
}: {
  squad: SquadMember[]
  isFielded: (playerId: string) => boolean
  fixtureByTeamId: Map<string, TeamFixture> | undefined
  startProbabilities: Map<string, StartProbability>
  /** This matchday's figures — the reason to bring one of these on. */
  expected: ExpectedPointsView
  /** The player who just arrived from the pitch, for a moment. */
  landedId: string | null
  onAdd: (player: SquadMember) => void
  onShowLegend: () => void
}) {
  // The bench is what is *not* fielded. Players move between the pitch and
  // here rather than appearing in both.
  const grouped = BENCH_ORDER.map((position) => ({
    position,
    players: squad
      .filter((player) => player.position === position && !isFielded(player.id))
      .sort((a, b) => b.marketValue - a.marketValue),
  })).filter((group) => group.players.length > 0)

  return (
    /* `shrink-0`: the bench keeps its natural height and the pitch above it
       absorbs whatever is left, rather than the two competing for space. */
    <section className="flex shrink-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <h2 className="flex items-center gap-1.5 text-[0.6875rem] font-semibold tracking-wider text-faint uppercase">
          <Armchair size={13} aria-hidden="true" />
          Bank
        </h2>

        {/* "tippen zum Aufstellen" used to follow the word. It taught the tap
            once and then repeated itself forever, and the portraits already
            look like buttons. */}
        <button
          type="button"
          onClick={onShowLegend}
          title="Was bedeuten die Symbole?"
          aria-label="Legende anzeigen"
          className={cn(
            'flex shrink-0 cursor-pointer items-center justify-center rounded-full border p-1',
            'border-line bg-surface text-muted transition-colors',
            'hover:border-accent/40 hover:bg-surface-2 hover:text-accent active:bg-line',
            'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
          )}
        >
          <Info size={14} aria-hidden="true" />
        </button>
      </div>

      {grouped.length === 0 && (
        <p className="rounded-card border border-line bg-surface px-3 py-4 text-center text-sm text-muted">
          Alle Spieler sind aufgestellt.
        </p>
      )}

      {/* One sideways-scrolling strip, grouped by position with headings, so
          the whole squad stays reachable with a thumb. `overscroll-x-contain`
          for the same reason the chip rows carry it — a swipe that runs off
          the end of a strip must not be handed to the browser as a back
          gesture. Not `touch-pan-x` though: this strip is tall enough to be
          most of the screen's bottom half, and a page you cannot scroll by
          dragging there would cost more than the strip is worth. */}
      <div className="-mx-3 no-scrollbar flex gap-4 overflow-x-auto overscroll-x-contain px-3 pb-1">
        {grouped.map((group) => (
          <div key={group.position} className="flex shrink-0 flex-col gap-1.5">
            <span className="text-[0.625rem] font-semibold tracking-wide text-faint">
              {POSITION_LABEL[group.position]}
            </span>
            <div className="flex gap-2">
              {group.players.map((player) => (
                <BenchPlayer
                  key={player.id}
                  player={player}
                  fixture={fixtureByTeamId?.get(player.teamId)}
                  startProbability={startProbabilities.get(player.id)}
                  expected={expected.entry(player.id)}
                  isLanding={landedId === player.id}
                  onClick={() => {
                    onAdd(player)
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function BenchPlayer({
  player,
  fixture,
  startProbability,
  expected,
  isLanding,
  onClick,
}: {
  player: SquadMember
  fixture: TeamFixture | undefined
  startProbability: StartProbability | undefined
  /** What he is expected to score, when anything expects anything. */
  expected: ExpectedPointsEntry | undefined
  /** He has just been held off the pitch — the far end of that movement. */
  isLanding: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${player.lastName} aufstellen`}
      className={cn(
        'flex w-[5rem] shrink-0 flex-col items-center gap-1 rounded-card border px-1 py-2',
        'border-line bg-surface transition-colors',
        'hover:border-accent/40 hover:bg-surface-2 active:bg-line',
        // Where the card that just fell off the pitch comes back up. The
        // outline fades on its own transition after the drop-in, so the strip
        // settles back to looking like itself.
        isLanding && 'animate-bench-land border-warning/60 bg-warning/5',
      )}
    >
      {/* No dimmed or disabled state: every bench player is tappable, and one
          whose position is full simply routes through the swap dialog. Fading
          them would signal "unavailable" for something that always works. */}
      {/* `relative` so the corner badge has something to anchor to — the
          bench avatar has no availability dot of its own, so this wrapper
          exists only for the badge. */}
      <span className="relative">
        <Avatar src={player.image} name={player.lastName} size={36} />
        {startProbability !== undefined && (
          <StartProbabilityCorner
            tier={startProbability}
            size={cornerBadgeSize(36)}
          />
        )}
      </span>
      <span className="max-w-full truncate text-[0.6875rem] font-medium text-ink">
        {player.lastName}
      </span>
      {/* The fixture and what he is expected to score against it, on one
          line — the same pairing the pitch card carries, and the pair a
          decision is actually made on: the opponent is *why* the figure is
          what it is, and the figure is the reason to bring him on. They
          replaced the average-points line, which asked the reader to do this
          arithmetic himself. */}
      <span className="flex max-w-full items-center gap-1">
        <FixtureBadge fixture={fixture} size="md" />
        {expected !== undefined && (
          <span
            className={cn(
              'nums flex min-w-0 items-center gap-0.5 text-[0.6875rem] leading-none font-bold',
              expectedTextClass(expected),
            )}
          >
            <ExpectedPointsFigure value={expected.value} fontSize={11} />
          </span>
        )}
      </span>
    </button>
  )
}
