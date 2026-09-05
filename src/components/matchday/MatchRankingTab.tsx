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
import { EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/cn'

/** One ranked row: a player, whose club he is, and who had him. */
interface RankedPlayer {
  player: MatchPlayer
  team: MatchTeam
}

/**
 * **Every player in the match, best first** — both clubs interleaved, benches
 * included.
 *
 * The counterpart of the [duel's ranking](../duels/DuelRankingTab.tsx), and it
 * exists for the same reason: the pitch answers "how are the two teams set up",
 * a ranked list answers "who actually scored the points", and those are
 * different questions. Interleaving the clubs is the point — a list where one
 * side occupies the top six says something a pair of separate lists cannot.
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
  const ranked = rankMatchPlayers(home, away)

  if (ranked.length === 0) {
    return (
      <EmptyState
        title="Keine Aufstellungen"
        description="Kickbase hat für dieses Spiel noch keine Kader veröffentlicht."
      />
    )
  }

  return (
    <ol className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      {ranked.map(({ player, team }, index) => (
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
 * Both clubs' players in one list, best first.
 *
 * Not memoised: the lineups behind it are rebuilt every render by
 * [`useMatchLineup`](../../api/hooks/useMatchLineup.ts) as points arrive, so a
 * memo keyed on them would never hit — the same reasoning the duel rosters
 * carry.
 */
function rankMatchPlayers(
  home: MatchLineup,
  away: MatchLineup,
): RankedPlayer[] {
  const rows: RankedPlayer[] = []

  for (const lineup of [home, away]) {
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
