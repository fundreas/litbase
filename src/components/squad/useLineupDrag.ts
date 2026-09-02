import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import type { PositionKey } from '@/api/models'

/**
 * How far the pointer has to travel before a tap becomes a drag.
 *
 * The same portrait is both a button (tap removes the player) and a drag
 * handle, so the two gestures are told apart by distance rather than by giving
 * dragging its own affordance. A few pixels of slop is what a finger produces
 * on a tap; below that the gesture stays a tap and the click runs as before.
 */
const DRAG_THRESHOLD_PX = 6

export interface DraggablePlayer {
  id: string
  position: PositionKey
}

/** Props that turn an element into a draggable, droppable lineup slot. */
export interface DragHandleProps {
  'data-lineup-player': string
  'data-lineup-position': PositionKey
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void
  onDragStart: (event: ReactDragEvent<HTMLElement>) => void
}

export interface LineupDrag<T extends DraggablePlayer> {
  /** What to render: the live preview while dragging, otherwise the lineup. */
  order: T[]
  /** The player currently under the pointer, or `null` when idle. */
  dragging: T | null
  /** Attach to the floating portrait; it is positioned imperatively. */
  ghostRef: (node: HTMLElement | null) => void
  dragProps: (player: T) => DragHandleProps
  /**
   * Whether the gesture that just ended was a tap rather than a drag — call it
   * from `onClick` before acting, or dropping a player also removes him.
   * Calling it consumes the verdict, so call it once per click.
   */
  isTap: () => boolean
}

/**
 * Move `draggedId` to where `targetId` currently sits.
 *
 * Insertion, not swapping: the other players keep their relative order, which
 * is what makes repeated small drags predictable. Dragging the third midfielder
 * onto the first gives `3-1-2`, not `3-2-1`.
 *
 * Both indexes are into the **whole** lineup, where positions are interleaved.
 * That still works, because a row is rendered by filtering the lineup and a
 * filter preserves relative order: landing immediately before a target
 * globally also lands immediately before him within his row. And since removing
 * the dragged id shifts everything after it left by one, `to` is the correct
 * insertion index in both directions — after the target when moving forward,
 * before it when moving back.
 */
export function moveTo(
  ids: readonly string[],
  draggedId: string,
  targetId: string,
): string[] {
  const from = ids.indexOf(draggedId)
  const to = ids.indexOf(targetId)
  if (from === -1 || to === -1 || from === to) return [...ids]

  const next = [...ids]
  next.splice(from, 1)
  next.splice(to, 0, draggedId)
  return next
}

/**
 * Drag-and-drop reordering of players inside their position row.
 *
 * ## Why pointer events rather than HTML5 drag-and-drop
 *
 * `dragstart`/`drop` do not fire on touch at all, and the lineup is a phone
 * screen first. Pointer events are one code path for mouse, touch and pen, and
 * pointer capture means the gesture keeps working when the finger leaves the
 * portrait it started on — which it always does, since the point is to move it
 * somewhere else.
 *
 * ## Why the row reorders live
 *
 * The preview is applied on hover and committed on release, so the row shows
 * the outcome while the finger is still down. An insertion caret would have to
 * be read and translated; a row that has already moved does not.
 *
 * ## Why the ghost is positioned imperatively
 *
 * The floating portrait follows the pointer at screen refresh rate. Holding its
 * coordinates in state would re-render the whole pitch — the SVG turf included
 * — on every `pointermove`. Instead only *changes of order* are state; the
 * ghost's transform is written straight to the node.
 *
 * Drops are confined to the dragged player's own position: Kickbase slots are
 * positional, and a midfielder posted into a defender slot is silently dropped
 * by the API. A drag that ends anywhere else simply reverts.
 */
export function useLineupDrag<T extends DraggablePlayer>({
  items,
  onReorder,
}: {
  items: T[]
  /** Called with the complete new id order once a drag is released. */
  onReorder: (orderedIds: string[]) => void
}): LineupDrag<T> {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [previewIds, setPreviewIds] = useState<string[] | null>(null)

  /** Where the gesture began, until it is known to be a drag. */
  const startRef = useRef<{
    pointerId: number
    x: number
    y: number
    player: T
    /** Pointer offset from the portrait's centre, so it does not jump. */
    grabX: number
    grabY: number
  } | null>(null)
  /** True once the threshold was passed — read by `isTap` in the click. */
  const didDragRef = useRef(false)
  const previewRef = useRef<string[] | null>(null)
  const ghostNodeRef = useRef<HTMLElement | null>(null)
  const ghostPointRef = useRef({ x: 0, y: 0 })

  const setPreview = useCallback((ids: string[] | null) => {
    previewRef.current = ids
    setPreviewIds(ids)
  }, [])

  const stop = useCallback(() => {
    startRef.current = null
    ghostNodeRef.current = null
    setDraggingId(null)
    setPreview(null)
  }, [setPreview])

  // Escape aborts mid-drag and puts the row back the way it was. `didDragRef`
  // deliberately stays set: the click that follows the release is still not a
  // tap, and must not remove the player.
  const isDragging = draggingId !== null
  useEffect(() => {
    if (!isDragging) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') stop()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isDragging, stop])

  /**
   * The order to render.
   *
   * Falls back to `items` whenever the preview no longer describes exactly the
   * same set — a squad refetch landing mid-drag would otherwise render a stale
   * lineup, or drop a player from the pitch entirely.
   */
  const order = useMemo(() => {
    if (previewIds === null) return items
    const byId = new Map(items.map((item) => [item.id, item]))
    const mapped = previewIds
      .map((id) => byId.get(id))
      .filter((item): item is T => item !== undefined)
    return mapped.length === items.length ? mapped : items
  }, [items, previewIds])

  const dragging = order.find((item) => item.id === draggingId) ?? null

  const moveGhost = (x: number, y: number) => {
    ghostPointRef.current = { x, y }
    const node = ghostNodeRef.current
    if (node !== null) {
      node.style.transform = `translate3d(${String(x)}px, ${String(y)}px, 0) translate(-50%, -50%)`
    }
  }

  const ghostRef = useCallback((node: HTMLElement | null) => {
    ghostNodeRef.current = node
    if (node === null) return
    const { x, y } = ghostPointRef.current
    node.style.transform = `translate3d(${String(x)}px, ${String(y)}px, 0) translate(-50%, -50%)`
  }, [])

  /**
   * The player the pointer is over, if he is a legal landing place.
   *
   * The pointer has to be past the **middle** of that slot in the direction it
   * is travelling, which is what stops two neighbours from trading places over
   * and over while a finger rests on the boundary between them: once they have
   * swapped, the pointer has to travel half a slot back before the reverse
   * move arms again.
   */
  const dropTargetId = (
    x: number,
    y: number,
    player: T,
    currentIds: readonly string[],
  ): string | null => {
    // The ghost is `pointer-events-none`, so this reaches the row underneath.
    const element = document.elementFromPoint(x, y)
    const slot = element?.closest('[data-lineup-player]')
    if (!(slot instanceof HTMLElement)) return null

    const { lineupPlayer, lineupPosition } = slot.dataset
    if (lineupPlayer === undefined || lineupPlayer === player.id) return null
    // Rows are positions. A defender cannot land among the midfielders.
    if (lineupPosition !== player.position) return null

    const rect = slot.getBoundingClientRect()
    const middle = rect.left + rect.width / 2
    const isForward =
      currentIds.indexOf(player.id) < currentIds.indexOf(lineupPlayer)
    if (isForward ? x < middle : x > middle) return null

    return lineupPlayer
  }

  const dragProps = (player: T): DragHandleProps => ({
    'data-lineup-player': player.id,
    'data-lineup-position': player.position,

    onPointerDown: (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      didDragRef.current = false
      const rect = event.currentTarget.getBoundingClientRect()
      startRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        player,
        grabX: rect.left + rect.width / 2 - event.clientX,
        grabY: rect.top + rect.height / 2 - event.clientY,
      }
      // Capture, so the rest of the gesture is delivered here even though the
      // pointer immediately leaves this portrait.
      event.currentTarget.setPointerCapture(event.pointerId)
    },

    onPointerMove: (event) => {
      const start = startRef.current
      if (start === null || start.pointerId !== event.pointerId) return

      if (!didDragRef.current) {
        const distance = Math.hypot(
          event.clientX - start.x,
          event.clientY - start.y,
        )
        if (distance < DRAG_THRESHOLD_PX) return
        didDragRef.current = true
        setDraggingId(player.id)
        setPreview(items.map((item) => item.id))
      }

      moveGhost(event.clientX + start.grabX, event.clientY + start.grabY)

      const current = previewRef.current ?? items.map((item) => item.id)
      const targetId = dropTargetId(
        event.clientX,
        event.clientY,
        player,
        current,
      )
      if (targetId === null) return
      setPreview(moveTo(current, player.id, targetId))
    },

    onPointerUp: () => {
      const pending = previewRef.current
      if (didDragRef.current && pending !== null) onReorder(pending)
      stop()
    },

    onPointerCancel: () => {
      stop()
    },

    onKeyDown: (event) => {
      // Keyboard parity for the same edit: a drag is unreachable without a
      // pointer, and the arrows read as "move him along the row".
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const row = items.filter((item) => item.position === player.position)
      const index = row.findIndex((item) => item.id === player.id)
      const neighbour = row[index + (event.key === 'ArrowLeft' ? -1 : 1)]
      if (neighbour === undefined) return
      event.preventDefault()
      onReorder(
        moveTo(
          items.map((item) => item.id),
          player.id,
          neighbour.id,
        ),
      )
    },

    // The portrait contains an `<img>`, which the browser would happily start
    // a native drag on, cancelling the pointer capture halfway through.
    onDragStart: (event) => {
      event.preventDefault()
    },
  })

  return {
    order,
    dragging,
    ghostRef,
    dragProps,
    // Reading the flag also clears it. A drag that produced no click at all
    // would otherwise leave it set, and the next activation of *any* portrait
    // — a keyboard Enter, which has no `pointerdown` to reset it — would be
    // swallowed as if it were the tail of that drag.
    isTap: () => {
      const wasDrag = didDragRef.current
      didDragRef.current = false
      return !wasDrag
    },
  }
}
