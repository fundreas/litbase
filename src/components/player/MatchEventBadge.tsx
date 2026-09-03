import { MATCH_EVENT_LABEL, type MatchEventTally } from '@/api/models'
import { EventGlyph } from '@/components/player/statGlyphs'
import { cn } from '@/lib/cn'

/** Events that read better on a tinted chip than bare on the row. */
const TINT: Partial<Record<MatchEventTally['kind'], string>> = {
  goal: 'bg-surface-2',
  ownGoal: 'bg-negative/20',
  assist: 'bg-surface-2',
  penaltySaved: 'bg-accent/15',
  cleanSheet: 'bg-positive/15',
}

/**
 * One kind of event in one match, with a count when it happened more than
 * once.
 *
 * A two-goal game is one badge reading "ball 2", not two badges — repeated
 * identical marks are harder to count at a glance than the number is to read,
 * and they push the rest of the row off a phone screen.
 *
 * The mark itself comes from the shared {@link EventGlyph}, so the badge on a
 * match row and the same statistic in the season grid are the same picture.
 * Cards get no chip: a coloured rectangle inside a coloured rounded box reads
 * as two nested shapes at 14px.
 */
export function MatchEventBadge({ event }: { event: MatchEventTally }) {
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
        'inline-flex h-5 shrink-0 items-center gap-0.5 rounded px-1',
        TINT[event.kind],
      )}
    >
      <EventGlyph kind={event.kind} size={12} />
      {event.count > 1 && (
        <span
          aria-hidden="true"
          className="nums text-[0.625rem] leading-none font-bold text-ink"
        >
          {event.count}
        </span>
      )}
    </span>
  )
}
