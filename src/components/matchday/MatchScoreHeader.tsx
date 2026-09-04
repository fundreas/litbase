import {
  fixtureState,
  type MatchDetail,
  type MatchdayMatch,
  type MatchTeam,
} from '@/api/models'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'
import { kickoff as kickoffLabel, minute as minuteLabel } from '@/lib/format'

/**
 * The scoreline at the top of a match page: both clubs, the score, and where
 * the match stands.
 *
 * Three states, one shape — the crests and the number never move, so switching
 * tabs or watching a match tick over does not shift the page under the reader:
 *
 * | State | The line under the score |
 * | ----- | ------------------------ |
 * | Not kicked off | `Sa, 5. Sep. · 18:30` — the full kick-off |
 * | Running | a **pulsing dot**, *Live*, and the minute |
 * | Over | *Beendet*, and the matchday |
 *
 * **The state is the fixture list's; the score, the minute and the names are
 * the match payload's.** `st` on the season's fixtures is what the app treats
 * as the truth about whether a match is on — and what
 * [the live development profile](../../dev/simulation.ts) rewrites — while
 * `mst` on the match itself would disagree with a simulated matchday. The
 * detail payload is the only source of the club *names* and the only fresh
 * source of the score, so the header shows both once it lands and falls back to
 * the fixture's symbols and goals until then.
 */
export function MatchScoreHeader({
  match,
  detail,
}: {
  match: MatchdayMatch
  /** The match payload, once it has arrived. */
  detail?: MatchDetail
}) {
  const state = fixtureState(match)
  const home = detail?.home ?? match.home
  const away = detail?.away ?? match.away

  /*
   * The match payload's score first, the fixture list's second. That list is
   * the whole season in one payload and is cached for an hour, so on a running
   * match it would put an hour-old number under a pulsing dot; it is exactly
   * right once the match is over and nothing can change, and it is all there
   * is for the second or two before the match payload lands.
   *
   * Both are home-and-away and the header draws home on the left, so no
   * per-team resolution is needed here — unlike a player row, which has to
   * read the score from its own club's side.
   */
  const goals =
    detail !== undefined
      ? { for: detail.goalsHome, against: detail.goalsAway }
      : { for: match.goalsHome, against: match.goalsAway }

  const minute =
    state === 'running' && detail !== undefined
      ? minuteLabel(detail.minute)
      : undefined

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex w-full items-start gap-2">
        <TeamBlock team={home} align="left" />

        <div className="flex shrink-0 flex-col items-center px-1">
          <p
            className={cn(
              'nums text-3xl leading-none font-bold',
              state === 'upcoming'
                ? 'text-faint'
                : state === 'running'
                  ? 'text-accent'
                  : 'text-ink',
            )}
          >
            {state === 'upcoming'
              ? '–:–'
              : `${String(goals.for ?? '–')}:${String(goals.against ?? '–')}`}
          </p>
        </div>

        <TeamBlock team={away} align="right" />
      </div>

      <p className="nums flex items-center gap-1.5 text-xs text-muted">
        {state === 'running' && (
          <>
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent"
            />
            <span className="font-semibold text-accent">
              Live{minute === undefined ? '' : ` · ${minute}`}
            </span>
            <span className="text-faint">·</span>
          </>
        )}
        {state === 'finished' && (
          <>
            <span className="font-semibold">Beendet</span>
            <span className="text-faint">·</span>
          </>
        )}
        {state === 'upcoming' ? (
          <span>{kickoffLabel(match.kickoff)}</span>
        ) : (
          <span>{match.day}. Spieltag</span>
        )}
      </p>
    </div>
  )
}

/** One club: crest over its name, leaning away from the score. */
function TeamBlock({
  team,
  align,
}: {
  team: MatchTeam
  align: 'left' | 'right'
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col gap-1',
        align === 'right' ? 'items-end' : 'items-start',
      )}
    >
      <Avatar
        src={team.image}
        name={team.symbol}
        size={44}
        square
        className="bg-transparent"
      />
      <p
        className={cn(
          'w-full truncate text-sm font-semibold text-ink',
          align === 'right' && 'text-right',
        )}
      >
        {team.name ?? team.symbol}
      </p>
    </div>
  )
}
