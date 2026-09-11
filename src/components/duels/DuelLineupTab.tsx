import { Link } from 'react-router'

import { breakdownFixtureFrom } from '@/api/hooks/usePlayerMatchEvents'
import {
  type DuelPlayer,
  type DuelRoster,
  type PositionKey,
} from '@/api/models'
import { BenchMark } from '@/components/player/BenchMark'
import { PlayerMatchEventsDialog } from '@/components/player/PlayerMatchEventsDialog'
import {
  RosterBand,
  RosterBenchRow,
  type RosterRing,
} from '@/components/roster/RosterPitch'
import { ProjectedPointsFigure } from '@/components/squad/ExpectedPointsBadge'
import { Pitch } from '@/components/squad/Pitch'
import {
  fitPitchMetrics,
  ROW_ORDER,
  ROW_ORDER_MIRRORED,
  usePitchBox,
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
import { useHashModal } from '@/lib/useHashModal'
import { useMemo, type ReactNode } from 'react'

/**
 * Which half of the pitch a player belongs to, and therefore how they are
 * drawn. The top side keeps the white ring the squad's own pitches use; the
 * bottom side takes the accent, so a glance at a portrait says whose it is
 * without reading anything.
 *
 * The cards themselves are the shared
 * [roster pieces](../roster/RosterPitch.tsx), which know only about a ring —
 * "top" and "bottom" are this page's idea, and only this page's.
 */
type Side = 'top' | 'bottom'

const RING: Record<Side, RosterRing> = { top: 'light', bottom: 'accent' }

/**
 * Both elevens on **one pitch, facing each other** — the first manager's
 * keeper at the top, the second's at the bottom, strikers either side of the
 * halfway line, exactly as the fixture would be drawn.
 *
 * This replaced two stacked lists of rows. The rows carried more per player (a
 * fixture, a status word, a position) and still lost the thing a duel is
 * actually about: the shape of two teams against each other, and where the
 * points are coming from. A pitch answers "who is carrying this" in one look,
 * and the [Rangliste](./DuelRankingTab.tsx) is one tap away for the detail.
 *
 * **Eight bands, not four.** The top half runs keeper → defence → midfield →
 * attack downwards ({@link ROW_ORDER_MIRRORED}) and the bottom half runs the
 * usual way up ({@link ROW_ORDER}), so the two attacks meet in the middle. The
 * card sizing has to be told there are eight of them, or every portrait is
 * budgeted twice the height it has.
 *
 * **Portraits carry a picture and a points figure, nothing else.** At 22
 * players on a phone a name under each is unreadable and a fixture badge is
 * noise; the points are the only number that changes and the only one worth
 * reading off a pitch.
 *
 * **And there is a way to make them bigger.** The corner opens the pitch
 * [full screen](../ui/FullscreenPane.tsx), which is the answer to the one
 * complaint 22 portraits on a phone will always have: the benches and the page
 * header step aside, the pitch measures the whole viewport, and the same
 * sizing search hands every card the extra room. The `summary` the page passes
 * becomes the bar at the top, so the two totals stay on screen — they are the
 * reason to be looking at all.
 */
export function DuelLineupTab({
  rosters,
  viewerId,
  summary,
  day,
  leagueId,
}: {
  rosters: [DuelRoster, DuelRoster]
  viewerId?: string
  /** Drawn in the full-screen bar in place of the app's header. */
  summary?: ReactNode
  /** The matchday, which with the player addresses his action breakdown. */
  day: number | undefined
  leagueId: string | undefined
}) {
  const [top, bottom] = rosters

  /**
   * **What each of these twenty-two is expected to score**, for the matches
   * that have not started — the reader's own guesses where he has entered any,
   * the [model's](../../api/hooks/usePointcast.ts) prediction everywhere else.
   *
   * The point of a duel before the weekend is *am I ahead on paper*, and until
   * now this page could only answer it after the fact. Both elevens read the
   * same figures, off one cached file: a prediction is a property of a player
   * and a matchday, not of whose team he happens to be in.
   */
  const expected = useExpectedPointsView(day)

  /*
   * **Where each eleven is heading**, not only where it stands: every real
   * score already in, plus an expected figure for every match still to come.
   * One per side, in the corner plate that names the manager — a duel read
   * before the weekend is two projections against each other, and the
   * scoreline above can only ever be two facts about the past.
   */
  const projected: [ProjectedPoints, ProjectedPoints] = [
    projectedPointsTotal(top.lineup, expected),
    projectedPointsTotal(bottom.lineup, expected),
  ]
  const { ref, box } = usePitchBox()
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
   * The tapped portrait, found back among the 22 on the pitch. The benches
   * carry no breakdown — they are rows of names — so a hash naming one of
   * those, or a player since substituted out of the payload, opens nothing.
   */
  const openPlayer = [...top.lineup, ...bottom.lineup].find(
    (player) => player.id === breakdown.id,
  )
  const openBreakdown = (player: DuelPlayer) => {
    breakdown.open(player.id)
  }

  /**
   * The busiest band across **both** halves — five defenders on either side
   * constrains the whole pitch, since every card is drawn at one size.
   */
  const metrics = useMemo(() => {
    const bandSizes = [
      ...ROW_ORDER_MIRRORED.map((position) => countAt(top.lineup, position)),
      ...ROW_ORDER.map((position) => countAt(bottom.lineup, position)),
    ]
    return fitPitchMetrics(box, Math.max(1, ...bandSizes), {
      rows: ROW_ORDER.length * 2,
      plate: 'points',
    })
  }, [box, top.lineup, bottom.lineup])

  /*
   * One pitch, drawn in whichever of the two places is showing — inline under
   * the page header, or alone on the screen. Deliberately **not** two copies:
   * a second one would measure a box nobody is looking at and size its cards
   * from it, and the whole point of the full-screen view is that the measuring
   * follows the space the pitch actually has.
   *
   * `min-h-[30rem]` is the floor that keeps eight bands legible on a phone
   * inline — below it the page scrolls instead of the cards shrinking further.
   * Full screen there is no page to scroll and nothing under the pitch to make
   * room for, so the floor comes off and the pitch takes the viewport exactly.
   */
  const pitch = (
    <Pitch
      className={fullscreen.isOpen ? 'min-h-0 flex-1' : 'min-h-[30rem] flex-1'}
    >
      {/* Name plates in the corners rather than a legend: the header pairs
          the managers left and right, the pitch stacks them top and bottom,
          and something has to bridge those two arrangements. */}
      <SideLabel
        roster={top}
        side="top"
        isViewer={top.manager.id === viewerId}
        leagueId={leagueId}
        day={day}
        projected={projected[0]}
      />

      {/* The one corner the two name plates leave free. Gone once the pitch is
          full screen: there is nothing further to expand into, and the bar's ✗
          is the way back. */}
      {!fullscreen.isOpen && (
        <FullscreenButton
          label="Aufstellung im Vollbild"
          onClick={() => {
            fullscreen.open()
          }}
        />
      )}

      <div ref={ref} className="grid min-h-0 flex-1 grid-rows-8 px-2 py-3">
        {ROW_ORDER_MIRRORED.map((position) => (
          <RosterBand
            key={`top-${position}`}
            players={top.lineup.filter((p) => p.position === position)}
            metrics={metrics}
            ring={RING.top}
            onOpen={openBreakdown}
            expected={expected}
          />
        ))}
        {ROW_ORDER.map((position) => (
          <RosterBand
            key={`bottom-${position}`}
            players={bottom.lineup.filter((p) => p.position === position)}
            metrics={metrics}
            ring={RING.bottom}
            onOpen={openBreakdown}
            expected={expected}
          />
        ))}
      </div>

      <SideLabel
        roster={bottom}
        side="bottom"
        isViewer={bottom.manager.id === viewerId}
        leagueId={leagueId}
        day={day}
        projected={projected[1]}
      />
    </Pitch>
  )

  /* Mounted in both layouts — a portrait is tappable full screen too, and the
     dialog sits above the pane at its own z-index. */
  const breakdownDialog = (
    <>
      {/* The breakdown for whichever portrait was tapped. Its header links to
          the **player**, not the match: a duel is read to find out whose
          players are carrying it, so the next question is about the man rather
          than the fixture — the opposite of the squad's live view, where you
          already know the men and want the match. */}
      {openPlayer?.fixture !== undefined && day !== undefined && (
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
      )}
    </>
  )

  if (fullscreen.isOpen) {
    /* The benches stay behind. They are rows of names, which is what the page
       underneath is for; this screen exists to make the *grass* bigger, and
       eight bands plus two columns would put us back where we started. */
    return (
      <FullscreenPane
        open
        onOpenChange={fullscreen.setOpen}
        title="Aufstellung im Vollbild"
        summary={summary}
      >
        {pitch}
        {breakdownDialog}
      </FullscreenPane>
    )
  }

  return (
    /* `min-h-0 flex-1` so the pitch can claim whatever height the page has
       left after the benches, rather than sitting at its floor on a desktop. */
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {pitch}

      {/* Two columns, laid out the way the header is: manager one on the
          left, manager two on the right. The pitch has to stack them top and
          bottom to make them face each other, so the benches keep the
          left/right arrangement the scoreline established and the corner
          labels bridge the two. */}
      <div className="grid grid-cols-2 gap-2">
        <BenchColumn roster={top} side="top" expected={expected} />
        <BenchColumn roster={bottom} side="bottom" expected={expected} />
      </div>

      {breakdownDialog}
    </div>
  )
}

function countAt(lineup: DuelPlayer[], position: PositionKey): number {
  return lineup.filter((player) => player.position === position).length
}

/**
 * Whose half this is, in the corner of the pitch — **and the way to them.**
 *
 * Absolutely positioned so it costs the bands no height: the pitch is the
 * scarcest space on the page and eight bands are already tight.
 *
 * A plate is small for a tap target, and it is the only thing on this pitch
 * naming a manager — the portraits are the players' and belong to the
 * breakdown. So it links to [their page](../../pages/ManagerDetailPage.tsx),
 * with the matchday riding along, which is where the same eleven is drawn at
 * twice the size with a bench you can read.
 */
function SideLabel({
  roster,
  side,
  isViewer,
  leagueId,
  day,
  projected,
}: {
  roster: DuelRoster
  side: Side
  isViewer: boolean
  leagueId: string | undefined
  day: number | undefined
  /** Where this eleven is heading, when any of it is still ahead. */
  projected: ProjectedPoints
}) {
  const body = (
    <>
      <Avatar src={roster.manager.image} name={roster.manager.name} size={16} />
      <span className="max-w-28 truncate text-[0.625rem] font-semibold text-white">
        {roster.manager.name}
        {isViewer && <span className="ml-1 text-accent">du</span>}
      </span>
      {/* The name gives up width for it — `max-w-28` truncates, and a
          four-digit projection is worth more on this pitch than the last four
          letters of a manager's name. Gone once every match is settled: the
          scoreline in the header is then the whole story. */}
      {isProjection(projected) && (
        <ProjectedPointsFigure
          projected={projected}
          iconSize={8}
          className="text-[0.625rem]"
        />
      )}
    </>
  )

  const className = cn(
    'absolute z-10 flex items-center gap-1.5 rounded-full bg-black/45 px-1.5 py-0.5 backdrop-blur-sm',
    side === 'top' ? 'top-1 left-1' : 'bottom-1 left-1',
  )

  if (leagueId === undefined) {
    return <span className={className}>{body}</span>
  }

  return (
    <Link
      to={`/leagues/${leagueId}/managers/${roster.manager.id}?day=${String(day ?? '')}`}
      title={`${roster.manager.name} ansehen`}
      className={cn(className, 'transition-colors hover:bg-black/65')}
    >
      {body}
    </Link>
  )
}

/**
 * One manager's unfielded players, as a **column** beside the other's.
 *
 * They scored what they scored and it did not count — which is exactly why
 * they are shown: a bench outscoring the eleven is the most interesting thing
 * a duel can tell you, and the [Rangliste](./DuelRankingTab.tsx) ranks the two
 * together.
 *
 * Stacked rather than a sideways-scrolling strip, because two benches side by
 * side are meant to be *compared*: rows at matching heights read against each
 * other, and nothing is hidden off the edge waiting to be swiped into view.
 * A name fits in a row where it would not fit under a portrait, so unlike the
 * pitch these carry one.
 *
 * Dimmed as a set rather than tagged one by one — the heading says what they
 * are, and repeating "Bank" down every row is noise.
 */
function BenchColumn({
  roster,
  side,
  expected,
}: {
  roster: DuelRoster
  side: Side
  /** This matchday's expected points, for the matches still to come. */
  expected: ExpectedPointsView
}) {
  return (
    <section className="flex min-w-0 flex-col gap-1.5">
      {/* The armchair is what says "bench" here — the column is otherwise just
          a manager's name over some players, and the word would eat width a
          truncated name needs. */}
      <h3 className="flex min-w-0 items-center gap-1.5 px-0.5 text-[0.625rem] font-semibold tracking-wider text-faint uppercase">
        <Avatar
          src={roster.manager.image}
          name={roster.manager.name}
          size={14}
        />
        <span className="truncate">{roster.manager.name}</span>
        <BenchMark size={12} />
      </h3>

      {roster.bench.length === 0 ? (
        <p className="rounded-card border border-line bg-surface px-2 py-3 text-center text-[0.6875rem] text-muted">
          Alle Spieler aufgestellt
        </p>
      ) : (
        /* Dimmed as a set, on the list rather than per row: the heading says
           what these are. The rows are the shared
           [bench row](../roster/RosterPitch.tsx), and inert here — a tap on
           this page belongs to the pitch. */
        <ul className="flex flex-col gap-1 opacity-75">
          {roster.bench.map((player) => (
            <RosterBenchRow
              key={player.id}
              player={player}
              ring={RING[side]}
              expected={expected}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
