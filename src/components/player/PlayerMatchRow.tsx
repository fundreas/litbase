import { House, PlaneTakeoff, Timer } from 'lucide-react'

import type { TeamSummary } from '@/api/hooks/useCompetition'
import { didPlay, type MatchOutcome, type PlayerMatch } from '@/api/models'
import { MatchEventBadge } from '@/components/player/MatchEventBadge'
import {
  PLAYER_POINTS_BANDS,
  pointsColor,
  pointsFraction,
} from '@/components/player/pointsScale'
import { MatchRoleMark } from '@/components/player/statGlyphs'
import { ExpectedPointsBadge } from '@/components/squad/ExpectedPointsBadge'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'
import type { ExpectedPointsEntry } from '@/lib/expectedPoints'
import { kickoff, points as formatPoints } from '@/lib/format'

/**
 * The result, said with colour instead of a letter.
 *
 * A `S` / `U` / `N` chip beside the scoreline was two things saying one thing,
 * and the chip took the width that the event badges need on a phone. The
 * scoreline is already there and already the thing a reader looks at, so it
 * carries the outcome itself.
 *
 * Colour is not the only cue: the score is right there, so a reader who cannot
 * separate the red from the green still has `5:1` and the `title` below.
 */
const OUTCOME_CLASS: Record<MatchOutcome, string> = {
  win: 'text-positive',
  draw: 'text-muted',
  loss: 'text-negative',
}

const OUTCOME_NAME: Record<MatchOutcome, string> = {
  win: 'Sieg',
  draw: 'Unentschieden',
  loss: 'Niederlage',
}

/**
 * One fixture: who against, how it ended, and what the player did in it.
 *
 * Shared by the Leistung tab, which lists a whole season of them, and the
 * Details tab, which shows the handful around the current matchday. One
 * renderer rather than two, so a match never looks like a different kind of
 * thing depending on which tab you found it on.
 *
 * Points read `–`, never `0`, for a match the player took no part in. `0`
 * would claim they were on the pitch and scored nothing, which is a different
 * — and much worse — thing to be told about your striker.
 *
 * **A fixture still to come can carry a figure of its own**: what he is
 * [expected](../squad/ExpectedPointsBadge.tsx) to score in it, in the points
 * column where the dash would be. That column is the row's answer to *what is
 * this match worth to me*, and for a match that has not happened the honest
 * answer is an estimate rather than a dash — the chip says whose estimate it
 * is, orange for the model's and accent green for the reader's own.
 */
export function PlayerMatchRow({
  match,
  teams,
  pointsScale,
  expected,
  onOpen,
  onOpenExpected,
}: {
  match: PlayerMatch
  /** Team id → name. Only this season's clubs resolve; the crest always does. */
  teams: Map<string, TeamSummary> | undefined
  /** Top of the bar's scale — see `pointsScaleFor`. */
  pointsScale: number
  /**
   * What he is expected to score in a match still to come — the reader's own
   * guess, or the model's prediction standing in for one.
   */
  expected?: ExpectedPointsEntry
  /**
   * Open the [action breakdown](./PlayerMatchEventsDialog.tsx) for this match.
   *
   * Given, the row becomes a button — but **only for a match he actually
   * played**. One he sat out has nothing but the match's own structure, so a
   * tappable row there would promise a list and deliver an empty state.
   */
  onOpen?: () => void
  /**
   * Open the [expected-points sheet](../squad/ExpectedPointsDialog.tsx) for a
   * match still to come.
   *
   * A **separate** prop rather than `onOpen` widened, because the two open
   * different things and the caller has to mean one of them: the
   * [Details tab](./PlayerDetailsTab.tsx) lists upcoming fixtures too and
   * wants them inert, and a row that decided for itself would have made them
   * tappable there the day this arrived.
   */
  onOpenExpected?: () => void
}) {
  const opponent = teams?.get(match.opponentId)
  const Venue = match.isHome ? House : PlaneTakeoff
  const played = didPlay(match.role)
  const color =
    match.points === undefined
      ? undefined
      : pointsColor(match.points, PLAYER_POINTS_BANDS)

  const canOpenBreakdown = onOpen !== undefined && match.isFinished && played
  const canOpenExpected = onOpenExpected !== undefined && !match.isFinished
  const canOpen = canOpenBreakdown || canOpenExpected
  /*
   * A button when there is something behind it, a plain block otherwise. The
   * card is the target rather than an added chevron: the whole row is about
   * this one match, so there is nothing on it a tap could mean instead — which
   * is also why the two openers can share it. Before the match it enters what
   * you expect, after it, it explains what happened.
   */
  const Shell = canOpen ? 'button' : 'div'

  return (
    <Shell
      {...(canOpen
        ? {
            type: 'button' as const,
            onClick: canOpenBreakdown ? onOpen : onOpenExpected,
            title: canOpenBreakdown
              ? 'Aktionen dieses Spiels ansehen'
              : 'Erwartete Punkte eintragen',
          }
        : {})}
      className={cn(
        'flex w-full flex-col overflow-hidden rounded-card border border-line bg-surface text-left',
        // A fixture still to come is a placeholder, not a result.
        !match.isFinished && 'opacity-60',
        canOpen &&
          'transition-colors hover:border-accent/40 hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
      )}
    >
      <div className="flex w-full items-center gap-2.5 px-3 py-2">
        <span className="nums w-6 shrink-0 text-xs text-faint">
          {match.day}.
        </span>

        <span className="flex w-5 shrink-0 justify-center">
          <Venue
            size={13}
            aria-label={match.isHome ? 'Heimspiel' : 'Auswärtsspiel'}
            className={match.isHome ? 'text-positive' : 'text-accent'}
          />
        </span>

        <Avatar
          src={match.opponentImage}
          name={opponent?.name ?? match.opponentId}
          size={22}
          square
          className="shrink-0 bg-transparent"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="min-w-0 truncate text-sm font-medium text-ink">
              {opponent?.name ?? '–'}
            </span>
            {match.isFinished && (
              <Scoreline
                goalsFor={match.goalsFor}
                goalsAgainst={match.goalsAgainst}
                outcome={match.outcome}
              />
            )}
          </div>

          <div className="mt-0.5 flex items-center gap-1.5 text-[0.6875rem]">
            {match.isFinished ? (
              <MatchRoleMark role={match.role} />
            ) : (
              <span className="shrink-0 text-faint">
                {kickoff(match.kickoff)}
              </span>
            )}
            {played && (
              <span className="nums flex shrink-0 items-center gap-0.5 text-faint">
                <Timer size={10} aria-hidden="true" />
                {match.minutes}′
              </span>
            )}
            {match.events.length > 0 && (
              <span className="flex min-w-0 items-center gap-1">
                {match.events.map((event) => (
                  <MatchEventBadge key={event.kind} event={event} />
                ))}
              </span>
            )}
          </div>
        </div>

        {match.points === undefined && expected !== undefined ? (
          <ExpectedPointsBadge
            value={expected.value}
            isForecast={!expected.isOwn}
            className="text-[0.6875rem]"
          />
        ) : (
          <span
            style={color === undefined ? undefined : { color }}
            className={cn(
              'nums shrink-0 text-sm font-bold',
              match.points === undefined && 'text-faint',
            )}
          >
            {match.points === undefined ? '–' : formatPoints(match.points)}
          </span>
        )}
      </div>

      {/* Flush against the card's bottom edge, so a column of rows reads as a
          bar chart on its side without anything drawing a chart. Only for
          matches that were actually played — an empty track under every
          upcoming fixture would be a row of nothing. */}
      {match.points !== undefined && color !== undefined && (
        <span
          aria-hidden="true"
          className="block h-1 w-full shrink-0 bg-surface-2"
        >
          <span
            className="block h-full rounded-r-full transition-[width]"
            style={{
              width: `${String(pointsFraction(match.points, pointsScale) * 100)}%`,
              background: color,
            }}
          />
        </span>
      )}
    </Shell>
  )
}

/** `5:1`, coloured by how it went for this player's club. */
export function Scoreline({
  goalsFor,
  goalsAgainst,
  outcome,
}: {
  goalsFor: number | undefined
  goalsAgainst: number | undefined
  outcome: MatchOutcome | undefined
}) {
  return (
    <span
      title={outcome === undefined ? undefined : OUTCOME_NAME[outcome]}
      className={cn(
        'nums shrink-0 text-xs font-bold',
        outcome === undefined ? 'text-muted' : OUTCOME_CLASS[outcome],
      )}
    >
      {goalsFor}:{goalsAgainst}
    </span>
  )
}
