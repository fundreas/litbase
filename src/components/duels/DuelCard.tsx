import { ChevronRight, CircleCheck, Swords } from 'lucide-react'
import { Link } from 'react-router'

import type { MatchdayPlayerCount } from '@/api/hooks/useMatchdayPlayerCounts'
import { duelLeader, type Duel, type DuelSide } from '@/api/models'
import { ManagerAvatar } from '@/components/manager/ManagerAvatar'
import { cn } from '@/lib/cn'
import { placement, points } from '@/lib/format'

/**
 * One head-to-head, as two mirrored halves around a divider.
 *
 * Mirroring — avatar outside, text turned to face the middle — is what makes
 * the card read as a duel rather than as two list rows that happen to share a
 * border. Both names truncate, because a phone at 360px leaves roughly 110px
 * per side and manager names are not short.
 *
 * The subtitle is the whole point of the card and switches on whether the
 * matchday has kicked off: points once it has (live while it runs), the
 * manager's standing before that, when every score is still `0` and printing
 * "0 Pkt" ten times would say nothing.
 *
 * While the matchday is being played a third line appears under the score,
 * saying how many of that manager's players are on the pitch and how many have
 * yet to kick off — see {@link Side}.
 */
export function DuelCard({
  duel,
  to,
  hasStarted,
  isFinished,
  viewerId,
  playerCounts,
}: {
  duel: Duel
  /** Detail route for this duel, matchday included. */
  to: string
  hasStarted: boolean
  isFinished: boolean
  viewerId?: string
  /**
   * Fielded players on the pitch and still to kick off, per manager id. Empty
   * unless the matchday is live; a manager whose squad has not loaded is
   * absent from it.
   */
  playerCounts?: Map<string, MatchdayPlayerCount>
}) {
  // Before kick-off both sides are level at zero, so there is no leader to
  // mark — only a started matchday can have one.
  const leader = hasStarted ? duelLeader(duel) : undefined
  const isMine = duel.sides.some((side) => side.id === viewerId)

  return (
    <li>
      {/* The whole card is the link, not a chevron in the corner: a duel row
          on a phone is a big target and every part of it means "this duel". */}
      <Link
        to={to}
        aria-label={`Duell ${duel.sides[0].name} gegen ${duel.sides[1].name}`}
        className={cn(
          'flex items-center gap-2 rounded-card border bg-surface px-3 py-3',
          'transition-colors hover:bg-surface-2',
          isMine ? 'border-accent/50' : 'border-line',
        )}
      >
        <Side
          side={duel.sides[0]}
          align="left"
          hasStarted={hasStarted}
          isFinished={isFinished}
          isLeader={leader?.id === duel.sides[0].id}
          isViewer={duel.sides[0].id === viewerId}
          count={playerCounts?.get(duel.sides[0].id)}
        />

        <Swords
          size={15}
          aria-hidden="true"
          className={cn(
            'shrink-0',
            hasStarted && !isFinished ? 'text-accent' : 'text-faint',
          )}
        />

        <Side
          side={duel.sides[1]}
          align="right"
          hasStarted={hasStarted}
          isFinished={isFinished}
          isLeader={leader?.id === duel.sides[1].id}
          isViewer={duel.sides[1].id === viewerId}
          count={playerCounts?.get(duel.sides[1].id)}
        />

        <ChevronRight size={16} className="-mr-1 shrink-0 text-faint" />
      </Link>
    </li>
  )
}

/**
 * One manager's half of the card.
 *
 * **The player count is the third line**, and only ever appears while the
 * matchday is being played and this manager has somebody left in it. It
 * answers the question a live duel list raises and the score alone cannot: 40
 * points behind with eight players on the pitch is not the same position as 40
 * behind with none, and 40 behind with four clubs still to kick off is a third
 * thing again. Managers with nothing of either get nothing rather than a pair
 * of zeroes — the line is news, and a row of noughts is noise.
 *
 * It sits *under* the points rather than beside them: at 360px a card leaves
 * roughly 86px per side after the 44px avatar, and "978 Pkt · 8 im Einsatz"
 * does not fit in it. See {@link PlayerCountLine} for what does.
 */
function Side({
  side,
  align,
  hasStarted,
  isFinished,
  isLeader,
  isViewer,
  count,
}: {
  side: DuelSide
  align: 'left' | 'right'
  hasStarted: boolean
  isFinished: boolean
  isLeader: boolean
  isViewer: boolean
  /** Playing and still to come. Absent while unknown or outside a live day. */
  count?: MatchdayPlayerCount
}) {
  const isRight = align === 'right'

  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 items-center gap-2.5',
        isRight && 'flex-row-reverse',
      )}
    >
      <ManagerAvatar manager={side} size={44} />
      <div className={cn('min-w-0 flex-1', isRight && 'text-right')}>
        <p className="truncate text-sm font-semibold text-ink">
          {side.name}
          {isViewer && <span className="ml-1.5 text-xs text-accent">du</span>}
        </p>
        <Subtitle
          side={side}
          isRight={isRight}
          hasStarted={hasStarted}
          isFinished={isFinished}
          isLeader={isLeader}
        />
        <PlayerCountLine count={count} isRight={isRight} />
      </div>
    </div>
  )
}

/**
 * **`● 3 · 4 offen`** — what this manager still has in a matchday being played.
 *
 * Two numbers in about 86px, which is the whole design problem. The pulsing
 * accent dot is what says *playing*, so the count beside it needs no word; the
 * open count keeps one, because nothing else on the card would say what it is.
 * The words come back when a number is alone on the line and can afford them:
 *
 * | What is true | The line |
 * | ------------ | -------- |
 * | Some playing, some to come | `● 3 · 4 offen` |
 * | Some playing, nothing left | `● 3 im Einsatz` |
 * | Nothing playing, some to come | `4 offen` |
 * | Neither | nothing at all |
 *
 * **Finished players are not counted.** They are already in the score above,
 * and a third number for them would be the one figure on the card that says
 * nothing the figure above it does not.
 *
 * The dot **pulses only while somebody is actually on a pitch**, which is the
 * half of this that is genuinely live; between the Saturday blocks the line is
 * a quiet `4 offen`. Colour carries nothing on its own — the accent marks the
 * playing count and the muted grey the open one, and the sr-only sentence
 * underneath spells both out, because two numbers and a dot are not a sentence.
 *
 * Mirrored with the rest of the half: on the right-hand side the row reverses,
 * so the dot stays on the outside edge where the eye arrives.
 */
function PlayerCountLine({
  count,
  isRight,
}: {
  count: MatchdayPlayerCount | undefined
  isRight: boolean
}) {
  if (count === undefined) return null
  const { playing, open } = count
  if (playing === 0 && open === 0) return null

  const spoken = [
    playing > 0 ? `${String(playing)} Spieler in laufenden Spielen` : undefined,
    open > 0 ? `${String(open)} Spieler noch nicht angepfiffen` : undefined,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <p
      title={spoken}
      className={cn(
        'flex items-center gap-1 text-[0.6875rem]',
        isRight && 'flex-row-reverse',
      )}
    >
      {playing > 0 && (
        <>
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent"
          />
          <span aria-hidden="true" className="nums shrink-0 text-accent">
            {playing}
            {open === 0 && ' im Einsatz'}
          </span>
        </>
      )}
      {playing > 0 && open > 0 && (
        <span aria-hidden="true" className="shrink-0 text-faint">
          ·
        </span>
      )}
      {open > 0 && (
        <span aria-hidden="true" className="nums truncate text-muted">
          {open} offen
        </span>
      )}
      <span className="sr-only">{spoken}</span>
    </p>
  )
}

/**
 * Points once the matchday is under way, standing before it.
 *
 * The leader is marked by weight *and* — once the matchday is over — a check
 * icon, never by colour alone: the ranking page settled that colour is not a
 * cue everyone gets. What the emphasis means is spelled out for screen
 * readers, which otherwise get a bare number and no way to tell who is ahead.
 */
function Subtitle({
  side,
  isRight,
  hasStarted,
  isFinished,
  isLeader,
}: {
  side: DuelSide
  isRight: boolean
  hasStarted: boolean
  isFinished: boolean
  isLeader: boolean
}) {
  if (!hasStarted) {
    return (
      <p className="nums truncate text-xs text-muted">
        {placement(side.duelPlacement ?? side.seasonPlacement)} Platz
      </p>
    )
  }

  return (
    <p
      className={cn(
        'flex items-center gap-1 text-xs',
        isRight && 'flex-row-reverse',
        isLeader ? 'font-semibold text-ink' : 'text-muted',
      )}
    >
      {isLeader && isFinished && (
        <CircleCheck
          size={13}
          aria-hidden="true"
          className="shrink-0 text-positive"
        />
      )}
      <span className="nums truncate">{points(side.matchdayPoints)} Pkt</span>
      {isLeader && (
        <span className="sr-only">
          {isFinished ? '– gewonnen' : '– in Führung'}
        </span>
      )}
    </p>
  )
}
