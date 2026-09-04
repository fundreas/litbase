import { Link } from 'react-router'

import {
  fixtureState,
  liveScoreFor,
  type LiveMatch,
  type MatchdayMatch,
  type MatchTeam,
} from '@/api/models'
import { MatchClock } from '@/components/matchday/MatchClock'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'

/**
 * One fixture, as a row you can tap into.
 *
 * Home on the left, away on the right, the score between them — the
 * arrangement every fixture list in football uses, and the reason the model
 * behind it ([`MatchdayMatch`](../../api/models.ts)) keeps home and away where
 * they are instead of resolving an "opponent" the way a player's fixture does.
 *
 * **The score is the live one wherever there is one.** The season's fixture
 * list carries goals as well, but it is the whole season in one payload and is
 * cached for an hour, so on a running match it would put an hour-old number
 * next to a pulsing dot. The fixture stays the fallback, which is exactly right
 * the moment a match is over and nothing can change — see
 * [`useLiveMatches`](../../api/hooks/useLiveMatches.ts).
 *
 * **Crest *and* label**, which is a departure from the app's usual wordless
 * [`FixtureBadge`](../squad/FixtureBadge.tsx). That badge answers "who is my
 * player up against", where the crest is a reminder; a fixture list is the one
 * place where both clubs are equally unknown, and two unfamiliar crests at 30px
 * are a guessing game. The label is the club's name where the payload carries
 * one and its symbol otherwise — the season fixture list only has symbols, the
 * match payload has both.
 */
export function MatchCard({
  match,
  live,
  to,
}: {
  match: MatchdayMatch
  /** The match as it stands, once it has kicked off. */
  live?: LiveMatch
  to: string
}) {
  const state = fixtureState(match)
  const goals =
    live === undefined
      ? { for: match.goalsHome, against: match.goalsAway }
      : liveScoreFor(live, match.home.id)

  const isRunning = state === 'running'
  const label = `${match.home.symbol} gegen ${match.away.symbol}`

  return (
    <li>
      <Link
        to={to}
        aria-label={label}
        className={cn(
          'flex items-center gap-2 rounded-card border bg-surface px-3 py-2.5 transition-colors',
          'hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
          // A running match gets a tinted edge, so a matchday half-played reads
          // as "these three are on" at a glance rather than one dot at a time.
          isRunning ? 'border-accent/40' : 'border-line',
        )}
      >
        <TeamSide team={match.home} align="left" />

        {/* Fixed-width so the scores line up down the list: a column of
            centred `2:1`s that shift by a character whenever a club's symbol
            is longer reads as a broken table. */}
        <span className="flex w-20 shrink-0 flex-col items-center">
          <span
            className={cn(
              'nums text-base leading-tight font-bold',
              state === 'upcoming'
                ? 'text-faint'
                : isRunning
                  ? 'text-accent'
                  : 'text-ink',
            )}
          >
            {state === 'upcoming'
              ? '–:–'
              : `${String(goals.for ?? '–')}:${String(goals.against ?? '–')}`}
          </span>
          <MatchClock match={match} live={live} />
        </span>

        <TeamSide team={match.away} align="right" />
      </Link>
    </li>
  )
}

/** One club: crest over its symbol, leaning towards its own touchline. */
function TeamSide({
  team,
  align,
}: {
  team: MatchTeam
  align: 'left' | 'right'
}) {
  return (
    <span
      className={cn(
        'flex min-w-0 flex-1 items-center gap-2',
        align === 'right' && 'flex-row-reverse',
      )}
    >
      <Avatar
        src={team.image}
        name={team.symbol}
        size={30}
        square
        className="bg-transparent"
      />
      <span
        className={cn(
          'min-w-0 truncate text-sm font-semibold text-ink',
          align === 'right' && 'text-right',
        )}
      >
        {team.name ?? team.symbol}
      </span>
    </span>
  )
}
