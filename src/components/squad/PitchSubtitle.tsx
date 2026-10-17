import type { PlayerFigure, TeamFixture } from '@/api/models'
import {
  figureDescription,
  figureLabel,
  isScore,
} from '@/components/player/playerFigure'
import { ExpectedPointsFigure } from '@/components/squad/ExpectedPointsBadge'
import { expectedTextClass } from '@/components/squad/expectedPointsLabels'
import { FixtureBadge } from '@/components/squad/FixtureBadge'
import type { PlayerMetrics } from '@/components/squad/pitchMetrics'
import {
  nextPitchSubtitle,
  PITCH_SUBTITLE,
} from '@/components/squad/pitchSubtitles'
import { cn } from '@/lib/cn'
import { kickoff, kickoffShort } from '@/lib/format'
import type { ExpectedPointsEntry } from '@/lib/expectedPoints'
import { usePreferences } from '@/preferences/usePreferences'

/**
 * **The second line of a player card on the grass**, in whichever of the three
 * readings the pitch is set to — see
 * [`PitchSubtitle`](../../preferences/preferences.ts).
 *
 * One component for every pitch that has the choice, because the alternative
 * is three plates drifting apart: the same player must be the same two lines
 * on his own squad, on a rival's, and on both halves of a duel, or a reader
 * comparing two screens is comparing two vocabularies.
 *
 * ## Why the three are mutually exclusive
 *
 * The plate is about fifty pixels wide on a phone's eight-band duel pitch.
 * There is room for one answer — a number, a crest, or a time — and the choice
 * exists precisely because all three are worth having and only one fits. The
 * one that is not showing is never lost: it rides along in the card's tooltip
 * and in its screen-reader text.
 *
 * **`points`** is what the pitches always drew and the default: the score, the
 * running figure, or what he is [expected](./ExpectedPointsBadge.tsx) to make
 * of a match still to come, in the target glyph and the two colours that
 * distinction has everywhere else.
 *
 * **`opponent`** is the [fixture badge](./FixtureBadge.tsx) — the crest with
 * the home-or-away chip on it, the same mark the Kader's rows carry. A pitch
 * of eleven crests answers *is this a good weekend for my eleven* in one
 * glance, which no column of numbers does.
 *
 * **`kickoff`** is the time today and the weekday before that — the half of an
 * instant that fits, through the same
 * [`kickoffShort`](../../lib/format.ts) every list in the app uses. It is the
 * Friday-evening reading: who is already done, who plays Sunday.
 *
 * Only the running figure is tinted, as before. A real score is drawn at full
 * contrast and anything standing in for one — a time, a weekday, a dash —
 * stays quiet, so the eye finds the numbers first on the pitch that has them.
 */
export function PitchSubtitleLine({
  figure,
  fixture,
  expected,
  metrics,
  isRunning,
}: {
  /** The player's one figure, from [`playerFigure`](../../api/models.ts). */
  figure: PlayerFigure
  /** His match this matchday; `undefined` where his club has none. */
  fixture: TeamFixture | undefined
  /** What he is expected to score, where that applies. */
  expected: ExpectedPointsEntry | undefined
  metrics: PlayerMetrics
  /** Is his match being played right now? Tints the figure. */
  isRunning: boolean
}) {
  const { preferences } = usePreferences()
  const subtitle = preferences.pitchSubtitle

  if (subtitle === 'opponent') {
    return (
      <FixtureBadge
        fixture={fixture}
        tone="onPitch"
        size={metrics.badgeCrest}
      />
    )
  }

  if (subtitle === 'kickoff') {
    return (
      <span
        title={
          fixture === undefined
            ? 'Kein Spiel an diesem Spieltag'
            : `Anpfiff ${kickoff(fixture.kickoff)}`
        }
        className="nums max-w-full truncate font-bold text-white/70"
      >
        {kickoffShort(fixture?.kickoff)}
      </span>
    )
  }

  return (
    <span
      title={figureDescription(figure)}
      className={cn(
        /* A flex row rather than one truncating line, because the expected
           figure is two things — the target and the number — and the number is
           the half that may be clipped. */
        'nums flex max-w-full items-center justify-center gap-0.5 font-bold',
        isRunning
          ? 'text-accent'
          : expected !== undefined
            ? expectedTextClass(expected)
            : isScore(figure)
              ? 'text-white'
              : 'text-white/55',
      )}
    >
      {expected === undefined ? (
        <span className="min-w-0 truncate">{figureLabel(figure)}</span>
      ) : (
        <ExpectedPointsFigure
          value={expected.value}
          fontSize={metrics.nameFontSize}
        />
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
 * It **names its own state** — *Punkte*, *Gegner*, *Anpfiff* — rather than
 * showing three glyphs with one lit, for the reason
 * [`ValueModeButton`](./ValueMode.tsx) does: none of the three glyphs *is* the
 * thing on the plate, so a row of them would say nothing about what the pitch
 * is currently showing. A tap moves to the next reading and the label moves
 * with it.
 *
 * The choice is a [preference](../../preferences/preferences.ts), so every
 * pitch in the app changes at once and the setting outlives the visit.
 *
 * Only drawn on the pitches where the three readings actually differ — see the
 * [squad page](../../../docs/pages/squad.md#was-unter-dem-namen-steht).
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
      title={`${PITCH_SUBTITLE[current].title} · tippen für: ${PITCH_SUBTITLE[next].label}`}
      aria-label={`Unter dem Namen: ${PITCH_SUBTITLE[current].title}. Wechseln zu: ${PITCH_SUBTITLE[next].title}`}
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
