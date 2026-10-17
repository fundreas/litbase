import {
  CircleCheck,
  CircleMinus,
  CircleX,
  type LucideIcon,
} from 'lucide-react'

import type { DuelResult } from '@/api/models'

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
 * The word is always available as the mark's label, so the colour is never the
 * only cue; see [Ranking](../../../docs/pages/ranking.md#duel-outcome).
 */
export const DUEL_RESULT: Record<
  DuelResult,
  { Icon: LucideIcon; className: string; text: string }
> = {
  won: { Icon: CircleCheck, className: 'text-positive', text: 'Gewonnen' },
  drawn: { Icon: CircleMinus, className: 'text-muted', text: 'Remis' },
  lost: { Icon: CircleX, className: 'text-negative', text: 'Verloren' },
}
