import type { ReactNode } from 'react'

import {
  DUEL_PLAYER_STATUS_LABEL,
  POSITION_LABEL,
  type DuelPlayer,
  type DuelPlayerStatus,
} from '@/api/models'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'
import { points } from '@/lib/format'

/**
 * Status colours. Only `playing` is loud — it is the one state that is going
 * to change, and the only one worth scanning a live page for. Everything else
 * stays quiet so eleven rows do not read as a warning light.
 */
const STATUS_CLASS: Record<DuelPlayerStatus, string> = {
  playing: 'text-accent',
  substituted: 'text-warning',
  finished: 'text-faint',
  open: 'text-muted',
  bench: 'text-faint',
}

/**
 * One player in a duel: who they are, what their match is doing, what they
 * scored.
 *
 * Points render as `–` rather than `0` while unknown. The distinction is the
 * whole reason `points` is optional: a player whose match has not kicked off
 * has *no* score, and printing `0` would claim they played and failed to
 * score.
 */
export function DuelPlayerRow({
  player,
  showStatus = true,
  trailing,
}: {
  player: DuelPlayer
  /** Off in the ranking tab, where the "Bank" tag carries the same load. */
  showStatus?: boolean
  /** Extra content on the right, e.g. the owning manager's avatar. */
  trailing?: ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <Avatar src={player.image} name={player.name} size={34} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{player.name}</p>
        <p className="flex items-center gap-1.5 text-xs">
          {/* `–` rather than a guess: the position is unknown only for a
              player transferred away since the matchday, whom no current squad
              can be asked about. */}
          <span className="shrink-0 text-faint">
            {player.position === undefined
              ? '–'
              : POSITION_LABEL[player.position]}
          </span>
          {player.fixture !== undefined && (
            <span className="truncate text-faint">
              {player.fixture.isHome ? 'vs' : '@'}{' '}
              {player.fixture.opponentSymbol}
            </span>
          )}
          {showStatus && (
            <span
              className={cn(
                'shrink-0 font-medium',
                STATUS_CLASS[player.status],
              )}
            >
              {DUEL_PLAYER_STATUS_LABEL[player.status]}
            </span>
          )}
        </p>
      </div>

      {trailing}

      <span
        className={cn(
          'nums shrink-0 text-sm font-semibold',
          player.points === undefined ? 'text-faint' : 'text-ink',
        )}
      >
        {player.points === undefined ? '–' : points(player.points)}
      </span>
    </div>
  )
}
