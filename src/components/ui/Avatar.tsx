import * as RadixAvatar from '@radix-ui/react-avatar'

import { cdnUrl } from '@/api/cdn'
import { cn } from '@/lib/cn'
import { initials as toInitials } from '@/lib/format'

export interface AvatarProps {
  /** Absolute URL or a CDN-relative Kickbase path. */
  src?: string | null
  name?: string | null
  size?: number
  className?: string
  /** Render as a rounded square instead of a circle (used for club crests). */
  square?: boolean
  /**
   * Drop the fixed box and fill the parent instead, so the image can sit flush
   * in a container that sizes itself (a list row's full height, say). `size`
   * is ignored; the caller owns width, height and rounding via `className`.
   */
  fill?: boolean
}

export function Avatar({
  src,
  name,
  size = 36,
  className,
  square = false,
  fill = false,
}: AvatarProps) {
  const resolved = cdnUrl(src)

  return (
    <RadixAvatar.Root
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden select-none',
        'bg-surface-2 align-middle',
        !fill && (square ? 'rounded-lg' : 'rounded-full'),
        className,
      )}
      style={fill ? undefined : { width: size, height: size }}
    >
      {resolved !== undefined && (
        <RadixAvatar.Image
          src={resolved}
          alt={name ?? ''}
          className="h-full w-full object-cover"
        />
      )}
      <RadixAvatar.Fallback
        // Small delay avoids a flash of initials when the image is cached.
        delayMs={resolved === undefined ? 0 : 120}
        className="leading-none font-semibold text-muted"
        style={{ fontSize: Math.max(10, Math.round(size * 0.38)) }}
      >
        {toInitials(name)}
      </RadixAvatar.Fallback>
    </RadixAvatar.Root>
  )
}
