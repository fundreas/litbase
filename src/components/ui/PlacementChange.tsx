import { TrendingDown, TrendingUp } from 'lucide-react'

import { cn } from '@/lib/cn'

/**
 * How far something moved in a table since the last time it was ranked.
 *
 * **Nothing at all when it held its place.** A dash on its own line was a
 * second subtitle carrying no information, and the space it took was the space
 * a real movement needs to stand out in.
 *
 * Shared by the [standings](../../pages/RankingPage.tsx), where the value is
 * the API's own `ppc`, and by the [team page](../team/TeamHeader.tsx), where it
 * is `pcpl − cpl` off the league table. Both are "places gained", so a positive
 * number is always an improvement and always green — which is the one thing
 * that had to be agreed before two screens could share the mark.
 */
export function PlacementChange({
  /** Places gained since the previous ranking. Negative is a drop. */
  value,
  size = 12,
  className,
}: {
  value: number
  size?: number
  className?: string
}) {
  if (value === 0) return null

  const isUp = value > 0
  const label = `${String(Math.abs(value))} ${Math.abs(value) === 1 ? 'Platz' : 'Plätze'} ${isUp ? 'gutgemacht' : 'verloren'}`

  return (
    <span
      title={label}
      className={cn(
        'nums flex items-center justify-center gap-0.5 text-xs',
        isUp ? 'text-positive' : 'text-negative',
        className,
      )}
    >
      {isUp ? (
        <TrendingUp size={size} aria-hidden="true" />
      ) : (
        <TrendingDown size={size} aria-hidden="true" />
      )}
      <span aria-hidden="true">{Math.abs(value)}</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}
