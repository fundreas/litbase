import { ListOrdered, SquareSplitVertical } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import {
  POSITION_LABEL,
  type FixtureState,
  type MatchLineup,
  type MatchPlayer,
  type MatchTeam,
} from '@/api/models'
import { matchPlayerFigure } from '@/components/matchday/matchPlayerFigure'
import { OwnerBadge } from '@/components/matchday/OwnerBadge'
import { teamPoints } from '@/components/matchday/teamPoints'
import { ClubWatermark } from '@/components/player/ClubWatermark'
import { MatchEventBadge } from '@/components/player/MatchEventBadge'
import {
  figureDescription,
  figureLabel,
  isScore,
} from '@/components/player/playerFigure'
import { MatchRoleMark } from '@/components/player/statGlyphs'
import {
  ExpectedPointsBadge,
  ProjectedPointsFigure,
} from '@/components/squad/ExpectedPointsBadge'
import { projectedDescription } from '@/components/squad/expectedPointsLabels'
import { useExpectedPointsView } from '@/components/squad/useExpectedPointsView'
import { Avatar } from '@/components/ui/Avatar'
import { PairToggle } from '@/components/ui/PairToggle'
import { EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import {
  isProjection,
  projectedPointsTotal,
  type ExpectedPointsView,
} from '@/lib/expectedPoints'
import { points } from '@/lib/format'
import { readString, writeString } from '@/lib/storage'

/** One ranked row: a player, whose club he is, and who had him. */
interface RankedPlayer {
  player: MatchPlayer
  team: MatchTeam
}

/** One list across both clubs, or one list per club. */
type RankingView = 'combined' | 'perTeam'

/**
 * **Every player in the match, best first** — benches included, in either of
 * two readings.
 *
 * The counterpart of the [duel's ranking](../duels/DuelRankingTab.tsx), and it
 * exists for the same reason: the pitch answers "how are the two teams set up",
 * a ranked list answers "who actually scored the points", and those are
 * different questions.
 *
 * **Two readings, one toggle.** *Gemeinsam* interleaves the clubs, which is the
 * default and the more interesting of the two — a list where one side occupies
 * the top six says something no pair of separate lists can. *Nach Verein*
 * splits it, home above away, each numbered from 1: that is the reading for
 * "who was this club's best today", a question the combined list buries when
 * the other side has run away with the match. The control is the app's
 * [`PairToggle`](../ui/PairToggle.tsx), the same one the squad uses for
 * list/grid, and the choice is remembered.
 *
 * Each row carries the **owning manager** next to the score. On the pitch that
 * badge is the whole reason the screen exists; here it is what distinguishes
 * otherwise identical rows, which is exactly how the duel list uses it.
 *
 * **Substitutes are in the list.** They scored what they scored, and one who
 * came on and outscored a starter is the most interesting thing the view can
 * show. Their rows carry the same arrows the bench columns do — and *only* the
 * arrows: an `S11` chip in a single match's list marks the replaced players and
 * nobody else, which is worse than marking nothing.
 *
 * A player with no points sorts **last** rather than as zero — not knowing is
 * not the same as nothing, the rule [`byMatchdayPoints`](../../api/models.ts)
 * holds for the duel list and this repeats for its own model.
 *
 * ## Before kick-off it ranks the predictions instead
 *
 * Between the team sheets being published and the first whistle — the hour
 * this tab is most worth opening, because the lineup is still yours to
 * change — every figure in the match is unknown, so the list was twenty-two
 * dashes in alphabetical order. A ranking ordered by surname is not a ranking.
 *
 * So for exactly that window the rows carry
 * [expected points](../squad/ExpectedPointsBadge.tsx) and are **ranked by
 * them**: the reader's own guess where he made one, the
 * [pointcast](../../api/hooks/usePointcast.ts) prediction everywhere else.
 * That precedence is not this list's to invent — it is
 * [`expectedPointsView`](../../lib/expectedPoints.ts), the one the Kader, the
 * market and both duel views already read, so a player a reader has overruled
 * is overruled here too.
 *
 * **Only while `state` is `upcoming`.** The moment a match is running its
 * figures are facts, and a list that mixed one club's real scores with the
 * other's predictions would rank them against each other as if they were the
 * same kind of number. The chips disappear at kick-off, which is also when the
 * first real figure arrives to take their place.
 */
export function MatchRankingTab({
  home,
  away,
  leagueId,
  day,
  state,
}: {
  home: MatchLineup
  away: MatchLineup
  leagueId: string
  /** The matchday, for the predictions and the reader's own guesses. */
  day: number
  /** From the fixture, not from the match payload — see the page. */
  state: FixtureState
}) {
  const [view, setView] = useRankingView()
  // Hooked unconditionally and *used* only before kick-off: the file is one
  // cached request shared with every other screen on this matchday, so asking
  // for it during a live match costs nothing and keeps the hook order honest.
  const expectedPoints = useExpectedPointsView(day)
  const expected = state === 'upcoming' ? expectedPoints : undefined
  const combined = rankMatchPlayers(expected, home, away)

  if (combined.length === 0) {
    return (
      <EmptyState
        title="Keine Aufstellungen"
        description="Kickbase hat für dieses Spiel noch keine Kader veröffentlicht."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <PairToggle
        value={view}
        onChange={setView}
        options={VIEW_OPTIONS}
        className="-mt-1"
      />

      {view === 'combined' ? (
        <RankedList rows={combined} leagueId={leagueId} expected={expected} />
      ) : (
        /* Home above away, the order the header's scoreline establishes and
           the one the pitch stacks them in. */
        <div className="flex flex-col gap-4">
          <TeamRanking lineup={home} leagueId={leagueId} expected={expected} />
          <TeamRanking lineup={away} leagueId={leagueId} expected={expected} />
        </div>
      )}
    </div>
  )
}

/** The two readings, and the glyph each is drawn as. */
const VIEW_OPTIONS = [
  { value: 'combined', icon: ListOrdered, label: 'Gemeinsame Rangliste' },
  {
    value: 'perTeam',
    icon: SquareSplitVertical,
    label: 'Nach Verein getrennt',
  },
] as const satisfies readonly [
  { value: RankingView; icon: typeof ListOrdered; label: string },
  { value: RankingView; icon: typeof ListOrdered; label: string },
]

const VIEW_STORAGE_KEY = 'litbase.matchRanking.view'

/**
 * Combined or per club, remembered across matches.
 *
 * A preference, not a place: it is stored the way the
 * [squad's list/grid](../squad/PlayerListTab.tsx) is — through the app's safe
 * `localStorage` wrapper, and **not** in the URL, so a shared link to a match
 * opens in the reader's own reading rather than the sender's.
 */
function useRankingView(): [RankingView, (view: RankingView) => void] {
  const [view, setViewState] = useState<RankingView>(
    () => (readString(VIEW_STORAGE_KEY) as RankingView | null) ?? 'combined',
  )

  const setView = (next: RankingView) => {
    setViewState(next)
    writeString(VIEW_STORAGE_KEY, next)
  }

  return [view, setView]
}

/**
 * One club's players, ranked among themselves, under a crest — and **what the
 * club scored altogether**.
 *
 * The numbering **restarts at 1**, which is the whole point of the split: in
 * this reading the question is "who was this club's best", and a player carrying
 * `14` because thirteen opponents outscored him answers a different one.
 *
 * The total closes the same question at the club level: split into two lists,
 * the two columns of figures no longer add up to anything the eye can compare,
 * so the comparison is drawn. It is the same
 * [`teamPoints`](./teamPoints.ts) the pitch's corner labels use — including
 * substitutes, `–` until the first figure lands — so a reader flicking between
 * the two tabs meets one number, not two that disagree.
 *
 * **Before kick-off it is a projection instead**, the sum of the same figures
 * the rows beneath it now carry — see {@link MatchRankingTab}. It is drawn as
 * [`ProjectedPointsFigure`](../squad/ExpectedPointsBadge.tsx): the target
 * glyph and the feature's two colours, which is what keeps it from being read
 * as a club that has already scored 1.240. The pitch's corner label still says
 * `–` in that window and the two do not contradict each other — one is "no
 * points yet", the other "expected to bring", and only the second is a claim
 * this tab is in a position to make, because only this tab is ranking by it.
 */
function TeamRanking({
  lineup,
  leagueId,
  expected,
}: {
  lineup: MatchLineup
  leagueId: string
  /** Set only before kick-off — see {@link MatchRankingTab}. */
  expected?: ExpectedPointsView
}) {
  const rows = rankMatchPlayers(expected, lineup)
  const total = teamPoints(lineup)
  const name = lineup.team.name ?? lineup.team.symbol
  /* Substitutes included, exactly as the real total includes them: a bench
     player's prediction is already weighted by how likely he is to play, so
     the sum is the club's expected yield rather than eighteen starters. */
  const projected =
    expected === undefined
      ? undefined
      : projectedPointsTotal(
          rows.map((row) => row.player),
          expected,
        )
  const showProjected = projected !== undefined && isProjection(projected)
  const totalLabel = showProjected
    ? `${name} — ${projectedDescription(projected)}`
    : total === undefined
      ? `${name}: noch keine Punkte`
      : `${name}: ${points(total)} Punkte in diesem Spiel`

  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="flex min-w-0 items-center gap-2 px-0.5" title={totalLabel}>
        <Avatar
          src={lineup.team.image}
          name={lineup.team.symbol}
          size={18}
          square
          className="shrink-0 bg-transparent"
        />
        <span className="truncate text-xs font-semibold tracking-wide text-muted uppercase">
          {name}
        </span>
        {showProjected ? (
          <ProjectedPointsFigure
            projected={projected}
            iconSize={11}
            className="ml-auto text-sm"
          />
        ) : (
          <>
            <span
              aria-hidden="true"
              className={cn(
                'nums ml-auto shrink-0 text-sm font-bold',
                total === undefined ? 'text-faint' : 'text-ink',
              )}
            >
              {points(total)}
            </span>
            <span className="sr-only">{totalLabel}</span>
          </>
        )}
      </h3>

      {rows.length === 0 ? (
        <p className="rounded-card border border-line bg-surface px-3 py-3 text-center text-xs text-muted">
          Keine Aufstellung veröffentlicht
        </p>
      ) : (
        <RankedList rows={rows} leagueId={leagueId} expected={expected} />
      )}
    </section>
  )
}

/** The card the two readings share: numbered rows, best first. */
function RankedList({
  rows,
  leagueId,
  expected,
}: {
  rows: RankedPlayer[]
  leagueId: string
  /** Set only before kick-off — see {@link MatchRankingTab}. */
  expected?: ExpectedPointsView
}) {
  return (
    <ol className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      {rows.map(({ player, team }, index) => (
        /* `min-h-14` is a **floor**, not a height: the second line carries
           whatever the match gave the player — a substitution arrow, a goal,
           a card, or nothing at all — so an intrinsic row would be a
           different height every third listing and the portraits beside them
           would step up and down the list. */
        <li key={player.id} className="flex min-h-14 items-stretch">
          {/* The rank is a **rail**, the flush left-hand column the
              [player ranking](../ranking/PlayerRankingTab.tsx) draws it in —
              which is the whole reason the portrait beside it can butt
              against an edge instead of ending on a cut. */}
          <span className="nums flex w-7 shrink-0 items-center justify-center self-stretch border-r border-line bg-surface-2/40 text-xs font-semibold text-faint">
            {index + 1}
          </span>
          <Link
            to={`/leagues/${leagueId}/players/${player.id}`}
            /* The club in words, for the reader the crest behind the row does
               not reach: the row no longer spells it out, and a badge is not
               a name to somebody who does not know the badge. */
            title={`${player.name} · ${team.name ?? team.symbol}`}
            className="flex min-w-0 flex-1 items-stretch transition-colors hover:bg-surface-2/60"
          >
            <PlayerRow player={player} team={team} expected={expected} />
          </Link>
        </li>
      ))}
    </ol>
  )
}

/**
 * Players in one list, best first — **one lineup or both**, which is the whole
 * difference between the two readings.
 *
 * What "best" means is whatever figure the row is showing: the points, or
 * before kick-off the expected points — so the order and the column always
 * agree, and a reader never meets a list sorted by a number he cannot see.
 * The two never mix, because `expected` is only handed in while the match is
 * `upcoming` and nobody has scored anything then.
 *
 * Not memoised: the lineups behind it are rebuilt every render by
 * [`useMatchLineup`](../../api/hooks/useMatchLineup.ts) as points arrive, so a
 * memo keyed on them would never hit — the same reasoning the duel rosters
 * carry.
 */
function rankMatchPlayers(
  expected: ExpectedPointsView | undefined,
  ...lineups: MatchLineup[]
): RankedPlayer[] {
  const rows: RankedPlayer[] = []

  for (const lineup of lineups) {
    for (const player of [...lineup.starters, ...lineup.substitutes]) {
      rows.push({ player, team: lineup.team })
    }
  }

  const figure = ({ player }: RankedPlayer): number | undefined =>
    player.points ?? expected?.entry(player.id)?.value

  return rows.sort((a, b) => {
    const left = figure(a)
    const right = figure(b)
    // Unknown sorts last, and two unknowns fall back to the name so the order
    // stays stable while points land one request at a time — and so the
    // players the model has nothing for sit together at the foot of the list
    // rather than being scattered through it as zeroes.
    if (left === undefined && right === undefined) {
      return a.player.name.localeCompare(b.player.name)
    }
    if (left === undefined) return 1
    if (right === undefined) return -1
    return right - left || a.player.name.localeCompare(b.player.name)
  })
}

/**
 * One row: portrait, name over what he did, then the owner and the score — on
 * **his club's crest**.
 *
 * **The portrait is the app's flush one**, the figure the
 * [market](../market/MarketRow.tsx), the [Kader](../squad/PlayerListTab.tsx)
 * and the [player ranking](../ranking/PlayerRankingTab.tsx) all draw: square
 * and full-bleed against the rank rail, a wash under it because the Kickbase
 * cutouts are transparent PNGs, and the inner edge masked so it dissolves into
 * the row rather than ending on a line. It replaces a 34px circle with air
 * around it. The sources are 1100×800 landscape and this box cover-crops them,
 * so every pixel of both dimensions is a pixel of face — which is what a list
 * of twenty-eight players is read for: recognising them.
 *
 * **The club is the watermark behind the lane**, in place of the 16px crest
 * that used to open the second line. That crest answered *which of the two
 * clubs* in principle and not in practice — a Bundesliga badge at 16px is a
 * coloured speck — and it was spending width on the one line that also carries
 * the goals, the cards and the substitution arrows. Behind the lane it costs
 * the row nothing and is finally large enough to be recognised; see
 * {@link ClubWatermark}. The name is in the row's tooltip for the reader the
 * badge does not reach.
 *
 * The line it freed goes to the **position**, which is what the other ranked
 * lists put there and what keeps the line from being empty on a player the
 * match had no events for.
 */
function PlayerRow({
  player,
  team,
  expected,
}: {
  player: MatchPlayer
  team: MatchTeam
  /** Set only before kick-off — see {@link MatchRankingTab}. */
  expected?: ExpectedPointsView
}) {
  const figure = matchPlayerFigure(player)
  /* The chip **replaces** the dash rather than joining it. On the duel row the
     two sit side by side because the figure there is a kick-off time, which
     says something the chip does not; here the whole page is one match and the
     figure before it starts is `–`, so a column of dashes beside a column of
     chips would be the same emptiness printed twice. */
  const entry =
    player.points === undefined ? expected?.entry(player.id) : undefined

  return (
    <div className="flex min-w-0 flex-1 items-stretch">
      <span className="flex w-14 shrink-0 self-stretch">
        <Avatar
          src={player.image}
          name={player.name}
          fill
          className={cn(
            'w-full self-stretch bg-transparent',
            'bg-linear-to-t from-surface-2/60 to-transparent to-70%',
            '[mask-image:linear-gradient(to_right,#000_65%,transparent)]',
          )}
        />
      </span>

      {/* `relative isolate overflow-hidden` is what the club watermark needs of
          its host — see [`ClubWatermark`](../player/ClubWatermark.tsx). Behind
          the **text**, not behind the portrait: that column is already a
          picture. */}
      <div className="relative isolate flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden py-2 pr-3 pl-1.5">
        <ClubWatermark team={team} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{player.name}</p>
          <span className="mt-0.5 flex items-center gap-2">
            {player.position !== undefined && (
              <span className="shrink-0 text-[0.6875rem] tracking-wide text-faint uppercase">
                {POSITION_LABEL[player.position]}
              </span>
            )}
            {/* Goals, cards and the rest, from the match's own event feed — the
                same glyphs the player page draws. The pitch has no room for
                these; a row does. */}
            {player.events?.map((event) => (
              <MatchEventBadge key={event.kind} event={event} />
            ))}
            {/* Arrows only. Every row here belongs to one match, and in a match
                a role exists only where there was a substitution — so an `S11`
                chip would sit on the handful of players who were *taken off* and
                on none of the ten beside them who also started, saying the
                opposite of what it means. The tooltip and the accessible name
                still spell the role out. */}
            {player.role !== undefined && (
              <MatchRoleMark
                role={player.role}
                showStart={false}
                className="text-[0.6875rem]"
              />
            )}
          </span>
        </div>

        {player.owner !== undefined && (
          <OwnerBadge owner={player.owner} size={20} />
        )}

        {entry === undefined ? (
          <span
            aria-label={figureDescription(figure)}
            className={cn(
              'nums shrink-0 text-sm font-semibold',
              isScore(figure) ? 'text-ink' : 'text-faint',
            )}
          >
            {figureLabel(figure)}
          </span>
        ) : (
          <ExpectedPointsBadge value={entry.value} isForecast={!entry.isOwn} />
        )}
      </div>
    </div>
  )
}
