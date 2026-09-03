import { Hand, Shield } from 'lucide-react'
import type { ReactNode } from 'react'

import {
  MATCH_EVENT_LABEL,
  type MatchEventKind,
  type MatchEventTally,
} from '@/api/models'
import { cn } from '@/lib/cn'

/**
 * How each event is drawn.
 *
 * Cards are literal rectangles rather than icons — a yellow card *is* a yellow
 * rectangle, and no icon reads faster than the thing itself. The goal is a
 * ball glyph, the assist a boot; both are text so they stay crisp at 14px,
 * where a stroked lucide icon turns to mush.
 *
 * Gelb-Rot is drawn as the two halves it is, so it is not mistaken for either
 * card on its own.
 */
const EVENT_STYLE: Record<
  MatchEventKind,
  { node: ReactNode; className: string }
> = {
  goal: { node: '⚽', className: 'bg-surface-2' },
  ownGoal: { node: '⚽', className: 'bg-negative/20 ring-1 ring-negative/50' },
  assist: { node: '👟', className: 'bg-surface-2' },
  penaltySaved: {
    node: <Hand size={11} aria-hidden="true" />,
    className: 'bg-accent/20 text-accent',
  },
  cleanSheet: {
    node: <Shield size={11} aria-hidden="true" />,
    className: 'bg-positive/20 text-positive',
  },
  yellowCard: { node: <Card tone="yellow" />, className: 'bg-transparent' },
  secondYellow: { node: <Card tone="split" />, className: 'bg-transparent' },
  redCard: { node: <Card tone="red" />, className: 'bg-transparent' },
}

/** A playing card rectangle, in the two colours football uses. */
function Card({ tone }: { tone: 'yellow' | 'red' | 'split' }) {
  if (tone === 'split') {
    return (
      <span className="flex h-3.5 w-2.5 overflow-hidden rounded-[2px]">
        <span className="h-full w-1/2 bg-warning" />
        <span className="h-full w-1/2 bg-negative" />
      </span>
    )
  }
  return (
    <span
      className={cn(
        'h-3.5 w-2.5 rounded-[2px]',
        tone === 'yellow' ? 'bg-warning' : 'bg-negative',
      )}
    />
  )
}

/**
 * One kind of event in one match, with a count when it happened more than
 * once.
 *
 * A two-goal game is one badge reading `⚽2`, not two badges — repeated
 * identical marks are harder to count at a glance than the number is to read,
 * and they push the rest of the row off a phone screen.
 */
export function MatchEventBadge({ event }: { event: MatchEventTally }) {
  const { node, className } = EVENT_STYLE[event.kind]
  const label =
    event.count > 1
      ? `${MATCH_EVENT_LABEL[event.kind]} ×${String(event.count)}`
      : MATCH_EVENT_LABEL[event.kind]

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-0.5 rounded px-1 text-[0.625rem] leading-none',
        className,
      )}
    >
      <span aria-hidden="true" className="flex items-center">
        {node}
      </span>
      {event.count > 1 && (
        <span aria-hidden="true" className="nums font-bold text-ink">
          {event.count}
        </span>
      )}
    </span>
  )
}
