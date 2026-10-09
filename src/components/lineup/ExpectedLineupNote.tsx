import { Sparkles } from 'lucide-react'

import type { ExpectedLineup } from '@/api/models'
import { chance } from '@/components/lineup/expectedLineup'
import { cn } from '@/lib/cn'
import { relativeTime } from '@/lib/format'

/**
 * **"Nobody has named this eleven."**
 *
 * An eleven on a pitch is the most authoritative-looking object this app
 * draws, and the one under this strip is a guess — so the strip is not
 * decoration and not a footnote. It is orange and dashed, exactly as the
 * [expected-points chip](../squad/ExpectedPointsBadge.tsx) and its
 * [sheet](../squad/ExpectedPointsDialog.tsx) are drawn: in this app a dashed
 * orange edge means *predicted*, everywhere, and a reader who has met it once
 * on his own Kader needs no legend to read it here.
 *
 * What it carries is what qualifies the picture above it:
 *
 *  - the **formation** the run drew, and the club's usual one beside it when
 *    the two differ — a 3-5-2 under a club that has played 4-4-2 four times
 *    running is the single most useful warning on the screen;
 *  - the **confidence**, which is the mean `pStart` over the eleven: at 90 %
 *    the run is copying out a settled team, at 60 % it is picking between
 *    rotations;
 *  - **when it was written**, because the run is nightly and a Saturday
 *    morning injury is not in it.
 *
 * **Two clubs, and the first two go.** They are per club, the corners of the
 * pitch already carry each club's shape, and a note above a head-to-head pitch
 * quoting one club's numbers would be read as describing both. What is left is
 * what the two have in common: the matchday, and the run that wrote them.
 */
export function ExpectedLineupNote({
  lineups,
  /** Under a pitch that already names the fixture, that line is noise. */
  showFixture = false,
  className,
}: {
  /** One club's prediction, or both of a fixture. */
  lineups: ExpectedLineup[]
  showFixture?: boolean
  className?: string
}) {
  const only = lineups.length === 1 ? lineups[0] : undefined
  const first = lineups[0]
  if (first === undefined) return null

  const differs =
    only?.usualFormation !== undefined && only.usualFormation !== only.formation

  /* The oldest of the runs, when there are two: the note says how fresh the
     screen is, and a screen is only as fresh as its stalest half. In practice
     both come from the same nightly run and the two are identical. */
  const writtenAt = lineups
    .map((lineup) => lineup.generatedAt)
    .filter((at): at is string => at !== undefined)
    .sort()[0]

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-card border border-dashed border-warning/40 bg-warning/10 px-3 py-2',
        className,
      )}
    >
      <Sparkles
        size={14}
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-warning"
      />

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-ink">
          Voraussichtliche Aufstellung
          <span className="font-normal text-muted">
            {' '}
            · keine offizielle Aufstellung
          </span>
        </p>

        <p className="nums mt-0.5 text-[0.6875rem] text-muted">
          {only !== undefined && only.formation !== '' && (
            <>
              <span className="font-semibold text-ink">{only.formation}</span>
              {differs && (
                <span className="text-faint">
                  {' '}
                  (sonst {only.usualFormation})
                </span>
              )}
              {' · '}
            </>
          )}
          {only?.confidence !== undefined && (
            <>Sicherheit {chance(only.confidence)} · </>
          )}
          {first.matchday}. Spieltag
          {writtenAt !== undefined && (
            <> · berechnet {relativeTime(writtenAt)}</>
          )}
        </p>

        {showFixture && only?.opponentTeamName !== undefined && (
          <p className="mt-0.5 truncate text-[0.6875rem] text-faint">
            {only.isHome === undefined
              ? `gegen ${only.opponentTeamName}`
              : only.isHome
                ? `gegen ${only.opponentTeamName} (H)`
                : `bei ${only.opponentTeamName} (A)`}
          </p>
        )}
      </div>
    </div>
  )
}
