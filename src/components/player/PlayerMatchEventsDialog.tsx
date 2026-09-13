import * as Dialog from '@radix-ui/react-dialog'
import { ChevronRight, House, PlaneTakeoff, X } from 'lucide-react'
import { Link } from 'react-router'

import {
  usePlayerMatchEvents,
  type PlayerMatchEvent,
} from '@/api/hooks/usePlayerMatchEvents'
import type { BreakdownFixture } from '@/api/hooks/usePlayerMatchEvents'
import { fixtureState, matchOutcome } from '@/api/models'
import { Scoreline } from '@/components/player/PlayerMatchRow'
import { ExpectedPointsBadge } from '@/components/squad/ExpectedPointsBadge'
import { usePointcastPrediction } from '@/components/squad/useExpectedPointsView'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { useExpectedPoints } from '@/lib/expectedPoints'
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
 * ## The header is the player
 *
 * **His face, his name, his total** — because that is whose sheet this is. The
 * header used to lead with the opponent's crest and name, which read as a
 * dialog about the *match*: opened from a pitch of twenty-two portraits, where
 * every card on screen belongs to the same fixture, the one thing it needed to
 * confirm was *which man you tapped*, and that was the one thing it did not
 * say. The match has not gone anywhere — venue, opponent, score and matchday
 * are the line underneath, which is where a qualifier belongs.
 *
 * And it is a link to **his page**, for the same reason: the question this
 * dialog answers ("what did he do in this match") has an obvious next one
 * ("who is he, and what has he been doing all season"), and the app has a page
 * for exactly that. Every caller that opens this from a pitch already sent the
 * reader there; the two that open it *from* the player's own page pass no `to`
 * at all, and the header goes quiet rather than offering a link back to the
 * page under the sheet.
 *
 * ## Both expectations, beside what actually happened
 *
 * The header also carries **the reader's own guess and the model's
 * prediction** for this player on this matchday, as the same two chips the
 * squad rows draw — accent green for his, orange for the model's — and it
 * carries *both* rather than the one the rest of the app resolves to. This is
 * the one screen where the two are worth separating: everywhere else a guess
 * overrules a prediction and the reader wants one number, but here the
 * question is *how did the two of us do*, and after the final whistle the real
 * total sits right next to them. Before kick-off they are what the plate that
 * opened this sheet was showing.
 *
 * **Nothing is shown for an archived season.** Guesses are filed under a
 * matchday number and nothing else — there was never a season in the storage
 * key — so a guess for "matchday 3" belongs to the running season, and
 * printing it over a 2019 match would be a fabrication. `seasonId` is set only
 * for archived seasons, which makes it the gate.
 *
 * The ✗ sits beside the header rather than inside it, so the two targets never
 * overlap: one navigates, one closes.
 */
export function PlayerMatchEventsDialog({
  fixture,
  playerId,
  playerName,
  playerImage,
  leagueId,
  seasonId,
  to,
  matchTo,
  onClose,
}: {
  fixture: BreakdownFixture
  playerId: string
  playerName: string
  /**
   * His portrait, for the header. Optional — the Avatar falls back to his
   * initials, which is what a player the caller has no picture of gets.
   */
  playerImage?: string
  leagueId: string | undefined
  /** The season the match belongs to. Omitted for the running one. */
  seasonId?: string
  /**
   * Where the header goes: **his page**, or nothing.
   *
   * Passed rather than built here so the two callers that open this sheet from
   * the player's own page can pass `undefined` — a header linking to the page
   * it is already sitting on is a target that does nothing. Those two pass
   * {@link matchTo} instead.
   */
  to?: string
  /**
   * Where the **match line** goes — and only honoured when {@link to} is not
   * given.
   *
   * One target in a header, and it is whichever of the two the reader has not
   * already got. Opened from a pitch, the match is the page underneath and his
   * page is the useful direction; opened from his own page, that is reversed
   * and the line about the fixture becomes the way out. They are never both
   * links, which is also what keeps an anchor out of an anchor.
   */
  matchTo?: string
  onClose: () => void
}) {
  const match = fixture
  const breakdown = usePlayerMatchEvents(leagueId, playerId, {
    day: match.day,
    seasonId,
  })

  /*
   * `undefined` for an archived season, which switches both lookups off: the
   * store is keyed by matchday alone, and the prediction file is this season's.
   */
  const expectedDay = seasonId === undefined ? match.day : undefined
  const ownExpected = useExpectedPoints(expectedDay)[playerId]
  const { prediction } = usePointcastPrediction(expectedDay, playerId)

  const opponent = match.opponentName ?? '–'
  const outcome = matchOutcome(match.goalsFor, match.goalsAgainst)
  // No `kickoff` means nothing is known about the clock, so lean on the API's
  // own word: not finished and no time is treated as still to come.
  const hasKickedOff =
    fixtureState({
      isFinished: match.isFinished,
      kickoff: match.kickoff ?? '',
    }) !== 'upcoming'
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

  /* The fixture, as facts — drawn plain under a header that is already a link
     to his page, and wrapped in a link to the match when it is not. */
  const matchFacts = (
    <>
      <Venue
        size={12}
        aria-hidden="true"
        className={cn(
          'shrink-0',
          match.isHome ? 'text-positive' : 'text-accent',
        )}
      />
      <Avatar
        src={match.opponentImage}
        name={opponent}
        size={14}
        square
        className="shrink-0 bg-transparent"
      />
      <span className="min-w-0 truncate">{opponent}</span>
      <Scoreline
        goalsFor={match.goalsFor}
        goalsAgainst={match.goalsAgainst}
        outcome={outcome}
      />
      <span aria-hidden="true" className="text-faint">
        ·
      </span>
      <span className="nums">{match.day}. Spieltag</span>
    </>
  )

  // Never both — see `matchTo`. An anchor inside an anchor is invalid anyway.
  const isMatchLink = to === undefined && matchTo !== undefined

  const header = (
    <>
      {/* **His portrait**, where the opponent's crest used to be. The crest is
          still here, at 14px on the line below: the match is what qualifies
          this total, not what the sheet is about. */}
      <Avatar
        src={playerImage}
        name={playerName}
        size={34}
        className="shrink-0"
      />
      <span className="min-w-0 flex-1">
        <Dialog.Title asChild>
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="min-w-0 truncate text-sm font-semibold text-ink">
              {playerName}
            </span>
            {/* The figure the rows below add up to, beside the man who scored
                it. It was under the opponent's name before, where it read as
                the match's. */}
            <span className="nums shrink-0 text-sm font-semibold text-ink">
              {total === undefined ? '–' : formatPoints(total)}
              <span className="font-normal text-muted"> Punkte</span>
            </span>
          </span>
        </Dialog.Title>
        {/* The match, in one line under him: where, against whom, how it
            ended, and which matchday. It **wraps** rather than truncating —
            the sheet is 26rem at most and this line can carry two chips as
            well, and a score cut off mid-colon says less than a second line
            costs. */}
        <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted">
          {isMatchLink ? (
            <Link
              to={matchTo}
              replace
              title={`${spoken} – Spiel öffnen`}
              className={cn(
                '-m-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded p-0.5',
                'transition-colors hover:bg-surface-2 hover:text-ink',
                'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
              )}
            >
              {matchFacts}
              <ChevronRight
                size={12}
                aria-hidden="true"
                className="shrink-0 text-faint"
              />
            </Link>
          ) : (
            matchFacts
          )}
          {/* The reader's first, the model's second: his is the one he is
              accountable for, and the order is the same as the precedence
              everywhere else in the app. Outside the link either way: they are
              about the matchday, not about the fixture. */}
          {ownExpected !== undefined && (
            <ExpectedPointsBadge value={ownExpected} />
          )}
          {prediction !== undefined && (
            <ExpectedPointsBadge value={prediction.expected} isForecast />
          )}
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
          // The header names the player and his match, and the list is the
          // content; a description element would only repeat one of them.
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
            {to === undefined ? (
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                {header}
              </div>
            ) : (
              // `replace`, and nothing that closes the sheet: it is the hash
              // on the page's URL, so leaving the page closes it — and the
              // entry it lives in is better spent on his page than on a
              // sheet to come back through. See `useHashModal`.
              <Link
                to={to}
                replace
                title={`${spoken} – Spielerseite öffnen`}
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
              /* Two different nothings, and saying which is the whole value of
                 the message: a match that has not begun has nothing *yet*, and
                 a substitute who came on without touching the score has a
                 payload of nothing but the fixture's own structure. Both are
                 real, neither is an error. */
              <p className="py-6 text-center text-sm text-muted">
                {hasKickedOff
                  ? 'Keine punktewirksamen Aktionen in diesem Spiel.'
                  : 'Das Spiel hat noch nicht begonnen.'}
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
