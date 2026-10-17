import { Link } from 'react-router'

import type { Duel } from '@/api/models'
import { Avatar } from '@/components/ui/Avatar'
import { SwitchBar, SWITCH_CHIP } from '@/components/ui/SwitchBar'
import { cn } from '@/lib/cn'
import { points } from '@/lib/format'

/**
 * **The matchday's other pairings, above the one being read** — two faces and
 * the two totals, per duel, in a row that scrolls sideways.
 *
 * The [match strip](../matchday/MatchSwitchBar.tsx)'s twin, and deliberately
 * the same control: same pill, same accent ring on the one you are on, same
 * sideways scroll. A league looks at its duels the way it looks at a matchday
 * — one after another — and that round trip through the list is what both
 * strips remove.
 *
 * **It costs no request.** `useDuels` for the matchday is the query the page
 * has already run to find its own pairing; every other duel came with it, live
 * poll included. So these totals are as fresh as the scoreline below them.
 *
 * Avatars are plain, not [starred](../manager/ManagerAvatar.tsx): at 18px a
 * crown of gold stars is a smudge, and the titles are on every face the moment
 * you land on the duel itself.
 */
export function DuelSwitchBar({
  duels,
  activeDuelId,
  hasStarted,
  viewerId,
  to,
}: {
  /** Every pairing of the matchday, in the order the list shows them. */
  duels: Duel[]
  activeDuelId: string
  /** Before the first whistle every total is `0`, so none is shown. */
  hasStarted: boolean
  viewerId?: string
  /** Route for one duel — the page keeps its tab and its `?day=`. */
  to: (duelId: string) => string
}) {
  return (
    <SwitchBar label="Andere Duelle des Spieltags" activeKey={activeDuelId}>
      {duels.map((duel) => {
        const isActive = duel.id === activeDuelId
        const [left, right] = duel.sides
        // The viewer's own duel, marked so it can be found in a strip of ten
        // faces — the same half-accent border the list's card wears, and only
        // where the full ring is not already there for another reason.
        const isMine = duel.sides.some((side) => side.id === viewerId)

        return (
          <Link
            key={duel.id}
            to={to(duel.id)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={`Duell ${left.name} gegen ${right.name}`}
            title={`${left.name} – ${right.name}`}
            className={cn(
              SWITCH_CHIP,
              isActive
                ? 'border-accent bg-accent/15'
                : cn(
                    'bg-surface hover:bg-surface-2 active:bg-surface-2',
                    isMine ? 'border-accent/50' : 'border-line',
                  ),
            )}
          >
            <Avatar src={left.image} name={left.name} size={18} />
            <span
              className={cn(
                'nums text-xs leading-none font-semibold whitespace-nowrap',
                hasStarted ? 'text-ink' : 'text-faint',
              )}
            >
              {hasStarted
                ? `${points(left.matchdayPoints)}:${points(right.matchdayPoints)}`
                : '–:–'}
            </span>
            <Avatar src={right.image} name={right.name} size={18} />
          </Link>
        )
      })}
    </SwitchBar>
  )
}
