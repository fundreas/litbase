import { rankDuelPlayers } from '@/api/hooks/useDuelRosters'
import type { DuelRoster } from '@/api/models'
import { DuelPlayerRow } from '@/components/duels/DuelPlayerRow'
import { Avatar } from '@/components/ui/Avatar'
import { useMemo } from 'react'

/**
 * Every player from both sides in one list, best first.
 *
 * The point of this view is that the two squads are *interleaved*: seeing
 * whose players occupy the top of a combined table says more about how a duel
 * is going than two separate lists do. So each row carries the owning
 * manager's avatar — small, on the right, next to the score — which is the
 * only thing distinguishing otherwise identical rows.
 */
export function DuelRankingTab({
  rosters,
}: {
  rosters: [DuelRoster, DuelRoster]
}) {
  const ranked = useMemo(() => rankDuelPlayers(rosters), [rosters])
  const managerById = useMemo(
    () => new Map(rosters.map((roster) => [roster.manager.id, roster.manager])),
    [rosters],
  )

  return (
    <ol className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      {ranked.map((player, index) => {
        // Always set on a duel roster; optional on the model only because the
        // squad page's live view has no sides to tell apart.
        const manager =
          player.managerId === undefined
            ? undefined
            : managerById.get(player.managerId)
        return (
          <li key={player.id} className="flex items-center">
            <span className="nums w-8 shrink-0 pl-3 text-right text-xs font-semibold text-faint">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <DuelPlayerRow
                player={player}
                // The lineup tab already says what every player's match is
                // doing; here the one thing that changes how a row is read is
                // whether it counted, which the "Bank" tag says on its own.
                showStatus={player.status === 'bench'}
                trailing={
                  <Avatar
                    src={manager?.image}
                    name={manager?.name}
                    size={20}
                    className="shrink-0"
                  />
                }
              />
            </div>
          </li>
        )
      })}
    </ol>
  )
}
