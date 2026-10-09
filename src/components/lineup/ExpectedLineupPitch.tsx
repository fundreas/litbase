import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'

import { playerPortraitUrl } from '@/api/cdn'
import {
  EXPECTED_STATUS_LABEL,
  type ExpectedLineup,
  type ExpectedPlayer,
  type PositionKey,
} from '@/api/models'
import { ExpectedTierBadge } from '@/components/lineup/ExpectedTierBadge'
import {
  chance,
  expectedPlayerLabel,
  expectedStatusCode,
  TIER_RING_CLASS,
} from '@/components/lineup/expectedLineup'
import { Pitch } from '@/components/squad/Pitch'
import { PlayerStatusBadge } from '@/components/squad/PlayerStatusBadge'
import {
  cornerBadgeSize,
  fitPitchMetrics,
  PITCH_BAND_CLASS,
  pitchGridClass,
  ROW_ORDER,
  ROW_ORDER_MIRRORED,
  SIDE_LABEL_CLASS,
  singleTeamOrder,
  usePitchBox,
  type PitchOrientation,
  type PlayerMetrics,
} from '@/components/squad/pitchMetrics'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'

/** One club on a predicted pitch: the eleven, and who to put in the corner. */
export interface ExpectedSide {
  lineup: ExpectedLineup
  /** Crest and short name for the corner plate — the club directory's. */
  name?: string
  symbol?: string
  image?: string
}

/**
 * **A predicted eleven on the grass** — one club's, or two facing each other.
 *
 * The same pitch, the same sizing search and the same bands as every other
 * lineup in the app ([`pitchMetrics`](../squad/pitchMetrics.ts)), because a
 * prediction is only useful if it can be read against the real thing. What
 * changes is what a portrait carries, and it is exactly what a guess has to
 * say for itself:
 *
 *  - the **tier** as a badge in the top-right corner — how sure the run is
 *    that this man starts, see [`ExpectedTierBadge`](./ExpectedTierBadge.tsx);
 *  - the **availability mark** top-left, the app's own red cross and red card,
 *    because "he is injured" is why a regular is missing from an eleven and
 *    the one thing a reader would otherwise have to go and check;
 *  - the **start probability** on the plate, where a real sheet puts points.
 *    `78 %` is the honest version of a name on a team sheet, and it is also
 *    the figure that separates two men the badge puts in the same tier.
 *
 * **The ring is the tier again, quietly**, so the eleven separates at a glance
 * into the players the run is sure of and the ones it is guessing at, without
 * anyone reading a single glyph.
 *
 * **No portraits from Kickbase.** The file names players and does not picture
 * them, so the faces come from the CDN's id-keyed pool
 * ([`playerPortraitUrl`](../../api/cdn.ts)), which answers for about four in
 * five and falls back to initials for the rest — the same arrangement the
 * pointcast [ranking](../ranking/PlayerRankingTab.tsx) rows use.
 *
 * A portrait is a **link to the player**, not a dialog: there is no
 * performance behind a predicted figure to break down, and the question a
 * predicted eleven raises about a name you do not recognise is who he is.
 */
export function ExpectedLineupPitch({
  sides,
  leagueId,
  orientation,
  className,
  children,
}: {
  /** One club, or two — the second is drawn facing the first. */
  sides: ExpectedSide[]
  leagueId: string
  orientation: PitchOrientation
  className?: string
  /** Drawn over the grass: the full-screen corner button, a banner. */
  children?: ReactNode
}) {
  const { ref, box } = usePitchBox()
  const isHeadToHead = sides.length > 1
  const rows = isHeadToHead ? ROW_ORDER.length * 2 : ROW_ORDER.length

  /**
   * The busiest band across **both** halves — five defenders on either side
   * constrains the whole pitch, since every card is drawn at one size.
   */
  const metrics = useMemo(() => {
    const bandSizes = sides.flatMap((side) =>
      ROW_ORDER.map((position) => countAt(side.lineup.starters, position)),
    )
    return fitPitchMetrics(box, Math.max(1, ...bandSizes), {
      rows,
      plate: 'named',
      orientation,
    })
  }, [box, sides, rows, orientation])

  /*
   * Head to head, the two halves face each other: the first club runs keeper →
   * defence → midfield → attack downwards and the second runs the usual way
   * up, so the two attacks meet at the halfway line. A lone eleven takes
   * `singleTeamOrder`, which keeps the keeper at the bottom on a phone and at
   * the far left on a wide screen — the way a formation is written down.
   */
  const bands = isHeadToHead
    ? [
        { side: sides[0] as ExpectedSide, order: ROW_ORDER_MIRRORED, key: 'a' },
        { side: sides[1] as ExpectedSide, order: ROW_ORDER, key: 'b' },
      ]
    : [
        {
          side: sides[0] as ExpectedSide,
          order: singleTeamOrder(orientation),
          key: 'a',
        },
      ]

  return (
    <Pitch
      orientation={orientation}
      className={cn(isHeadToHead ? 'min-h-[34rem]' : 'min-h-80', className)}
    >
      {sides.map((side, index) => (
        <SideLabel
          key={side.lineup.teamId}
          side={side}
          /* A lone eleven keeps the first corner; two share the pair the
             orientation lays out. */
          className={SIDE_LABEL_CLASS[orientation][index === 0 ? 0 : 1]}
        />
      ))}

      {children}

      <div
        ref={ref}
        className={cn(
          'grid min-h-0 min-w-0 flex-1 px-2 py-3',
          pitchGridClass(rows, orientation),
        )}
      >
        {bands.flatMap(({ side, order, key }) =>
          order.map((position) => (
            <PitchBand
              key={`${key}-${position}`}
              players={side.lineup.starters.filter(
                (player) => player.position === position,
              )}
              metrics={metrics}
              leagueId={leagueId}
              orientation={orientation}
            />
          )),
        )}
      </div>
    </Pitch>
  )
}

function countAt(players: ExpectedPlayer[], position: PositionKey): number {
  return players.filter((player) => player.position === position).length
}

/** One position's players, side by side — or stacked, on a landscape pitch. */
function PitchBand({
  players,
  metrics,
  leagueId,
  orientation,
}: {
  players: ExpectedPlayer[]
  metrics: PlayerMetrics
  leagueId: string
  orientation: PitchOrientation
}) {
  return (
    <div className={PITCH_BAND_CLASS[orientation]}>
      {players.map((player) => (
        <PitchPlayer
          key={player.id}
          player={player}
          metrics={metrics}
          leagueId={leagueId}
        />
      ))}
    </div>
  )
}

/** A portrait, its name-and-probability plate, and the two corner marks. */
function PitchPlayer({
  player,
  metrics,
  leagueId,
}: {
  player: ExpectedPlayer
  metrics: PlayerMetrics
  leagueId: string
}) {
  const label = expectedPlayerLabel(player)
  const status = expectedStatusCode(player.status)
  const badge = cornerBadgeSize(metrics.avatar)

  return (
    <Link
      to={`/leagues/${leagueId}/players/${player.id}`}
      title={label}
      aria-label={label}
      style={{ width: metrics.width }}
      className={cn(
        'flex shrink-0 flex-col items-center rounded-lg p-1 transition-colors',
        'hover:bg-black/20 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
      )}
    >
      <span className="relative">
        <Avatar
          src={playerPortraitUrl(player.id)}
          name={player.name}
          size={metrics.avatar}
          className={cn('ring-2', TIER_RING_CLASS[player.tier])}
        />

        {/* Top-left, the corner the squad's own pitch gives availability, and
            the one the eye sweeps first down a band. */}
        <PlayerStatusBadge
          status={status}
          reason={
            player.status === undefined
              ? undefined
              : EXPECTED_STATUS_LABEL[player.status]
          }
          size={badge}
          onImage
          className="absolute -top-0.5 -left-0.5"
        />

        <ExpectedTierBadge
          tier={player.tier}
          size={badge}
          onImage
          className="absolute -top-0.5 -right-0.5"
        />
      </span>

      <span
        aria-hidden="true"
        style={{
          width: metrics.plateWidth,
          marginTop: -metrics.plateOverlap,
          fontSize: metrics.nameFontSize,
        }}
        className="relative flex flex-col items-center rounded bg-black/70 px-0.5 py-0.5 leading-tight"
      >
        <span className="max-w-full truncate font-semibold text-white">
          {player.name}
        </span>
        {/* Where a real sheet puts points. Dimmed, because it is a probability
            and not a score — and `nums` so a band of them lines up. */}
        <span className="nums max-w-full truncate font-bold text-white/70">
          {chance(player.startChance)}
        </span>
      </span>
    </Link>
  )
}

/**
 * Whose half this is, in the corner — crest, short name and the **formation**
 * the run drew.
 *
 * The formation is the one figure that belongs to the eleven as a whole rather
 * than to anyone in it, and on a head-to-head pitch it is what the two corners
 * are being compared on. The real [match pitch](../matchday/MatchLineupTab.tsx)
 * puts the club's points here; a predicted sheet has no points, and a shape is
 * what it does have to say.
 */
function SideLabel({
  side,
  className,
}: {
  side: ExpectedSide
  className: string
}) {
  const name = side.name ?? side.lineup.teamName ?? side.symbol ?? '—'
  const short = side.symbol ?? side.lineup.teamName ?? name
  const label =
    side.lineup.formation === ''
      ? `${name}: voraussichtliche Aufstellung`
      : `${name}: voraussichtlich ${side.lineup.formation}`

  return (
    <span
      title={label}
      className={cn(
        'absolute z-10 flex items-center gap-1.5 rounded-full bg-black/45 px-1.5 py-0.5 backdrop-blur-sm',
        className,
      )}
    >
      <Avatar
        src={side.image}
        name={short}
        size={16}
        square
        className="bg-transparent"
      />
      <span
        aria-hidden="true"
        className="max-w-32 truncate text-[0.625rem] font-semibold text-white"
      >
        {short}
      </span>
      {side.lineup.formation !== '' && (
        <span
          aria-hidden="true"
          className="nums shrink-0 text-[0.6875rem] font-bold text-white/80"
        >
          {side.lineup.formation}
        </span>
      )}
      <span className="sr-only">{label}</span>
    </span>
  )
}
