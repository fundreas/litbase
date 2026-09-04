import { fixtureState, type MatchdayFixture } from '@/api/models'
import { cn } from '@/lib/cn'
import { time } from '@/lib/format'

/**
 * Where a player's club match stands, as a scoreline.
 *
 * One shape for all three states, so a column of these reads down the page:
 *
 * | State | Drawn as |
 * | ----- | -------- |
 * | Not kicked off | `–:–`, faint — a result-shaped placeholder |
 * | Running | a **pulsing dot** and the score so far, in accent |
 * | Over | the final score, quietly |
 *
 * The dot is the live indicator, and it is the only thing on a row that moves:
 * running is the one state that is going to change, and the only one worth
 * scanning a list for. The score is read from the player's own side of the
 * fixture (`goalsFor`/`goalsAgainst` are already resolved that way), so `2:1`
 * always means his club is winning.
 *
 * **Nothing is spelled out visually**, so the state and the kick-off ride
 * along as the tooltip and as screen-reader text — a faint `–:–` says
 * "not yet" to the eye and nothing at all to a reader.
 */
export function MatchStateBadge({
  fixture,
  className,
}: {
  fixture: MatchdayFixture | undefined
  className?: string
}) {
  if (fixture === undefined) return null

  const state = fixtureState(fixture)
  const score = `${String(fixture.goalsFor ?? '–')}:${String(fixture.goalsAgainst ?? '–')}`

  const label =
    state === 'upcoming'
      ? `Noch nicht angepfiffen · Anpfiff ${time(fixture.kickoff)}`
      : state === 'running'
        ? `Läuft · ${score}`
        : `Beendet · ${score}`

  return (
    <span
      title={label}
      className={cn(
        'nums flex shrink-0 items-center gap-1 text-[0.6875rem] font-medium',
        state === 'running'
          ? 'text-accent'
          : state === 'finished'
            ? 'text-muted'
            : 'text-faint',
        className,
      )}
    >
      {state === 'running' && (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent"
        />
      )}
      <span aria-hidden="true">{state === 'upcoming' ? '–:–' : score}</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}
