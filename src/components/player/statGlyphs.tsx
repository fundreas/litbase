import {
  ArrowDown,
  ArrowUp,
  Footprints,
  Hand,
  ShieldCheck,
  Volleyball,
  X,
} from 'lucide-react'

import {
  MATCH_ROLE_LABEL,
  type MatchEventKind,
  type PlayerMatchRole,
} from '@/api/models'
import { cn } from '@/lib/cn'

/**
 * One mark per thing that can happen to a player, used **everywhere** that
 * thing is counted — the match rows, the badges on them, and the season grid.
 *
 * Sharing the marks is the point. A reader who learns that a ball means a goal
 * on a match row should not have to learn a second symbol for the same idea
 * three cards further down, and a season total that disagreed visually with
 * the rows it sums would read as a different statistic.
 *
 * Cards are literal rectangles rather than icons: a yellow card *is* a yellow
 * rectangle, and no icon reads faster than the thing itself. Gelb-Rot is drawn
 * as the two halves it is, so it cannot be mistaken for either card alone.
 * Everything else is a lucide glyph, which keeps the stroke crisp at 11px and
 * lets the colour come from a theme token.
 */
export function CardGlyph({
  tone,
  size = 14,
  className,
}: {
  tone: 'yellow' | 'red' | 'split'
  size?: number
  className?: string
}) {
  const style = { width: Math.round(size * 0.72), height: size }

  if (tone === 'split') {
    return (
      <span
        style={style}
        className={cn('flex overflow-hidden rounded-[2px]', className)}
      >
        <span className="h-full w-1/2 bg-warning" />
        <span className="h-full w-1/2 bg-negative" />
      </span>
    )
  }

  return (
    <span
      style={style}
      className={cn(
        'inline-block rounded-[2px]',
        tone === 'yellow' ? 'bg-warning' : 'bg-negative',
        className,
      )}
    />
  )
}

/**
 * The mark for one kind of match event, at whatever size the caller needs.
 *
 * Substitutions are absent on purpose: they say where a player was, not what
 * he did, and the role column already carries that. Adding them here would put
 * an arrow beside every second row.
 */
export function EventGlyph({
  kind,
  size = 14,
  className,
}: {
  kind: MatchEventKind
  size?: number
  className?: string
}) {
  switch (kind) {
    case 'goal':
      return (
        <Volleyball
          size={size}
          aria-hidden="true"
          className={cn('text-ink', className)}
        />
      )
    case 'ownGoal':
      return (
        <Volleyball
          size={size}
          aria-hidden="true"
          className={cn('text-negative', className)}
        />
      )
    case 'assist':
      return (
        <Footprints
          size={size}
          aria-hidden="true"
          className={cn('text-ink', className)}
        />
      )
    case 'penaltySaved':
      return (
        <Hand
          size={size}
          aria-hidden="true"
          className={cn('text-accent', className)}
        />
      )
    case 'cleanSheet':
      return (
        <ShieldCheck
          size={size}
          aria-hidden="true"
          className={cn('text-positive', className)}
        />
      )
    case 'yellowCard':
      return <CardGlyph tone="yellow" size={size} className={className} />
    case 'secondYellow':
      return <CardGlyph tone="split" size={size} className={className} />
    case 'redCard':
      return <CardGlyph tone="red" size={size} className={className} />
  }
}

/**
 * The only role still spelled out.
 *
 * *Nicht im Einsatz* became an ✕ and *Startelf* an `S11` chip, but an injury
 * is worth a word: it is the one non-appearance with a cause, and the cause is
 * why the reader is looking.
 */
const ROLE_TEXT: Partial<Record<PlayerMatchRole, string>> = {
  injured: MATCH_ROLE_LABEL.injured,
}

const ROLE_TEXT_CLASS: Partial<Record<PlayerMatchRole, string>> = {
  injured: 'text-negative',
}

/**
 * Where the player was, in marks rather than words: **`S11` for a start, an up
 * arrow for coming on, a down arrow for going off.**
 *
 * The row already holds an opponent, a scoreline, minutes, event badges and a
 * points total. "Startelf" and "Ausgewechselt" are nine and thirteen
 * characters, and on a phone they pushed the badges off the end.
 *
 * The arrows are the notation every match report and scoreboard already uses,
 * they survive at 11px, and they **compose** — a player who came on and went
 * off again gets both, which no single word manages without getting longer
 * still. `S11` is the same trick for the starting eleven: a chip, not prose,
 * and it sits happily beside a down arrow to say "started, then came off".
 *
 * **There is no bench mark, because there is no bench state in the data.**
 * `PLAYER_MATCH_STATUS.DID_NOT_PLAY` covers the unused substitute *and* the
 * player left out of the squad entirely, and nothing separates them: counting
 * a full roster's statuses per matchday — with each player's club resolved
 * from `pt` so nobody at an opposing club is miscounted — put `SUBSTITUTE +
 * DID_NOT_PLAY` at eleven players on seven of thirty-four matchdays, and a
 * Bundesliga bench holds nine. So the mark is a plain ✕, "did not feature",
 * which is true either way. An armchair here would tell the reader his striker
 * was among the substitutes on days he was not in the squad at all.
 *
 * The full wording stays in the accessible name and the tooltip, so nothing is
 * lost to a screen reader or to anyone meeting the marks for the first time.
 */
export function MatchRoleMark({
  role,
  className,
}: {
  role: PlayerMatchRole
  className?: string
}) {
  const text = ROLE_TEXT[role]
  // A player taken off still started, so he keeps the chip and gains an arrow.
  const started = role === 'started' || role === 'substitutedOff'
  const cameOn = role === 'substitutedIn' || role === 'substitutedInAndOff'
  const cameOff = role === 'substitutedOff' || role === 'substitutedInAndOff'

  return (
    <span
      title={MATCH_ROLE_LABEL[role]}
      className={cn(
        'flex shrink-0 items-center gap-0.5 font-medium',
        className,
      )}
    >
      {started && (
        <span
          aria-hidden="true"
          className={cn(
            'rounded border border-line bg-surface-2 px-1',
            'text-[0.625rem] leading-[1.5] font-bold text-muted',
          )}
        >
          S11
        </span>
      )}
      {role === 'didNotPlay' && (
        <X
          size={12}
          aria-hidden="true"
          className="shrink-0 stroke-[3] text-faint"
        />
      )}
      {text !== undefined && (
        <span className={ROLE_TEXT_CLASS[role] ?? 'text-faint'}>{text}</span>
      )}
      {cameOn && (
        <ArrowUp
          size={12}
          aria-hidden="true"
          className="shrink-0 stroke-[3] text-positive"
        />
      )}
      {cameOff && (
        <ArrowDown
          size={12}
          aria-hidden="true"
          className="shrink-0 stroke-[3] text-warning"
        />
      )}
      <span className="sr-only">{MATCH_ROLE_LABEL[role]}</span>
    </span>
  )
}
