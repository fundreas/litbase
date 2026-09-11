import { useCallback, useEffect, useRef, useState } from 'react'

import type { PositionKey } from '@/api/models'
import { useMediaQuery } from '@/lib/useMediaQuery'

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

/**
 * Which way round the pitch is drawn.
 *
 * `portrait` is the phone's pitch and the one every measurement here was
 * written for: own goal at the bottom, bands stacked top to bottom, players
 * side by side within a band.
 *
 * `landscape` is the **same picture turned a quarter turn anticlockwise**, for
 * a screen wide enough to have stopped being a phone layout: the first band
 * moves to the left edge — so the home half of a head-to-head pitch ends up on
 * the left, where the scoreline above it already puts that team — and each
 * band becomes a column of players. It is a rearrangement, not a CSS `rotate`:
 * a rotated pitch would take every name, number and badge with it and leave
 * the reader tilting their head.
 *
 * Nothing else about a card changes. The same portraits, the same plates, the
 * same sizing search — only which of the box's two dimensions the bands are
 * cut from, and which the players are packed along.
 */
export type PitchOrientation = 'portrait' | 'landscape'

/**
 * The width at which the pitch turns on its side.
 *
 * Deliberately the same 64rem as the shell's sidebar breakpoint
 * ([`AppShell`](../layout/AppShell.tsx)): "wide screen" should mean one thing
 * in this app, and that is the width at which it stops being a phone layout.
 */
const LANDSCAPE_QUERY = '(min-width: 64rem)'

/**
 * How this screen draws its pitches — one query, so every pitch in the app
 * turns at the same moment and a reader never meets one of each.
 */
export function usePitchOrientation(): PitchOrientation {
  return useMediaQuery(LANDSCAPE_QUERY) ? 'landscape' : 'portrait'
}

/**
 * How many bands a pitch is drawn in: one eleven, or two facing each other.
 * The only two counts that exist, and the grid classes are written for both.
 */
type PitchBands = 4 | 8

/** 8 for a head-to-head pitch, 4 for everything else. */
function bandCount(rows: number): PitchBands {
  return rows >= 8 ? 8 : 4
}

/**
 * The grid the bands are laid into: stacked rows, or columns across.
 *
 * Written out as literal class names rather than composed from the count,
 * because Tailwind scans source text for the classes it generates and
 * `grid-rows-${n}` is not a class it can see.
 */
const PITCH_GRID_CLASS: Record<PitchOrientation, Record<PitchBands, string>> = {
  portrait: { 4: 'grid-rows-4', 8: 'grid-rows-8' },
  landscape: { 4: 'grid-cols-4', 8: 'grid-cols-8' },
}

/** The band grid for `rows` bands — see {@link PITCH_GRID_CLASS}. */
export function pitchGridClass(
  rows: number,
  orientation: PitchOrientation,
): string {
  return PITCH_GRID_CLASS[orientation][bandCount(rows)]
}

/**
 * The class that makes a band's cards run the right way.
 *
 * `flex-nowrap` + `overflow-hidden` in both, for the reason the pitches
 * document at length: wrapping turns pressure along the band into pressure
 * across it, which feeds back into the sizing and oscillates. The fit already
 * guarantees the busiest band fits, so the clipping is a backstop.
 */
export const PITCH_BAND_CLASS: Record<PitchOrientation, string> = {
  portrait:
    'flex min-h-0 min-w-0 flex-nowrap items-center justify-center gap-1 overflow-hidden',
  landscape:
    'flex min-h-0 min-w-0 flex-col flex-nowrap items-center justify-center gap-1 overflow-hidden',
}

/**
 * How a message drawn *instead of* the bands spans the whole grid — an
 * unpublished team sheet, an empty lineup.
 */
const PITCH_SPAN_CLASS: Record<PitchOrientation, Record<PitchBands, string>> = {
  portrait: { 4: 'row-span-4', 8: 'row-span-8' },
  landscape: { 4: 'col-span-4', 8: 'col-span-8' },
}

/** Spans all `rows` bands — see {@link PITCH_SPAN_CLASS}. */
export function pitchSpanClass(
  rows: number,
  orientation: PitchOrientation,
): string {
  return PITCH_SPAN_CLASS[orientation][bandCount(rows)]
}

/**
 * Where a half's corner plate sits, by the order its half is drawn in.
 *
 * Portrait stacks the halves, so both plates keep to the left edge and the
 * [full-screen button](../ui/FullscreenPane.tsx) has the top-right corner to
 * itself. Landscape puts the halves side by side, so the plates move to
 * opposite ends — and the second one takes the *bottom* right, leaving that
 * same button its corner.
 */
export const SIDE_LABEL_CLASS: Record<PitchOrientation, [string, string]> = {
  portrait: ['top-1 left-1', 'bottom-1 left-1'],
  landscape: ['top-1 left-1', 'bottom-1 right-1'],
}

/**
 * Bands top-to-bottom on a portrait pitch: attack first, keeper last.
 *
 * On a landscape pitch this is the **away** half of a head-to-head — attack at
 * the halfway line, keeper at the far right. A lone eleven is drawn
 * keeper-first instead; see {@link singleTeamOrder}.
 */
export const ROW_ORDER: PositionKey[] = ['fwd', 'mid', 'def', 'gk']

/**
 * The mirror of {@link ROW_ORDER} — keeper first, attack last.
 *
 * For the **top half** of a head-to-head pitch, where that team attacks
 * downwards towards the centre line. Used with `ROW_ORDER` underneath it, the
 * two elevens end up facing each other the way a real fixture does: keepers at
 * the two ends, strikers either side of the halfway line.
 *
 * Drawn first, so on a landscape pitch this is the **left-hand** half — the
 * home side, where a scoreline puts it, keeper at the far left.
 *
 * It is also how a **lone eleven** is drawn in landscape — see
 * {@link singleTeamOrder}.
 */
export const ROW_ORDER_MIRRORED: PositionKey[] = ['gk', 'def', 'mid', 'fwd']

/**
 * The band order for a pitch with **one eleven on it** — the squad's own
 * pitches, a manager's, a club's team sheet.
 *
 * Portrait keeps {@link ROW_ORDER}: attacking up the screen, own goal at the
 * bottom, which is how a lineup has always read on a phone.
 *
 * Landscape does **not** simply inherit that. Turning the phone's pitch a
 * quarter turn would leave the keeper on the right and the attack on the left,
 * which is backwards from how a team is written down and read — 4-4-2 runs
 * from the back, and so does every formation graphic anyone has seen. So a
 * lone eleven takes the *mirrored* order: **keeper at the far left, strikers
 * at the right**, attacking rightwards.
 *
 * A head-to-head pitch has no such freedom and does not use this: the two
 * elevens have to face each other, so home keeps the mirrored order and away
 * the normal one — home's keeper at the far left, away's at the far right,
 * the two attacks meeting in the middle.
 */
export function singleTeamOrder(orientation: PitchOrientation): PositionKey[] {
  return orientation === 'landscape' ? ROW_ORDER_MIRRORED : ROW_ORDER
}

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
/**
 * Floor for a **compact** card, which carries no name and no fixture badge.
 *
 * Lower than {@link AVATAR_MIN} because that floor exists to keep a name
 * legible under the portrait. With nothing but a points figure there is less
 * to protect, and a head-to-head pitch has to fit *eight* bands rather than
 * four — so on a phone this is the difference between a readable pitch and a
 * clipped one.
 */
const AVATAR_MIN_COMPACT = 26
/** How much wider than its avatar a player button is (its own padding). */
const PLAYER_PADDING = 12
/**
 * How far a plate may spill past the portrait it belongs to — the button's own
 * `p-1`, and not a pixel more, so nothing about the band's fit changes.
 *
 * The [editor's](./LineupTab.tsx) plate needs it: its second line carries the
 * fixture crest *and* the expected figure, and on a phone's 50px portrait
 * those two are a few pixels wider than the face above them. Every other plate
 * spans its portrait exactly, which is the default {@link PlayerMetrics}
 * describes.
 */
export const PLATE_BLEED = 4
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

/** The smallest portrait each plate is allowed to shrink to. */
function avatarFloor(plate: PlateContent): number {
  return plate === 'points' ? AVATAR_MIN_COMPACT : AVATAR_MIN
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
 * What a card's plate holds, which is what decides how tall the card is.
 *
 *  - `full` — a name over a fixture badge, as the squad's own pitches draw it.
 *    The [expected points](./ExpectedPointsBadge.tsx) share that second line
 *    with the badge rather than taking a third, which is what keeps this plate
 *    — and so the portrait above it — the size it has always been.
 *  - `points` — one line, a points figure and nothing else. The head-to-head
 *    duel pitch, where 22 portraits have to fit and a name under each would be
 *    unreadable at that size anyway.
 */
export type PlateContent = 'full' | 'points'

/**
 * Total height a card occupies.
 *
 * The plate overlaps the portrait's lower edge, so it costs the card less than
 * its own height — that overlap has to come out of the budget or the sizing
 * search would leave a gap under every player.
 *
 * A `full` plate is measured with the **fixture badge**, the tallest thing its
 * second line can hold: the live view's points figure and the editor's
 * expected figure are both text, and text at this font is shorter than the
 * crest at every size — so both fit inside a budget solved for a badge rather
 * than needing one of their own.
 */
function playerHeight(metrics: PlayerMetrics, plate: PlateContent): number {
  const textLine = Math.round(metrics.nameFontSize * 1.25)
  const plateHeight =
    plate === 'points'
      ? textLine + PLATE_CHROME_HEIGHT
      : textLine + metrics.badgeCrest + PLATE_CHROME_HEIGHT
  return (
    PLAYER_CHROME_HEIGHT + metrics.avatar - metrics.plateOverlap + plateHeight
  )
}

/**
 * The largest avatar that fits both the room along the band and the room
 * across it.
 *
 * Searched rather than solved because the plate does not scale linearly with
 * the portrait — the font size and crest are both clamped, so the height is
 * piecewise. Stepping down from the width limit until the card fits is exact
 * and costs at most a few dozen iterations.
 *
 * Fitting *exactly* matters more than it looks. An earlier version took a
 * fixed 54% of the band, which overshot by ~2px; the card then pushed the
 * pitch taller, the page gained a scrollbar, the scrollbar narrowed the row,
 * and the size oscillated between two values on every render.
 */
function fitAvatar(
  maxHeight: number,
  maxWidth: number,
  plate: PlateContent,
): PlayerMetrics {
  const floor = avatarFloor(plate)
  const ceiling = Math.min(AVATAR_MAX, Math.floor(maxWidth))
  for (let avatar = ceiling; avatar > floor; avatar -= 1) {
    const metrics = playerMetrics(avatar)
    if (playerHeight(metrics, plate) <= maxHeight) return metrics
  }
  return playerMetrics(floor)
}

export interface PitchBox {
  width: number
  height: number
}

/**
 * How large an avatar can be without crowding its band.
 *
 * Two limits, whichever bites first: the room a band has **across** it once
 * the plate is paid for, and the room the *busiest* band can give each player
 * **along** it. A row of five defenders is what constrains a narrow screen;
 * the band's own thickness is what constrains a wide one.
 *
 * `busiestBand` is the most cards any one band has to hold — on the editor
 * that includes the mandatory placeholders, since an empty slot takes exactly
 * the room a player would.
 *
 * `rows` is how many bands the pitch is divided into: four for one eleven,
 * **eight** for the head-to-head duel pitch, which stacks two of them. Getting
 * this wrong is not cosmetic — the budget per band is the pitch divided by it,
 * so a pitch that claimed four while drawing eight would size every card at
 * twice the room it has and clip the lot.
 *
 * **Landscape swaps the two axes and nothing else.** The bands are then cut
 * out of the width and the players stack down the height, so the pitch's
 * height is what the busiest band has to share and the band's own width is
 * what each card is measured against. Which is why the gaps move too: they
 * sit between players, and the players have turned a quarter turn with the
 * pitch.
 */
export function fitPitchMetrics(
  box: PitchBox,
  busiestBand: number,
  {
    rows = ROW_ORDER.length,
    plate = 'full',
    orientation = 'portrait',
  }: PitchFitOptions = {},
): PlayerMetrics {
  if (box.height === 0 || box.width === 0) {
    return playerMetrics(avatarFloor(plate))
  }

  const bands = Math.max(1, busiestBand)
  const lanes = Math.max(1, rows)

  // Solve for the avatar that makes the busiest band exactly fit:
  //   n * (size + PLAYER_PADDING) + (n - 1) * PLAYER_GAP <= along
  // Dividing the length by the count alone overshoots, because each button is
  // wider than its avatar and the gaps still have to go somewhere — which is
  // what made a row of five defenders wrap on a phone.
  if (orientation === 'landscape') {
    const usable = box.height - (bands - 1) * PLAYER_GAP
    return fitAvatar(usable / bands, box.width / lanes - PLAYER_PADDING, plate)
  }

  const usable = box.width - (bands - 1) * PLAYER_GAP
  return fitAvatar(box.height / lanes, usable / bands - PLAYER_PADDING, plate)
}

export interface PitchFitOptions {
  /** Bands the pitch is split into. 4 for one eleven, 8 head-to-head. */
  rows?: number
  /** What each card's plate carries — see {@link PlateContent}. */
  plate?: PlateContent
  /** Which way the pitch is drawn — see {@link PitchOrientation}. */
  orientation?: PitchOrientation
}

/**
 * The pitch's own measured size.
 *
 * Measured rather than guessed at, so the avatars scale with whatever height
 * the flex chain actually hands the pitch.
 *
 * ## A callback ref, because the element it watches is replaced
 *
 * This was a `useRef` observed once from a `[]`-dependency effect, which is the
 * usual shape and is wrong the moment the measured element can be **swapped for
 * a different one while the component stays mounted**. That is exactly what
 * [full screen](../ui/FullscreenPane.tsx) does: the pitch moves from the page
 * into the dialog, React mounts a new grid `div`, `ref.current` points at it —
 * and the observer is still watching the old, detached node. It then reports
 * `0 × 0` for the node being removed, `fitPitchMetrics` falls back to its floor,
 * and every portrait collapses to 26px on the one screen with room to spare.
 *
 * A callback ref is called with the new node (and with `null` for the old one),
 * so the observer follows the element instead of the first element.
 *
 * **Zero-area measurements are ignored.** An element on its way out of the tree
 * reports `0 × 0`, and acting on that would flash a pitch of floor-sized
 * portraits between the two layouts. Keeping the last real size costs nothing:
 * a pitch with no area is not on screen to be wrong.
 */
export function usePitchBox(): {
  ref: React.RefCallback<HTMLDivElement>
  box: PitchBox
} {
  const [box, setBox] = useState<PitchBox>({ width: 0, height: 0 })
  const observer = useRef<ResizeObserver | null>(null)

  const ref = useCallback((element: HTMLDivElement | null) => {
    observer.current?.disconnect()
    if (element === null) {
      observer.current = null
      return
    }

    observer.current = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      const next = {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      }
      // An element being detached measures `0 × 0`. See the note above.
      if (next.width === 0 || next.height === 0) return
      // Rounded, and only when it actually moved: a resize observer that
      // re-renders on sub-pixel noise is one step from an infinite loop.
      setBox((current) =>
        current.width === next.width && current.height === next.height
          ? current
          : next,
      )
    })
    observer.current.observe(element)
  }, [])

  // The callback ref is called with `null` on unmount, which covers the normal
  // path; this is the backstop for a React that skips it.
  useEffect(
    () => () => {
      observer.current?.disconnect()
    },
    [],
  )

  return { ref, box }
}
