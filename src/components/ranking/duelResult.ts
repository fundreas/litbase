import type { LucideIcon } from 'lucide-react'

import type { DuelResult } from '@/api/models'
import { RESULT_MARK, type ResultKind } from '@/components/ui/resultMark'

/**
 * *won / drawn / lost* → *win / draw / loss*, the two spellings the app has
 * for one idea.
 *
 * A manager's duel and a club's match are the same three outcomes and are
 * drawn with the same three marks — see [`RESULT_MARK`](../ui/resultMark.ts) —
 * but the models name them differently, and renaming either would touch every
 * payload mapper for a word. This is the seam, and it is three lines.
 */
const MARK_KIND: Record<DuelResult, ResultKind> = {
  won: 'win',
  drawn: 'draw',
  lost: 'loss',
}

/**
 * How each of the three duel outcomes is drawn — **one mark, one colour, one
 * word.**
 *
 * Its own module rather than a second export from
 * [`DuelOutcomeLine`](./DuelOutcomeLine.tsx), for the reason
 * [`managerTabs`](../manager/managerTabs.ts) and `navigation.ts` are their own
 * modules: a file that exports both a component and a plain value breaks React
 * Fast Refresh.
 *
 * Two shapes need it. The outcome *line* spells a result out under a scoreline;
 * a row in a **season of duels**
 * ([`ManagerPerformanceTab`](../manager/ManagerPerformanceTab.tsx)) has no room
 * for the word on every row and carries the mark alone — but it has to be the
 * same mark and the same green, or two screens describe one result two ways.
 *
 * **The mark and the colour are not this file's.** They come from
 * [`RESULT_MARK`](../ui/resultMark.ts), which a club's
 * [results on the league table](../team/ClubFormStrip.tsx) read too; what is
 * this file's is the German word for a *duel*'s outcome, which is not a club's.
 *
 * The word is always available as the mark's label, so the colour is never the
 * only cue; see [Ranking](../../../docs/pages/ranking.md#duel-outcome).
 */
export const DUEL_RESULT: Record<
  DuelResult,
  { Icon: LucideIcon; className: string; text: string }
> = {
  won: { ...RESULT_MARK[MARK_KIND.won], text: 'Gewonnen' },
  drawn: { ...RESULT_MARK[MARK_KIND.drawn], text: 'Remis' },
  lost: { ...RESULT_MARK[MARK_KIND.lost], text: 'Verloren' },
}
