import {
  isBeforeKickoff,
  playerFigure,
  TEAM_SHEET_ROLE_LABEL,
  type DuelPlayer,
} from '@/api/models'
import { BenchMark } from '@/components/player/BenchMark'
import {
  figureDescription,
  figureLabel,
  isScore,
} from '@/components/player/playerFigure'
import {
  TeamSheetCorner,
  TeamSheetMark,
} from '@/components/player/TeamSheetMark'
import {
  expectedDescription,
  expectedTextClass,
  ExpectedPointsBadge,
  ExpectedPointsFigure,
} from '@/components/squad/ExpectedPointsBadge'
import {
  cornerBadgeSize,
  type PlayerMetrics,
} from '@/components/squad/pitchMetrics'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'
import type {
  ExpectedPointsEntry,
  ExpectedPointsView,
} from '@/lib/expectedPoints'

/**
 * **What he is expected to score, where his match has not started.**
 *
 * One helper for all three pieces below, so the pitch and the bench cannot
 * disagree about when the figure appears: the view answers *which* figure —
 * the reader's own guess, else the model's prediction —
 * [`isBeforeKickoff`](../../api/models.ts) answers *whether it is still worth
 * showing*. `undefined` view is every caller that has no matchday to file a
 * figure under, and every screen that has not been given one.
 */
function expectedFor(
  player: DuelPlayer,
  expected: ExpectedPointsView | undefined,
): ExpectedPointsEntry | undefined {
  if (expected === undefined || !isBeforeKickoff(player)) return undefined
  return expected.entry(player.id)
}

/**
 * The pieces a **read-only matchday roster** is drawn from — a portrait on the
 * grass, a band of them, and a bench row.
 *
 * Extracted from [`DuelLineupTab`](../duels/DuelLineupTab.tsx) once a second
 * page drew the same thing: that one puts two elevens on one pitch facing each
 * other, the [manager page](../manager/ManagerLineupTab.tsx) puts one eleven on
 * its own. Both read a [`DuelPlayer`](../../api/models.ts) — the shape a
 * matchday roster produces, whether or not there is a duel — and both want the
 * identical card, or the same player would be a different size and a different
 * colour on two screens one tap apart.
 *
 * What is *not* here: the pitch itself, the bands' arrangement, the benches'
 * layout and every modal. Those are where the two pages genuinely differ, and
 * a shared component with a `sides` flag would have been the two of them
 * wearing one coat.
 *
 * These are read-only. The squad's own [editor](../squad/LineupTab.tsx) has its
 * own card: it carries a name plate, a fixture badge and a remove control, and
 * its portraits are drag handles.
 */

/**
 * How a portrait is ringed — which is how a reader tells whose it is.
 *
 * `light` is the squad's own pitches, and the top half of a duel. `accent` is
 * the bottom half, so a glance at a duel says which eleven is which without
 * reading a name.
 */
export type RosterRing = 'light' | 'accent'

const RING_CLASS: Record<RosterRing, string> = {
  light: 'ring-white/75',
  accent: 'ring-accent/80',
}

/** One position's players, side by side. */
export function RosterBand({
  players,
  metrics,
  ring,
  onOpen,
  expected,
}: {
  players: DuelPlayer[]
  metrics: PlayerMetrics
  ring: RosterRing
  onOpen: (player: DuelPlayer) => void
  /** This matchday's expected points, for the matches still to come. */
  expected?: ExpectedPointsView
}) {
  return (
    /* `flex-nowrap` + `overflow-hidden` for the reason the squad's pitch
       documents at length: wrapping turns width pressure into height, which
       feeds back into the sizing and oscillates. The caller's fit already
       guarantees the busiest band fits, so clipping is a backstop. */
    <div className="flex min-h-0 flex-nowrap items-center justify-center gap-1 overflow-hidden">
      {players.map((player) => (
        <RosterPortrait
          key={player.id}
          player={player}
          metrics={metrics}
          ring={ring}
          onOpen={onOpen}
          expected={expected}
        />
      ))}
    </div>
  )
}

/**
 * A portrait and its one figure: the points, what he is **expected** to score
 * while his match is still to come, or the kick-off time when nothing expects
 * anything of him — see [`playerFigure()`](../../api/models.ts).
 *
 * **The expected figure outranks the kick-off time**, because the plate holds
 * exactly one number and the two are answers to different questions: *when*
 * versus *what for*. Before a kick-off a pitch of eleven identical `Sa` plates
 * says almost nothing, and eleven expected figures say what the eleven is
 * worth — which is the question a lineup is looked at to answer. The time is
 * not lost: it stays in the card's tooltip, spelled out in full beside the
 * figure it gave its place to.
 *
 * It wears the **target glyph** and the two colours the chips use — accent
 * green for the reader's own guess, orange for the model's prediction — via
 * [`ExpectedPointsFigure`](../squad/ExpectedPointsBadge.tsx), so one
 * distinction has one vocabulary across the app. The glyph is what keeps the
 * plate from reading as points already scored, which is the one thing a number
 * over a portrait on a pitch is otherwise taken for.
 *
 * It is **in the plate rather than on the portrait**: the corner is the
 * [team sheet's](../player/TeamSheetMark.tsx), and that mark appears in
 * exactly this window — the hour before a kick-off — so a second corner badge
 * would have to displace the one thing that can say the striker is not in the
 * eighteen. The glyph belongs next to the figure it qualifies anyway.
 *
 * The figure is tinted **only while the player's match is running**, otherwise
 * — the one state that is going to change, and so the only one worth spotting
 * across a pitch of eleven or twenty-two. A real score is drawn at full
 * contrast and a placeholder (a kick-off day or time, a dash) stays quiet, so
 * the eye finds the numbers first. A running match and an expected figure
 * cannot coexist, which is what keeps the accent green unambiguous: it is a
 * live score before kick-off has happened to nobody, and a guess afterwards to
 * nobody either.
 *
 * The corner carries the [club's team sheet](../player/TeamSheetMark.tsx) in
 * the hour a sheet exists and the match has not started, and nothing at all
 * outside it. That is the one time a pitch of unstarted elevens has anything to
 * separate its identical `Sa` plates.
 *
 * A portrait is a **button, not a link**: these plates carry nothing but a
 * number, and the number is the one thing on the page that cannot be explained
 * by looking at it. A tap opens the
 * [breakdown](../player/PlayerMatchEventsDialog.tsx) — the actions behind that
 * figure — and the player's own page is a tap further on, from the dialog's
 * header. There is nothing to open without a fixture: a player whose club has
 * no match that matchday has no actions to break down.
 */
export function RosterPortrait({
  player,
  metrics,
  ring,
  onOpen,
  expected,
}: {
  player: DuelPlayer
  metrics: PlayerMetrics
  ring: RosterRing
  onOpen: (player: DuelPlayer) => void
  /** This matchday's expected points, for the matches still to come. */
  expected?: ExpectedPointsView
}) {
  const isRunning = player.status === 'playing'
  const figure = playerFigure(player)
  const entry = expectedFor(player, expected)
  const canOpen = player.fixture !== undefined

  const Shell = canOpen ? 'button' : 'span'

  /* Both halves when the expected figure has taken the plate: what it is, and
     the kick-off it displaced. A tooltip is the one place on a pitch with room
     to say both. */
  const title =
    entry === undefined
      ? `${player.name}: ${figureDescription(figure)}`
      : `${player.name}: ${expectedDescription(entry)} · ${figureDescription(figure)}`

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
      title={title}
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
          className={cn('ring-2', RING_CLASS[ring])}
        />
        {player.sheet !== undefined && (
          <TeamSheetCorner
            role={player.sheet}
            size={cornerBadgeSize(metrics.avatar)}
          />
        )}
      </span>
      <span
        style={{
          width: metrics.plateWidth,
          marginTop: -metrics.plateOverlap,
          fontSize: metrics.nameFontSize,
        }}
        className={cn(
          /* A flex row rather than one truncating line, because the expected
             figure is two things — the target and the number — and the number
             is the half that may be clipped. */
          'nums relative flex items-center justify-center gap-0.5 rounded bg-black/70 px-1 font-bold',
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
    </Shell>
  )
}

/**
 * One unfielded player, as a row.
 *
 * A bench player scored what they scored and it did not count — which is
 * exactly why they are shown: a bench outscoring the eleven is the most
 * interesting thing a matchday can tell you. A name fits in a row where it
 * would not fit under a portrait, so unlike the pitch these carry one.
 *
 * Dimmed as a set by whoever lists them rather than tagged one by one — the
 * heading above says what they are, and repeating "Bank" down every row is
 * noise.
 *
 * **The expected chip sits beside the figure here rather than replacing it**,
 * because a row has the width a plate does not. On the bench that figure is
 * the interesting one: an expected 240 next to the armchair is the question
 * *why is he not on the pitch*, and it is exactly the question a bench is on
 * screen to raise.
 */
export function RosterBenchRow({
  player,
  ring,
  onOpen,
  expected,
}: {
  player: DuelPlayer
  ring: RosterRing
  /**
   * Opens the player's breakdown, where the row has one to open.
   *
   * Optional: the duel's benches are two columns of names beside each other and
   * deliberately inert — the pitch is what that page's taps are for. The
   * manager page's single bench is wide enough to be a list of controls, and a
   * benched player's points are exactly as unexplained as a fielded one's.
   */
  onOpen?: (player: DuelPlayer) => void
  /** This matchday's expected points, for the matches still to come. */
  expected?: ExpectedPointsView
}) {
  const figure = playerFigure(player)
  const entry = expectedFor(player, expected)
  const canOpen = onOpen !== undefined && player.fixture !== undefined

  const title = `${player.name}: ${
    entry === undefined ? '' : `${expectedDescription(entry)} · `
  }${figureDescription(figure)}${
    player.sheet === undefined
      ? ''
      : ` · ${TEAM_SHEET_ROLE_LABEL[player.sheet]}`
  }`

  const body = (
    <>
      <Avatar
        src={player.image}
        name={player.name}
        size={24}
        className={cn('ring-1', RING_CLASS[ring])}
      />
      <span className="min-w-0 flex-1 truncate text-left text-[0.6875rem] font-medium text-ink">
        {player.name}
      </span>
      {/* Inline rather than in the corner of a 24px portrait, where a badge
          would cover a third of the face. A bench player's club sheet still
          matters: he is who you would have fielded instead, and next week you
          might. */}
      {player.sheet !== undefined && (
        <TeamSheetMark role={player.sheet} size={12} />
      )}
      {/* Decorative: the row's `title` already reads the figure and its source
          out in words, and a second label on a chip inside it would say the
          same thing twice. */}
      {entry !== undefined && (
        <ExpectedPointsBadge
          value={entry.value}
          isForecast={!entry.isOwn}
          decorative
        />
      )}
      {figure.kind === 'bench' ? (
        <BenchMark size={12} className="text-faint" />
      ) : (
        <span
          className={cn(
            'nums shrink-0 text-[0.6875rem] font-semibold',
            isScore(figure) ? 'text-ink' : 'text-faint',
          )}
        >
          {figureLabel(figure)}
        </span>
      )}
    </>
  )

  const shell =
    'flex w-full items-center gap-1.5 rounded-lg border border-line bg-surface px-1.5 py-1'

  return (
    <li title={title}>
      {canOpen ? (
        <button
          type="button"
          onClick={() => {
            onOpen(player)
          }}
          className={cn(
            shell,
            'transition-colors hover:border-accent/40 hover:bg-surface-2',
            'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
          )}
        >
          {body}
        </button>
      ) : (
        <span className={shell}>{body}</span>
      )}
    </li>
  )
}
