import { useMemo } from 'react'

import { breakdownFixtureFrom } from '@/api/hooks/usePlayerMatchEvents'
import type { DuelPlayer, DuelRoster, PositionKey } from '@/api/models'
import { BenchMark } from '@/components/player/BenchMark'
import { PlayerMatchEventsDialog } from '@/components/player/PlayerMatchEventsDialog'
import { RosterBand, RosterBenchRow } from '@/components/roster/RosterPitch'
import { ProjectedPointsFigure } from '@/components/squad/ExpectedPointsBadge'
import { Pitch } from '@/components/squad/Pitch'
import {
  fitPitchMetrics,
  pitchGridClass,
  ROW_ORDER,
  usePitchBox,
  usePitchOrientation,
} from '@/components/squad/pitchMetrics'
import { useExpectedPointsView } from '@/components/squad/useExpectedPointsView'
import { Avatar } from '@/components/ui/Avatar'
import {
  FullscreenButton,
  FullscreenPane,
} from '@/components/ui/FullscreenPane'
import { cn } from '@/lib/cn'
import {
  isProjection,
  projectedPointsTotal,
  type ExpectedPointsView,
  type ProjectedPoints,
} from '@/lib/expectedPoints'
import { points } from '@/lib/format'
import { useHashModal } from '@/lib/useHashModal'

/**
 * **One manager's eleven for one matchday**, on a pitch, with the rest of the
 * squad under it.
 *
 * The reason the [manager page](../../pages/ManagerDetailPage.tsx) exists: a
 * name in a table answers nothing, and *what has this manager got on the pitch*
 * is what a reader wants from it. Until now the only way to see somebody else's
 * eleven was to be drawn against them, and only for the matchday you were drawn
 * on — the [duel page](../duels/DuelLineupTab.tsx) with its two half-pitches.
 *
 * **The same cards as the duel's**, from the shared
 * [roster pieces](../roster/RosterPitch.tsx): a portrait, one points figure, a
 * team-sheet corner while the sheet is news, and a tap that opens the
 * [breakdown](../player/PlayerMatchEventsDialog.tsx) behind the number. What
 * differs is the arrangement — four bands and a full-width bench, where a duel
 * has eight bands and two columns — so the cards are bigger here and the bench
 * rows are controls rather than a list to read against another one.
 *
 * **The corner plate is the matchday total, not a name.** The header above
 * already says whose page this is; what the pitch cannot otherwise say is what
 * these eleven are worth on the day, and how much of it is still to come.
 */
export function ManagerLineupTab({
  roster,
  day,
  leagueId,
  isPointsPending,
}: {
  roster: DuelRoster
  /** The matchday, which with a player addresses his action breakdown. */
  day: number | undefined
  leagueId: string | undefined
  /** True while the per-player figures are still arriving. */
  isPointsPending: boolean
}) {
  const { ref, box } = usePitchBox()
  /** Portrait on a phone, on its side from `lg` up — the pitch is one picture
      either way, and a wide screen has the width for the long side. */
  const orientation = usePitchOrientation()

  /**
   * **What each of these players is expected to score**, for the matches of
   * this matchday that have not started — the reader's own guesses where he
   * has entered any, the [model's](../../api/hooks/usePointcast.ts) prediction
   * everywhere else.
   *
   * Filed under the matchday this tab is showing, so a past matchday resolves
   * to nothing at all and the pitch reads exactly as it always did: the
   * predictions exist for the coming matchday only, and a settled match has
   * real points to show instead.
   */
  const expected = useExpectedPointsView(day)

  /**
   * **What this eleven is on course to finish the matchday on** — every real
   * score it already has, plus an expected figure for every match still to
   * come.
   *
   * The plate's other number is Kickbase's own total, which is a fact about
   * the past and says nothing about the four matches still to kick off. That
   * gap is the whole reason to look at somebody else's eleven on a Friday, and
   * until now the page could only be read after the fact.
   */
  const projected = projectedPointsTotal(roster.lineup, expected)

  /**
   * Both of this tab's modals live in the URL — `#fullscreen`, and
   * `#player:<id>` for a portrait's breakdown, stacking as
   * `#fullscreen/player:4711` when the sheet is opened from the big pitch. So
   * the back gesture peels them off one at a time in the order they went on,
   * and a refresh lands back on the pitch, full screen and all. See
   * [`useHashModal`](../../lib/useHashModal.ts).
   */
  const fullscreen = useHashModal('fullscreen')
  const breakdown = useHashModal('player')

  /*
   * The tapped player, found back among the squad. Both the pitch and the bench
   * open one here — unlike the duel, where the benches are inert — so a hash
   * naming a benched player resolves too.
   */
  const openPlayer = [...roster.lineup, ...roster.bench].find(
    (player) => player.id === breakdown.id,
  )
  const openBreakdown = (player: DuelPlayer) => {
    breakdown.open(player.id)
  }

  /** The busiest band constrains every card, since all are drawn at one size. */
  const metrics = useMemo(() => {
    const bandSizes = ROW_ORDER.map((position) =>
      countAt(roster.lineup, position),
    )
    return fitPitchMetrics(box, Math.max(1, ...bandSizes), {
      rows: ROW_ORDER.length,
      plate: 'points',
      orientation,
    })
  }, [box, roster.lineup, orientation])

  /*
   * A player the pitch cannot place: no current squad knows his position and
   * his own detail has not answered yet, which in practice means somebody
   * transferred away since the matchday. Counted rather than dropped in
   * silence — see [`DuelPlayer.position`](../../api/models.ts).
   */
  const unplaced = roster.lineup.filter(
    (player) => player.position === undefined,
  ).length

  /*
   * One pitch, drawn in whichever of the two places is showing — inline under
   * the header, or alone on the screen. Deliberately **not** two copies: a
   * second one would measure a box nobody is looking at and size its cards from
   * it, and the whole point of the full-screen view is that the measuring
   * follows the space the pitch actually has.
   */
  const pitch = (
    <Pitch
      orientation={orientation}
      className={fullscreen.isOpen ? 'min-h-0 flex-1' : 'min-h-[22rem] flex-1'}
    >
      <TotalPlate
        roster={roster}
        projected={projected}
        isPointsPending={isPointsPending}
      />

      {/* The corner the plate leaves free. Gone once the pitch is full screen:
          there is nothing further to expand into, and the bar's ✗ is the way
          back. */}
      {!fullscreen.isOpen && (
        <FullscreenButton
          label="Aufstellung im Vollbild"
          onClick={() => {
            fullscreen.open()
          }}
        />
      )}

      <div
        ref={ref}
        className={cn(
          'grid min-h-0 min-w-0 flex-1 px-2 py-3',
          pitchGridClass(ROW_ORDER.length, orientation),
        )}
      >
        {ROW_ORDER.map((position) => (
          <RosterBand
            key={position}
            players={roster.lineup.filter(
              (player) => player.position === position,
            )}
            metrics={metrics}
            ring="light"
            onOpen={openBreakdown}
            expected={expected}
            orientation={orientation}
          />
        ))}
      </div>
    </Pitch>
  )

  /* Mounted in both layouts — a portrait is tappable full screen too, and the
     dialog sits above the pane at its own z-index. */
  const breakdownDialog =
    openPlayer?.fixture !== undefined && day !== undefined ? (
      <PlayerMatchEventsDialog
        key={openPlayer.id}
        fixture={breakdownFixtureFrom(
          openPlayer.fixture,
          day,
          openPlayer.points,
          { match: openPlayer.live, teamId: openPlayer.teamId },
        )}
        playerId={openPlayer.id}
        playerName={openPlayer.name}
        leagueId={leagueId}
        to={
          leagueId === undefined
            ? undefined
            : `/leagues/${leagueId}/players/${openPlayer.id}`
        }
        onClose={breakdown.close}
      />
    ) : null

  if (fullscreen.isOpen) {
    /* The bench stays behind. It is rows of names, which is what the page
       underneath is for; this screen exists to make the *grass* bigger. */
    return (
      <FullscreenPane
        open
        onOpenChange={fullscreen.setOpen}
        title="Aufstellung im Vollbild"
        summary={<FullscreenSummary roster={roster} projected={projected} />}
      >
        {pitch}
        {breakdownDialog}
      </FullscreenPane>
    )
  }

  return (
    /* `min-h-0 flex-1` so the pitch can claim whatever height the page has left
       after the bench, rather than sitting at its floor on a desktop. */
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {pitch}

      {unplaced > 0 && (
        <p className="nums px-0.5 text-[0.6875rem] text-faint">
          {unplaced === 1
            ? 'Ein aufgestellter Spieler ist keiner Position zuzuordnen und fehlt auf dem Feld.'
            : `${points(unplaced)} aufgestellte Spieler sind keiner Position zuzuordnen und fehlen auf dem Feld.`}
        </p>
      )}

      <Bench
        players={roster.bench}
        onOpen={openBreakdown}
        expected={expected}
      />

      {breakdownDialog}
    </div>
  )
}

function countAt(lineup: DuelPlayer[], position: PositionKey): number {
  return lineup.filter((player) => player.position === position).length
}

/**
 * The matchday total, in the corner of the pitch.
 *
 * Absolutely positioned so it costs the bands no height, exactly as the duel's
 * name plates are. The figure is Kickbase's own for the matchday rather than the
 * sum of the portraits below it: the portraits may still be loading, and the
 * standings are the authority either way.
 *
 * `n laufend · n offen` is the line a live matchday is actually read for —
 * forty points behind with four matches to play is winning — so it sits under
 * the number it qualifies.
 */
function TotalPlate({
  roster,
  projected,
  isPointsPending,
}: {
  roster: DuelRoster
  projected: ProjectedPoints
  isPointsPending: boolean
}) {
  const pending = roster.activeMatches + roster.openMatches

  return (
    <span className="absolute top-1 left-1 z-10 flex flex-col rounded-lg bg-black/45 px-2 py-1 backdrop-blur-sm">
      <span
        className={cn(
          'nums text-base leading-none font-bold text-white',
          isPointsPending && 'opacity-70',
        )}
      >
        {points(roster.totalPoints)}
        <span className="ml-1 text-[0.625rem] font-medium text-white/70">
          Pkt
        </span>
      </span>
      {/* Under the scored total, not beside it: the two are the same eleven
          measured at two different times, and reading down from *what it has*
          to *where it is going* is the order the question comes in. Absent
          once every match is settled, where a projection would be the scored
          total again in a different colour. */}
      {isProjection(projected) && (
        <ProjectedPointsFigure
          projected={projected}
          className="mt-0.5 text-[0.6875rem] leading-none"
        />
      )}

      {pending > 0 && (
        <span className="nums mt-0.5 text-[0.625rem] text-white/70">
          {roster.activeMatches} laufend · {roster.openMatches} offen
        </span>
      )}
    </span>
  )
}

/**
 * The manager and their total, for the bar of the
 * [full-screen pitch](../ui/FullscreenPane.tsx).
 *
 * The page's header does not fit there and should not: full screen, the whole
 * screen is the pitch, and the bar has one row to say whose eleven this is and
 * what it has scored — the two things the header is read for.
 */
function FullscreenSummary({
  roster,
  projected,
}: {
  roster: DuelRoster
  projected: ProjectedPoints
}) {
  return (
    <div className="flex items-center gap-2">
      <Avatar src={roster.manager.image} name={roster.manager.name} size={26} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.6875rem] text-muted">
          {roster.manager.name}
        </p>
        <p className="nums flex items-center gap-2 truncate text-sm leading-tight font-bold text-ink">
          <span>{points(roster.totalPoints)} Pkt</span>
          {/* Beside it here rather than under it: the bar has one row, and
              the pitch behind it is the whole point of the view. */}
          {isProjection(projected) && (
            <ProjectedPointsFigure projected={projected} iconSize={11} />
          )}
        </p>
      </div>
    </div>
  )
}

/**
 * Everyone who was not fielded, as a two-column grid of rows.
 *
 * They scored what they scored and it did not count — which is exactly why they
 * are here: a bench outscoring the eleven is the most interesting thing a
 * matchday can tell you about a manager's week.
 *
 * Two columns rather than the duel's one, because there is only one bench to
 * show and a phone's width fits two of these rows comfortably; a single column
 * of four names would leave half the screen empty. The rows **open the same
 * breakdown the pitch does** — a benched player's points are exactly as
 * unexplained as a fielded one's.
 */
function Bench({
  players,
  onOpen,
  expected,
}: {
  players: DuelPlayer[]
  onOpen: (player: DuelPlayer) => void
  /** This matchday's expected points, for the matches still to come. */
  expected: ExpectedPointsView
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="flex items-center gap-1.5 px-0.5 text-[0.625rem] font-semibold tracking-wider text-faint uppercase">
        <BenchMark size={12} />
        <span>Bank</span>
        {players.length > 0 && (
          <span className="nums text-faint">{players.length}</span>
        )}
      </h3>

      {players.length === 0 ? (
        <p className="rounded-card border border-line bg-surface px-2 py-3 text-center text-[0.6875rem] text-muted">
          Alle Spieler aufgestellt
        </p>
      ) : (
        /* Dimmed as a set rather than tagged one by one — the heading says what
           these are, and repeating "Bank" down every row is noise. */
        <ul className="grid grid-cols-2 gap-1 opacity-80 sm:grid-cols-3">
          {players.map((player) => (
            <RosterBenchRow
              key={player.id}
              player={player}
              ring="light"
              onOpen={onOpen}
              expected={expected}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
