import { Armchair } from 'lucide-react'

import { cn } from '@/lib/cn'

/**
 * "This player was on the bench", as the armchair rather than the word.
 *
 * The same glyph the squad page's [bench section](../squad/LineupTab.tsx) is
 * headed with, so it is already learnt by the time it turns up on a row. It
 * replaces the word *Bank*, which had to compete for width with a name, a
 * fixture and a score — a mark says it in a tenth of the space, and in the
 * figure column it sits where a number would, which is exactly the reading
 * wanted: nothing was scored here that counts.
 *
 * The word rides along as screen-reader text and as the tooltip, so nothing is
 * lost to anyone who cannot see the glyph or does not recognise it.
 */
export function BenchMark({
  size = 13,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <span
      title="Auf der Bank — zählt nicht"
      className={cn('inline-flex shrink-0 items-center', className)}
    >
      <Armchair size={size} aria-hidden="true" />
      <span className="sr-only">Bank</span>
    </span>
  )
}
