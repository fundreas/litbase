import { useEffect, useRef, useState } from 'react'

/**
 * The longest a figure spends travelling to its new value.
 *
 * It has to finish **well inside the slot its notification holds the strip
 * for** — see [the replay budget](./useLiveEventTicker.ts) — or the number is
 * still moving when the next action is announced and the reader is watching two
 * things at once. At the top of that budget a slot is three seconds, so a third
 * of a second leaves the figure settled and legible for the rest of it.
 *
 * Shorter than that and it stops reading as a count at all: under about 200ms
 * the eye sees a cut with some flicker in the middle, which is the animation
 * costing something and returning nothing.
 */
const COUNT_MAX_MS = 360

/**
 * What share of the slot the count may spend.
 *
 * The cap above is the whole story at a leisurely three seconds a slot; at the
 * 400ms floor of a busy window it is not — a 360ms count inside a 400ms slot
 * is a number that never stops moving. So the count takes a fixed *share* of
 * whatever slot it was given and the cap only bites at the top end: 240ms of a
 * 400ms floor, 360ms of anything from 600ms up.
 */
const COUNT_SHARE = 0.6

/** How long the direction's colour outlives the count that earned it. */
const TINT_HOLD_MS = 240

/** Which way the last change went — `undefined` once the figure has settled. */
export type CountTrend = 'up' | 'down' | undefined

export interface Counting {
  /** The figure to draw **right now**, mid-count. */
  shown: number | undefined
  /** Green or red while it moves and a moment after; then nothing. */
  trend: CountTrend
}

/** The count's duration for a replay slot of `slotMs`. */
export function countMsFor(slotMs: number): number {
  return Math.min(COUNT_MAX_MS, Math.round(slotMs * COUNT_SHARE))
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * **A figure that travels to its new value instead of jumping to it.**
 *
 * The one thing on the [live pitch](./MatchLineupTab.tsx) that says *this
 * number just changed, and it changed because of the action being announced
 * beside it*. A number that is simply different from the one you last looked
 * at says neither.
 *
 * ## It animates changes, never arrivals
 *
 * The first value a portrait is given is not a change — it is the poll landing,
 * or the reader opening the pitch in the 70th minute. Counting 0 → 110 there
 * would be a fifth of a second of pure fiction about a match that has been
 * going on for an hour. So the first non-`undefined` value is **snapped**, and
 * only what happens after it is counted. Same reasoning as the ticker's own
 * seed.
 *
 * ## `prefers-reduced-motion` snaps, it does not skip
 *
 * The app's [global rule](../../index.css) collapses every CSS animation to
 * nothing, and a `requestAnimationFrame` loop is not a CSS animation — it would
 * sail straight through it. So the query is read here: under it the figure goes
 * to its new value **immediately and completely**. The number is the
 * information and the reader gets all of it; the travelling was always the
 * decoration.
 *
 * The **colour stays** under the same rule, deliberately. Green-for-up is not
 * motion, it is the other half of what the change means, and it is the same
 * `text-positive` / `text-negative` pair the
 * [strip](./LiveEventTicker.tsx) puts on the points badge of the very action
 * that caused it.
 *
 * ## Why the tint is transient
 *
 * A plate that stays green has stopped describing a moment and started
 * describing a player — *this one is doing well* — which is a claim this screen
 * has no business making and, after twenty minutes of a busy match, would be
 * made about most of the pitch. So it fades out a beat after the count settles
 * and the plate goes back to its own styling.
 *
 * ## It is one rAF loop, not twenty-two
 *
 * Every portrait calls this and all but one return on the first line of the
 * effect: a value that has not changed starts no loop. Only the player whose
 * action is being announced, and the club total moving with him, are ever
 * counting — so the cost is two loops at a time, not one per plate.
 */
export function useCountUp(
  target: number | undefined,
  {
    animate,
    durationMs,
  }: {
    /**
     * `false` outside the replay — a settled match, the bell off, the inline
     * pitch — where the figure is simply the authoritative one and there is
     * nothing to announce about it. It then snaps with no tint at all.
     */
    animate: boolean
    durationMs: number
  },
): Counting {
  /**
   * **Where a run in flight has got to**, and `undefined` whenever none is.
   *
   * State only for the frames that are actually moving. Everything else —
   * a figure that has not changed, a stream that is not replaying, a reader who
   * asked for no motion — falls through to `target` **during render**, so the
   * common case sets no state, schedules no work and costs a comparison.
   *
   * The earlier shape held the displayed figure in state at all times and
   * assigned `target` to it from an effect on every change. That is a second
   * render for every poll on every one of twenty-two portraits, to arrive at
   * the value the first render already had in its hand.
   */
  const [travelling, setTravelling] = useState<number | undefined>(undefined)
  const [trend, setTrend] = useState<CountTrend>(undefined)

  /**
   * The last value this hook was *given*, and the last it *painted*.
   *
   * Two refs rather than one because they answer different questions. `settled`
   * is what the poll last said, which is where a new run starts from. `painted`
   * is where the pixels are, which is where a new run starts from **when one is
   * already under way** — an action landing on a player who is still counting
   * should carry on from the figure on screen rather than snapping forward to
   * the one it was heading for.
   *
   * Both are written from effects and from the frame callback, never during
   * render.
   */
  const settled = useRef<number | undefined>(target)
  const painted = useRef<number | undefined>(undefined)

  useEffect(() => {
    const previous = settled.current
    settled.current = target

    const from = painted.current ?? previous

    /*
     * **Did the figure change?** — which is a different question from whether
     * it should travel, and the two are kept apart on purpose. The change is
     * what the colour reports; the travelling is only how it gets there. A
     * reader who has asked for no motion has not asked to be told less.
     */
    const changed =
      animate && target !== undefined && from !== undefined && from !== target

    if (!changed) {
      /*
       * Nothing to schedule: `shown` already falls through to `target` below.
       *
       * **Unless a run was in flight**, and it can be — this effect re-runs on
       * a changing `durationMs` and on the bell going off, neither of which is
       * a new value to travel to. The previous cleanup cancelled the frame but
       * nothing has released the last one it painted, and `shown` prefers it,
       * so the figure would sit at a rounded intermediate value **for good** —
       * until that player's next action, which on a quiet afternoon is a long
       * time to be quietly wrong. Cheap to guard, sticky to get wrong.
       */
      if (painted.current !== undefined) {
        painted.current = undefined
        setTravelling(undefined)
      }
      return
    }

    setTrend(target > from ? 'up' : 'down')

    /*
     * A `requestAnimationFrame` loop is not a CSS animation, so the app's
     * [global rule](../../index.css) does not reach it — the query has to be
     * read here or the one reader who asked for stillness gets all of the
     * motion. Under it nothing is scheduled at all: `shown` falls through to
     * `target`, which *is* the snap, and it costs a render fewer than the
     * animated path's first frame.
     */
    const still = durationMs <= 0 || prefersReducedMotion()

    let frame = 0
    if (!still) {
      const started = performance.now()
      const step = () => {
        const progress = Math.min(1, (performance.now() - started) / durationMs)
        if (progress >= 1) {
          // Handed back to the derived value rather than set to it, so there
          // is exactly one place the settled figure comes from.
          painted.current = undefined
          setTravelling(undefined)
          return
        }
        // Eased out rather than linear: a counter that decelerates reads as
        // *landing* on a figure, where a linear one reads as being cut off at
        // whatever it had reached when the clock ran out.
        const eased = 1 - (1 - progress) ** 3
        const value = Math.round(from + (target - from) * eased)
        painted.current = value
        setTravelling(value)
        frame = requestAnimationFrame(step)
      }
      frame = requestAnimationFrame(step)
    }

    const fade = setTimeout(
      () => {
        setTrend(undefined)
      },
      (still ? 0 : durationMs) + TINT_HOLD_MS,
    )

    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(fade)
    }
  }, [target, animate, durationMs])

  /*
   * The figure in flight if there is one, and otherwise the truth — which is
   * what makes a snap free: no state, no second render, no path by which a
   * stale intermediate value can survive the run that produced it.
   */
  return { shown: travelling ?? target, trend }
}

/** The tint a moving figure takes, on the dark plates of the pitch. */
export const TREND_CLASS: Record<'up' | 'down', string> = {
  up: 'text-positive',
  down: 'text-negative',
}
