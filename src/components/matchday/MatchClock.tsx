import { fixtureState, type LiveMatch, type MatchdayMatch } from '@/api/models'
import { cn } from '@/lib/cn'
import {
  kickoff as kickoffLabel,
  minute as minuteLabel,
  time,
} from '@/lib/format'

/**
 * Where a match stands, in as few characters as it takes.
 *
 * | State | Drawn as |
 * | ----- | -------- |
 * | Not kicked off | the kick-off **time** — `18:30` |
 * | Running | a **pulsing dot** and the minute, in accent |
 * | Over | *Beendet*, quietly |
 *
 * The dot is the live indicator and the only thing on a fixture list that
 * moves: running is the one state that is going to change, so it is the one
 * worth scanning for down a column of nine.
 *
 * **The state comes from the fixture, the minute from the match.** `st` on the
 * season's fixture list is what the app treats as the truth about whether a
 * match is on — it is what
 * [the live development profile](../../dev/simulation.ts) rewrites — while the
 * minute exists only on the match's own payload. Mixing the two is deliberate:
 * `mst` would disagree with a simulated matchday, and the fixture list has no
 * clock.
 */
export function MatchClock({
  match,
  live,
  size = 'sm',
  className,
}: {
  match: MatchdayMatch
  /** The match as it stands, once it has kicked off. */
  live?: LiveMatch
  size?: 'sm' | 'md'
  className?: string
}) {
  const state = fixtureState(match)
  const minute =
    state === 'running' && live !== undefined
      ? minuteLabel(live.minute)
      : undefined

  const label =
    state === 'upcoming'
      ? `Anpfiff ${kickoffLabel(match.kickoff)}`
      : state === 'running'
        ? `Läuft${minute === undefined ? '' : ` (${minute})`}`
        : 'Beendet'

  const text =
    state === 'upcoming'
      ? time(match.kickoff)
      : state === 'running'
        ? (minute ?? 'Läuft')
        : 'Beendet'

  return (
    <span
      title={label}
      className={cn(
        'nums flex shrink-0 items-center gap-1 font-medium',
        size === 'md' ? 'text-xs' : 'text-[0.6875rem]',
        state === 'running'
          ? 'text-accent'
          : state === 'finished'
            ? 'text-faint'
            : 'text-muted',
        className,
      )}
    >
      {state === 'running' && (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent"
        />
      )}
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}
