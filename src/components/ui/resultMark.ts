import {
  CircleCheck,
  CircleMinus,
  CircleX,
  type LucideIcon,
} from 'lucide-react'

/**
 * A win, a draw or a loss — whatever was being contested.
 *
 * The same three spellings [`TeamResult`](../../api/models.ts) uses, so a
 * club's result needs no conversion to be drawn; a manager's
 * [`DuelResult`](../../api/models.ts) says *won / drawn / lost* and is mapped
 * across in [`duelResult`](../ranking/duelResult.ts).
 */
export type ResultKind = 'win' | 'draw' | 'loss'

/**
 * **One mark and one colour per outcome, for the whole app.**
 *
 * ✓ for a win, – for a draw, ✗ for a loss, in the app's own positive, muted and
 * negative. Two kinds of contest are drawn with it and they are deliberately
 * drawn identically: a manager's [duels](../ranking/DuelFormStrip.tsx) on the
 * standings and a club's [results](../team/ClubFormStrip.tsx) on the league
 * table. Both are *the last five, fading into the season* — see
 * [`FORM_DEPTH`](./formDepth.ts) — and a reader who learns the notation on one
 * table should not have to learn a second on the other.
 *
 * The club table drew **S / U / N** for a day, which is what a printed
 * Bundesliga table does and what the club page's own form card still does at
 * 32px with a scoreline under each disc. At 10px beside a club name the
 * letters were the weaker half of the pair: three glyphs that differ only as
 * letterforms, against three that differ as *shapes*. The shape is what
 * survives the fade.
 *
 * **The mark is never the colour alone.** Each caller carries the whole
 * sentence as the strip's accessible name and tooltip — which outcome, which
 * matchday, and the scoreline where it has one.
 */
export const RESULT_MARK: Record<
  ResultKind,
  { Icon: LucideIcon; className: string }
> = {
  win: { Icon: CircleCheck, className: 'text-positive' },
  draw: { Icon: CircleMinus, className: 'text-muted' },
  loss: { Icon: CircleX, className: 'text-negative' },
}
