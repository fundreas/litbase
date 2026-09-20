import * as Dialog from '@radix-ui/react-dialog'
import { Astroid, ChevronRight, House, PlaneTakeoff, X } from 'lucide-react'
import { useState } from 'react'
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
 * What the filter keeps: an action worth **five points either way**.
 *
 * Below five is the texture of a football match — the passes, duels,
 * interceptions and fouls a midfielder accrues sixty of, each meaningless on
 * its own and collectively most of a hundred-row list. Five and up is his
 * afternoon in about twenty rows: the duels won, the chances created, the ball
 * lost in his own half.
 *
 * **Not ten**, which is where this started and which turned out to be a bar so
 * high the list was four rows and sometimes none at all — a midfielder can have
 * a good afternoon with nothing in it above ten. Ten survives as
 * {@link SUPER_EVENT_POINTS}, where it does the job it is actually good at.
 */
const NOTABLE_EVENT_POINTS = 5

/**
 * What gets **heavy type**: an action worth ten points either way.
 *
 * Ten is where Kickbase's own scale changes character. At ten and above the
 * entries are *events* rather than texture — the goal, the assist, the penalty,
 * the card, the goal conceded — and the question that opens this dialog, *why
 * did that number move*, is almost always answered by one of them.
 *
 * **A separate threshold from the filter's on purpose.** Hiding at ten threw
 * away the context that makes the ten mean anything; drawing at ten keeps the
 * context and still lets the eye land on the goal. So the two numbers do two
 * jobs: five decides what is on the page, ten decides what the page points at.
 */
const SUPER_EVENT_POINTS = 10

/**
 * Both tests, on the **absolute** value.
 *
 * A −18 is as big as a +18. A reader filtering for what mattered is not asking
 * to be shown only good news, and the worst thing that happened to a player is
 * the single row most likely to explain his afternoon.
 */
function isNotableEvent(event: PlayerMatchEvent): boolean {
  return Math.abs(event.points) >= NOTABLE_EVENT_POINTS
}

function isSuperEvent(event: PlayerMatchEvent): boolean {
  return Math.abs(event.points) >= SUPER_EVENT_POINTS
}

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

  /**
   * **On by default**, which is the unusual half of this and the deliberate
   * half. A filter that starts off is a feature; a filter that starts on is an
   * opinion about what the list is for — and this list is opened off a number
   * that needs explaining, not to be read end to end. One tap restores the
   * whole record, which is unchanged underneath.
   */
  const [onlyNotable, setOnlyNotable] = useState(true)

  /*
   * Derived rather than held: the breakdown is already memoised by the query
   * cache, the lists are short, and a second copy in state is a second thing
   * that can disagree with the first.
   */
  const allEvents = breakdown.data?.events ?? []
  const shownEvents = onlyNotable ? allEvents.filter(isNotableEvent) : allEvents
  const hiddenCount = allEvents.length - shownEvents.length
  /*
   * **Is the control worth drawing at all?** Only if it would change the list.
   * A match whose every action clears five gets no toggle, rather than one that
   * visibly does nothing when tapped.
   */
  const canFilter = allEvents.some((event) => !isNotableEvent(event))

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

            {/* **In the header, and so outside the scroll area** — which is
                the half of its placement that is not taste. It is the one
                control that can explain an empty list, and inside the list it
                would scroll away from the emptiness it caused, gone within a
                flick of a hundred rows. Left of the ✗, so close keeps the
                corner it has in every sheet in the app. */}
            {canFilter && (
              <EventFilterToggle
                isActive={onlyNotable}
                hiddenCount={hiddenCount}
                onToggle={() => {
                  setOnlyNotable(!onlyNotable)
                }}
              />
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
            ) : allEvents.length === 0 ? (
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
            ) : shownEvents.length === 0 ? (
              /* A **third** nothing, and the only one that is the app's doing
                 rather than the match's: he played, he scored, and every
                 action of it was below the bar. Saying "no actions" here would
                 be a lie the reader has no way to catch — so it names the
                 filter, and the chip that undoes it is directly above. */
              <p className="py-6 text-center text-sm text-muted">
                {`Keine Aktion ab ${String(NOTABLE_EVENT_POINTS)} Punkten — ${String(hiddenCount)} kleinere ausgeblendet.`}
              </p>
            ) : (
              <EventList events={shownEvents} />
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
 * **The event filter, as one glyph in the header.**
 *
 * A chip reading *Nur große Aktionen (ab 10)* sat between the header and the
 * list until 2026-09-20 and said its piece well; it also spent a whole band of
 * a sheet that is mostly list, on a phone where that band is a row and a half
 * of the thing the reader came for. The header had room for a 36px square
 * beside the ✗ and the sheet did not have room for the strip, so the strip
 * went.
 *
 * ## Two settings, after briefly being three
 *
 * It ran as a three-way cycle — everything, five and up, ten and up — for part
 * of the same day, and the top setting did not earn its place. Ten is a bar so
 * high that the list is four rows and sometimes empty, and the two useful
 * answers turned out to be *the whole thing* and *five and up*. What ten was
 * genuinely good at is **emphasis**, which costs no setting at all: it is
 * {@link SUPER_EVENT_POINTS}, applied to both settings, so the goal is findable
 * whether or not the passes are on screen.
 *
 * Back to two, therefore, and `aria-pressed` with it — honest for a control
 * with two states and false for one with a middle setting, which is why it came
 * off for the cycle and goes back on now.
 *
 * ## One glyph, and the colour is the state
 *
 * The mark stays put and only its weight changes: accent while it is filtering,
 * the muted grey of the ✗ beside it while the list is whole. It swapped to a
 * plain `Circle` for the unfiltered state for part of the same day, and a
 * control whose *shape* changes reads as two different buttons rather than one
 * button in two states — which is the wrong thing to say about a toggle that
 * sits in a header the reader is not looking at.
 *
 * That does leave **colour as the only visual carrier**, which is a thing to
 * be careful with and is carried here by three others: `aria-pressed` and the
 * accessible name say it outright, and the list underneath visibly grows or
 * shrinks on the tap — the feedback is the content, which is the strongest
 * signal on the screen and the one the reader is actually watching.
 *
 * ## What an icon owes back
 *
 * It dropped words, and they go where words go: `title` and `aria-label` carry
 * the setting's name **and the count it is hiding** — *Ab 5 Punkten · 71
 * ausgeblendet* — which is more than the old chip's label said, and one hover
 * or one screen-reader stop away rather than always on screen.
 *
 * The second half of the count survives on screen regardless: when the filter
 * empties a list that had rows in it, the list itself names the threshold and
 * the number hidden. That is the one moment the figure is load-bearing.
 */
function EventFilterToggle({
  isActive,
  hiddenCount,
  onToggle,
}: {
  isActive: boolean
  /** How many rows the filter is keeping out, for the label. */
  hiddenCount: number
  onToggle: () => void
}) {
  const name = isActive
    ? `Ab ${String(NOTABLE_EVENT_POINTS)} Punkten`
    : 'Alle Aktionen'
  const label =
    hiddenCount === 0 ? name : `${name} · ${String(hiddenCount)} ausgeblendet`

  return (
    <button
      type="button"
      onClick={onToggle}
      title={label}
      aria-label={label}
      aria-pressed={isActive}
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
        'hover:bg-surface-2',
        // Lit in the accent while anything is being held back, because that is
        // the state worth noticing: a list that is *not* showing everything
        // should say so without being asked. Showing all, it sits at the
        // weight of the ✗ beside it — available, not advertised.
        isActive
          ? 'text-accent hover:text-accent'
          : 'text-muted hover:text-ink',
      )}
    >
      <Astroid size={18} aria-hidden="true" />
    </button>
  )
}

/**
 * The actions, **latest first** — the ordering
 * [`toPlayerMatchBreakdown`](../../api/hooks/usePlayerMatchEvents.ts) hands
 * over, and the reason is there rather than here.
 *
 * A minute gutter, the name, and what it was worth — three columns, because
 * that is the whole content and anything more would be decoration on a list a
 * hundred rows long. The sign is on every figure, so the colour is
 * reinforcement rather than the only carrier.
 *
 * The **minute is only printed when it changes**, so a burst of actions in the
 * same minute reads as one moment rather than as five rows each restating
 * `45'`. That is what makes a long list scannable: the gutter becomes a
 * timeline of the match instead of a repeated number. It compares against the
 * row *above*, which is positional and so survived the list being turned
 * around: a minute is still printed on the first row of its group either way.
 *
 * **The super events are set in heavy type** — the name bold, the figure
 * extra-bold, at {@link SUPER_EVENT_POINTS} and in either direction. Always,
 * at both settings of the filter, because the two numbers do two jobs: five
 * decides what is on the page, ten decides what the page points at. Filtered
 * or whole, the goal and the card are where the eye lands first.
 *
 * It was conditional while the filter's own top setting was also ten — bolding
 * every row of a list that is all big actions is bolding none of them. With
 * that setting gone there is always something lighter to stand against, and
 * the flag that carried the condition went with it.
 *
 * The gutter stays quiet throughout: it is a timeline, and a timeline with
 * some of its minutes shouted is a worse one.
 */
function EventList({ events }: { events: PlayerMatchEvent[] }) {
  return (
    <ol className="flex flex-col">
      {events.map((event, index) => {
        const isSameMinute = events[index - 1]?.minute === event.minute
        const isSuper = isSuperEvent(event)

        return (
          <li
            key={event.id}
            className="flex items-baseline gap-2.5 border-b border-line/60 py-1.5 last:border-0"
          >
            {/* The gutter stays quiet either way: it is a timeline, and a
                timeline with some of its minutes shouted is a worse one. */}
            <span
              className={cn(
                'nums w-8 shrink-0 text-right text-xs',
                isSameMinute ? 'text-transparent' : 'text-faint',
              )}
            >
              {event.minute}′
            </span>
            <span
              className={cn(
                'min-w-0 flex-1 text-sm text-ink',
                isSuper && 'font-bold',
              )}
            >
              {event.name}
            </span>
            {/* `nums` — tabular figures, so the column stays aligned when a
                row goes heavy. A proportional face would set `+18` wider in
                bold than `+1` is in semibold and ripple the whole column. */}
            <span
              className={cn(
                'nums shrink-0 text-sm',
                isSuper ? 'font-extrabold' : 'font-semibold',
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
