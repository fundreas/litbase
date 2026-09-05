import { House, PlaneTakeoff } from 'lucide-react'

import type { TeamFixture } from '@/api/models'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'

type Size = 'sm' | 'md' | 'lg'

/** Crest sizes per variant, in px. The badge is derived from the crest. */
const SIZES: Record<Size, number> = { sm: 24, md: 30, lg: 38 }

/** The corner chip, as a fraction of the crest — clamped to stay legible. */
function chipSize(crest: number): number {
  return Math.min(16, Math.max(10, Math.round(crest * 0.42)))
}

/**
 * A player's next fixture: **who against**, and whether it is at home.
 *
 * Deliberately wordless. The short symbol this used to print ate the width that
 * makes the crest legible, and a crest is recognised faster than three letters
 * anyway.
 *
 * **The crest is the badge; home-or-away rides on it.** The two used to sit
 * side by side at comparable sizes, which gave a house the same weight as the
 * club it was next to — but the opponent is the fact being read, and whether
 * the match is at home is a qualifier on it. So the crest takes the whole slot
 * and the house or aeroplane shrinks to a chip in its bottom-right corner, the
 * way a flag sits on a badge. The one-glance answer is now the club, with the
 * venue available to the second glance.
 *
 * The chip sits **inside** the crest's box rather than overhanging it, so the
 * badge's footprint is exactly `crest × crest`. That matters on the
 * [pitch](./LineupTab.tsx), where the card height is computed from the crest
 * size and a couple of overhanging pixels would push every band.
 *
 * Because nothing is spelled out visually, the whole badge is a labelled
 * `role="img"`: assistive tech gets "Heimspiel gegen FCB" even though sighted
 * users get a crest and a glyph.
 */
export function FixtureBadge({
  fixture,
  className,
  tone = 'default',
  size = 'sm',
}: {
  fixture: TeamFixture | undefined
  className?: string
  /** `onPitch` swaps to light colours, for use over the grass. */
  tone?: 'default' | 'onPitch'
  /** A preset, or an explicit crest size in px for continuous scaling. */
  size?: Size | number
}) {
  const crest = typeof size === 'number' ? size : SIZES[size]

  if (fixture === undefined) {
    // No fixture this matchday — a bye, or the club is out of the competition.
    // Still the full box, so a row with one keeps its shape.
    return (
      <span
        role="img"
        aria-label="Kein Spiel an diesem Spieltag"
        title="Kein Spiel an diesem Spieltag"
        style={{ width: crest, height: crest }}
        className={cn(
          'flex shrink-0 items-center justify-center text-[0.6875rem]',
          tone === 'onPitch' ? 'text-white/70' : 'text-faint',
          className,
        )}
      >
        –
      </span>
    )
  }

  const Icon = fixture.isHome ? House : PlaneTakeoff
  const label = `${fixture.isHome ? 'Heimspiel' : 'Auswärtsspiel'} gegen ${fixture.opponentSymbol}`
  const chip = chipSize(crest)

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      style={{ width: crest, height: crest }}
      className={cn('relative flex shrink-0', className)}
    >
      <Avatar
        src={fixture.opponentImage}
        name={fixture.opponentSymbol}
        size={crest}
        square
        className="bg-transparent"
      />
      {/* The chip carries its own ground because it lands on artwork: a crest
          is a full-bleed image and a bare glyph over one is unreadable at
          10px. Over the grass that ground is the same black wash the pitch's
          other corner marks use, so the notation matches. */}
      <span
        aria-hidden="true"
        style={{ width: chip, height: chip }}
        className={cn(
          'absolute right-0 bottom-0 flex items-center justify-center rounded-full',
          tone === 'onPitch'
            ? 'bg-black/80 text-white'
            : cn(
                'bg-surface ring-1 ring-line',
                fixture.isHome ? 'text-positive' : 'text-accent',
              ),
        )}
      >
        <Icon size={Math.round(chip * 0.7)} className="shrink-0" />
      </span>
    </span>
  )
}
