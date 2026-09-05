import { useCallback, useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/cn'

/** How long the finger has to stay down, by default. */
const DEFAULT_HOLD_MS = 3000

/**
 * A button that has to be **held**, filling as it goes, and fires only when it
 * is full.
 *
 * For the one action in the app that cannot be undone. A confirmation dialog
 * asks "are you sure" and is answered by the same reflex that got you there —
 * two taps in the same place, half a second apart. Three seconds of deliberate
 * contact is a different kind of answer: it cannot be given by accident, it can
 * be withdrawn at any point up to the last moment, and the fill says exactly
 * how much time is left to withdraw it.
 *
 * **Let go early and nothing happens** — the fill drains back and no request is
 * sent. That is the property the whole control exists for, so the drain is
 * drawn rather than snapped: a bar that vanished would leave the reader unsure
 * whether it had fired.
 *
 * The progress is state, updated per animation frame. Sixty renders a second of
 * one small component for three seconds is nothing next to the alternative — a
 * CSS transition whose completion is inferred from `transitionend`, which is
 * exactly the event that does not arrive when the transition is interrupted,
 * which is the case that must never fire the request.
 *
 * Keyboard works the same way: hold Enter or Space. The auto-repeat a held key
 * produces is ignored (`event.repeat`), so the timer starts once.
 */
export function HoldButton({
  onComplete,
  label,
  holdingLabel,
  holdMs = DEFAULT_HOLD_MS,
  disabled = false,
  className,
}: {
  /** Fired once, at the moment the bar fills. */
  onComplete: () => void
  /** What the button says at rest. */
  label: string
  /** What it says while being held — the instruction, not the action. */
  holdingLabel: string
  holdMs?: number
  disabled?: boolean
  className?: string
}) {
  const [progress, setProgress] = useState(0)
  const [isHolding, setIsHolding] = useState(false)

  const frame = useRef<number | undefined>(undefined)
  // Read through a ref: the loop is installed once per press and would
  // otherwise keep calling the handler the closure captured at that moment.
  const complete = useRef(onComplete)
  useEffect(() => {
    complete.current = onComplete
  })

  const stop = useCallback(() => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current)
    frame.current = undefined
    setIsHolding(false)
    setProgress(0)
  }, [])

  // A component unmounted mid-hold — the dialog closed under it — must not
  // leave a frame scheduled that then sets state on nothing.
  useEffect(() => stop, [stop])

  const start = useCallback(() => {
    if (disabled || frame.current !== undefined) return
    setIsHolding(true)

    const startedAt = performance.now()
    const tick = (now: number) => {
      const ratio = Math.min(1, (now - startedAt) / holdMs)
      setProgress(ratio)

      if (ratio < 1) {
        frame.current = requestAnimationFrame(tick)
        return
      }
      // Full. Fire once and reset — the ref is cleared *first* so a press that
      // is still down cannot schedule another frame behind the handler.
      frame.current = undefined
      setIsHolding(false)
      setProgress(0)
      complete.current()
    }
    frame.current = requestAnimationFrame(tick)
  }, [disabled, holdMs])

  const remaining = Math.ceil((holdMs / 1000) * (1 - progress))

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(event) => {
        if (event.repeat) return
        if (event.key === 'Enter' || event.key === ' ') start()
      }}
      onKeyUp={(event) => {
        if (event.key === 'Enter' || event.key === ' ') stop()
      }}
      onBlur={stop}
      className={cn(
        'relative flex h-12 w-full items-center justify-center overflow-hidden',
        'rounded-xl border border-negative/40 bg-negative/15 font-semibold text-negative',
        'transition-colors select-none',
        // Holding is a gesture: no text cursor, no scroll stealing the press,
        // no long-press context menu on the way to three seconds.
        'touch-none',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
    >
      {/* The fill, behind the label. `origin-left` + `scaleX` so the growth is
          composited rather than laid out sixty times a second. */}
      <span
        aria-hidden="true"
        style={{ transform: `scaleX(${String(progress)})` }}
        className={cn(
          'absolute inset-0 origin-left bg-negative/45',
          // Only the drain is animated. The fill is driven frame by frame and
          // a transition on top of that would lag it.
          isHolding ? '' : 'transition-transform duration-200',
        )}
      />

      {/* `aria-hidden` with the label carried by `aria-label` above: the
          countdown is decoration, and a screen reader reciting a number that
          changes three times would drown the label that says what the button
          does. */}
      <span aria-hidden="true" className="relative">
        {isHolding ? `${holdingLabel} ${String(remaining)}` : label}
      </span>
    </button>
  )
}
