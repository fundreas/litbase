import { ChevronRight, TrendingDown, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import type { TeamRoster } from '@/api/hooks/useTeam'
import {
  POSITION_NAME,
  teamSquadTotals,
  type PositionKey,
  type TeamSquadPlayer,
} from '@/api/models'
import { PLAYER_AVAILABILITY } from '@/api/types'
import { OwnerBadge } from '@/components/matchday/OwnerBadge'
import { LineupPosterDialog } from '@/components/player/LineupPosterDialog'
import { PlayerStatusBadge } from '@/components/squad/PlayerStatusBadge'
import { StartProbabilityBadge } from '@/components/squad/StartProbabilityBadge'
import { Avatar } from '@/components/ui/Avatar'
import { StatTile } from '@/components/ui/Card'
import { FilterChip, FilterChipRow } from '@/components/ui/FilterChip'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { money, points } from '@/lib/format'

/** The four groups, in the order a team sheet is always written. */
const GROUPS: PositionKey[] = ['gk', 'def', 'mid', 'fwd']

/** Which slice of the roster is on screen. */
type Filter = 'all' | 'fit' | 'out' | 'free' | 'mine'

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'Alle' },
  { key: 'fit', label: 'Fit' },
  { key: 'out', label: 'Nicht fit' },
  { key: 'free', label: 'Frei' },
  { key: 'mine', label: 'Meine' },
]

/**
 * The club's whole roster, with **what each player costs, how likely he is to
 * start, and who in your league already has him.**
 *
 * This is the tab the page is worth building for. A Bundesliga squad list is
 * available anywhere; a squad list annotated with your league's ownership is
 * the join that only a Kickbase client can make, and it turns a club page into
 * the answer to "is there anything here worth buying".
 *
 * **It costs one request per player** — twenty-five to thirty — because the
 * competition's free player list carries performance and nothing else: no
 * market value, no probability, no owner. All four come off the same
 * league-scoped player response, which is why they arrive together rather than
 * one card at a time. The full reasoning, and why the Übersicht deliberately
 * does not pay it, is on [`useTeamRoster`](../../api/hooks/useTeam.ts).
 *
 * Rows render immediately from the free half and fill in as the fan-out lands,
 * so the tab is never a spinner over an empty screen — only the three columns
 * on the right arrive late, and the summary above says so while they do.
 *
 * ## The filters are the scouting tool
 *
 * *Frei* is the one that earns its place: it is every player at this club that
 * nobody in the league owns, which is the shortest useful list on the page and
 * has no equivalent anywhere in the official app. *Meine* is its mirror, and
 * *Nicht fit* is the one to check before a matchday.
 */
export function TeamSquadTab({
  roster,
  teamName,
  leagueId,
}: {
  roster: TeamRoster
  /** For the poster dialog, which names the club it is showing. */
  teamName: string | undefined
  leagueId: string
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [isPosterOpen, setIsPosterOpen] = useState(false)

  const totals = teamSquadTotals(roster.players)
  const visible = roster.players.filter((player) => matches(player, filter))

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <StatTile
          label="Kaderwert"
          value={money(totals.marketValue)}
          hint={
            roster.isPending ? (
              <span className="flex items-center gap-1.5">
                <Spinner size={11} />
                {totals.players} Spieler
              </span>
            ) : (
              `${String(totals.players)} Spieler`
            )
          }
        />
        <StatTile
          label="In deiner Liga"
          value={`${String(totals.owned)} / ${String(totals.players)}`}
          hint={
            totals.ownedByViewer === 0
              ? 'keiner davon deiner'
              : totals.ownedByViewer === 1
                ? '1 davon deiner'
                : `${String(totals.ownedByViewer)} davon deine`
          }
          tone={totals.ownedByViewer > 0 ? 'positive' : 'neutral'}
        />
      </div>

      {roster.lineupPoster !== undefined && (
        <>
          <button
            type="button"
            onClick={() => {
              setIsPosterOpen(true)
            }}
            aria-haspopup="dialog"
            className={cn(
              'flex items-center gap-2 rounded-card border border-line bg-surface px-3 py-2.5',
              'text-sm font-medium text-muted transition-colors',
              'hover:border-accent/40 hover:bg-surface-2 hover:text-ink',
              'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
            )}
          >
            <StartProbabilityBadge tier={1} size={14} decorative />
            <span className="min-w-0 flex-1 text-left">
              Voraussichtliche Aufstellung
            </span>
            <ChevronRight size={15} aria-hidden="true" className="shrink-0" />
          </button>

          <LineupPosterDialog
            open={isPosterOpen}
            onOpenChange={setIsPosterOpen}
            poster={roster.lineupPoster}
            teamName={teamName}
          />
        </>
      )}

      <FilterChipRow label="Filter">
        {FILTERS.map(({ key, label }) => (
          <FilterChip
            key={key}
            isActive={filter === key}
            onClick={() => {
              setFilter(key)
            }}
          >
            {label}
          </FilterChip>
        ))}
      </FilterChipRow>

      {visible.length === 0 ? (
        <EmptyState
          title="Kein Spieler passt"
          description={
            roster.isPending
              ? 'Die Kaderdaten werden noch geladen.'
              : 'Für diesen Filter hat der Klub gerade niemanden.'
          }
        />
      ) : (
        GROUPS.map((position) => {
          const group = visible
            .filter((player) => player.position === position)
            .sort((a, b) => b.points - a.points)
          if (group.length === 0) return null

          return (
            <section key={position} className="flex flex-col gap-1.5">
              <h2 className="px-0.5 text-[0.625rem] font-semibold tracking-wider text-faint uppercase">
                {POSITION_NAME[position]}
                <span className="nums ml-1.5 font-normal">{group.length}</span>
              </h2>
              <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
                {group.map((player) => (
                  <li key={player.id}>
                    <PlayerRow player={player} leagueId={leagueId} />
                  </li>
                ))}
              </ul>
            </section>
          )
        })
      )}
    </div>
  )
}

/**
 * Whether a player belongs in the current slice.
 *
 * **A player whose detail has not arrived stays visible under every filter.**
 * `availability` and `owner` are both `undefined` until the fan-out lands, and
 * treating that as "fit" or "free" would make rows appear and disappear as the
 * requests resolve one at a time — which reads as a list that cannot make up
 * its mind. Unknown is not a state to filter on; it is a state to wait out.
 */
function matches(player: TeamSquadPlayer, filter: Filter): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'fit':
      return (
        player.availability === undefined ||
        player.availability === PLAYER_AVAILABILITY.FIT
      )
    case 'out':
      return (
        player.availability !== undefined &&
        player.availability !== PLAYER_AVAILABILITY.FIT
      )
    case 'free':
      return player.owner === undefined
    case 'mine':
      return player.owner?.isViewer === true
  }
}

/**
 * One player: portrait, name over his season line, then value and points.
 *
 * The marks ride **beside the name** rather than on the portrait. A corner
 * badge is right on a pitch, where there is no room for anything else, and
 * wrong on a list row, where 13px of it against a photograph is the mush that
 * got the probability icon pulled off the squad pitch — a row has the width for
 * a real mark and a real tooltip.
 *
 * The **owner** sits on the right, next to the numbers, because that is what
 * the eye is scanning this list for: a column of manager avatars down the right
 * edge answers "what is left here" in one sweep, where the same badges
 * scattered beside the names would have to be hunted.
 */
function PlayerRow({
  player,
  leagueId,
}: {
  player: TeamSquadPlayer
  leagueId: string
}) {
  const Trend =
    player.marketValueTrend === 'up'
      ? TrendingUp
      : player.marketValueTrend === 'down'
        ? TrendingDown
        : undefined

  return (
    <Link
      to={`/leagues/${leagueId}/players/${player.id}`}
      className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-surface-2/60"
    >
      <Avatar
        src={player.image}
        name={player.name}
        size={36}
        square
        className="shrink-0 bg-surface-2"
      />

      <div className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-sm font-medium text-ink">
            {player.name}
          </span>
          {player.availability !== undefined && (
            <PlayerStatusBadge
              status={player.availability}
              reason={player.availabilityText}
              size={13}
            />
          )}
          {player.startProbability !== undefined && (
            <StartProbabilityBadge tier={player.startProbability} size={13} />
          )}
        </span>
        <p className="nums truncate text-[0.6875rem] text-faint">
          {player.minutesPlayed}′ · {player.goals} Tore · {player.assists}{' '}
          Vorlagen
        </p>
      </div>

      {player.owner !== undefined && (
        <OwnerBadge owner={player.owner} size={20} />
      )}

      <div className="w-20 shrink-0 text-right">
        <p className="nums flex items-center justify-end gap-1 text-sm font-semibold text-ink">
          {Trend !== undefined && (
            <Trend
              size={12}
              aria-hidden="true"
              className={cn(
                'shrink-0',
                player.marketValueTrend === 'up'
                  ? 'text-positive'
                  : 'text-negative',
              )}
            />
          )}
          {/* A dash, not `0 €`: the value has not arrived, and a zero would
              read as a worthless player rather than as a pending request. */}
          {player.marketValue === undefined ? '–' : money(player.marketValue)}
        </p>
        <p className="nums text-[0.625rem] text-faint">
          {points(player.points)} Pkt
        </p>
      </div>
    </Link>
  )
}
