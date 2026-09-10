import { X } from 'lucide-react'
import { useCallback, useState } from 'react'

import type { PointcastPrediction, TeamFixture } from '@/api/models'
import type { ExpectedPointsSubject } from '@/components/squad/ExpectedPointsSheet'
import { FixtureBadge } from '@/components/squad/FixtureBadge'
import { usePointcastPrediction } from '@/components/squad/useExpectedPointsView'
import { AmountSteps } from '@/components/ui/AmountSteps'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import {
  clearExpectedPoints,
  DEFAULT_EXPECTED_POINTS,
  setExpectedPoints,
  useExpectedPoints,
} from '@/lib/expectedPoints'
import { kickoff, points } from '@/lib/format'

/**
 * **What do you think he will score?** — the guess, the match it is about, and
 * what the model thinks.
 *
 * Opened from the fixture crest at the end of one's own squad row — the one
 * part of that row already about the coming matchday — and from the target
 * mark at the end of a row in a [rival's](../manager/ManagerSquadTab.tsx) or a
 * [club's](../team/TeamSquadTab.tsx) squad, which have no crest to hang it on.
 * Which list a player was tapped in changes nothing here: a guess is filed
 * against a player and a matchday, not against a screen.
 *
 * The guess is stored per matchday in
 * [`expectedPoints`](../../lib/expectedPoints.ts) and goes nowhere near
 * Kickbase: nobody else can see it, and nothing in the app acts on it except
 * the badge on the row and the total over the pitch.
 *
 * **It opens on the prediction.** The
 * [pointcast](../../api/hooks/usePointcast.ts) figure is the field's default,
 * because a guess is an adjustment to what is already expected far more often
 * than it is a number invented from nothing — and the shortcut rows below then
 * answer the only question left, *more than that, or less?* A guess already
 * entered wins over the prediction, as it wins everywhere else in the app; a
 * player the model has nothing for falls back to
 * {@link DEFAULT_EXPECTED_POINTS}.
 *
 * **The prediction stays on the screen either way** — see
 * {@link PredictionPanel}. It is the one figure here that is neither the
 * reader's own invention nor a fact about the past, and once it can be typed
 * over it has to remain visible, or a reader who nudged the number twice has
 * no way back to what the model actually said.
 *
 * **The season's average sits under the field** wherever the list that opened
 * the sheet knows it. It is what a guess is calibrated against, and the
 * fixture above it — and who it is against — is what would move it away from
 * the average.
 *
 * **✗ deletes the guess**, at the end of the field it deletes, exactly as the
 * market's withdraw sits on the amount it takes back. It appears only once
 * there is something stored, so it can never be mistaken for "clear the
 * field": the field is cleared by the keyboard. What is left afterwards is the
 * prediction, on the row and in this field.
 *
 * Mount it with `key={player.id}`: the field tracks one player's figures, and
 * a component per player is what keeps a squad refetch from writing over a
 * half-typed number.
 */
export function ExpectedPointsDialog({
  player,
  matchday,
  onClose,
}: {
  player: ExpectedPointsSubject
  matchday: number
  onClose: () => void
}) {
  const stored = useExpectedPoints(matchday)[player.id]
  const { prediction, isPending } = usePointcastPrediction(matchday, player.id)

  /*
   * What the field shows until the reader touches it: his own guess, else the
   * model's figure, else a round hundred.
   *
   * Text, not a number: a controlled number input coerces on every keystroke
   * and so cannot be cleared to retype. Minus is kept because Kickbase points
   * genuinely go below zero.
   *
   * **`undefined` means untouched**, and that is load-bearing rather than
   * tidy. The prediction arrives over the network — usually already cached by
   * the list behind this sheet, but not always — so a figure seeded once at
   * mount would be a hundred for anyone who opened the sheet first and asked
   * the question later. Untouched, the field follows whatever the default
   * becomes; the first keystroke or step pins it, and nothing that lands
   * afterwards can move it.
   */
  const seed = stored ?? prediction?.expected ?? DEFAULT_EXPECTED_POINTS
  const [typed, setTyped] = useState<string>()
  const amount = typed ?? String(seed)

  // Functional: a held shortcut installs one interval, and a delta applied to
  // the value captured at press time would add the same step to the same
  // number for as long as the finger stayed down. `seed` is a dependency
  // because an untouched field has no value of its own to add to — a step is
  // then a step away from the prediction. No floor at zero: unlike money,
  // this figure is allowed to be negative.
  const stepBy = useCallback(
    (delta: number) => {
      setTyped((current) => {
        const parsed = Number(current ?? seed)
        return String((Number.isFinite(parsed) ? parsed : 0) + delta)
      })
    },
    [seed],
  )

  const value = Number(amount)
  const isValid = amount !== '' && amount !== '-' && Number.isFinite(value)

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={player.name}
      description={
        <MatchSummary fixture={player.fixture} matchday={matchday} />
      }
      confirmLabel={stored === undefined ? 'Eintragen' : 'Ändern'}
      isConfirmDisabled={!isValid}
      onConfirm={() => {
        if (!isValid) return
        setExpectedPoints(matchday, player.id, value)
        onClose()
      }}
    >
      <div className="flex flex-col gap-2">
        <Input
          label="Erwartete Punkte"
          // `inputMode` rather than `type="number"`: the numeric keypad
          // without the spinner arrows, which are useless next to the
          // shortcut rows below.
          inputMode="numeric"
          className="nums"
          value={amount}
          onChange={(event) => {
            // Digits, and a single leading minus — anything else a keypad can
            // produce would only ever make the figure unparseable.
            const raw = event.target.value
            const sign = raw.startsWith('-') ? '-' : ''
            setTyped(sign + raw.replace(/\D/g, ''))
          }}
          /* Only what the list actually knows: a club's roster carries an
             average and no season total, and a hint that printed `–` for it
             would be inventing a gap rather than reporting one. */
          hint={
            player.averagePoints === undefined ? undefined : (
              <span className="nums">
                Ø {points(player.averagePoints)} pro Spiel
                {player.totalPoints !== undefined && (
                  <> · {points(player.totalPoints)} in dieser Saison</>
                )}
              </span>
            )
          }
          trailing={
            stored === undefined ? undefined : (
              <button
                type="button"
                title={DELETE_LABEL}
                aria-label={DELETE_LABEL}
                onClick={() => {
                  clearExpectedPoints(matchday, player.id)
                  onClose()
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-negative/30 bg-negative/10 text-negative transition-colors hover:bg-negative/25"
              >
                <X size={18} aria-hidden="true" />
              </button>
            )
          }
        />

        <PredictionPanel
          prediction={prediction}
          isPending={isPending}
          // Compared against the figure in the field, not against the stored
          // guess: the button is an undo for the nudges just made, and it has
          // no business being there while the field already says what the
          // model says.
          isAdopted={isValid && prediction?.expected === value}
          onAdopt={() => {
            if (prediction !== undefined) setTyped(String(prediction.expected))
          }}
        />

        <AmountSteps onStep={stepBy} scale="points" />
      </div>
    </ConfirmDialog>
  )
}

/**
 * What ✗ says it does.
 *
 * Spelled out because deleting a guess no longer leaves the row empty — the
 * prediction takes the slot back — and a reader who expected the chip to
 * disappear should be told before he taps, not after.
 */
const DELETE_LABEL = 'Eigene Erwartung löschen — es gilt wieder die Prognose'

/**
 * **What the model expects**, under the field that overrules it.
 *
 * Always present, in one of three states: the figures, *loading*, or *nothing
 * for this player*. The empty state is a line of text rather than a hidden
 * panel on purpose — a panel that vanished would leave the reader wondering
 * whether the model disagreed with him or simply had not been asked, and those
 * are different things. Ligainsider's own tiers get the same treatment on the
 * row.
 *
 * It is orange throughout, like the chip on the row: the whole panel is the
 * model talking, and the accent green in this sheet belongs to the field the
 * reader types in.
 *
 * The band is `p20 … p80`: the pessimistic case, which includes his not
 * playing at all, and the ceiling. Both are quieter than the headline figure
 * because the headline is the one the field is seeded from — the band is what
 * says how much to trust it, and a 40-to-300 spread is a very different
 * recommendation from 150-to-170 at the same expected points.
 *
 * **Übernehmen appears only once the field has moved off the prediction.** It
 * is a way back, not a way in: the field already opens on the model's figure,
 * so a button offering what is on the screen would be a control that does
 * nothing.
 */
function PredictionPanel({
  prediction,
  isPending,
  isAdopted,
  onAdopt,
}: {
  prediction: PointcastPrediction | undefined
  isPending: boolean
  isAdopted: boolean
  onAdopt: () => void
}) {
  return (
    /* Orange and dashed, exactly as the chip on the row is drawn: the reader
       has to be able to see at a glance that the figure in this panel is the
       same kind of thing as the one he tapped, and a different kind of thing
       from the accent-green number in the field above it. */
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-warning/40 bg-warning/10 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[0.6875rem] font-semibold tracking-wider text-faint uppercase">
            Prognose
          </span>
          {prediction !== undefined && (
            <span className="nums text-base leading-none font-semibold text-warning">
              {points(prediction.expected)}
            </span>
          )}
        </div>

        {prediction === undefined ? (
          <p className="text-xs text-muted">
            {isPending
              ? 'wird geladen …'
              : 'Für diesen Spieler liegt keine Prognose vor.'}
          </p>
        ) : (
          <p className="nums text-xs text-muted">
            {points(Math.min(prediction.low, prediction.high))} –{' '}
            {points(Math.max(prediction.low, prediction.high))} · Startelf{' '}
            {chance(prediction.startChance)} · Einsatz{' '}
            {chance(prediction.playChance)}
          </p>
        )}
      </div>

      {prediction !== undefined && !isAdopted && (
        <Button variant="secondary" size="sm" onClick={onAdopt}>
          Übernehmen
        </Button>
      )}
    </div>
  )
}

/** `64 %` — German spacing, as everywhere else a share is printed. */
function chance(value: number): string {
  return `${String(Math.round(value * 100))} %`
}

/**
 * The match the guess is about, in one line and a half.
 *
 * The same crest the row was tapped on, so the sheet is visibly about the
 * thing that opened it, with the fixture spelled out beside it — the badge is
 * wordless by design on a row, and a dialog has the width to say it properly.
 */
function MatchSummary({
  fixture,
  matchday,
}: {
  fixture: TeamFixture | undefined
  matchday: number
}) {
  return (
    <span className="flex items-center gap-2.5">
      <FixtureBadge fixture={fixture} size="lg" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-ink">
          {fixture === undefined
            ? 'Spielfrei'
            : `${fixture.isHome ? 'Heimspiel gegen' : 'Auswärts bei'} ${fixture.opponentSymbol}`}
        </span>
        <span className="nums block text-xs">
          {String(matchday)}. Spieltag
          {fixture !== undefined && ` · ${kickoff(fixture.kickoff)}`}
        </span>
      </span>
    </span>
  )
}
