import type { ExpectedLineup } from '@/api/models'
import { ExpectedBench } from '@/components/lineup/ExpectedBench'
import { ExpectedLineupNote } from '@/components/lineup/ExpectedLineupNote'
import { ExpectedLineupPitch } from '@/components/lineup/ExpectedLineupPitch'
import { cn } from '@/lib/cn'

/**
 * **One club's predicted eleven, bench and substitutions**, as a column.
 *
 * The single-club reading of
 * [`ExpectedLineupPitch`](./ExpectedLineupPitch.tsx): the note that says this
 * is a guess, the eleven on the grass, and under it the bench as the swaps it
 * would produce.
 *
 * Drawn **portrait whatever the screen**, unlike the pitches that own their
 * page. This one lives in a column beside something else — Ligainsider's
 * poster, in the [club page's dialog](../player/LineupPosterDialog.tsx) — and
 * a column is tall and narrow no matter how wide the window is. Turning the
 * pitch on its side there would cut four columns out of a pane half a screen
 * wide and stack five defenders down each of them.
 */
export function ExpectedTeamLineup({
  lineup,
  leagueId,
  teamName,
  crest,
  className,
}: {
  lineup: ExpectedLineup
  leagueId: string
  /** The club, for the pitch's corner plate. */
  teamName?: string
  crest?: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <ExpectedLineupNote lineups={[lineup]} showFixture />

      <ExpectedLineupPitch
        sides={[
          {
            lineup,
            name: teamName,
            symbol: teamName,
            image: crest,
          },
        ]}
        leagueId={leagueId}
        orientation="portrait"
        /* Taller than the pitch's own floor: this one sits in a scrolling
           column rather than claiming a page's leftover height, so nothing
           else would ever grow it. */
        className="min-h-[26rem] shrink-0"
      />

      <ExpectedBench lineup={lineup} leagueId={leagueId} />
    </div>
  )
}
