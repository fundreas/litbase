import {
  ArrowDown,
  ArrowUp,
  Footprints,
  Hand,
  ShieldCheck,
  Volleyball,
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

/** Only the roles that are a word rather than an arrow. */
const ROLE_TEXT: Partial<Record<PlayerMatchRole, string>> = {
  // A player taken off still started, and that is the half worth spelling out
  // — the arrow beside it says the rest.
  started: MATCH_ROLE_LABEL.started,
  substitutedOff: MATCH_ROLE_LABEL.started,
  injured: MATCH_ROLE_LABEL.injured,
  didNotPlay: MATCH_ROLE_LABEL.didNotPlay,
}

const ROLE_TEXT_CLASS: Partial<Record<PlayerMatchRole, string>> = {
  injured: 'text-negative',
}

/**
 * Where the player was, as football writes it: **an up arrow for coming on and
 * a down arrow for going off**, not the words.
 *
 * "Ausgewechselt" is thirteen characters on a row that also has to hold an
 * opponent, a scoreline, minutes, event badges and a points total — on a phone
 * it pushed the badges off the end. The arrows are the notation every match
 * report and every scoreboard already uses, they survive at 11px, and they
 * compose: a player who came on and went off again gets both, which no single
 * word does without becoming longer still.
 *
 * The full wording stays in the accessible name and the tooltip, so nothing is
 * lost to a screen reader or to anyone unsure what an arrow means.
 */
export function MatchRoleMark({
  role,
  className,
}: {
  role: PlayerMatchRole
  className?: string
}) {
  const text = ROLE_TEXT[role]
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
