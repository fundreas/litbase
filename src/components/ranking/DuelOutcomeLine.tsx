import { CircleCheck, CircleMinus, CircleX } from 'lucide-react'

import type { DuelResult } from '@/api/models'
import { cn } from '@/lib/cn'

const DUEL_RESULT = {
  won: { Icon: CircleCheck, className: 'text-positive', text: 'Gewonnen' },
  drawn: { Icon: CircleMinus, className: 'text-muted', text: 'Remis' },
  lost: { Icon: CircleX, className: 'text-negative', text: 'Verloren' },
} as const

/**
 * How a manager's duel went, and against whom.
 *
 * The outcome is **spelled out** rather than left to the icon's colour, which
 * would be the only cue otherwise — and colour alone is not a cue everyone
 * gets. See [Ranking](../../../docs/pages/ranking.md#duel-outcome).
 *
 * Shared by the [season standings](../../pages/RankingPage.tsx) and the duels
 * page's [matchday standings](./ManagerRankingTab.tsx), which show the same
 * sentence about two different matchdays — the season table's is the current
 * duel, the duels page's is the duel of whichever matchday is selected.
 *
 * Renders nothing at all outside duel leagues, where there is no duel and no
 * opponent to name.
 */
export function DuelOutcomeLine({
  result,
  opponentName,
}: {
  result: DuelResult | undefined
  opponentName: string | undefined
}) {
  if (result === undefined && opponentName === undefined) return null
  const outcome = result === undefined ? undefined : DUEL_RESULT[result]

  return (
    <p className="flex items-center gap-1 text-xs">
      {outcome !== undefined && (
        <>
          <outcome.Icon
            size={13}
            aria-hidden="true"
            className={cn('shrink-0', outcome.className)}
          />
          <span className={cn('shrink-0 font-medium', outcome.className)}>
            {outcome.text}
          </span>
        </>
      )}
      {opponentName !== undefined && (
        <span className="truncate text-faint">vs. {opponentName}</span>
      )}
    </p>
  )
}
