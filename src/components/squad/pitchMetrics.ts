import { useEffect, useRef, useState } from 'react'

import type { PositionKey } from '@/api/models'

/**
 * How a player card on the pitch is sized.
 *
 * Extracted from [`LineupTab`](./LineupTab.tsx) once a second pitch existed —
 * the read-only [live view](./LiveTab.tsx) draws the same portraits with a
 * points line where the editor draws a fixture badge. Both need the identical
 * fit, or the two pitches would size their players differently on the same
 * screen for no reason a reader could see.
 *
 * Everything here is pure except {@link usePitchBox}, which is the one bit
 * that has to measure the DOM.
 */

/** Rows top-to-bottom on a vertical pitch: attack first, keeper last. */
export const ROW_ORDER: PositionKey[] = ['fwd', 'mid', 'def', 'gk']

/**
 * Bounds for the on-pitch avatar, which scales with the pitch itself.
 *
 * A fixed 44px looked right on a phone and lost on a 1280px screen, where the
 * pitch is ~480px tall and the players were islands in it. The size is derived
 * from the space each band actually has, so it tracks the window continuously
 * rather than stepping at breakpoints.
 */
const AVATAR_MIN = 40
const AVATAR_MAX = 96
/** How much wider than its avatar a player button is (its own padding). */
const PLAYER_PADDING = 12
/** The `gap-1` between two players in the same band. */
const PLAYER_GAP = 4
/** Button `p-1`, top and bottom. */
const PLAYER_CHROME_HEIGHT = 8
/** The plate's own `py-0.5` and the `gap-0.5` between its two lines. */
const PLATE_CHROME_HEIGHT = 6
/** How far the name plate rides up over the portrait, as a share of it. */
const PLATE_OVERLAP_RATIO = 0.15

/**
 * How large the lineup-probability badge is on a portrait of `avatar` px.
 *
 * Clamped at both ends. Purely proportional gives an illegible dot on a 36px
 * bench card and something the size of a dinner plate on a 96px pitch
 * portrait, so it tracks the avatar only through the middle of the range.
 */
export function cornerBadgeSize(avatar: number): number {
  return Math.min(24, Math.max(13, Math.round(avatar * 0.32)))
}

/** Everything in a player card is derived from one number. */
function playerMetrics(avatar: number) {
  return {
    avatar,
    width: avatar + PLAYER_PADDING,
    /** The plate spans the portrait exactly, so the card reads as one object. */
    plateWidth: avatar,
    plateOverlap: Math.round(avatar * PLATE_OVERLAP_RATIO),
    nameFontSize: Math.min(16, Math.max(10, Math.round(avatar * 0.2))),
    badgeCrest: Math.min(26, Math.max(14, Math.round(avatar * 0.3))),
    removeIcon: Math.round(avatar * 0.36),
  }
}

export type PlayerMetrics = ReturnType<typeof playerMetrics>

/**
 * Total height a card occupies.
 *
 * The plate overlaps the portrait's lower edge, so it costs the card less than
 * its own height — that overlap has to come out of the budget or the sizing
 * search would leave a gap under every player.
 *
 * The second plate line is measured as the **fixture badge**, the taller of
 * the two things that go there: the live view's points line is smaller, so it
 * fits inside a budget solved for a badge rather than needing its own.
 */
function playerHeight(metrics: PlayerMetrics): number {
  const nameLine = Math.round(metrics.nameFontSize * 1.25)
  const plate = nameLine + metrics.badgeCrest + PLATE_CHROME_HEIGHT
  return PLAYER_CHROME_HEIGHT + metrics.avatar - metrics.plateOverlap + plate
}

/**
 * The largest avatar that fits both the band's height and its width.
 *
 * Searched rather than solved because the plate does not scale linearly with
 * the portrait — the font size and crest are both clamped, so the height is
 * piecewise. Stepping down from the width limit until the card fits the band
 * is exact and costs at most a few dozen iterations.
 *
 * Fitting *exactly* matters more than it looks. An earlier version took a
 * fixed 54% of the band, which overshot by ~2px; the card then pushed the
 * pitch taller, the page gained a scrollbar, the scrollbar narrowed the row,
 * and the size oscillated between two values on every render.
 */
function fitAvatar(bandHeight: number, maxWidth: number): PlayerMetrics {
  const ceiling = Math.min(AVATAR_MAX, Math.floor(maxWidth))
  for (let avatar = ceiling; avatar > AVATAR_MIN; avatar -= 1) {
    const metrics = playerMetrics(avatar)
    if (playerHeight(metrics) <= bandHeight) return metrics
  }
  return playerMetrics(AVATAR_MIN)
}

export interface PitchBox {
  width: number
  height: number
}

/**
 * How large an avatar can be without crowding its band.
 *
 * Two limits, whichever bites first: the height a band has left after the
 * name plate, and the width the *busiest* band can give each player. A row of
 * five defenders is what constrains a narrow screen; the band height is what
 * constrains a wide one.
 *
 * `busiestBand` is the most cards any one band has to hold — on the editor
 * that includes the mandatory placeholders, since an empty slot takes exactly
 * the room a player would.
 */
export function fitPitchMetrics(
  box: PitchBox,
  busiestBand: number,
): PlayerMetrics {
  if (box.height === 0) return playerMetrics(AVATAR_MIN)

  const bands = Math.max(1, busiestBand)

  // Solve for the avatar that makes the busiest band exactly fit:
  //   n * (size + PLAYER_PADDING) + (n - 1) * PLAYER_GAP <= width
  // Dividing the width by the count alone overshoots, because each button is
  // wider than its avatar and the gaps still have to go somewhere — which is
  // what made a row of five defenders wrap on a phone.
  const usable = box.width - (bands - 1) * PLAYER_GAP
  const byWidth = usable / bands - PLAYER_PADDING

  return fitAvatar(box.height / ROW_ORDER.length, byWidth)
}

/**
 * The pitch's own measured size.
 *
 * Measured rather than guessed at, so the avatars scale with whatever height
 * the flex chain actually hands the pitch.
 */
export function usePitchBox(): {
  ref: React.RefObject<HTMLDivElement | null>
  box: PitchBox
} {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<PitchBox>({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (element === null) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      const next = {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      }
      // Rounded, and only when it actually moved: a resize observer that
      // re-renders on sub-pixel noise is one step from an infinite loop.
      setBox((current) =>
        current.width === next.width && current.height === next.height
          ? current
          : next,
      )
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [])

  return { ref, box }
}
