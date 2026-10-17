import { useEffect, useRef, type ReactNode } from 'react'

import { CHIP_ROW } from '@/components/ui/FilterChip'

/**
 * **The strip of siblings at the top of a detail page** — every other match of
 * the matchday above [one match](../matchday/MatchSwitchBar.tsx), every other
 * pairing above [one duel](../duels/DuelSwitchBar.tsx).
 *
 * A detail page reached from a list is a page you leave by going *back*, and
 * the next thing most people do with a matchday is look at the next game in it.
 * The strip turns that round trip into one tap, and it costs no request on
 * either page: both lists are already in the cache the page read its own
 * subject from.
 *
 * It is a `<nav>` with a label, and the chip you are on carries
 * `aria-current="page"` — the same thing the accent ring says in colour, said
 * once for a screen reader.
 *
 * **The chips scroll sideways**, with {@link CHIP_ROW}'s classes: nine
 * fixtures do not fit across a phone, and the bleed through the content well's
 * padding is what keeps the next one half-visible at the screen's edge rather
 * than stopping short of it. That row's comment carries why the gesture needs
 * `overscroll-x-contain` and `touch-pan-x` — the part that took a real device
 * to get right.
 */
export function SwitchBar({
  label,
  activeKey,
  children,
}: {
  label: string
  /**
   * What is on screen, so the strip can bring that chip into view — and only
   * when it actually changes. Navigating between siblings does **not** remount
   * the page (same route, different id), so an effect is the only moment the
   * strip hears about it.
   */
  activeKey: string | undefined
  children: ReactNode
}) {
  const row = useRef<HTMLElement>(null)

  /* Centred rather than `nearest`: on a strip you navigate *with*, the useful
     thing is to see what lies either side of where you are, and the chip
     tapped was by definition at the edge of the row it was tapped from. Only
     the row scrolls — `block: 'nearest'` keeps the page's own scroll position,
     which belongs to the reader. */
  useEffect(() => {
    row.current?.querySelector('[aria-current="page"]')?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [activeKey])

  return (
    <nav ref={row} aria-label={label} className={CHIP_ROW}>
      {children}
    </nav>
  )
}

/**
 * The shape every chip in a {@link SwitchBar} takes: a pill the height of a
 * [filter chip](./FilterChip.tsx), ringed in the accent when it is the page
 * you are on.
 *
 * One class list rather than two, so the match strip and the duel strip cannot
 * drift apart — they are the same control over different subjects, and a
 * reader who has learned one should recognise the other.
 */
export const SWITCH_CHIP =
  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-2.5 transition-colors'
