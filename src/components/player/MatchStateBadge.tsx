import {
  fixtureState,
  liveScoreFor,
  type LiveMatch,
  type MatchdayFixture,
} from '@/api/models'
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
 * | Running | a **pulsing dot**, the score so far, and the minute, in accent |
 * | Over | the final score, quietly |
 *
 * **The live score comes from the match itself**, via
 * [`useLiveMatches`](../../api/hooks/useLiveMatches.ts). The fixture carries
 * goals too, but that payload is the season's and is cached for an hour, so
 * for a running match it would put a stale number next to a pulsing dot. The
 * fixture stays as the fallback, which is exactly right once a match is over
 * and nothing can change.
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
  live,
  teamId,
  className,
}: {
  fixture: MatchdayFixture | undefined
  /** The match as it stands, when it has kicked off. */
  live?: LiveMatch
  /** Whose side to read the score from. */
  teamId?: string
  className?: string
}) {
  if (fixture === undefined) return null

  const state = fixtureState(fixture)
  const goals =
    live !== undefined && teamId !== undefined
      ? liveScoreFor(live, teamId)
      : { for: fixture.goalsFor, against: fixture.goalsAgainst }
  const score = `${String(goals.for ?? '–')}:${String(goals.against ?? '–')}`
  // Past 90 the API keeps counting, so `90+` is closer to what a viewer
  // expects than `95`.
  const minute =
    live === undefined || state !== 'running'
      ? undefined
      : live.minute > 90
        ? "90+'"
        : `${String(live.minute)}'`

  const label =
    state === 'upcoming'
      ? `Noch nicht angepfiffen · Anpfiff ${time(fixture.kickoff)}`
      : state === 'running'
        ? `Läuft${minute === undefined ? '' : ` (${minute})`} · ${score}`
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
      {minute !== undefined && (
        <span aria-hidden="true" className="text-accent/70">
          {minute}
        </span>
      )}
      <span className="sr-only">{label}</span>
    </span>
  )
}
