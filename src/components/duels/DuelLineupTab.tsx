import { breakdownFixtureFrom } from '@/api/hooks/usePlayerMatchEvents'
import {
  playerFigure,
  TEAM_SHEET_ROLE_LABEL,
  type DuelPlayer,
  type DuelRoster,
  type PositionKey,
} from '@/api/models'
import { BenchMark } from '@/components/player/BenchMark'
import {
  figureDescription,
  figureLabel,
  isScore,
} from '@/components/player/playerFigure'
import { PlayerMatchEventsDialog } from '@/components/player/PlayerMatchEventsDialog'
import {
  TeamSheetCorner,
  TeamSheetMark,
} from '@/components/player/TeamSheetMark'
import { Pitch } from '@/components/squad/Pitch'
import {
  cornerBadgeSize,
  fitPitchMetrics,
  ROW_ORDER,
  ROW_ORDER_MIRRORED,
  usePitchBox,
  type PlayerMetrics,
} from '@/components/squad/pitchMetrics'
import { Avatar } from '@/components/ui/Avatar'
import {
  FullscreenButton,
  FullscreenPane,
} from '@/components/ui/FullscreenPane'
import { cn } from '@/lib/cn'
import { useHashModal } from '@/lib/useHashModal'
import { useMemo, type ReactNode } from 'react'

/**
 * Which half of the pitch a player belongs to, and therefore how they are
 * drawn. The top side keeps the white ring the squad's own pitches use; the
 * bottom side takes the accent, so a glance at a portrait says whose it is
 * without reading anything.
 */
type Side = 'top' | 'bottom'

const RING_CLASS: Record<Side, string> = {
  top: 'ring-white/75',
  bottom: 'ring-accent/80',
}

/**
 * Both elevens on **one pitch, facing each other** — the first manager's
 * keeper at the top, the second's at the bottom, strikers either side of the
 * halfway line, exactly as the fixture would be drawn.
 *
 * This replaced two stacked lists of rows. The rows carried more per player (a
 * fixture, a status word, a position) and still lost the thing a duel is
 * actually about: the shape of two teams against each other, and where the
 * points are coming from. A pitch answers "who is carrying this" in one look,
 * and the [Rangliste](./DuelRankingTab.tsx) is one tap away for the detail.
 *
 * **Eight bands, not four.** The top half runs keeper → defence → midfield →
 * attack downwards ({@link ROW_ORDER_MIRRORED}) and the bottom half runs the
 * usual way up ({@link ROW_ORDER}), so the two attacks meet in the middle. The
 * card sizing has to be told there are eight of them, or every portrait is
 * budgeted twice the height it has.
 *
 * **Portraits carry a picture and a points figure, nothing else.** At 22
 * players on a phone a name under each is unreadable and a fixture badge is
 * noise; the points are the only number that changes and the only one worth
 * reading off a pitch.
 *
 * **And there is a way to make them bigger.** The corner opens the pitch
 * [full screen](../ui/FullscreenPane.tsx), which is the answer to the one
 * complaint 22 portraits on a phone will always have: the benches and the page
 * header step aside, the pitch measures the whole viewport, and the same
 * sizing search hands every card the extra room. The `summary` the page passes
 * becomes the bar at the top, so the two totals stay on screen — they are the
 * reason to be looking at all.
 */
export function DuelLineupTab({
  rosters,
  viewerId,
  summary,
  day,
  leagueId,
}: {
  rosters: [DuelRoster, DuelRoster]
  viewerId?: string
  /** Drawn in the full-screen bar in place of the app's header. */
  summary?: ReactNode
  /** The matchday, which with the player addresses his action breakdown. */
  day: number | undefined
  leagueId: string | undefined
}) {
  const [top, bottom] = rosters
  const { ref, box } = usePitchBox()
  /**
   * Both of this tab's modals live in the URL — `#fullscreen`, and
   * `#player:<id>` for a portrait's breakdown, stacking as
   * `#fullscreen/player:4711` when the sheet is opened from the big pitch. So
   * the back gesture peels them off one at a time in the order they went on,
   * and a refresh lands back on the pitch, full screen and all. See
   * [`useHashModal`](../../lib/useHashModal.ts).
   */
  const fullscreen = useHashModal('fullscreen')
  const breakdown = useHashModal('player')

  /*
   * The tapped portrait, found back among the 22 on the pitch. The benches
   * carry no breakdown — they are rows of names — so a hash naming one of
   * those, or a player since substituted out of the payload, opens nothing.
   */
  const openPlayer = [...top.lineup, ...bottom.lineup].find(
    (player) => player.id === breakdown.id,
  )
  const openBreakdown = (player: DuelPlayer) => {
    breakdown.open(player.id)
  }

  /**
   * The busiest band across **both** halves — five defenders on either side
   * constrains the whole pitch, since every card is drawn at one size.
   */
  const metrics = useMemo(() => {
    const bandSizes = [
      ...ROW_ORDER_MIRRORED.map((position) => countAt(top.lineup, position)),
      ...ROW_ORDER.map((position) => countAt(bottom.lineup, position)),
    ]
    return fitPitchMetrics(box, Math.max(1, ...bandSizes), {
      rows: ROW_ORDER.length * 2,
      plate: 'points',
    })
  }, [box, top.lineup, bottom.lineup])

  /*
   * One pitch, drawn in whichever of the two places is showing — inline under
   * the page header, or alone on the screen. Deliberately **not** two copies:
   * a second one would measure a box nobody is looking at and size its cards
   * from it, and the whole point of the full-screen view is that the measuring
   * follows the space the pitch actually has.
   *
   * `min-h-[30rem]` is the floor that keeps eight bands legible on a phone
   * inline — below it the page scrolls instead of the cards shrinking further.
   * Full screen there is no page to scroll and nothing under the pitch to make
   * room for, so the floor comes off and the pitch takes the viewport exactly.
   */
  const pitch = (
    <Pitch
      className={fullscreen.isOpen ? 'min-h-0 flex-1' : 'min-h-[30rem] flex-1'}
    >
      {/* Name plates in the corners rather than a legend: the header pairs
          the managers left and right, the pitch stacks them top and bottom,
          and something has to bridge those two arrangements. */}
      <SideLabel
        roster={top}
        side="top"
        isViewer={top.manager.id === viewerId}
      />

      {/* The one corner the two name plates leave free. Gone once the pitch is
          full screen: there is nothing further to expand into, and the bar's ✗
          is the way back. */}
      {!fullscreen.isOpen && (
        <FullscreenButton
          label="Aufstellung im Vollbild"
          onClick={() => {
            fullscreen.open()
          }}
        />
      )}

      <div ref={ref} className="grid min-h-0 flex-1 grid-rows-8 px-2 py-3">
        {ROW_ORDER_MIRRORED.map((position) => (
          <PitchBand
            key={`top-${position}`}
            players={top.lineup.filter((p) => p.position === position)}
            metrics={metrics}
            side="top"
            onOpen={openBreakdown}
          />
        ))}
        {ROW_ORDER.map((position) => (
          <PitchBand
            key={`bottom-${position}`}
            players={bottom.lineup.filter((p) => p.position === position)}
            metrics={metrics}
            side="bottom"
            onOpen={openBreakdown}
          />
        ))}
      </div>

      <SideLabel
        roster={bottom}
        side="bottom"
        isViewer={bottom.manager.id === viewerId}
      />
    </Pitch>
  )

  /* Mounted in both layouts — a portrait is tappable full screen too, and the
     dialog sits above the pane at its own z-index. */
  const breakdownDialog = (
    <>
      {/* The breakdown for whichever portrait was tapped. Its header links to
          the **player**, not the match: a duel is read to find out whose
          players are carrying it, so the next question is about the man rather
          than the fixture — the opposite of the squad's live view, where you
          already know the men and want the match. */}
      {openPlayer?.fixture !== undefined && day !== undefined && (
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
          to={
            leagueId === undefined
              ? undefined
              : `/leagues/${leagueId}/players/${openPlayer.id}`
          }
          onClose={breakdown.close}
        />
      )}
    </>
  )

  if (fullscreen.isOpen) {
    /* The benches stay behind. They are rows of names, which is what the page
       underneath is for; this screen exists to make the *grass* bigger, and
       eight bands plus two columns would put us back where we started. */
    return (
      <FullscreenPane
        open
        onOpenChange={fullscreen.setOpen}
        title="Aufstellung im Vollbild"
        summary={summary}
      >
        {pitch}
        {breakdownDialog}
      </FullscreenPane>
    )
  }

  return (
    /* `min-h-0 flex-1` so the pitch can claim whatever height the page has
       left after the benches, rather than sitting at its floor on a desktop. */
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {pitch}

      {/* Two columns, laid out the way the header is: manager one on the
          left, manager two on the right. The pitch has to stack them top and
          bottom to make them face each other, so the benches keep the
          left/right arrangement the scoreline established and the corner
          labels bridge the two. */}
      <div className="grid grid-cols-2 gap-2">
        <BenchColumn roster={top} side="top" />
        <BenchColumn roster={bottom} side="bottom" />
      </div>

      {breakdownDialog}
    </div>
  )
}

function countAt(lineup: DuelPlayer[], position: PositionKey): number {
  return lineup.filter((player) => player.position === position).length
}

/** One position's players, side by side. */
function PitchBand({
  players,
  metrics,
  side,
  onOpen,
}: {
  players: DuelPlayer[]
  metrics: PlayerMetrics
  side: Side
  onOpen: (player: DuelPlayer) => void
}) {
  return (
    /* `flex-nowrap` + `overflow-hidden` for the reason the squad's pitch
       documents at length: wrapping turns width pressure into height, which
       feeds back into the sizing and oscillates. The fit above already
       guarantees the busiest band fits, so clipping is a backstop. */
    <div className="flex min-h-0 flex-nowrap items-center justify-center gap-1 overflow-hidden">
      {players.map((player) => (
        <PitchPlayer
          key={player.id}
          player={player}
          metrics={metrics}
          side={side}
          onOpen={onOpen}
        />
      ))}
    </div>
  )
}

/**
 * A portrait and its one figure: the points, or the kick-off time while the
 * match is still to come — see
 * [`playerFigure()`](../../api/models.ts).
 *
 * The figure is tinted **only while the player's match is running** — the one
 * state that is going to change, and so the only one worth spotting across a
 * pitch of 22. A real score is drawn at full contrast and a placeholder (a
 * kick-off day or time, a dash) stays quiet, so the eye finds the numbers
 * first.
 *
 * The corner carries the [club's team sheet](../player/TeamSheetMark.tsx) in
 * the hour a sheet exists and the match has not started, and nothing at all
 * outside it. That is the one time a duel of two unstarted elevens has anything
 * to separate its 22 identical `Sa` plates — and on this pitch, unlike the
 * squad editor's, no other badge is competing for the corner.
 */
function PitchPlayer({
  player,
  metrics,
  side,
  onOpen,
}: {
  player: DuelPlayer
  metrics: PlayerMetrics
  side: Side
  onOpen: (player: DuelPlayer) => void
}) {
  const isRunning = player.status === 'playing'
  const figure = playerFigure(player)

  /*
   * A portrait is a **button, not a link**, and that is the change worth
   * noting: these plates carried nothing but a number, and the number was the
   * one thing on the page that could not be explained. A tap now opens the
   * [breakdown](../player/PlayerMatchEventsDialog.tsx) — the actions behind
   * that figure — and the player's own page is a tap further on, from the
   * dialog's header. A duel is read to find out where the points came from, so
   * the answer belongs in front of the detour rather than behind it.
   *
   * There is nothing to open without a fixture: a player whose club has no
   * match that matchday has no actions and no breakdown to address.
   */
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
      title={`${player.name}: ${figureDescription(figure)}`}
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
          className={cn('ring-2', RING_CLASS[side])}
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
          'nums relative truncate rounded bg-black/70 px-1 text-center font-bold',
          isRunning
            ? 'text-accent'
            : isScore(figure)
              ? 'text-white'
              : 'text-white/55',
        )}
      >
        {figureLabel(figure)}
      </span>
    </Shell>
  )
}

/**
 * Whose half this is, in the corner of the pitch.
 *
 * Absolutely positioned so it costs the bands no height — the pitch is the
 * scarcest space on the page and eight bands are already tight.
 */
function SideLabel({
  roster,
  side,
  isViewer,
}: {
  roster: DuelRoster
  side: Side
  isViewer: boolean
}) {
  return (
    <span
      className={cn(
        'absolute z-10 flex items-center gap-1.5 rounded-full bg-black/45 px-1.5 py-0.5 backdrop-blur-sm',
        side === 'top' ? 'top-1 left-1' : 'bottom-1 left-1',
      )}
    >
      <Avatar src={roster.manager.image} name={roster.manager.name} size={16} />
      <span className="max-w-28 truncate text-[0.625rem] font-semibold text-white">
        {roster.manager.name}
        {isViewer && <span className="ml-1 text-accent">du</span>}
      </span>
    </span>
  )
}

/**
 * One manager's unfielded players, as a **column** beside the other's.
 *
 * They scored what they scored and it did not count — which is exactly why
 * they are shown: a bench outscoring the eleven is the most interesting thing
 * a duel can tell you, and the [Rangliste](./DuelRankingTab.tsx) ranks the two
 * together.
 *
 * Stacked rather than a sideways-scrolling strip, because two benches side by
 * side are meant to be *compared*: rows at matching heights read against each
 * other, and nothing is hidden off the edge waiting to be swiped into view.
 * A name fits in a row where it would not fit under a portrait, so unlike the
 * pitch these carry one.
 *
 * Dimmed as a set rather than tagged one by one — the heading says what they
 * are, and repeating "Bank" down every row is noise.
 */
function BenchColumn({ roster, side }: { roster: DuelRoster; side: Side }) {
  return (
    <section className="flex min-w-0 flex-col gap-1.5">
      {/* The armchair is what says "bench" here — the column is otherwise just
          a manager's name over some players, and the word would eat width a
          truncated name needs. */}
      <h3 className="flex min-w-0 items-center gap-1.5 px-0.5 text-[0.625rem] font-semibold tracking-wider text-faint uppercase">
        <Avatar
          src={roster.manager.image}
          name={roster.manager.name}
          size={14}
        />
        <span className="truncate">{roster.manager.name}</span>
        <BenchMark size={12} />
      </h3>

      {roster.bench.length === 0 ? (
        <p className="rounded-card border border-line bg-surface px-2 py-3 text-center text-[0.6875rem] text-muted">
          Alle Spieler aufgestellt
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {roster.bench.map((player) => {
            const figure = playerFigure(player)
            return (
              <li
                key={player.id}
                title={`${player.name}: ${figureDescription(figure)}${player.sheet === undefined ? '' : ` · ${TEAM_SHEET_ROLE_LABEL[player.sheet]}`}`}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-1.5 py-1 opacity-75"
              >
                <Avatar
                  src={player.image}
                  name={player.name}
                  size={24}
                  className={cn('ring-1', RING_CLASS[side])}
                />
                <span className="min-w-0 flex-1 truncate text-[0.6875rem] font-medium text-ink">
                  {player.name}
                </span>
                {/* Inline rather than in the corner of a 24px portrait, where
                    a badge would cover a third of the face. A bench player's
                    club sheet still matters: he is who you would have fielded
                    instead, and next week you might. */}
                {player.sheet !== undefined && (
                  <TeamSheetMark role={player.sheet} size={12} />
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
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
