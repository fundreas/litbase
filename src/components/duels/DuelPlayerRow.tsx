import type { ReactNode } from 'react'

import {
  DUEL_PLAYER_STATUS_LABEL,
  playerFigure,
  POSITION_LABEL,
  type DuelPlayer,
  type DuelPlayerStatus,
} from '@/api/models'
import {
  figureDescription,
  figureLabel,
  isScore,
} from '@/components/player/playerFigure'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'

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
 * The figure on the right is never `0` for a player who has not scored: it is
 * the points when they exist, the **kick-off time** while the match is still
 * to come, *Bank* for someone who did not play, and `–` only when there is
 * nothing to say. That is [`playerFigure()`](../../api/models.ts), shared with
 * both pitches. Printing `0` would claim a player featured and failed to
 * score, which is why `points` is optional in the first place.
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
  const figure = playerFigure(player)
  /*
   * The status word is dropped when the figure already **is** that word.
   *
   * `playerFigure` resolves to `bench` only for a benched player with no
   * points, and for him "Bank … Bank" across one row is just noise. A benched
   * player who *did* score keeps the word, because there the figure is a
   * number and the word is the thing that says it did not count.
   */
  const showStatusWord = showStatus && figure.kind !== 'bench'

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
          {showStatusWord && (
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
        aria-label={figureDescription(figure)}
        className={cn(
          'nums shrink-0 text-sm font-semibold',
          isScore(figure) ? 'text-ink' : 'text-faint',
        )}
      >
        {figureLabel(figure)}
      </span>
    </div>
  )
}
