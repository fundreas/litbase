import { AlertTriangle, UserMinus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import {
  POSITION_LABEL,
  POSITION_NAME,
  type PositionKey,
  type SquadMember,
  type TeamFixture,
} from '@/api/models'
import { FixtureBadge } from '@/components/squad/FixtureBadge'
import { Pitch } from '@/components/squad/Pitch'
import {
  useLineupDrag,
  type DragHandleProps,
  type LineupDrag,
} from '@/components/squad/useLineupDrag'
import type { LineupEditor } from '@/components/squad/useLineupEditor'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { points } from '@/lib/format'
import {
  emptySlotPenalty,
  formationLabel,
  LINEUP_SIZE,
  missingAtPosition,
} from '@/lib/lineup'

/** Rows top-to-bottom on a vertical pitch: attack first, keeper last. */
const ROW_ORDER: PositionKey[] = ['fwd', 'mid', 'def', 'gk']

/** Bench grouping, and the order player ids are sent to the API in. */
const BENCH_ORDER: PositionKey[] = ['gk', 'def', 'mid', 'fwd']

/**
 * Bounds for the on-pitch avatar, which scales with the pitch itself.
 *
 * A fixed 44px looked right on a phone and lost on a 1280px screen, where the
 * pitch is ~480px tall and the players were islands in it. The size is derived
 * from the space each band actually has, so it tracks the window continuously
 * rather than stepping at breakpoints.
 */
const AVATAR_MIN = 40
const AVATAR_MAX = 96
/** How much wider than its avatar a player button is (its own padding). */
const PLAYER_PADDING = 12
/** The `gap-1` between two players in the same band. */
const PLAYER_GAP = 4
/** Button `p-1`, top and bottom. */
const PLAYER_CHROME_HEIGHT = 8
/** The plate's own `py-0.5` and the `gap-0.5` between its two lines. */
const PLATE_CHROME_HEIGHT = 6
/** How far the name plate rides up over the portrait, as a share of it. */
const PLATE_OVERLAP_RATIO = 0.15

/** Everything in a player card is derived from one number. */
function playerMetrics(avatar: number) {
  return {
    avatar,
    width: avatar + PLAYER_PADDING,
    /** The plate spans the portrait exactly, so the card reads as one object. */
    plateWidth: avatar,
    plateOverlap: Math.round(avatar * PLATE_OVERLAP_RATIO),
    nameFontSize: Math.min(16, Math.max(10, Math.round(avatar * 0.2))),
    badgeCrest: Math.min(26, Math.max(14, Math.round(avatar * 0.3))),
    removeIcon: Math.round(avatar * 0.36),
  }
}

export type PlayerMetrics = ReturnType<typeof playerMetrics>

/**
 * Total height a card occupies.
 *
 * The plate overlaps the portrait's lower edge, so it costs the card less than
 * its own height — that overlap has to come out of the budget or the sizing
 * search would leave a gap under every player.
 */
function playerHeight(metrics: PlayerMetrics): number {
  const nameLine = Math.round(metrics.nameFontSize * 1.25)
  const plate = nameLine + metrics.badgeCrest + PLATE_CHROME_HEIGHT
  return PLAYER_CHROME_HEIGHT + metrics.avatar - metrics.plateOverlap + plate
}

/**
 * The largest avatar that fits both the band's height and its width.
 *
 * Searched rather than solved because the plate does not scale linearly with
 * the portrait — the font size and crest are both clamped, so the height is
 * piecewise. Stepping down from the width limit until the card fits the band
 * is exact and costs at most a few dozen iterations.
 *
 * Fitting *exactly* matters more than it looks. An earlier version took a
 * fixed 54% of the band, which overshot by ~2px; the card then pushed the
 * pitch taller, the page gained a scrollbar, the scrollbar narrowed the row,
 * and the size oscillated between two values on every render.
 */
function fitAvatar(bandHeight: number, maxWidth: number): PlayerMetrics {
  const ceiling = Math.min(AVATAR_MAX, Math.floor(maxWidth))
  for (let avatar = ceiling; avatar > AVATAR_MIN; avatar -= 1) {
    const metrics = playerMetrics(avatar)
    if (playerHeight(metrics) <= bandHeight) return metrics
  }
  return playerMetrics(AVATAR_MIN)
}

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
  fixtureByTeamId,
}: {
  squad: SquadMember[]
  editor: LineupEditor
  fixtureByTeamId: Map<string, TeamFixture> | undefined
}) {
  const { lineup, counts, formation } = editor

  /**
   * Dragging reorders a player *within his row*.
   *
   * Rows are positions, and the slot a player occupies inside his row is what
   * the API stores — so this is the one lineup edit that changes nothing about
   * who plays, only about where. Cross-row drops are refused by the hook
   * rather than corrected here: a midfielder posted into a defender slot is
   * silently discarded by Kickbase.
   */
  const drag = useLineupDrag({ items: lineup, onReorder: editor.reorder })

  // The pitch is measured rather than guessed at, so the avatars scale with
  // whatever height the flex chain actually hands it.
  const pitchRef = useRef<HTMLDivElement>(null)
  const [pitchBox, setPitchBox] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const element = pitchRef.current
    if (element === null) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      const next = {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      }
      // Rounded, and only when it actually moved: a resize observer that
      // re-renders on sub-pixel noise is one step from an infinite loop.
      setPitchBox((current) =>
        current.width === next.width && current.height === next.height
          ? current
          : next,
      )
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [])

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
   * Two limits, whichever bites first: the height a band has left after the
   * name plate, and the width the *busiest* band can give each player. A row
   * of five defenders is what constrains a narrow screen; the band height is
   * what constrains a wide one.
   */
  const metrics = useMemo(() => {
    if (pitchBox.height === 0) return playerMetrics(AVATAR_MIN)

    const busiestBand = Math.max(
      1,
      ...ROW_ORDER.map(
        (position) =>
          lineup.filter((player) => player.position === position).length +
          missingAtPosition(counts, position),
      ),
    )

    // Solve for the avatar that makes the busiest band exactly fit:
    //   n * (size + PLAYER_PADDING) + (n - 1) * PLAYER_GAP <= width
    // Dividing the width by the count alone overshoots, because each button is
    // wider than its avatar and the gaps still have to go somewhere — which
    // is what made a row of five defenders wrap on a phone.
    const usable = pitchBox.width - (busiestBand - 1) * PLAYER_GAP
    const byWidth = usable / busiestBand - PLAYER_PADDING

    return fitAvatar(pitchBox.height / ROW_ORDER.length, byWidth)
  }, [pitchBox, lineup, counts])

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

          {editor.isSaving && (
            <span className="flex items-center gap-1 text-xs text-faint">
              <Spinner size={12} />
              Speichern …
            </span>
          )}
        </p>
        <p className="nums rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-accent">
          {formationLabel(formation)}
        </p>
      </div>

      {editor.saveError !== null && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-negative/30 bg-negative/10 px-3 py-2.5 text-sm text-negative"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {editor.saveError}
        </p>
      )}

      <Pitch className="flex-1">
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
          className="grid min-h-0 flex-1 grid-rows-4 px-2 py-3"
        >
          {ROW_ORDER.map((position) => (
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
              fixtureByTeamId={fixtureByTeamId}
              metrics={metrics}
              drag={drag}
              onRemove={editor.remove}
            />
          ))}
        </div>
      </Pitch>

      {drag.dragging !== null && (
        <DragGhost
          player={drag.dragging}
          fixture={fixtureByTeamId?.get(drag.dragging.teamId)}
          metrics={metrics}
          ghostRef={drag.ghostRef}
        />
      )}

      <Bench
        squad={squad}
        isFielded={editor.isFielded}
        fixtureByTeamId={fixtureByTeamId}
        onAdd={editor.toggle}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Pitch                                                                      */
/* -------------------------------------------------------------------------- */

function PitchRow({
  position,
  players,
  placeholders,
  fixtureByTeamId,
  metrics,
  drag,
  onRemove,
}: {
  position: PositionKey
  players: SquadMember[]
  /** Mandatory places of this position still to fill. */
  placeholders: number
  fixtureByTeamId: Map<string, TeamFixture> | undefined
  metrics: PlayerMetrics
  drag: LineupDrag<SquadMember>
  onRemove: (playerId: string) => void
}) {
  return (
    /* Deliberately `flex-nowrap` + `overflow-hidden`.
     *
     * Wrapping turned a width overflow into extra height, which fed straight
     * back into the avatar sizing: wider avatars → the band wraps → the band
     * is taller → `byHeight` allows a wider avatar → it wraps harder. That
     * loop settled with a 854px pitch on an 844px screen. With nowrap, width
     * pressure can never become height, so the pitch height stays purely
     * flex-driven and the calculation has a fixed point.
     *
     * The size calculation already guarantees the busiest band fits, so the
     * clipping here is a backstop, not a normal state.
     */
    <div className="flex min-h-0 flex-nowrap items-center justify-center gap-1 overflow-hidden">
      {players.map((player) => (
        <PitchPlayer
          key={player.id}
          player={player}
          fixture={fixtureByTeamId?.get(player.teamId)}
          metrics={metrics}
          isDragging={drag.dragging?.id === player.id}
          dragProps={drag.dragProps(player)}
          onClick={() => {
            // The click that ends a drag is not a tap, and taking the player
            // off the pitch is the last thing the manager meant by it.
            if (!drag.isTap()) return
            onRemove(player.id)
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

function PitchPlayer({
  player,
  fixture,
  metrics,
  isDragging,
  dragProps,
  onClick,
}: {
  player: SquadMember
  fixture: TeamFixture | undefined
  metrics: PlayerMetrics
  /** This portrait is the one being carried; the ghost shows it instead. */
  isDragging: boolean
  dragProps: DragHandleProps
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...dragProps}
      title={`${player.lastName} – ziehen zum Verschieben, tippen zum Herausnehmen`}
      aria-label={`${player.lastName} aus der Aufstellung nehmen. Mit den Pfeiltasten nach links oder rechts verschieben.`}
      // Width follows the avatar exactly. A minimum floor here would fight
      // the size calculation, which already solves for the busiest band —
      // a 64px floor is what made five defenders wrap on a phone.
      style={{ width: metrics.width }}
      className={cn(
        'group flex shrink-0 flex-col items-center rounded-lg p-1',
        'cursor-grab transition-[opacity,background-color] active:cursor-grabbing active:bg-black/20',
        // `touch-none`, or the first millimetre of a drag is swallowed by the
        // browser as a scroll and the gesture never reaches us. Safe here
        // because the pitch is sized to fit rather than to scroll.
        'touch-none',
        // Kept in place rather than hidden: the row is mid-reflow around it,
        // and removing the slot would make everything else jump.
        isDragging && 'opacity-25',
      )}
    >
      <PlayerFace player={player} fixture={fixture} metrics={metrics} />
    </button>
  )
}

/**
 * The portrait and its name plate — everything inside a pitch player except
 * the button. Shared with the drag ghost so the thing under the finger is
 * literally the thing that was picked up.
 */
function PlayerFace({
  player,
  fixture,
  metrics,
}: {
  player: SquadMember
  fixture: TeamFixture | undefined
  metrics: PlayerMetrics
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
        {player.status !== 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-negative"
            title="Nicht einsatzbereit"
          />
        )}
        {/* Only shows on hover/focus — on touch the label already explains it.
            The ghost is outside any `group`, so it never appears there. */}
        <span className="absolute inset-0 hidden items-center justify-center rounded-full bg-black/55 group-hover:flex">
          <UserMinus size={metrics.removeIcon} className="text-white" />
        </span>
      </span>

      {/* One plate, two lines: name over fixture. Two separate chips read as
          unrelated badges floating over the grass. */}
      {/* The plate scales with the portrait, spans its full width, and rides
          up over its lower edge so the two read as one object rather than a
          caption floating beneath a circle. `relative` puts it above the
          portrait in paint order. */}
      <span
        style={{
          width: metrics.plateWidth,
          marginTop: -metrics.plateOverlap,
        }}
        className="relative flex flex-col items-center gap-0.5 rounded bg-black/70 px-1 py-0.5 leading-tight"
      >
        <span
          style={{ fontSize: metrics.nameFontSize }}
          className="max-w-full truncate font-semibold text-white"
        >
          {player.lastName}
        </span>
        <FixtureBadge
          fixture={fixture}
          tone="onPitch"
          size={metrics.badgeCrest}
        />
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
  metrics,
  ghostRef,
}: {
  player: SquadMember
  fixture: TeamFixture | undefined
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
        <PlayerFace player={player} fixture={fixture} metrics={metrics} />
      </span>
    </div>,
    document.body,
  )
}

/* -------------------------------------------------------------------------- */
/* Bench                                                                      */
/* -------------------------------------------------------------------------- */

function Bench({
  squad,
  isFielded,
  fixtureByTeamId,
  onAdd,
}: {
  squad: SquadMember[]
  isFielded: (playerId: string) => boolean
  fixtureByTeamId: Map<string, TeamFixture> | undefined
  onAdd: (player: SquadMember) => void
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
      <h2 className="px-0.5 text-[0.6875rem] font-semibold tracking-wider text-faint uppercase">
        Bank · tippen zum Aufstellen
      </h2>

      {grouped.length === 0 && (
        <p className="rounded-card border border-line bg-surface px-3 py-4 text-center text-sm text-muted">
          Alle Spieler sind aufgestellt.
        </p>
      )}

      {/* One sideways-scrolling strip, grouped by position with headings, so
          the whole squad stays reachable with a thumb. */}
      <div className="-mx-3 no-scrollbar flex gap-4 overflow-x-auto px-3 pb-1">
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
  onClick,
}: {
  player: SquadMember
  fixture: TeamFixture | undefined
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
      )}
    >
      {/* No dimmed or disabled state: every bench player is tappable, and one
          whose position is full simply routes through the swap dialog. Fading
          them would signal "unavailable" for something that always works. */}
      <Avatar src={player.image} name={player.lastName} size={36} />
      <span className="max-w-full truncate text-[0.6875rem] font-medium text-ink">
        {player.lastName}
      </span>
      {/* The next fixture replaces the average-points line: on a card this
          size only one secondary fact fits, and which club a player faces is
          the one that decides whether to field him this week. */}
      <FixtureBadge fixture={fixture} size="md" />
    </button>
  )
}
