import { House, PlaneTakeoff } from 'lucide-react'

import type { TeamFixture } from '@/api/models'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'

type Size = 'sm' | 'md' | 'lg'

/** Icon and crest sizes per variant, in px. */
const SIZES: Record<Size, { icon: number; crest: number }> = {
  sm: { icon: 12, crest: 18 },
  md: { icon: 15, crest: 24 },
  lg: { icon: 18, crest: 30 },
}

/**
 * A player's next fixture: whether it is at home, and who against.
 *
 * Deliberately wordless — a house or an aeroplane plus the opponent's crest.
 * The short symbol this used to print ate the width that makes the crest
 * legible, and a crest is recognised faster than three letters anyway.
 *
 * Because nothing is spelled out visually, the whole badge is a labelled
 * `role="img"`: assistive tech gets "Heimspiel gegen FCB" even though sighted
 * users get two glyphs.
 */
export function FixtureBadge({
  fixture,
  className,
  tone = 'default',
  size = 'sm',
  layout = 'inline',
}: {
  fixture: TeamFixture | undefined
  className?: string
  /** `onPitch` swaps to light colours, for use over the grass. */
  tone?: 'default' | 'onPitch'
  size?: Size
  /** `stacked` puts the icon above the crest, to fill a tall slot. */
  layout?: 'inline' | 'stacked'
}) {
  const { icon, crest } = SIZES[size]

  if (fixture === undefined) {
    // No fixture this matchday — a bye, or the club is out of the competition.
    return (
      <span
        role="img"
        aria-label="Kein Spiel an diesem Spieltag"
        title="Kein Spiel an diesem Spieltag"
        className={cn(
          'flex items-center justify-center text-[0.6875rem]',
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

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        'flex items-center justify-center',
        layout === 'stacked' ? 'flex-col gap-1' : 'flex-row gap-1',
        className,
      )}
    >
      <Icon
        size={icon}
        aria-hidden="true"
        className={cn(
          'shrink-0',
          tone === 'onPitch'
            ? 'text-white/90'
            : fixture.isHome
              ? 'text-positive'
              : 'text-accent',
        )}
      />
      <Avatar
        src={fixture.opponentImage}
        name={fixture.opponentSymbol}
        size={crest}
        square
        className="bg-transparent"
      />
    </span>
  )
}
