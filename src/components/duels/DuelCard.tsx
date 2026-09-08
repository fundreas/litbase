import { ChevronRight, CircleCheck, Swords } from 'lucide-react'
import { Link } from 'react-router'

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
 * While a match is being played a third line appears under the score, saying
 * how many of that manager's players are on the pitch — see {@link Side}.
 */
export function DuelCard({
  duel,
  to,
  hasStarted,
  isFinished,
  viewerId,
  activePlayers,
}: {
  duel: Duel
  /** Detail route for this duel, matchday included. */
  to: string
  hasStarted: boolean
  isFinished: boolean
  viewerId?: string
  /**
   * Fielded players currently on the pitch, per manager id. Empty unless a
   * match is running; a manager whose squad has not loaded is absent from it.
   */
  activePlayers?: Map<string, number>
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
          activePlayers={activePlayers?.get(duel.sides[0].id)}
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
          activePlayers={activePlayers?.get(duel.sides[1].id)}
        />

        <ChevronRight size={16} className="-mr-1 shrink-0 text-faint" />
      </Link>
    </li>
  )
}

/**
 * One manager's half of the card.
 *
 * **`n im Einsatz` is the third line**, and only ever appears while a match is
 * being played and this manager has somebody in it. It answers the question a
 * live duel list raises and the score alone cannot: 40 points behind with
 * eight players still on the pitch is not the same position as 40 behind with
 * none. Managers with nobody playing get nothing rather than a `0` — the line
 * is news, and a row of zeroes is noise.
 *
 * It sits *under* the points rather than beside them: at 360px a card leaves
 * roughly 110px per side, and "978 Pkt · 8 im Einsatz" does not fit in it.
 */
function Side({
  side,
  align,
  hasStarted,
  isFinished,
  isLeader,
  isViewer,
  activePlayers,
}: {
  side: DuelSide
  align: 'left' | 'right'
  hasStarted: boolean
  isFinished: boolean
  isLeader: boolean
  isViewer: boolean
  /** On the pitch right now. Absent while unknown, `0` when nobody is. */
  activePlayers?: number
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
        {activePlayers !== undefined && activePlayers > 0 && (
          <p
            className={cn(
              'flex items-center gap-1 text-[0.6875rem] text-accent',
              isRight && 'flex-row-reverse',
            )}
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent"
            />
            <span aria-hidden="true" className="nums truncate">
              {activePlayers} im Einsatz
            </span>
            <span className="sr-only">
              {activePlayers} Spieler in laufenden Spielen
            </span>
          </p>
        )}
      </div>
    </div>
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
