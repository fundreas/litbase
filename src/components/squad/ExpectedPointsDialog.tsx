import { X } from 'lucide-react'
import { useCallback, useState } from 'react'

import type { TeamFixture } from '@/api/models'
import type { ExpectedPointsSubject } from '@/components/squad/ExpectedPointsSheet'
import { FixtureBadge } from '@/components/squad/FixtureBadge'
import { AmountSteps } from '@/components/ui/AmountSteps'
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
 * **What do you think he will score?** — the guess, and the match it is about.
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
 * **It opens at 100 rather than at nothing.** An empty field asks the reader
 * to invent a scale from scratch; a round hundred is roughly a good matchday
 * and puts the question where it belongs — *more than that, or less?* — which
 * is the question the shortcut rows are then there to answer in taps. A guess
 * already entered wins over the default, because reopening the sheet is
 * almost always an adjustment.
 *
 * **The season's average sits under the field** wherever the list that opened
 * the sheet knows it, and is the only figure here that is not the reader's own
 * invention. It is what a guess is calibrated against, and the fixture above
 * it — and who it is against — is what would move it away from the average.
 *
 * **✗ deletes the guess**, at the end of the field it deletes, exactly as the
 * market's withdraw sits on the amount it takes back. It appears only once
 * there is something stored, so it can never be mistaken for "clear the
 * field": the field is cleared by the keyboard.
 *
 * Mount it with `key={player.id}`: the amount is seeded once, at mount, and a
 * component per player is what keeps a squad refetch from writing over a
 * half-typed figure.
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

  // Text, not a number: a controlled number input coerces on every keystroke
  // and so cannot be cleared to retype. Minus is kept because Kickbase points
  // genuinely go below zero.
  const [amount, setAmount] = useState(() =>
    String(stored ?? DEFAULT_EXPECTED_POINTS),
  )

  // Functional, and stable across renders: a held shortcut installs one
  // interval, and a delta applied to the value captured at press time would
  // add the same step to the same number for as long as the finger stayed
  // down. No floor at zero — unlike money, this figure is allowed to be
  // negative.
  const stepBy = useCallback((delta: number) => {
    setAmount((current) => {
      const parsed = Number(current)
      return String((Number.isFinite(parsed) ? parsed : 0) + delta)
    })
  }, [])

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
            setAmount(sign + raw.replace(/\D/g, ''))
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
                title="Erwartung löschen"
                aria-label="Erwartung löschen"
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

        <AmountSteps onStep={stepBy} scale="points" />
      </div>
    </ConfirmDialog>
  )
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
