import { useMemo } from 'react'
import { Link } from 'react-router'

import {
  MATCH_EVENT_LABEL,
  MATCH_ROLE_LABEL,
  type MatchLineup,
  type MatchPlayer,
  type PlayerFigure,
  type PositionKey,
} from '@/api/models'
import { OwnerBadge } from '@/components/matchday/OwnerBadge'
import { matchPlayerFigure } from '@/components/matchday/matchPlayerFigure'
import { ownerLabel } from '@/components/matchday/ownerLabel'
import {
  figureDescription,
  figureLabel,
  isScore,
} from '@/components/player/playerFigure'
import { MatchRoleMark, SwapMark } from '@/components/player/statGlyphs'
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
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { points } from '@/lib/format'

/** Which half of the pitch a team is drawn on. */
type Side = 'home' | 'away'

/**
 * Home keeps the white ring the app's other pitches use; away takes the
 * accent, so a portrait says which side it belongs to without being read.
 */
const RING_CLASS: Record<Side, string> = {
  home: 'ring-white/75',
  away: 'ring-accent/80',
}

/**
 * Which arrow a portrait carries, if any — and it is **one or the other,
 * never both**, because the two arrangements
 * [`useMatchLineup`](../../api/hooks/useMatchLineup.ts) picks between put
 * different men on the grass.
 *
 * While the match runs the pitch is who is *on* it, so nobody there has left
 * and the only swap a portrait can show is an arrival. Before and after, the
 * pitch is the eleven the club *named*, so the arrivals are on the bench and
 * the only swap a portrait can show is a departure — the starter who was
 * replaced, standing where his club put him with a red arrow saying when that
 * ended.
 */
function pitchSwap(player: MatchPlayer): 'in' | 'out' | undefined {
  if (player.role === undefined) return undefined
  return player.role === 'substitutedIn' ? 'in' : 'out'
}

/**
 * Everything a portrait shows and everything it cannot: the name, the score,
 * who owns him, what he did, and whether he was swapped.
 *
 * A portrait is a photograph, a number and a small second photograph — which is
 * as much as twenty-two of them can carry and less than a reader occasionally
 * wants. So the full sentence is the tooltip *and* the accessible name, which
 * is the one place the width is free. It is also where `MatchPlayer.events`
 * earns its keep: the glyphs have no room on the grass, and this is the reader
 * who is asking.
 */
function playerLabel(player: MatchPlayer, figure: PlayerFigure): string {
  const parts = [`${player.name}: ${figureDescription(figure)}`]

  // The same sentence the badge's own tooltip carries, so the two cannot say
  // different things about the same player.
  if (player.owner !== undefined) parts.push(ownerLabel(player.owner))
  for (const event of player.events ?? []) {
    parts.push(
      event.count > 1
        ? `${MATCH_EVENT_LABEL[event.kind]} ×${String(event.count)}`
        : MATCH_EVENT_LABEL[event.kind],
    )
  }
  if (player.role !== undefined) parts.push(MATCH_ROLE_LABEL[player.role])

  return parts.join(' · ')
}

/**
 * Both team sheets on **one pitch, facing each other** — the arrangement the
 * [duel](../duels/DuelLineupTab.tsx) uses, for the same reason: two elevens
 * stacked as lists lose the shape of a fixture, and the shape is most of what a
 * lineup is for.
 *
 * **Eight bands, not four.** The home half runs keeper → defence → midfield →
 * attack downwards ({@link ROW_ORDER_MIRRORED}) and the away half runs the
 * usual way up ({@link ROW_ORDER}), so the two attacks meet at the halfway
 * line. The card sizing has to be told there are eight of them or every
 * portrait is budgeted twice the height it has.
 *
 * Each portrait carries three things and no more:
 *
 *  - the **points** the player has scored this matchday, on the plate — the one
 *    number that changes, and `–` rather than `0` while it is unknown, because
 *    a match that has not kicked off is not a blank performance;
 *  - the **owning manager**, as an [`OwnerBadge`](./OwnerBadge.tsx) in the
 *    corner — the whole reason this screen exists rather than a link to
 *    kicker.de;
 *  - a **swap arrow** in the other corner, green or red, when the match's event
 *    feed says he was substituted — see {@link pitchSwap}.
 *
 * **While the match is running, the pitch follows the substitutions.** A player
 * taken off drops to the bottom of his club's bench and the man who replaced
 * him takes a place in the band his position calls for — so the eleven drawn on
 * the grass is the eleven currently on it, which is the question a live lineup
 * is opened to answer.
 *
 * **Before and after, it does not.** A settled match is a record of the team
 * sheet the club named, and rearranging that is not a fresher answer but a
 * wrong one — nobody ever picked the eleven a rearranged pitch would draw. So
 * the grass keeps the named eleven, the substitutes who came on move to the
 * **top of the bench in the order they came on**, and the two ends of each
 * substitution are visible in the place each belongs: the man replaced on the
 * pitch with a red arrow, the man who replaced him at the head of the column.
 *
 * Either way the arranging happens once, in
 * [`useMatchLineup`](../../api/hooks/useMatchLineup.ts), so the bench columns
 * and the [ranking](./MatchRankingTab.tsx) cannot disagree with the pitch.
 *
 * No names, and **no event badges**. At twenty-two portraits on a phone a name
 * under each is unreadable and a row of badges beside a 30px avatar is worse;
 * the tooltip and accessible label carry the name, the points and what the
 * player did, and the [timeline](./MatchTimelineTab.tsx) is the tab where an
 * event gets a full row. The **substitutes** underneath do get names, because a
 * row has the width for one.
 *
 * A portrait is a link to the player's own page, where the per-match detail
 * lives. The players the pitch cannot place — no `pos` on the match payload and
 * no detail response yet — are counted under it rather than dropped silently or
 * defaulted into midfield.
 */
export function MatchLineupTab({
  home,
  away,
  leagueId,
  isPointsPending,
}: {
  home: MatchLineup
  away: MatchLineup
  leagueId: string
  /** Points or owners still arriving; the pitch renders without them. */
  isPointsPending: boolean
}) {
  const { ref, box } = usePitchBox()

  /**
   * The busiest band across **both** halves — five defenders on either side
   * constrains the whole pitch, since every card is drawn at one size.
   */
  const metrics = useMemo(() => {
    const bandSizes = [
      ...ROW_ORDER_MIRRORED.map((position) => countAt(home.starters, position)),
      ...ROW_ORDER.map((position) => countAt(away.starters, position)),
    ]
    return fitPitchMetrics(box, Math.max(1, ...bandSizes), {
      rows: ROW_ORDER.length * 2,
      plate: 'points',
    })
  }, [box, home.starters, away.starters])

  const unplaced = [...home.starters, ...away.starters].filter(
    (player) => player.position === undefined,
  ).length

  const hasLineups = home.starters.length > 0 || away.starters.length > 0

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* `min-h-0 flex-1` so the pitch claims whatever height the page has
          left after the benches rather than sitting at its floor on a desktop.
          The `min-h-[30rem]` floor is what keeps eight bands legible on a
          phone: below that the page scrolls instead of the cards shrinking. */}
      <Pitch className="min-h-[30rem] flex-1">
        <SideLabel lineup={home} side="home" />

        <div ref={ref} className="grid min-h-0 flex-1 grid-rows-8 px-2 py-3">
          {hasLineups ? (
            <>
              {ROW_ORDER_MIRRORED.map((position) => (
                <PitchBand
                  key={`home-${position}`}
                  players={home.starters.filter((p) => p.position === position)}
                  metrics={metrics}
                  side="home"
                  leagueId={leagueId}
                />
              ))}
              {ROW_ORDER.map((position) => (
                <PitchBand
                  key={`away-${position}`}
                  players={away.starters.filter((p) => p.position === position)}
                  metrics={metrics}
                  side="away"
                  leagueId={leagueId}
                />
              ))}
            </>
          ) : (
            /* Kickbase publishes the team sheets around an hour before
               kick-off. Until then the payload's lineup arrays are simply
               empty — not an error, and not a team of nobody. */
            <p className="row-span-8 flex items-center justify-center px-6 text-center text-sm font-medium text-white/80">
              Die Aufstellungen sind noch nicht veröffentlicht.
            </p>
          )}
        </div>

        <SideLabel lineup={away} side="away" />
      </Pitch>

      {(isPointsPending || unplaced > 0) && (
        <p className="flex items-center gap-2 px-0.5 text-xs text-muted">
          {isPointsPending && <Spinner size={12} />}
          {isPointsPending && <span>Punkte werden geladen …</span>}
          {unplaced > 0 && (
            <span>
              {unplaced === 1
                ? '1 Spieler ohne Position wird nicht auf dem Feld gezeigt'
                : `${String(unplaced)} Spieler ohne Position werden nicht auf dem Feld gezeigt`}
            </span>
          )}
        </p>
      )}

      {/* Two columns, home left and away right — the arrangement the header's
          scoreline establishes. The pitch has to stack the teams to make them
          face each other, and the corner labels bridge the two. */}
      <div className="grid grid-cols-2 gap-2">
        <BenchColumn lineup={home} side="home" leagueId={leagueId} />
        <BenchColumn lineup={away} side="away" leagueId={leagueId} />
      </div>
    </div>
  )
}

function countAt(players: MatchPlayer[], position: PositionKey): number {
  return players.filter((player) => player.position === position).length
}

/** One position's players, side by side. */
function PitchBand({
  players,
  metrics,
  side,
  leagueId,
}: {
  players: MatchPlayer[]
  metrics: PlayerMetrics
  side: Side
  leagueId: string
}) {
  return (
    /* `flex-nowrap` + `overflow-hidden` for the reason the squad's pitch
       documents at length: wrapping turns width pressure into height, which
       feeds back into the sizing and oscillates. The fit already guarantees the
       busiest band fits, so clipping is a backstop. */
    <div className="flex min-h-0 flex-nowrap items-center justify-center gap-1 overflow-hidden">
      {players.map((player) => (
        <PitchPlayer
          key={player.id}
          player={player}
          metrics={metrics}
          side={side}
          leagueId={leagueId}
        />
      ))}
    </div>
  )
}

/**
 * A portrait, its points plate, and the badge saying who owns him.
 *
 * The owner badge takes the **top-left** corner, which is where the squad
 * page's pitch puts its availability mark — the corner that reads most easily
 * against the grass, and the one the eye sweeps first down a band.
 */
function PitchPlayer({
  player,
  metrics,
  side,
  leagueId,
}: {
  player: MatchPlayer
  metrics: PlayerMetrics
  side: Side
  leagueId: string
}) {
  const figure = matchPlayerFigure(player)
  const owned = player.owner
  const label = playerLabel(player, figure)
  const swap = pitchSwap(player)

  return (
    <Link
      to={`/leagues/${leagueId}/players/${player.id}`}
      title={label}
      aria-label={label}
      style={{ width: metrics.width }}
      className="flex shrink-0 flex-col items-center rounded-lg p-1 transition-colors hover:bg-black/20"
    >
      <span className="relative">
        <Avatar
          src={player.image}
          name={player.name}
          size={metrics.avatar}
          className={cn('ring-2', RING_CLASS[side])}
        />
        {owned !== undefined && (
          <OwnerBadge
            owner={owned}
            size={cornerBadgeSize(metrics.avatar)}
            onImage
            className="absolute -top-0.5 -left-0.5"
          />
        )}
        {/* Top-*right*, the corner the owner badge left free. Either way it
            qualifies his number: green, he came on, so it was scored in part of
            a match and is still climbing; red, he was taken off, so it stopped
            climbing when he walked. The mark is the app's shared `SwapMark`, so
            an arrow means the same here as on a bench row. */}
        {swap !== undefined && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full bg-black/75 p-0.5"
          >
            <SwapMark
              direction={swap}
              size={Math.round(cornerBadgeSize(metrics.avatar) * 0.7)}
            />
          </span>
        )}
      </span>

      <span
        aria-hidden="true"
        style={{
          width: metrics.plateWidth,
          marginTop: -metrics.plateOverlap,
          fontSize: metrics.nameFontSize,
        }}
        className={cn(
          'nums relative truncate rounded bg-black/70 px-1 text-center font-bold',
          isScore(figure) ? 'text-white' : 'text-white/55',
        )}
      >
        {figureLabel(figure)}
      </span>
    </Link>
  )
}

/**
 * Whose half this is, in the corner of the pitch — crest, symbol, and **what
 * the club's players scored in this match**.
 *
 * The total is the sum of every known figure in that team sheet, substitutes
 * included: a player who came on and scored did so for this club, and one who
 * never left the bench contributes nothing because his points are `undefined`
 * rather than `0`. So it climbs as the fan-out lands and settles at the club's
 * real Kickbase yield for the match — which is the number that says *where the
 * points in this fixture were*, and the reason to open a match at all rather
 * than read the score off the list.
 *
 * The corner used to carry the **formation** (`ts1`/`ts2`, e.g. `4-2-3-1`).
 * That went: it reads as a date at 10px, and the shape of the bands underneath
 * is a rough answer to the same question — while nothing else on the screen
 * added up the two teams.
 *
 * Absolutely positioned so it costs the bands no height: the pitch is the
 * scarcest space on the page and eight bands are already tight.
 */
function SideLabel({ lineup, side }: { lineup: MatchLineup; side: Side }) {
  const total = teamPoints(lineup)
  const name = lineup.team.name ?? lineup.team.symbol
  const label =
    total === undefined
      ? `${name}: noch keine Punkte`
      : `${name}: ${points(total)} Punkte in diesem Spiel`

  return (
    <span
      title={label}
      className={cn(
        'absolute z-10 flex items-center gap-1.5 rounded-full bg-black/45 px-1.5 py-0.5 backdrop-blur-sm',
        side === 'home' ? 'top-1 left-1' : 'bottom-1 left-1',
      )}
    >
      <Avatar
        src={lineup.team.image}
        name={lineup.team.symbol}
        size={16}
        square
        className="bg-transparent"
      />
      <span
        aria-hidden="true"
        className="max-w-32 truncate text-[0.625rem] font-semibold text-white"
      >
        {lineup.team.symbol}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'nums shrink-0 text-[0.6875rem] font-bold',
          total === undefined ? 'text-white/55' : 'text-white',
        )}
      >
        {points(total)}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  )
}

/**
 * What a club's players scored in this match, or `undefined` when not one of
 * them has a figure yet.
 *
 * `undefined` rather than `0`, for the reason the model's `points` is optional:
 * before kick-off nobody has scored *nothing*, they have scored *not yet*, and
 * a corner reading `0` over a team about to play would be a claim.
 */
function teamPoints(lineup: MatchLineup): number | undefined {
  let total: number | undefined

  for (const player of [...lineup.starters, ...lineup.substitutes]) {
    if (player.points === undefined) continue
    total = (total ?? 0) + player.points
  }

  return total
}

/**
 * One club's substitutes, as a **column** beside the other's.
 *
 * The real bench, not a Kickbase one — the players the club named in its squad
 * rather than in its eleven. **What the order says depends on the match.**
 * While it runs the column is who is *not on the pitch*: the ones who never
 * came on, and at the bottom the ones who have been taken off. Once it is over
 * — or before it starts — the column is the club's own bench with the players
 * who came on lifted to the **top, earliest first**, so it reads down the
 * afternoon.
 *
 * Either way it is worth the space: a manager's own player among these rows is
 * the answer to "why did he score nothing", and a row with an arrow carries a
 * figure that means something other than a full match.
 *
 * Rows rather than portraits, so each gets a name — and stacked rather than a
 * sideways-scrolling strip, because two benches side by side are meant to be
 * compared: rows at matching heights read against each other and nothing hides
 * off the edge waiting to be swiped into view.
 *
 * A row carries the **owning manager too**, and as its own inline avatar rather
 * than a badge stuck on a 24px portrait: an owned substitute is one of the more
 * interesting things on this screen, and at that size a corner badge is 12px of
 * unreadable mush.
 */
function BenchColumn({
  lineup,
  side,
  leagueId,
}: {
  lineup: MatchLineup
  side: Side
  leagueId: string
}) {
  return (
    <section className="flex min-w-0 flex-col gap-1.5">
      <h3 className="flex min-w-0 items-center gap-1.5 px-0.5 text-[0.625rem] font-semibold tracking-wider text-faint uppercase">
        <Avatar
          src={lineup.team.image}
          name={lineup.team.symbol}
          size={14}
          square
          className="bg-transparent"
        />
        <span className="truncate">Bank</span>
      </h3>

      {lineup.substitutes.length === 0 ? (
        <p className="rounded-card border border-line bg-surface px-2 py-3 text-center text-[0.6875rem] text-muted">
          Keine Ersatzspieler gemeldet
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {lineup.substitutes.map((player) => (
            <BenchRow
              key={player.id}
              player={player}
              side={side}
              leagueId={leagueId}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function BenchRow({
  player,
  side,
  leagueId,
}: {
  player: MatchPlayer
  side: Side
  leagueId: string
}) {
  const figure = matchPlayerFigure(player)

  return (
    <li>
      <Link
        to={`/leagues/${leagueId}/players/${player.id}`}
        title={playerLabel(player, figure)}
        className={cn(
          'flex items-center gap-1.5 rounded-lg border border-line bg-surface px-1.5 py-1',
          'transition-colors hover:bg-surface-2',
          // Dimmed as a set: the heading says what they are, and a player who
          // actually came on has an arrow that should not be dimmed with them.
          player.role === undefined && 'opacity-75',
        )}
      >
        <Avatar
          src={player.image}
          name={player.name}
          size={24}
          className={cn('shrink-0 ring-1', RING_CLASS[side])}
        />

        <span className="min-w-0 flex-1 truncate text-[0.6875rem] font-medium text-ink">
          {player.name}
        </span>

        {/* The owner **inline**, not as a corner badge on the portrait. On the
            grass a badge is the only option and 26px of it is legible; on a
            24px bench avatar the same badge is 12px of mush — which is exactly
            how the lineup-probability icon failed on the squad pitch. A row
            has room for a second avatar of its own, so it gets one. */}
        {player.owner !== undefined && (
          <OwnerBadge owner={player.owner} size={16} />
        )}

        {player.role !== undefined && <MatchRoleMark role={player.role} />}

        <span
          className={cn(
            'nums shrink-0 text-[0.6875rem] font-semibold',
            isScore(figure) ? 'text-ink' : 'text-faint',
          )}
        >
          {figureLabel(figure)}
        </span>
      </Link>
    </li>
  )
}
