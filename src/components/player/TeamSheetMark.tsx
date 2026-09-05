import { Armchair, Check, X } from 'lucide-react'
import type { ComponentType } from 'react'

import { TEAM_SHEET_ROLE_LABEL, type TeamSheetRole } from '@/api/models'
import { cn } from '@/lib/cn'

/**
 * How each of the three answers is drawn.
 *
 * A glyph **and** a colour, for the reason the
 * [probability badge](../squad/StartProbabilityBadge.tsx) states: colour alone
 * cannot carry a scale, and about one man in twelve cannot separate this red
 * from this green. The glyph is the signal.
 *
 * The check is the same mark Ligainsider draws for a player who is in, the
 * armchair is the app's own bench mark, and the cross is what tier 5 of the
 * probability scale already uses for a player who is out — so all three are
 * read before they are learnt.
 */
const ROLE_STYLE: Record<
  TeamSheetRole,
  {
    icon: ComponentType<{ size?: number | string; className?: string }>
    className: string
  }
> = {
  starting: { icon: Check, className: 'bg-positive text-canvas' },
  bench: { icon: Armchair, className: 'bg-muted text-canvas' },
  out: { icon: X, className: 'bg-negative text-white' },
}

/**
 * What a player's **club** has named him as, once its team sheet is official:
 * in the eleven, on the bench, or not in the squad at all.
 *
 * ## Why it is a filled badge and the manager's bench mark is not
 *
 * Both can appear on one row, and they mean different things said by different
 * people — [`BenchMark`](./BenchMark.tsx) is *your* manager leaving a player
 * out of your eleven, this is *his club* leaving him out of theirs. A row can
 * carry the armchair twice with two meanings, which would be unreadable if the
 * two looked alike. So the club's mark is a filled disc, the way every other
 * badge that speaks for the outside world is drawn, and the manager's stays a
 * bare glyph in text colour. Weight says who is speaking; the tooltip says the
 * rest.
 *
 * ## Why it appears for the starters too
 *
 * The eleven checks are the calm answer, and they are what makes the one cross
 * in a lineup mean something: a mark that only ever appeared for bad news would
 * leave its absence ambiguous — nothing to report, or nothing known yet? Those
 * are very different an hour before kick-off, and this way only the second one
 * is blank.
 */
export function TeamSheetMark({
  role,
  size = 13,
  /** Draws a contrasting ring, for sitting on a portrait or the pitch. */
  onImage = false,
  /** Where the surrounding link or row already spells the role out. */
  decorative = false,
  className,
}: {
  role: TeamSheetRole
  size?: number
  onImage?: boolean
  decorative?: boolean
  className?: string
}) {
  const { icon: Icon, className: roleClass } = ROLE_STYLE[role]
  // Named as the club's word, not the app's: "Bank" on its own would read as
  // the manager's bench, which is the one thing this must not be mistaken for.
  const spoken = `Vereinsaufstellung: ${TEAM_SHEET_ROLE_LABEL[role]}`

  return (
    <span
      {...(decorative
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': spoken })}
      title={spoken}
      style={{ width: size, height: size }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        roleClass,
        onImage && 'ring-2 ring-white/85',
        className,
      )}
    >
      <Icon
        size={Math.round(size * 0.66)}
        className="stroke-[3.5]"
        aria-hidden="true"
      />
    </span>
  )
}

/**
 * The mark parked in the corner of a player portrait.
 *
 * **Top-right**, the corner that reads most easily against a busy pitch — and
 * free on both pitches this is drawn on, neither of which carries the squad
 * editor's probability badge. The wrapper must be `relative`.
 *
 * A prediction of who will start has no business here once this exists: the two
 * answer the same question, and one of them is now known.
 */
export function TeamSheetCorner({
  role,
  size,
  decorative = false,
}: {
  role: TeamSheetRole
  size: number
  decorative?: boolean
}) {
  return (
    <TeamSheetMark
      role={role}
      size={size}
      onImage
      decorative={decorative}
      // Pulled slightly outside the circle so it clears the portrait's own
      // curve — at the tangent a corner badge looks half-swallowed.
      className="absolute -top-0.5 -right-0.5"
    />
  )
}
