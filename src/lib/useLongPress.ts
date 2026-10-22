import { useCallback, useEffect, useRef, type PointerEvent } from 'react'

/**
 * How long a press has to be held before it counts as a hold.
 *
 * Long enough that no tap reaches it — a deliberate tap is well under 200ms —
 * and short enough that the hold does not feel stuck. The number is exported
 * because the pitch animates a ring that fills over exactly this duration, and
 * a CSS literal would drift away from it.
 */
export const LONG_PRESS_MS = 420

/**
 * How far the pointer may travel before the press stops being a hold.
 *
 * A few pixels of slop is what a finger produces standing still; past that it
 * is scrolling the list, and a list that popped something up mid-scroll would
 * be punishing the most ordinary gesture on the page.
 */
const MOVE_THRESHOLD_PX = 8

/**
 * How long a completed hold keeps swallowing clicks.
 *
 * The release after a hold normally fires a click, which the handler below
 * consumes — but a hold that ends outside the element produces none, and the
 * flag would then eat the next activation of *any* element, including a
 * keyboard one that has no `pointerdown` to reset it. This is the backstop.
 */
const CLICK_GRACE_MS = 500

/** Everything the gesture needs, ready to spread onto one element. */
export interface LongPressHandlers {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void
  onPointerMove: (event: PointerEvent<HTMLElement>) => void
  onPointerUp: (event: PointerEvent<HTMLElement>) => void
  onPointerCancel: (event: PointerEvent<HTMLElement>) => void
  onPointerLeave: (event: PointerEvent<HTMLElement>) => void
  onContextMenu: (event: { preventDefault: () => void }) => void
  onClick: (event: {
    preventDefault: () => void
    stopPropagation: () => void
  }) => void
}

/**
 * **Press and hold**, on an element that may also be tapped.
 *
 * The two gestures start identically, so they are told apart by time: a
 * release before {@link LONG_PRESS_MS} is a tap and runs `onClick`, a press
 * that outlives it is a hold and runs `onLongPress` — and the click that the
 * release then fires is swallowed, so a hold never also does the tap's job.
 * That swallow both `preventDefault`s and `stopPropagation`s, because the
 * element may sit inside a larger button that would otherwise take it; see the
 * [Kader row](../components/squad/PlayerListTab.tsx)'s fixture panel in
 * calculator mode.
 *
 * Travel cancels the hold. The one thing a list of rows does constantly is
 * scroll, and a scroll begins as a press that stays down — without the
 * threshold every flick down the squad would pop something open.
 *
 * `contextmenu` is suppressed for the same reason the threshold exists: on
 * Android a long press raises the browser's own menu over whatever the hold
 * was for, and on iOS it raises the image callout. Right-clicking the element
 * on a desktop is the price, and it is a price worth paying on a phone-first
 * screen.
 *
 * The hold buzzes where the platform can. Absent on desktop and on iOS, where
 * `navigator.vibrate` is silently nothing.
 */
export function useLongPress({
  onLongPress,
  onClick,
  enabled = true,
}: {
  /** Called with the element once it has been held. */
  onLongPress: (node: HTMLElement) => void
  /**
   * The ordinary tap, if the element has one. Left out where the tap belongs
   * to something further up — the handlers still swallow the click a hold
   * produces, which is the whole reason they are on the element at all.
   */
  onClick?: () => void
  /**
   * Whether the hold is armed at all. `false` leaves the element a plain tap
   * target: the timer never starts, so a long press neither buzzes nor eats
   * the click it ends with — which is what it would do if the callback simply
   * returned early.
   */
  enabled?: boolean
}): LongPressHandlers {
  const pressRef = useRef<{
    pointerId: number
    x: number
    y: number
    node: HTMLElement
  } | null>(null)
  const timerRef = useRef<number | null>(null)
  /** Whether the click now arriving is the tail of a completed hold. */
  const heldRef = useRef(false)
  const graceRef = useRef<number | null>(null)

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    pressRef.current = null
  }, [])

  // A row can unmount under a finger — a sale, a refetch — and a timer that
  // outlived it would call back into a component that is gone.
  useEffect(() => {
    return () => {
      cancel()
      if (graceRef.current !== null) window.clearTimeout(graceRef.current)
    }
  }, [cancel])

  return {
    onPointerDown: (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      cancel()
      heldRef.current = false
      if (!enabled) return
      pressRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        node: event.currentTarget,
      }
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        const press = pressRef.current
        if (press === null) return
        // The gesture is over the moment the hold lands: clearing it is what
        // makes the move and up handlers ignore the rest of the press.
        pressRef.current = null
        heldRef.current = true
        if (graceRef.current !== null) window.clearTimeout(graceRef.current)
        graceRef.current = window.setTimeout(() => {
          heldRef.current = false
        }, CLICK_GRACE_MS)
        navigator.vibrate?.(12)
        onLongPress(press.node)
      }, LONG_PRESS_MS)
    },

    onPointerMove: (event) => {
      const press = pressRef.current
      if (press === null || press.pointerId !== event.pointerId) return
      const distance = Math.hypot(
        event.clientX - press.x,
        event.clientY - press.y,
      )
      if (distance < MOVE_THRESHOLD_PX) return
      cancel()
    },

    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,

    onContextMenu: (event) => {
      event.preventDefault()
    },

    onClick: (event) => {
      if (heldRef.current) {
        heldRef.current = false
        if (graceRef.current !== null) {
          window.clearTimeout(graceRef.current)
          graceRef.current = null
        }
        event.preventDefault()
        event.stopPropagation()
        return
      }
      onClick?.()
    },
  }
}
