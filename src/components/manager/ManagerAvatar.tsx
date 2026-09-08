import { Star } from 'lucide-react'

import { useManagerHistory } from '@/api/hooks/useManagerHistory'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'

/**
 * Past this many, the stars would be wider than the face they sit on. A
 * manager with more gets this many plus the exact count in the tooltip.
 */
const MAX_STARS = 5

/**
 * **A manager's avatar with one gold star per league title along its top.**
 *
 * The standings, the duel cards and the matchday ranking all show the same
 * faces, and a champion should look like one on each of them — so the stars
 * live here, on the avatar, rather than in three row layouts. The component
 * asks for the manager's history itself: React Query holds one entry per
 * manager for an hour, so ten rows on three pages cost ten requests, once.
 *
 * The stars are the finished seasons the manager ended in first place **in
 * this league** — see [`useManagerHistory`](../../api/hooks/useManagerHistory.ts)
 * for why the running season can never be one. Nothing is drawn while the
 * history is loading or for a manager without a title, so a row never flashes
 * a badge it then takes back.
 */
export function ManagerAvatar({
  leagueId,
  manager,
  size = 36,
  className,
}: {
  leagueId: string
  manager: { id: string; name: string; image?: string }
  size?: number
  className?: string
}) {
  const history = useManagerHistory(leagueId, manager.id)
  const titles = history.data?.titles ?? 0

  return (
    <span
      className={cn('relative inline-flex shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <Avatar src={manager.image} name={manager.name} size={size} />
      {titles > 0 && <TitleStars count={titles} avatarSize={size} />}
    </span>
  )
}

function TitleStars({
  count,
  avatarSize,
}: {
  count: number
  avatarSize: number
}) {
  const shown = Math.min(count, MAX_STARS)
  // A fifth of the face — a mark on the avatar, not a badge beside it — and
  // never so small the star loses its shape.
  const starSize = Math.max(8, Math.round(avatarSize * 0.22))
  const label = count === 1 ? '1 Meistertitel' : `${String(count)} Meistertitel`

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="pointer-events-auto absolute inset-x-0 flex justify-center"
      // Sits astride the rim: half the star above the circle, half over it.
      style={{ top: -Math.round(starSize / 2) }}
    >
      {Array.from({ length: shown }, (_, index) => (
        <Star
          key={index}
          size={starSize}
          strokeWidth={1.5}
          aria-hidden="true"
          className="shrink-0 fill-gold text-gold-ink drop-shadow-[0_1px_1px_oklch(0_0_0/0.5)]"
          // Points tuck under the neighbour, so five still fit on a 44px face.
          style={
            index === 0 ? undefined : { marginLeft: -Math.round(starSize / 5) }
          }
        />
      ))}
    </span>
  )
}
