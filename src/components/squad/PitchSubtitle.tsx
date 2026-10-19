import type { PlayerFigure, TeamFixture } from '@/api/models'
import {
  figureDescription,
  figureLabel,
  isScore,
} from '@/components/player/playerFigure'
import { ExpectedPointsFigure } from '@/components/squad/ExpectedPointsBadge'
import {
  expectedTextClass,
  forecastComparison,
} from '@/components/squad/expectedPointsLabels'
import { FixtureBadge } from '@/components/squad/FixtureBadge'
import type { PlayerMetrics } from '@/components/squad/pitchMetrics'
import {
  nextPitchSubtitle,
  PITCH_SUBTITLE,
} from '@/components/squad/pitchSubtitles'
import { cn } from '@/lib/cn'
import { kickoff, kickoffShort, points } from '@/lib/format'
import type { ExpectedPointsEntry } from '@/lib/expectedPoints'
import { usePreferences } from '@/preferences/usePreferences'

/**
 * **The second line of a player card on the grass**: the opponent's crest, and
 * one thing beside it — see
 * [`PitchSubtitle`](../../preferences/preferences.ts).
 *
 * One component for every pitch that has the choice, because the alternative
 * is three plates drifting apart: the same player must be the same two lines
 * on his own squad, on a rival's, and on both halves of a duel, or a reader
 * comparing two screens is comparing two vocabularies.
 *
 * ## The crest is always there
 *
 * *Who is he playing* is the question a pitch of eleven different clubs raises
 * on every single card, and it is the one thing on the plate that no other
 * part of the screen answers. So the [fixture badge](./FixtureBadge.tsx) — the
 * crest with the home-or-away chip on it, the same mark the Kader's rows carry
 * — holds the left of the line unconditionally, and the chip in the corner
 * only decides what stands next to it.
 *
 * It was briefly a third reading of its own, one the reader had to switch to.
 * That was the wrong shape: a pitch of crests answered *is this a good
 * weekend* beautifully and cost you the points to do it, when the two fit side
 * by side at every size the sizing search produces. The editor's plate had
 * been drawing exactly this pair — *Bayern away, 141* — for its whole life.
 *
 * ## What rides beside it
 *
 * **`points`** is what the pitches have always drawn and the default: the
 * score, the running figure, or what he is
 * [expected](./ExpectedPointsBadge.tsx) to make of a match still to come, in
 * the target glyph and the two colours that distinction has everywhere else.
 *
 * **`kickoff`** is the time today and the weekday before that — the half of an
 * instant that fits, through the same
 * [`kickoffShort`](../../lib/format.ts) every list in the app uses. It is the
 * Friday-evening reading: who is already done, who plays Sunday.
 *
 * **A real score overrules `kickoff`.** A player who has points has already
 * kicked off, so printing the whistle he has been through would spend the line
 * on the one fact that no longer matters about him. The setting is really
 * about the matches still to come, and on a half-played matchday the plates
 * sort themselves: the finished men show their points, the rest show when they
 * start.
 *
 * Only the running figure is tinted, as before. A real score is drawn at full
 * contrast and anything standing in for one — a time, a weekday, a dash —
 * stays quiet, so the eye finds the numbers first on the pitch that has them.
 *
 * ## Once the match is over, the model is marked
 *
 * A settled player's plate carries **both numbers**: what he scored, and what
 * the [pointcast](../../api/hooks/usePointcast.ts) predicted he would — `141·118`,
 * the score in white and the prediction in the orange the model has
 * everywhere else. A prediction is a claim, and a claim nobody ever checks is
 * decoration; this is the one moment in a player's week where the check costs
 * a glance rather than a trip to another screen.
 *
 * **Strictly the model's own figure**, never the reader's guess standing in
 * for it — see [`forecast`](../../lib/expectedPoints.ts). The whole value of
 * the pair is that one half of it was written down before kick-off by
 * something that cannot change its mind afterwards.
 *
 * **Only between the final whistle and the score**, which is what
 * [`isSettled`](../../api/models.ts) decides: a running match would be
 * comparing a half-finished tally against a ninety-minute prediction.
 *
 * It costs width, and the tightest plate in the app — a phone's eight-band
 * duel pitch, 42 pixels — cannot hold all of it. That is why the pair is
 * drawn bare: no target glyph, a hairline `·` between, and the **prediction**
 * is the half that truncates, because it is the half the reader can live
 * without. The tooltip and the label spell the comparison out in full,
 * deviation included.
 *
 * **It is also the one reading that can simply be missing**, where the model
 * has no file for the matchday on screen — the run publishes the coming
 * matchday and drops the ones behind it, so an old matchday is a plate of
 * plain scores again. Nothing says so, because nothing is wrong: this is a
 * second figure on a line that was complete without it.
 */
export function PitchSubtitleLine({
  figure,
  fixture,
  expected,
  forecast,
  metrics,
  isRunning,
}: {
  /** The player's one figure, from [`playerFigure`](../../api/models.ts). */
  figure: PlayerFigure
  /** His match this matchday; `undefined` where his club has none. */
  fixture: TeamFixture | undefined
  /** What he is expected to score, where that applies. */
  expected: ExpectedPointsEntry | undefined
  /**
   * What the **model** predicted, for a player whose match is settled — the
   * other half of the pair above. `undefined` everywhere else, which is every
   * match still to come and every matchday the run no longer publishes.
   */
  forecast?: number | undefined
  metrics: PlayerMetrics
  /** Is his match being played right now? Tints the figure. */
  isRunning: boolean
}) {
  const { preferences } = usePreferences()
  /* The kick-off reading, but only while the kick-off is still the news —
     see "A real score overrules `kickoff`" above. */
  const showsKickoff =
    preferences.pitchSubtitle === 'kickoff' && !isScore(figure)
  /* Nothing to put beside the crest: no match at all, or a match with neither
     a score nor a prediction behind it. The badge already draws the dash for
     that case, and a second one next to it would read as two facts. */
  const isBare =
    fixture === undefined ||
    (!showsKickoff && expected === undefined && figure.kind === 'unknown')
  /* The marked model — only ever beside a real score, and only where the
     caller found one (every caller asks `isSettled` first). `expected` cannot
     be set at the same time: one is the window before kick-off, the other the
     window after the whistle. */
  const marked =
    forecast !== undefined && figure.kind === 'points'
      ? { scored: figure.points, forecast }
      : undefined

  return (
    <span
      style={{ fontSize: metrics.nameFontSize }}
      className="flex max-w-full items-center justify-center gap-0.5 leading-none"
    >
      <FixtureBadge
        fixture={fixture}
        tone="onPitch"
        size={metrics.badgeCrest}
      />

      {isBare ? null : showsKickoff ? (
        <span
          title={`Anpfiff ${kickoff(fixture.kickoff)}`}
          className="nums min-w-0 truncate font-bold text-white/70"
        >
          {kickoffShort(fixture.kickoff)}
        </span>
      ) : (
        <span
          title={
            marked === undefined
              ? figureDescription(figure)
              : forecastComparison(marked.scored, marked.forecast)
          }
          className={cn(
            /* A flex row rather than one truncating line, because the expected
               figure is two things — the target and the number — and the
               number is the half that may be clipped. */
            'nums flex min-w-0 items-center gap-0.5 font-bold',
            isRunning
              ? 'text-accent'
              : expected !== undefined
                ? expectedTextClass(expected)
                : isScore(figure)
                  ? 'text-white'
                  : 'text-white/55',
          )}
        >
          {expected !== undefined ? (
            <ExpectedPointsFigure
              value={expected.value}
              fontSize={metrics.nameFontSize}
            />
          ) : (
            <>
              {/* The score never gives way: `shrink-0` on the half that is a
                  fact, so a narrow plate eats the prediction from the right
                  rather than clipping the number the reader came for. */}
              <span
                className={cn(
                  'min-w-0 truncate',
                  marked !== undefined && 'shrink-0',
                )}
              >
                {figureLabel(figure)}
              </span>
              {/* Separator and prediction as **one** shrinking unit, so the
                  pair costs a single gap rather than two — four pixels of a
                  42px plate are a whole digit. The model's orange, and no
                  target glyph: the target is what tells a prediction from a
                  score *before* a match, and after one the score is standing
                  right beside it saying the same thing in half the width. */}
              {marked !== undefined && (
                <span className="min-w-0 truncate text-warning">
                  <span aria-hidden="true" className="text-white/35">
                    ·
                  </span>
                  {points(marked.forecast)}
                </span>
              )}
            </>
          )}
        </span>
      )}
    </span>
  )
}

/**
 * **The switch, as one labelled chip on the grass.**
 *
 * In the pitch's top-right corner, drawn as the same smoked disc the
 * [full-screen button](../ui/FullscreenPane.tsx) and the duel's side labels
 * use, so it reads as furniture belonging to the pitch rather than a control
 * floating over it. The corner is where it has to be: the question it answers
 * is asked *while looking at the eleven*, and a setting buried on the
 * preferences page would be found by nobody and changed by nobody.
 *
 * It **names its own state** — *Punkte* or *Anpfiff* — rather than showing two
 * glyphs with one lit, for the reason [`ValueModeButton`](./ValueMode.tsx)
 * does: neither glyph *is* the thing on the plate, so a row of them would say
 * nothing about what the pitch is currently showing. A tap moves to the other
 * reading and the label moves with it.
 *
 * The choice is a [preference](../../preferences/preferences.ts), so every
 * pitch in the app changes at once and the setting outlives the visit.
 *
 * Only drawn on the pitches whose players come from **different clubs** — see
 * the [squad page](../../../docs/pages/squad.md#was-unter-dem-namen-steht).
 */
export function PitchSubtitleToggle({ className }: { className?: string }) {
  const { preferences, setPreference } = usePreferences()
  const current = preferences.pitchSubtitle
  const next = nextPitchSubtitle(current)
  const Icon = PITCH_SUBTITLE[current].icon

  return (
    <button
      type="button"
      onClick={() => {
        setPreference('pitchSubtitle', next)
      }}
      title={`Neben dem Gegner: ${PITCH_SUBTITLE[current].title} · tippen für: ${PITCH_SUBTITLE[next].label}`}
      aria-label={`Neben dem Gegner: ${PITCH_SUBTITLE[current].title}. Wechseln zu: ${PITCH_SUBTITLE[next].title}`}
      className={cn(
        'z-10 flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5',
        'bg-black/45 text-[0.6875rem] font-semibold text-white/85 backdrop-blur-sm',
        'transition-colors hover:bg-black/65 hover:text-white',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        className,
      )}
    >
      <Icon size={13} aria-hidden="true" className="shrink-0" />
      {PITCH_SUBTITLE[current].label}
    </button>
  )
}
