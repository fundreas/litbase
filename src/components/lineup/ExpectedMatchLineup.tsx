import type { ReactNode } from 'react'

import { useExpectedLineups } from '@/api/hooks/useExpectedLineup'
import type { MatchTeam } from '@/api/models'
import { ExpectedBench } from '@/components/lineup/ExpectedBench'
import { ExpectedLineupNote } from '@/components/lineup/ExpectedLineupNote'
import {
  ExpectedLineupPitch,
  type ExpectedSide,
} from '@/components/lineup/ExpectedLineupPitch'
import { Pitch } from '@/components/squad/Pitch'
import {
  pitchGridClass,
  pitchSpanClass,
  ROW_ORDER,
  usePitchOrientation,
} from '@/components/squad/pitchMetrics'
import {
  FullscreenButton,
  FullscreenPane,
} from '@/components/ui/FullscreenPane'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { useHashModal } from '@/lib/useHashModal'

/**
 * **What the lineup tab shows while the clubs have not named their teams.**
 *
 * Kickbase publishes the real sheets about an hour before kick-off. Until then
 * this tab was a sentence on an empty pitch — true, and useless for the whole
 * of the week in which a Kickbase manager actually sets his lineup. The
 * pointcast run has an answer for exactly that window: an expected eleven per
 * club, rebuilt nightly, with the bench behind it and the substitution each
 * bench player is nearest to making. See
 * [`useExpectedLineup`](../../api/hooks/useExpectedLineup.ts).
 *
 * **It is drawn as a prediction, not as a team sheet.** The orange dashed note
 * sits above the grass rather than under it, the plates carry percentages
 * where the real pitch carries points, and every portrait wears the run's own
 * confidence in the corner. Nothing about this screen should be mistakable for
 * the sheet it stands in for — see
 * [`ExpectedLineupNote`](./ExpectedLineupNote.tsx).
 *
 * **One club is enough.** The run publishes per club, so a fixture can have a
 * prediction for one side and none for the other — a promoted club with too
 * little history, or a file that failed to build. A lone eleven is then drawn
 * on its own pitch rather than against an empty half, which would read as
 * eleven players against nobody.
 *
 * The corner opens the pitch [full screen](../ui/FullscreenPane.tsx), and on a
 * sideways phone the two benches come with it — the same arrangement the real
 * [match pitch](../matchday/MatchLineupTab.tsx) uses, for the same reason: it
 * is the one view with nothing underneath to scroll to.
 */
export function ExpectedMatchLineup({
  home,
  away,
  day,
  competitionId,
  leagueId,
  summary,
}: {
  home: MatchTeam
  away: MatchTeam
  /** The matchday, which with the club addresses the file. */
  day: number
  competitionId: string
  leagueId: string
  /** Drawn in the full-screen bar in place of the app's header. */
  summary?: ReactNode
}) {
  const fullscreen = useHashModal('fullscreen')
  const orientation = usePitchOrientation({ isFullscreen: fullscreen.isOpen })

  // Both clubs in one fan-out, so the pitch is drawn once both have answered
  // rather than flickering an eleven onto the grass against an empty half.
  const expected = useExpectedLineups(competitionId, [home.id, away.id], day)

  /* Home first, so the pitch's top half is the club the scoreline names
     first — the arrangement every other two-team pitch in the app uses. A
     club with no file is simply left out. */
  const sides: ExpectedSide[] = []
  const missing: MatchTeam[] = []
  for (const team of [home, away]) {
    const lineup = expected.byTeamId.get(team.id)
    if (lineup === undefined) {
      missing.push(team)
      continue
    }
    sides.push({
      lineup,
      name: team.name,
      symbol: team.symbol,
      image: team.image,
    })
  }

  if (sides.length === 0) {
    return <EmptyPitch isPending={expected.isPending} />
  }

  const pitch = (
    <ExpectedLineupPitch
      sides={sides}
      leagueId={leagueId}
      orientation={orientation}
      className={fullscreen.isOpen ? 'min-h-0 flex-1' : 'min-h-[34rem] flex-1'}
    >
      {/* Gone once full screen: there is nothing further to expand into, and
          the bar's ✗ is the way back. */}
      {!fullscreen.isOpen && (
        <FullscreenButton
          label="Voraussichtliche Aufstellung im Vollbild"
          onClick={() => {
            fullscreen.open()
          }}
        />
      )}
    </ExpectedLineupPitch>
  )

  const benches = sides.map((side) => (
    <ExpectedBench
      key={side.lineup.teamId}
      lineup={side.lineup}
      leagueId={leagueId}
      crest={side.image}
      teamName={side.name ?? side.symbol}
    />
  ))

  if (fullscreen.isOpen) {
    return (
      <FullscreenPane
        open
        onOpenChange={fullscreen.setOpen}
        title="Voraussichtliche Aufstellung im Vollbild"
        summary={summary}
        /* The note rides in the bar's banner slot, because full screen it is
           the only thing left saying this eleven is a guess — and that is
           precisely the screen on which it looks most like a fact. */
        banner={
          <ExpectedLineupNote
            lineups={sides.map((side) => side.lineup)}
            className="rounded-none border-x-0 border-t-0"
          />
        }
      >
        {orientation === 'landscape' ? (
          <div className="flex min-h-0 flex-1 items-stretch gap-2">
            {sides.map((side) => (
              <ExpectedBench
                key={`bench-${side.lineup.teamId}`}
                lineup={side.lineup}
                leagueId={leagueId}
                crest={side.image}
                teamName={side.name ?? side.symbol}
                className="w-36 shrink-0 lg:w-48"
                isBeside
              />
            ))}
            {/* The pitch's own `flex-1` grows it *down* the column, so it needs
                a column of its own inside this row. */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">{pitch}</div>
          </div>
        ) : (
          pitch
        )}
      </FullscreenPane>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Above the grass, not under it. A reader who scrolls no further has
          still been told what he is looking at. */}
      <ExpectedLineupNote lineups={sides.map((side) => side.lineup)} />

      {pitch}

      {/* One club predicted and the other not — a promoted side with too
          little history, or a file that failed to build. Said plainly, because
          a lone eleven on a pitch otherwise reads as a claim about the
          fixture. */}
      {missing.length === 1 && (
        <p className="px-0.5 text-xs text-muted">
          Für {missing[0]?.name ?? missing[0]?.symbol} liegt keine Prognose vor.
        </p>
      )}

      <div
        className={cn(
          'grid gap-2',
          benches.length > 1 ? 'grid-cols-2' : 'grid-cols-1',
        )}
      >
        {benches}
      </div>
    </div>
  )
}

/**
 * The pitch with nothing on it — **the state this component replaced**, kept
 * for the two cases that still reach it: the files are on their way, or there
 * are none.
 *
 * Still a pitch rather than an empty box, because the tab is a lineup and an
 * empty lineup is a pitch with nobody on it. The sentence is the one that has
 * always stood here, with the prediction named as the thing that is also
 * missing — otherwise a reader who saw a predicted eleven on the previous
 * match would read this one as "Kickbase is late" and keep refreshing.
 */
function EmptyPitch({ isPending }: { isPending: boolean }) {
  const orientation = usePitchOrientation()

  return (
    <Pitch orientation={orientation} className="min-h-[34rem] flex-1">
      <div
        className={cn(
          'grid min-h-0 min-w-0 flex-1 px-2 py-3',
          pitchGridClass(ROW_ORDER.length * 2, orientation),
        )}
      >
        <div
          className={cn(
            'flex flex-col items-center justify-center gap-2 px-6 text-center text-sm font-medium text-white/80',
            pitchSpanClass(ROW_ORDER.length * 2, orientation),
          )}
        >
          {isPending ? (
            <>
              <Spinner size={16} />
              <span>Prognose wird geladen …</span>
            </>
          ) : (
            <>
              <span>Die Aufstellungen sind noch nicht veröffentlicht.</span>
              <span className="text-xs font-normal text-white/60">
                Für dieses Spiel liegt auch keine Prognose vor.
              </span>
            </>
          )}
        </div>
      </div>
    </Pitch>
  )
}
