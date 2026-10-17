import { Link } from 'react-router'

import {
  fixtureState,
  type MatchDetail,
  type MatchdayMatch,
} from '@/api/models'
import { Avatar } from '@/components/ui/Avatar'
import { SwitchBar, SWITCH_CHIP } from '@/components/ui/SwitchBar'
import { cn } from '@/lib/cn'
import { kickoffShort } from '@/lib/format'

/**
 * **The matchday's other fixtures, above the one being read** — two crests and
 * the score, per match, in a row that scrolls sideways.
 *
 * The match on screen is in it too, ringed in the accent. It is the anchor:
 * without it the strip's order would say nothing about where you are, and
 * tapping along it would shuffle the chips under the finger. With it, the
 * strip is the matchday and the ring is your place in it.
 *
 * **It costs no request.** The matchdays payload is the whole season in one
 * response, cached and already read by this page to resolve its own fixture —
 * `useMatchdayMatches` is one more `select` on that same entry.
 *
 * **Where the score comes from, and the one place it may lag.** The chip you
 * are *on* takes the match payload the page is already polling, so it and the
 * scoreline below it cannot disagree. The others take the fixture list's own
 * goals, which refresh once a minute while a matchday is live (see
 * [`MATCHDAY_STATE_POLL_MS`](../../api/polling.ts)) — so a goal elsewhere can
 * be up to a minute old here. That is the deliberate trade: the alternative is
 * [`useLiveMatches`](../../api/hooks/useLiveMatches.ts) fanning out eight more
 * requests every ten seconds, on the page that already runs the heaviest
 * fan-out in the app. This is a way *to* the other match, and its real score
 * is one tap away.
 */
export function MatchSwitchBar({
  matches,
  activeMatchId,
  detail,
  to,
}: {
  /** Every fixture of the matchday, in kick-off order. */
  matches: MatchdayMatch[]
  activeMatchId: string
  /** The match payload of the active fixture, once it has arrived. */
  detail?: MatchDetail
  /** Route for one fixture — the page keeps its tab across the jump. */
  to: (matchId: string) => string
}) {
  return (
    <SwitchBar label="Andere Spiele des Spieltags" activeKey={activeMatchId}>
      {matches.map((match) => {
        const isActive = match.matchId === activeMatchId
        const state = fixtureState(match)
        const goals =
          isActive && detail !== undefined
            ? { for: detail.goalsHome, against: detail.goalsAway }
            : { for: match.goalsHome, against: match.goalsAway }

        return (
          <Link
            key={match.matchId}
            to={to(match.matchId)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={`${match.home.symbol} gegen ${match.away.symbol}`}
            title={`${match.home.symbol} – ${match.away.symbol}`}
            className={cn(
              SWITCH_CHIP,
              isActive
                ? 'border-accent bg-accent/15'
                : 'border-line bg-surface hover:bg-surface-2 active:bg-surface-2',
            )}
          >
            <Avatar
              src={match.home.image}
              name={match.home.symbol}
              size={18}
              square
              className="bg-transparent"
            />
            <span
              className={cn(
                'nums text-xs leading-none font-semibold whitespace-nowrap',
                state === 'upcoming'
                  ? 'text-faint'
                  : state === 'running'
                    ? 'text-accent'
                    : 'text-ink',
              )}
            >
              {state === 'upcoming'
                ? kickoffShort(match.kickoff)
                : `${String(goals.for ?? '–')}:${String(goals.against ?? '–')}`}
            </span>
            <Avatar
              src={match.away.image}
              name={match.away.symbol}
              size={18}
              square
              className="bg-transparent"
            />
          </Link>
        )
      })}
    </SwitchBar>
  )
}
