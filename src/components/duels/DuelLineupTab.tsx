import type { DuelRoster } from '@/api/models'
import { DuelPlayerRow } from '@/components/duels/DuelPlayerRow'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'
import { points } from '@/lib/format'

/**
 * Both teams, one under the other.
 *
 * Side by side was the obvious layout and the wrong one: two elevens in
 * parallel columns on a 360px screen leaves ~170px per player, which is not
 * enough for a name, a fixture and a score. Stacked, each roster gets the full
 * width and the comparison is made by the header figures rather than by the
 * eye travelling sideways.
 */
export function DuelLineupTab({
  rosters,
  viewerId,
}: {
  rosters: [DuelRoster, DuelRoster]
  viewerId?: string
}) {
  return (
    <div className="flex flex-col gap-4">
      {rosters.map((roster) => (
        <RosterCard
          key={roster.manager.id}
          roster={roster}
          isViewer={roster.manager.id === viewerId}
        />
      ))}
    </div>
  )
}

function RosterCard({
  roster,
  isViewer,
}: {
  roster: DuelRoster
  isViewer: boolean
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-card border bg-surface',
        isViewer ? 'border-accent/50' : 'border-line',
      )}
    >
      <header className="flex items-center gap-3 border-b border-line px-3 py-3">
        <Avatar
          src={roster.manager.image}
          name={roster.manager.name}
          size={40}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">
            {roster.manager.name}
            {isViewer && <span className="ml-1.5 text-xs text-accent">du</span>}
          </p>
          {/* What is still to come, which is the question a live duel raises:
              a manager 40 points behind with four matches open is winning. */}
          <p className="nums truncate text-xs text-muted">
            {roster.activeMatches} laufend · {roster.openMatches} offen
          </p>
        </div>
        <p className="nums shrink-0 text-lg font-bold text-ink">
          {points(roster.totalPoints)}
        </p>
      </header>

      <ul className="divide-y divide-line">
        {roster.lineup.map((player) => (
          <li key={player.id}>
            <DuelPlayerRow player={player} />
          </li>
        ))}
      </ul>

      {roster.bench.length > 0 && (
        <>
          <h3 className="border-t border-line bg-surface-2/40 px-3 py-1.5 text-[0.6875rem] font-medium tracking-wide text-faint uppercase">
            Bank
          </h3>
          <ul className="divide-y divide-line">
            {roster.bench.map((player) => (
              <li key={player.id} className="opacity-60">
                <DuelPlayerRow player={player} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
