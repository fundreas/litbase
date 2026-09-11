import type { MatchPlayerOwner } from '@/api/models'
import { ownerLabel } from '@/components/matchday/ownerLabel'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'

/**
 * **Who in the league owns this player** — the manager's own avatar, on the
 * player's portrait.
 *
 * This is the whole reason the [match lineup](./MatchLineupTab.tsx) is worth
 * more than the one on the Kickbase website: a Bundesliga eleven means nothing
 * to a manager until they can see which of those players are *someone's*, and
 * whose. Everything else on that screen is a fact about football; this is the
 * fact about the league.
 *
 * An avatar rather than a name or a colour. Twenty-two portraits leave no room
 * for a name, and a colour key would have to be learned — while a manager's
 * avatar is already how they are identified in the drawer, the standings and
 * every duel. The signed-in user's own players take the **accent ring**, so
 * "which of these are mine" is answered without reading anything at all.
 *
 * **Every badge is drawn at full strength**, including a manager who owned the
 * player and left him out. That case used to be faded, on the reasoning that it
 * makes a weaker claim — "mine, but not playing for me". At 16px on a busy
 * pitch the fade cost legibility of the face, which is the badge's entire job,
 * and bought a distinction the tooltip already states in words. The weaker
 * claim is still worded by {@link ownerLabel}; it is no longer whispered.
 *
 * Wordless, therefore labelled: the manager's name rides along as the tooltip
 * and as screen-reader text, since a small circular photograph says nothing to
 * either — see {@link ownerLabel}, which is where the badge's claim is worded.
 */
export function OwnerBadge({
  owner,
  size = 16,
  onImage = false,
  className,
}: {
  owner: MatchPlayerOwner
  size?: number
  /** Over grass or a portrait, where the ring needs to be light. */
  onImage?: boolean
  className?: string
}) {
  const label = ownerLabel(owner)

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn('flex shrink-0', className)}
    >
      <Avatar
        src={owner.image}
        name={owner.name}
        size={size}
        className={cn(
          'ring-2',
          owner.isViewer
            ? 'ring-accent'
            : onImage
              ? 'ring-white/80'
              : 'ring-surface',
        )}
      />
    </span>
  )
}
