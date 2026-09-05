import { ListOrdered, SquareSplitVertical } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import type { MatchLineup, MatchPlayer, MatchTeam } from '@/api/models'
import { matchPlayerFigure } from '@/components/matchday/matchPlayerFigure'
import { OwnerBadge } from '@/components/matchday/OwnerBadge'
import { MatchEventBadge } from '@/components/player/MatchEventBadge'
import {
  figureDescription,
  figureLabel,
  isScore,
} from '@/components/player/playerFigure'
import { MatchRoleMark } from '@/components/player/statGlyphs'
import { Avatar } from '@/components/ui/Avatar'
import { PairToggle } from '@/components/ui/PairToggle'
import { EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
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
 */
export function MatchRankingTab({
  home,
  away,
  leagueId,
}: {
  home: MatchLineup
  away: MatchLineup
  leagueId: string
}) {
  const [view, setView] = useRankingView()
  const combined = rankMatchPlayers(home, away)

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
        <RankedList rows={combined} leagueId={leagueId} />
      ) : (
        /* Home above away, the order the header's scoreline establishes and
           the one the pitch stacks them in. */
        <div className="flex flex-col gap-4">
          <TeamRanking lineup={home} leagueId={leagueId} />
          <TeamRanking lineup={away} leagueId={leagueId} />
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
 * One club's players, ranked among themselves, under a crest.
 *
 * The numbering **restarts at 1**, which is the whole point of the split: in
 * this reading the question is "who was this club's best", and a player carrying
 * `14` because thirteen opponents outscored him answers a different one.
 */
function TeamRanking({
  lineup,
  leagueId,
}: {
  lineup: MatchLineup
  leagueId: string
}) {
  const rows = rankMatchPlayers(lineup)

  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="flex min-w-0 items-center gap-2 px-0.5">
        <Avatar
          src={lineup.team.image}
          name={lineup.team.symbol}
          size={18}
          square
          className="shrink-0 bg-transparent"
        />
        <span className="truncate text-xs font-semibold tracking-wide text-muted uppercase">
          {lineup.team.name ?? lineup.team.symbol}
        </span>
      </h3>

      {rows.length === 0 ? (
        <p className="rounded-card border border-line bg-surface px-3 py-3 text-center text-xs text-muted">
          Keine Aufstellung veröffentlicht
        </p>
      ) : (
        <RankedList rows={rows} leagueId={leagueId} />
      )}
    </section>
  )
}

/** The card the two readings share: numbered rows, best first. */
function RankedList({
  rows,
  leagueId,
}: {
  rows: RankedPlayer[]
  leagueId: string
}) {
  return (
    <ol className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      {rows.map(({ player, team }, index) => (
        <li key={player.id} className="flex items-center">
          <span className="nums w-8 shrink-0 pl-3 text-right text-xs font-semibold text-faint">
            {index + 1}
          </span>
          <Link
            to={`/leagues/${leagueId}/players/${player.id}`}
            className="min-w-0 flex-1 transition-colors hover:bg-surface-2/60"
          >
            <PlayerRow player={player} team={team} />
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
 * Not memoised: the lineups behind it are rebuilt every render by
 * [`useMatchLineup`](../../api/hooks/useMatchLineup.ts) as points arrive, so a
 * memo keyed on them would never hit — the same reasoning the duel rosters
 * carry.
 */
function rankMatchPlayers(...lineups: MatchLineup[]): RankedPlayer[] {
  const rows: RankedPlayer[] = []

  for (const lineup of lineups) {
    for (const player of [...lineup.starters, ...lineup.substitutes]) {
      rows.push({ player, team: lineup.team })
    }
  }

  return rows.sort((a, b) => {
    const left = a.player.points
    const right = b.player.points
    // Unknown sorts last, and two unknowns fall back to the name so the order
    // stays stable while points land one request at a time.
    if (left === undefined && right === undefined) {
      return a.player.name.localeCompare(b.player.name)
    }
    if (left === undefined) return 1
    if (right === undefined) return -1
    return right - left || a.player.name.localeCompare(b.player.name)
  })
}

/**
 * One row: portrait, name over club crest and what he did, then the owner and
 * the score.
 *
 * The **crest is on the second line**, where the duel's row puts the opponent's
 * fixture. Here it says which of the two clubs the player belongs to, which is
 * the one thing a combined list takes away and has to give back — and unlike the
 * duel it needs no scoreline beside it, because every row in this list is the
 * same match.
 */
function PlayerRow({ player, team }: { player: MatchPlayer; team: MatchTeam }) {
  const figure = matchPlayerFigure(player)

  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <Avatar src={player.image} name={player.name} size={34} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{player.name}</p>
        <span className="mt-0.5 flex items-center gap-2">
          <Avatar
            src={team.image}
            name={team.symbol}
            size={16}
            square
            className="bg-transparent"
          />
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

      <span
        aria-label={figureDescription(figure)}
        className={cn(
          'nums shrink-0 text-sm font-semibold',
          isScore(figure) ? 'text-ink' : 'text-faint',
        )}
      >
        {figureLabel(figure)}
      </span>
    </div>
  )
}
