import { ArrowUpToLine } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'

import { cn } from '@/lib/cn'

/**
 * The steps the shortcut rows offer, coarsest first so the two rows line up
 * column by column.
 *
 * A hundred thousand is the unit market values actually move in overnight; ten
 * thousand is the one you reach for when a hundred overshoots and a thousand
 * takes ten taps, which is most of the time; a thousand is haggling range; one
 * euro exists because a tie goes to the higher bid, and outbidding someone by a
 * single euro is a real move.
 */
const STEPS = [100_000, 10_000, 1_000, 1] as const

/**
 * The steps a row of **points** offers, same order, same reasoning one scale
 * down: fifty is a good matchday's worth, ten is the size of the adjustment
 * "he might get an assist" is worth, five is the last nudge.
 *
 * Points are not money, so they get their own list — but they get the
 * identical control, down to the hold-to-repeat, because the gesture is the
 * same one. See [`ExpectedPointsDialog`](../squad/ExpectedPointsDialog.tsx).
 */
const POINT_STEPS = [50, 10, 5] as const

/** Which scale the buttons step on. */
export type StepScale = 'money' | 'points'

const SCALES: Record<StepScale, readonly number[]> = {
  money: STEPS,
  points: POINT_STEPS,
}

/** `+100k`, `−10k`, `+1k`, `+1` — compact enough for an eight-button grid. */
function stepLabel(amount: number, sign: 1 | -1): string {
  const prefix = sign > 0 ? '+' : '−'
  if (amount >= 1_000) return `${prefix}${String(amount / 1_000)}k`
  return `${prefix}${String(amount)}`
}

/** How long a button must be held before it starts repeating, and how fast. */
const HOLD_DELAY_MS = 400
const REPEAT_MS = 60

/**
 * Press-and-hold to repeat, the way a held keyboard key behaves.
 *
 * `+1` exists to outbid someone by a euro, but reaching a five-figure
 * adjustment a euro per tap is not a thing anyone should be asked to do — so
 * holding the button keeps it firing. The pause before the repeat starts is
 * what keeps a single deliberate tap from becoming three.
 *
 * The step is read through a ref: the interval is installed once per press,
 * and the closure it captured would otherwise keep adding to the amount the
 * field held when the finger went down.
 */
function useHoldRepeat(onStep: () => void) {
  const step = useRef(onStep)
  useEffect(() => {
    step.current = onStep
  })

  const timers = useRef<{
    delay?: ReturnType<typeof setTimeout>
    repeat?: ReturnType<typeof setInterval>
  }>({})
  // A pointer press already fired on `pointerdown`; the `click` that follows
  // it must not fire again. Keyboard activation has no pointer event, so the
  // same `click` is exactly how Enter and Space get their turn.
  const wasPointer = useRef(false)

  const stop = useCallback(() => {
    clearTimeout(timers.current.delay)
    clearInterval(timers.current.repeat)
    timers.current = {}
  }, [])

  useEffect(() => stop, [stop])

  const start = useCallback(() => {
    wasPointer.current = true
    step.current()
    timers.current.delay = setTimeout(() => {
      timers.current.repeat = setInterval(() => {
        step.current()
      }, REPEAT_MS)
    }, HOLD_DELAY_MS)
  }, [])

  return {
    onPointerDown: start,
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onClick: () => {
      if (wasPointer.current) {
        wasPointer.current = false
        return
      }
      step.current()
    },
  }
}

/** One shortcut button. Its own component so the hold-repeat state is its own. */
function AmountStepButton({
  amount,
  sign,
  onStep,
}: {
  amount: number
  sign: 1 | -1
  onStep: (delta: number) => void
}) {
  const handlers = useHoldRepeat(() => {
    onStep(sign * amount)
  })

  return (
    <button
      type="button"
      {...handlers}
      /* Direction is carried by the border, not by a fill: eight solid green
         and red blocks would read as eight warnings, and these are the least
         consequential controls in the dialog — nothing is written until the
         confirm. A tinted edge and the sign are enough to tell the rows
         apart at a glance. */
      className={cn(
        // `flex-1 min-w-0` so the four share their row evenly and a long
        // label (`+100k`) shrinks rather than pushing its neighbours out.
        'nums h-10 min-w-0 flex-1 rounded-xl border text-sm font-semibold select-none',
        'bg-surface transition-colors',
        // Holding is a gesture, and a text cursor mid-hold looks like a bug.
        'touch-none',
        sign > 0
          ? 'border-positive/40 text-positive hover:border-positive hover:bg-positive/10'
          : 'border-negative/40 text-negative hover:border-negative hover:bg-negative/10',
      )}
    >
      {stepLabel(amount, sign)}
    </button>
  )
}

/**
 * Eight shortcuts for a seven-digit figure: four up, four down.
 *
 * Shared by the two dialogs that ask for a sum of money — the
 * [bid](../market/OfferDialog.tsx) and the
 * [asking price](../player/PlayerSaleDialogs.tsx) — which want the identical
 * control down to the hold-to-repeat, and had no business owning two copies of
 * it.
 *
 * **One row per direction**: every `+` together, every `−` under it, the steps
 * in the same order both times — so a finger that has learnt where `+1k` is
 * finds `−1k` directly beneath.
 *
 * Two flex rows rather than one grid of eight. A grid gets the same picture out
 * of `grid-cols-4`, and did until the fourth step was added, but it makes the
 * rows an artefact of a column count: the buttons are one flat list and the
 * layout is the only thing saying which of them mean *up*. Here the row **is**
 * the group, which is what it looks like — and it cannot silently collapse to
 * one button per line if that single utility ever fails to reach the
 * stylesheet, which is exactly how this was found.
 *
 * `onStep` must be stable across renders — a held button installs one interval
 * and fires it repeatedly, so a delta applied to a value captured at press time
 * would add the same step to the same number for as long as the finger stayed
 * down. Give it the functional form of a `setState`.
 *
 * `scale` picks which list of steps the rows offer, and is the only thing the
 * points caller changes: the labels are derived from the figures, so a
 * three-digit step prints as `+50` without being told it is not euros.
 */
export function AmountSteps({
  onStep,
  scale = 'money',
}: {
  onStep: (delta: number) => void
  scale?: StepScale
}) {
  const steps = SCALES[scale]

  return (
    <>
      {([1, -1] as const).map((sign) => (
        <div key={String(sign)} className="flex gap-2">
          {steps.map((step) => (
            <AmountStepButton
              key={String(step)}
              amount={step}
              sign={sign}
              onStep={onStep}
            />
          ))}
        </div>
      ))}
    </>
  )
}

/**
 * The units the round-up row offers, coarsest first — same order as
 * {@link STEPS}, so the whole block reads big-to-small top to bottom.
 *
 * A million and a hundred thousand, because those are the two figures a price
 * gets tidied to: an asking price of `4.837.000 €` is a number nobody chose,
 * and the two taps that would fix it with {@link STEPS} are arithmetic done in
 * your head first.
 */
const ROUND_UNITS = [1_000_000, 100_000] as const

/** `1 Mio.`, `100k` — the unit, in the notation the market uses for it. */
function unitLabel(unit: number): string {
  if (unit >= 1_000_000) return `${String(unit / 1_000_000)} Mio.`
  return `${String(unit / 1_000)}k`
}

/**
 * **Round the figure up** to the next million, or the next hundred thousand.
 *
 * A row above the [step shortcuts](#AmountSteps), and deliberately not one of
 * them: a step is a delta and these are a *destination*. `4.837.000 €` becomes
 * `5.000.000 €` or `4.900.000 €` in one tap, where the `+` rows get there by
 * asking the reader to work out the difference first.
 *
 * **Already-round is left alone.** A ceiling, not a bump: a figure sitting
 * exactly on a million stays where it is rather than jumping to the next one,
 * because the tap means "make this round" and it already is.
 *
 * The arrow-to-line mark is what says *up to*, and it carries the meaning on
 * its own — the label beside it is the unit, so the button reads `↥ 1 Mio.`
 * even before the row's own label is read.
 *
 * No hold-to-repeat here, unlike the steps: a second tap on a rounded figure
 * does nothing at all, so there is nothing to repeat.
 */
export function AmountRoundUp({
  onRoundUp,
}: {
  onRoundUp: (unit: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-xs text-faint">Aufrunden auf</span>
      {ROUND_UNITS.map((unit) => (
        <button
          key={String(unit)}
          type="button"
          aria-label={`Auf ${unitLabel(unit)} aufrunden`}
          onClick={() => {
            onRoundUp(unit)
          }}
          /* Neutral where the step rows are tinted: nothing about rounding is
             a direction the way `+` and `−` are, and a third coloured row
             would compete with the two that carry a sign. */
          className={cn(
            'nums flex h-10 min-w-0 flex-1 items-center justify-center gap-1',
            'rounded-xl border border-line bg-surface text-sm font-semibold',
            'text-muted transition-colors select-none',
            'hover:border-muted hover:bg-surface-2 hover:text-ink',
          )}
        >
          <ArrowUpToLine size={14} aria-hidden="true" className="shrink-0" />
          {unitLabel(unit)}
        </button>
      ))}
    </div>
  )
}
