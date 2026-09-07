import * as Dialog from '@radix-ui/react-dialog'
import { ChevronRight, House, PlaneTakeoff, X } from 'lucide-react'
import { Link } from 'react-router'

import {
  usePlayerMatchEvents,
  type PlayerMatchEvent,
} from '@/api/hooks/usePlayerMatchEvents'
import type { TeamSummary } from '@/api/hooks/useCompetition'
import type { PlayerMatch } from '@/api/models'
import { Scoreline } from '@/components/player/PlayerMatchRow'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { delta, points as formatPoints } from '@/lib/format'

/**
 * **Why a player scored what he scored in one match**, action by action.
 *
 * The number on a match row is the one figure the app could never explain. A
 * defender's 239 is four goals' worth of points arrived at through a hundred
 * and eleven small things — a pass into the final third, a possession lost, a
 * goal conceded, and once in a while the goal itself — and none of them were
 * anywhere in the app. Kickbase serves the lot, per action and per minute; see
 * [`usePlayerMatchEvents`](../../api/hooks/usePlayerMatchEvents.ts) for the
 * endpoint and the three rules that turn 129 raw entries into a list a person
 * can read.
 *
 * **It adds up.** The rows sum to the total in the header exactly — verified on
 * a settled match — which is the property that makes this worth drawing at all
 * rather than a selection of highlights.
 *
 * ## The header is the way out, upwards
 *
 * It carries the result from this player's side and his total, and it is a link
 * to [the match](../../pages/MatchDetailPage.tsx) — because the question this
 * dialog answers ("what did *he* do") has an obvious next one ("what happened
 * in the match"), and the app already has a page for it.
 *
 * The link is **only offered for the running season**: the match page resolves
 * a fixture from the current season's list, so a 2019 match id lands on its
 * "not found" state. A header that is not a link when the destination would be
 * a dead end is better than one that always looks tappable — `matchTo` is
 * `undefined` for an archived season and the header goes quiet.
 *
 * The ✗ sits beside the header rather than inside it, so the two targets never
 * overlap: one navigates, one closes.
 */
export function PlayerMatchEventsDialog({
  match,
  playerId,
  playerName,
  leagueId,
  seasonId,
  teams,
  matchTo,
  onClose,
}: {
  match: PlayerMatch
  playerId: string
  playerName: string
  leagueId: string | undefined
  /** The season the match belongs to. Omitted for the running one. */
  seasonId?: string
  /** Team id → name, for the opponent. The crest comes off the match itself. */
  teams: Map<string, TeamSummary> | undefined
  /** Where the header goes, when there is somewhere for it to go. */
  matchTo?: string
  onClose: () => void
}) {
  const breakdown = usePlayerMatchEvents(leagueId, playerId, {
    day: match.day,
    seasonId,
  })

  const opponent = teams?.get(match.opponentId)?.name ?? match.opponentId
  const Venue = match.isHome ? House : PlaneTakeoff
  /*
   * The breakdown's own total, not the row's. They are the same number for a
   * settled match — checked — and when they are not, the one the rows below
   * actually add up to is the one that belongs above them.
   */
  const total = breakdown.data?.total ?? match.points
  const spoken = `${playerName} gegen ${opponent}, ${String(match.day)}. Spieltag`

  /*
   * `dayNumber` and `seasonId` are the only things that selected this fixture,
   * and a silently ignored parameter is a failure mode this API has form for —
   * so the response is asked which match it answered about before its events
   * are drawn under this header.
   */
  const isThisMatch =
    breakdown.data?.matchId === undefined ||
    breakdown.data.matchId === match.matchId

  const header = (
    <>
      <Avatar
        src={match.opponentImage}
        name={opponent}
        size={30}
        square
        className="shrink-0 bg-transparent"
      />
      <span className="min-w-0 flex-1">
        <Dialog.Title asChild>
          <span className="flex min-w-0 items-center gap-1.5">
            <Venue
              size={12}
              aria-hidden="true"
              className={cn(
                'shrink-0',
                match.isHome ? 'text-positive' : 'text-accent',
              )}
            />
            <span className="min-w-0 truncate text-sm font-semibold text-ink">
              {opponent}
            </span>
            <Scoreline
              goalsFor={match.goalsFor}
              goalsAgainst={match.goalsAgainst}
              outcome={match.outcome}
            />
          </span>
        </Dialog.Title>
        <span className="nums mt-0.5 flex items-center gap-1.5 text-xs text-muted">
          <span>{match.day}. Spieltag</span>
          <span aria-hidden="true" className="text-faint">
            ·
          </span>
          <span className="font-semibold text-ink">
            {total === undefined ? '–' : formatPoints(total)} Punkte
          </span>
        </span>
      </span>
    </>
  )

  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]',
            'data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in',
          )}
        />
        <Dialog.Content
          // The header names the match and the list is the content; a
          // description element would only repeat one of them.
          aria-describedby={undefined}
          className={cn(
            'fixed z-50 flex flex-col border border-line bg-surface shadow-raise',
            // A bottom sheet on a phone, capped so the list scrolls rather
            // than the sheet growing past the screen.
            'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl pb-safe',
            'sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[min(26rem,92vw)]',
            'sm:max-h-[80dvh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:pb-0',
            'data-[state=open]:animate-pop-in',
          )}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-line p-3">
            {matchTo === undefined ? (
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                {header}
              </div>
            ) : (
              <Link
                to={matchTo}
                onClick={onClose}
                title={`${spoken} – Spiel öffnen`}
                className={cn(
                  '-m-1 flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1',
                  'transition-colors hover:bg-surface-2',
                  'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
                )}
              >
                {header}
                <ChevronRight
                  size={16}
                  aria-hidden="true"
                  className="shrink-0 text-faint"
                />
              </Link>
            )}

            <Dialog.Close
              aria-label="Schließen"
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                'text-muted transition-colors hover:bg-surface-2 hover:text-ink',
              )}
            >
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>

          {/* `overscroll-contain` so reaching the end of a hundred rows does
              not start scrolling the page behind the dialog. */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
            {breakdown.isPending ? (
              <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted">
                <Spinner size={14} />
                Aktionen werden geladen …
              </p>
            ) : breakdown.isError ? (
              <ErrorState error={breakdown.error} onRetry={breakdown.refetch} />
            ) : !isThisMatch || breakdown.data === undefined ? (
              <p className="py-6 text-center text-sm text-muted">
                Für dieses Spiel liefert Kickbase keine Einzelaktionen.
              </p>
            ) : breakdown.data.events.length === 0 ? (
              /* A real case, not an error: a substitute who came on and did
                 not touch the score has a payload of nothing but the match's
                 own structure, all of it worth zero. */
              <p className="py-6 text-center text-sm text-muted">
                Keine punktewirksamen Aktionen in diesem Spiel.
              </p>
            ) : (
              <EventList events={breakdown.data.events} />
            )}
          </div>

          {breakdown.data !== undefined && breakdown.data.revisions > 0 && (
            /* A breakdown that quietly drops rows should say so. Kickbase
               re-scores by appending a reversal rather than editing, and the
               pairs cancel exactly — so the total is untouched and the note is
               a footnote rather than a warning. */
            <p className="shrink-0 border-t border-line px-3 py-2 text-[0.6875rem] text-faint">
              {breakdown.data.revisions === 1
                ? '1 nachträgliche Korrektur herausgerechnet'
                : `${String(breakdown.data.revisions)} nachträgliche Korrekturen herausgerechnet`}
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * The actions, earliest first.
 *
 * A minute gutter, the name, and what it was worth — three columns, because
 * that is the whole content and anything more would be decoration on a list a
 * hundred rows long. The sign is on every figure, so the colour is
 * reinforcement rather than the only carrier.
 *
 * The **minute is only printed when it changes**, so a burst of actions in the
 * same minute reads as one moment rather than as five rows each restating
 * `45'`. That is what makes a long list scannable: the gutter becomes a
 * timeline of the match instead of a repeated number.
 */
function EventList({ events }: { events: PlayerMatchEvent[] }) {
  return (
    <ol className="flex flex-col">
      {events.map((event, index) => {
        const isSameMinute = events[index - 1]?.minute === event.minute

        return (
          <li
            key={event.id}
            className="flex items-baseline gap-2.5 border-b border-line/60 py-1.5 last:border-0"
          >
            <span
              className={cn(
                'nums w-8 shrink-0 text-right text-xs',
                isSameMinute ? 'text-transparent' : 'text-faint',
              )}
            >
              {event.minute}′
            </span>
            <span className="min-w-0 flex-1 text-sm text-ink">
              {event.name}
            </span>
            <span
              className={cn(
                'nums shrink-0 text-sm font-semibold',
                event.points > 0 ? 'text-positive' : 'text-negative',
              )}
            >
              {delta(event.points)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
