import { Minus, TrendingDown, TrendingUp } from 'lucide-react'

import {
  POSITION_LABEL,
  type MarketValueTrend,
  type PositionKey,
  type SquadMember,
} from '@/api/models'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'
import { money, moneyDelta, points } from '@/lib/format'

const POSITION_ORDER: PositionKey[] = ['gk', 'def', 'mid', 'fwd']

/**
 * The full squad as a grouped list — the original squad view, unchanged.
 * Extracted from `SquadPage` when the lineup tab was added.
 */
export function PlayerListTab({ squad }: { squad: SquadMember[] }) {
  const byPosition = POSITION_ORDER.map((position) => ({
    position,
    players: squad
      .filter((player) => player.position === position)
      .sort((a, b) => b.marketValue - a.marketValue),
  })).filter((group) => group.players.length > 0)

  return (
    <div className="flex flex-col gap-5">
      {byPosition.map(({ position, players }) => (
        <section key={position} className="flex flex-col gap-2">
          <h2 className="px-1 text-[0.6875rem] font-semibold tracking-wider text-faint uppercase">
            {POSITION_LABEL[position]} · {players.length}
          </h2>
          <ul className="flex flex-col gap-2">
            {players.map((player) => (
              <PlayerRow key={player.id} player={player} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function PlayerRow({ player }: { player: SquadMember }) {
  return (
    <li className="flex items-center gap-3 rounded-card border border-line bg-surface px-3 py-2.5">
      <Avatar
        src={player.image}
        name={player.lastName}
        size={40}
        square
        className="bg-surface-2"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {player.lastName}
          {player.status !== 0 && (
            <span
              className="ml-1.5 align-middle text-xs text-negative"
              title="Nicht einsatzbereit"
            >
              ●
            </span>
          )}
        </p>
        <p className="nums truncate text-xs text-muted">
          {points(player.totalPoints)} Pkt · ⌀ {points(player.averagePoints)}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="nums text-sm font-semibold text-ink">
          {money(player.marketValue)}
        </p>
        <p
          className={cn(
            'nums flex items-center justify-end gap-1 text-xs',
            player.profitLoss > 0 && 'text-positive',
            player.profitLoss < 0 && 'text-negative',
            player.profitLoss === 0 && 'text-faint',
          )}
        >
          <TrendIcon trend={player.marketValueTrend} />
          {moneyDelta(player.profitLoss)}
        </p>
      </div>
    </li>
  )
}

function TrendIcon({ trend }: { trend: MarketValueTrend }) {
  if (trend === 'up') return <TrendingUp size={12} className="text-positive" />
  if (trend === 'down')
    return <TrendingDown size={12} className="text-negative" />
  return <Minus size={12} className="text-faint" />
}
