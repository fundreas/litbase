import { useCallback, useState, type ReactNode } from 'react'

import type { CurrentMatchday } from '@/api/hooks/useMatchday'
import {
  FixturePeekLayer,
  TRACK_LENGTH,
  TRACK_PEEK_LENGTH,
} from '@/components/squad/FixtureTrack'

/**
 * **Tap the panel, see five.** The state behind the fixture tooltip, and the
 * layer it puts up.
 *
 * Two crests is as many as a 48px panel can carry at full size; the month a
 * transfer decision actually turns on is longer than that. The rest is one tap
 * away on the thing already showing the first two — no second target on the
 * row, no gesture to discover, and nothing taken from the name beside it.
 *
 * It was a press-and-hold for about an hour. A hold is something a reader has
 * to be told about, and this is the panel's *only* job now that the
 * expected-points sheet has moved to the
 * [match breakdown](../player/PlayerMatchEventsDialog.tsx) — so the tap is
 * free, and a control with one meaning should use it.
 *
 * The layer is the [fixture strip](./SquadReading.tsx) itself, not a new
 * notation: the same crest-over-matchday-number columns the *Spielplan*
 * reading puts in every row, five of them, so what the tap brings up is
 * something the reader has already learned to read somewhere else.
 *
 * Returned rather than rendered here so the panel keeps its own markup — it is
 * a `<button>` on one row and an inert `<span>` on another, and only one of
 * them can open anything.
 */
export function useFixturePeek({
  matchdays,
  teamId,
}: {
  matchdays: CurrentMatchday[]
  teamId: string
}): {
  /**
   * Whether there is anything past the track to show. `false` past the last
   * matchdays of a season, and on a list handed no schedule at all — the
   * panel is then an inert picture, as it was before any of this.
   */
  canPeek: boolean
  /** Open the layer, anchored to the element tapped. */
  open: (node: HTMLElement) => void
  /** The layer, while it is out. Rendered next to the panel; it portals away. */
  layer: ReactNode
} {
  const peek = matchdays.slice(0, TRACK_PEEK_LENGTH)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  // Stable, because the layer hangs its window listeners off it and a fresh
  // closure every render would tear them down and put them back for nothing.
  const close = useCallback(() => {
    setAnchor(null)
  }, [])

  return {
    canPeek: peek.length > TRACK_LENGTH,
    open: (node) => {
      setAnchor(node.getBoundingClientRect())
    },
    layer:
      anchor === null ? null : (
        <FixturePeekLayer
          anchor={anchor}
          matchdays={peek}
          teamId={teamId}
          onClose={close}
        />
      ),
  }
}
