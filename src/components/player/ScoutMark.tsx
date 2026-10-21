import { Binoculars } from 'lucide-react'

import { cn } from '@/lib/cn'

const LABEL = 'Auf deiner Scoutliste'

/**
 * **He is on your scout list** — the badge a listing wears so the player you
 * have already decided to watch is found without reading twenty names.
 *
 * ## A filled badge, not a bare glyph
 *
 * It rides on a row that also carries a gold edge and a gold ground (see
 * [`MarketRow`](../market/MarketRow.tsx)), and the three are one mark: the
 * ground is what is seen while scrolling, the badge is what says *which* mark
 * it is. The badge is also the half that survives a **bid** on the same
 * player, where the edge and the ground go to the accent — so it has to read
 * on its own, against a tinted row, at a glance. A 14px outline glyph did not.
 *
 * ## Why binoculars and not a star
 *
 * Every other mark on a market row is already spoken for, and a scout mark
 * must not be mistaken for any of them: the **accent** edge and tint mean *you
 * have bid*, **amber** under a price means *above the market value*, and
 * **gold stars** are league titles, worn by managers' avatars. So the colour
 * alone could not carry this — the glyph is what says which of those it is,
 * the same rule the [lineup-probability
 * badge](../squad/StartProbabilityBadge.tsx) follows, and the one the app
 * keeps for anything a colour-blind reader has to tell apart.
 *
 * Gold behind the glyph because this is the only mark on the row the reader
 * *put there themselves*, and it should read as theirs at a glance.
 *
 * **It is not a control.** Scouting is done on the player's own page, where
 * the decision is made with his history in front of you; a row that toggled it
 * would be a fourth tap target on a row that already has two. So this is an
 * image with a name, not a button.
 */
export function ScoutMark({
  size = 14,
  className,
}: {
  size?: number
  className?: string
}) {
  // The label rides on the wrapper rather than the icon: lucide's components
  // take no `title`, and a tooltip is half of what this mark is for.
  return (
    <span
      role="img"
      aria-label={LABEL}
      title={LABEL}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full',
        'bg-gold/20 p-1 text-gold ring-1 ring-gold/40 ring-inset',
        className,
      )}
    >
      <Binoculars size={size} aria-hidden="true" className="fill-gold/25" />
    </span>
  )
}
