import { House, PlaneTakeoff } from 'lucide-react'

import type { TeamFixture } from '@/api/models'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'

/**
 * A player's next fixture: who they face and whether it is at home.
 *
 * Home/away is carried by an icon *and* by the `title`, not by colour alone —
 * a house for home, a plane for away, which reads without German or English.
 * The opponent is shown as crest plus short symbol (`FCB`, `VFB`) because a
 * full club name never fits a bench card.
 */
export function FixtureBadge({
  fixture,
  className,
  tone = 'default',
}: {
  fixture: TeamFixture | undefined
  className?: string
  /** `onPitch` swaps to light text, for use over the grass. */
  tone?: 'default' | 'onPitch'
}) {
  if (fixture === undefined) {
    // No fixture this matchday — a bye, or the team is out of the competition.
    return (
      <span
        className={cn(
          'text-[0.625rem]',
          tone === 'onPitch' ? 'text-white/70' : 'text-faint',
          className,
        )}
        title="Kein Spiel an diesem Spieltag"
      >
        –
      </span>
    )
  }

  const Icon = fixture.isHome ? House : PlaneTakeoff

  return (
    <span
      className={cn('flex items-center gap-1 text-[0.625rem]', className)}
      title={`${fixture.isHome ? 'Heimspiel' : 'Auswärtsspiel'} gegen ${fixture.opponentSymbol}`}
    >
      <Icon
        size={10}
        className={cn(
          'shrink-0',
          tone === 'onPitch'
            ? 'text-white/90'
            : fixture.isHome
              ? 'text-positive'
              : 'text-accent',
        )}
        aria-hidden="true"
      />
      <Avatar
        src={fixture.opponentImage}
        name={fixture.opponentSymbol}
        size={12}
        square
        className="bg-transparent"
      />
      <span
        className={cn(
          'truncate',
          tone === 'onPitch' ? 'text-white/90' : 'text-muted',
        )}
      >
        {fixture.opponentSymbol}
      </span>
    </span>
  )
}
