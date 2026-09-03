import {
  availabilityLabel,
  POSITION_NAME,
  START_PROBABILITY,
  type PlayerDetail,
} from '@/api/models'
import { StartProbabilityBadge } from '@/components/squad/StartProbabilityBadge'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'

/**
 * Who this page is about — shown above all three tabs.
 *
 * Kept out of the Details tab even though it is the player's identity: it is
 * what tells you which player you are looking at, and a market chart with no
 * name above it is a chart of nothing. The Details tab carries the numbers.
 *
 * The availability chip is only rendered when there is something to say. A
 * "Fit" pill on 90% of players is decoration that trains people to ignore the
 * spot where the real warning appears.
 *
 * **No back link.** The page is reached by tapping a row, and the browser's
 * own back — the system gesture on a phone, the hardware button on Android —
 * already does it. An in-page chevron duplicated that and spent the first line
 * of a small screen saying so.
 */
export function PlayerHeader({ player }: { player: PlayerDetail }) {
  const isFit = player.status === 0
  const probability =
    player.startProbability === undefined
      ? undefined
      : START_PROBABILITY[player.startProbability]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {/* Square, like every other player portrait in the app — the round
            treatment is reserved for manager avatars, which keeps "a person
            who plays this game" and "a person in a photo" apart at a glance. */}
        <Avatar
          src={player.image}
          name={player.lastName}
          size={72}
          square
          className="bg-surface-2"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h1 className="truncate text-xl font-bold tracking-tight text-ink">
              {player.lastName}
            </h1>
            {player.shirtNumber !== undefined && (
              <span className="nums shrink-0 text-sm font-semibold text-faint">
                #{player.shirtNumber}
              </span>
            )}
          </div>

          {player.firstName !== undefined && (
            <p className="truncate text-sm text-muted">{player.firstName}</p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="flex items-center gap-1.5 text-muted">
              <Avatar
                src={player.teamImage}
                name={player.teamName}
                size={16}
                square
                className="bg-transparent"
              />
              <span className="truncate">{player.teamName ?? '–'}</span>
            </span>
            <span className="text-faint">·</span>
            <span className="text-muted">{POSITION_NAME[player.position]}</span>
          </div>
        </div>
      </div>

      {(!isFit || probability !== undefined) && (
        <div className="flex flex-wrap items-center gap-2">
          {!isFit && (
            <span className="rounded-full bg-negative/15 px-2.5 py-1 text-xs font-semibold text-negative">
              {availabilityLabel(player.status)}
            </span>
          )}
          {probability !== undefined &&
            player.startProbability !== undefined && (
              <span
                className={cn(
                  'flex items-center gap-1.5 rounded-full border border-line bg-surface',
                  'px-2.5 py-1 text-xs font-medium text-muted',
                )}
              >
                <StartProbabilityBadge
                  tier={player.startProbability}
                  size={13}
                  decorative
                />
                {probability.label}
              </span>
            )}
        </div>
      )}
    </div>
  )
}
