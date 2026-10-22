import { useCallback, useState, type ReactNode } from 'react'

import type { CurrentMatchday } from '@/api/hooks/useMatchday'
import {
  FixtureHoldLayer,
  TRACK_HELD_LENGTH,
  TRACK_LENGTH,
} from '@/components/squad/FixtureTrack'
import { useLongPress } from '@/lib/useLongPress'

/**
 * **Hold the panel, see five.** The gesture, and the layer it opens.
 *
 * Three crests is as many as a 48px panel can carry and still be read at a
 * glance; the month a transfer decision actually turns on is longer than that.
 * So the rest is behind a press-and-hold — a gesture the pitch already uses on
 * this very screen, and one that costs the row no pixels and no second target.
 * A tap still does what a tap on the panel did.
 *
 * The layer is the [fixture strip](./SquadReading.tsx) itself, not a new
 * notation: the same crest-over-matchday-number columns the *Spielplan*
 * reading puts in every row, five of them, so what the hold reveals is
 * something the reader has already learned to read somewhere else.
 *
 * Returned rather than rendered here so the panel keeps its own markup — it is
 * a `<button>` on one row and a `<span>` inside a bigger button on another,
 * and both need these handlers.
 */
export function useFixtureHold({
  matchdays,
  teamId,
  onTap,
}: {
  matchdays: CurrentMatchday[]
  teamId: string
  /** The panel's ordinary tap, where it has one. */
  onTap?: () => void
}): {
  /** Spread onto the panel. */
  handlers: ReturnType<typeof useLongPress>
  /** The layer, while it is out. Rendered next to the panel; it portals away. */
  layer: ReactNode
} {
  const held = matchdays.slice(0, TRACK_HELD_LENGTH)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  // Stable, because the layer hangs its window listeners off it and a fresh
  // closure every render would tear them down and put them back for nothing.
  const close = useCallback(() => {
    setAnchor(null)
  }, [])

  const handlers = useLongPress({
    // Nothing past the three already on the track — the last matchdays of a
    // season, or no schedule at all. The gesture is disarmed rather than made
    // to open an empty layer, so the panel stays a plain tap target and a long
    // press on it still counts as a tap.
    enabled: held.length > TRACK_LENGTH,
    onLongPress: (node) => {
      setAnchor(node.getBoundingClientRect())
    },
    onClick: onTap,
  })

  return {
    handlers,
    layer:
      anchor === null ? null : (
        <FixtureHoldLayer
          anchor={anchor}
          matchdays={held}
          teamId={teamId}
          onClose={close}
        />
      ),
  }
}
