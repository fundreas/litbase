import {
  playerFigure,
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
import { Pitch } from '@/components/squad/Pitch'
import {
  fitPitchMetrics,
  ROW_ORDER,
  ROW_ORDER_MIRRORED,
  usePitchBox,
  type PlayerMetrics,
} from '@/components/squad/pitchMetrics'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'
import { useMemo } from 'react'

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
 */
export function DuelLineupTab({
  rosters,
  viewerId,
}: {
  rosters: [DuelRoster, DuelRoster]
  viewerId?: string
}) {
  const [top, bottom] = rosters
  const { ref, box } = usePitchBox()

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

  return (
    /* `min-h-0 flex-1` so the pitch can claim whatever height the page has
       left after the benches, rather than sitting at its floor on a desktop.
       The `min-h-[30rem]` floor is what keeps eight bands legible on a phone:
       below that the page scrolls instead of the cards shrinking further. */
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Pitch className="min-h-[30rem] flex-1">
        {/* Name plates in the corners rather than a legend: the header pairs
            the managers left and right, the pitch stacks them top and bottom,
            and something has to bridge those two arrangements. */}
        <SideLabel
          roster={top}
          side="top"
          isViewer={top.manager.id === viewerId}
        />

        <div ref={ref} className="grid min-h-0 flex-1 grid-rows-8 px-2 py-3">
          {ROW_ORDER_MIRRORED.map((position) => (
            <PitchBand
              key={`top-${position}`}
              players={top.lineup.filter((p) => p.position === position)}
              metrics={metrics}
              side="top"
            />
          ))}
          {ROW_ORDER.map((position) => (
            <PitchBand
              key={`bottom-${position}`}
              players={bottom.lineup.filter((p) => p.position === position)}
              metrics={metrics}
              side="bottom"
            />
          ))}
        </div>

        <SideLabel
          roster={bottom}
          side="bottom"
          isViewer={bottom.manager.id === viewerId}
        />
      </Pitch>

      {/* Two columns, laid out the way the header is: manager one on the
          left, manager two on the right. The pitch has to stack them top and
          bottom to make them face each other, so the benches keep the
          left/right arrangement the scoreline established and the corner
          labels bridge the two. */}
      <div className="grid grid-cols-2 gap-2">
        <BenchColumn roster={top} side="top" />
        <BenchColumn roster={bottom} side="bottom" />
      </div>
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
}: {
  players: DuelPlayer[]
  metrics: PlayerMetrics
  side: Side
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
 * kick-off time, a dash) stays quiet, so the eye finds the numbers first.
 */
function PitchPlayer({
  player,
  metrics,
  side,
}: {
  player: DuelPlayer
  metrics: PlayerMetrics
  side: Side
}) {
  const isRunning = player.status === 'playing'
  const figure = playerFigure(player)

  return (
    <span
      title={`${player.name}: ${figureDescription(figure)}`}
      style={{ width: metrics.width }}
      className="flex shrink-0 flex-col items-center p-1"
    >
      <Avatar
        src={player.image}
        name={player.name}
        size={metrics.avatar}
        className={cn('ring-2', RING_CLASS[side])}
      />
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
    </span>
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
                title={`${player.name}: ${figureDescription(figure)}`}
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
