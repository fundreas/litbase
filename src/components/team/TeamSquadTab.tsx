import { ChevronRight, TrendingDown, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import type { TeamRoster } from '@/api/hooks/useTeam'
import {
  POSITION_LABEL,
  POSITION_NAME,
  teamSquadTotals,
  type PositionKey,
  type TeamSquadPlayer,
} from '@/api/models'
import { OwnerBadge } from '@/components/matchday/OwnerBadge'
import { LineupPosterDialog } from '@/components/player/LineupPosterDialog'
import { PlayerStatusBadge } from '@/components/squad/PlayerStatusBadge'
import { StartProbabilityBadge } from '@/components/squad/StartProbabilityBadge'
import { Avatar } from '@/components/ui/Avatar'
import { StatTile } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { money, moneyDelta } from '@/lib/format'

/**
 * Sort weight per position — the order a team sheet is always written in.
 *
 * The list is flat rather than sectioned, so this is an index rather than a
 * set of headings: every row carries its own position, which is what a heading
 * would otherwise have said once for the group.
 */
const POSITION_ORDER: Record<PositionKey, number> = {
  gk: 0,
  def: 1,
  mid: 2,
  fwd: 3,
}

/**
 * The club's whole roster, with **what each player costs, how likely he is to
 * start, and who in your league already has him.**
 *
 * This is the tab the page is worth building for. A Bundesliga squad list is
 * available anywhere; a squad list annotated with your league's ownership is
 * the join that only a Kickbase client can make, and it turns a club page into
 * the answer to "is there anything here worth buying".
 *
 * **Every player, always, in one list.** No filters and no sections: a club has
 * twenty-five to thirty players, which is a single screenful of scrolling, and
 * a filter over a list that short mostly hides the comparison the reader came
 * to make. Sorted by position, then by name — so the shape of the squad is the
 * order of the list, and a player is found where his name puts him rather than
 * where this week's form does.
 *
 * **It costs one request per player** — twenty-five to thirty — because the
 * competition's free player list carries performance and nothing else: no
 * market value, no probability, no owner. All of them come off the same
 * league-scoped player response, which is why they arrive together rather than
 * one column at a time. The full reasoning, and why the Übersicht deliberately
 * does not pay it, is on [`useTeamRoster`](../../api/hooks/useTeam.ts).
 *
 * Rows render immediately from the free half — name and position — and fill in
 * as the fan-out lands, so the tab is never a spinner over an empty screen.
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
  const [isPosterOpen, setIsPosterOpen] = useState(false)

  const totals = teamSquadTotals(roster.players)

  /*
   * Not memoised: the roster is rebuilt by `useTeamRoster` on every render as
   * the fan-out lands, so a memo keyed on it would never hit — the same
   * trade-off the duel rosters and the match ranking document, over thirty
   * comparisons.
   *
   * `localeCompare` rather than `<`, because the names are German and a plain
   * comparison sorts every umlaut after Z: Özcan would land under Zirkzee.
   */
  const players = [...roster.players].sort(
    (a, b) =>
      POSITION_ORDER[a.position] - POSITION_ORDER[b.position] ||
      a.name.localeCompare(b.name, 'de'),
  )

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

      {players.length === 0 ? (
        <EmptyState
          title="Kein Kader geladen"
          description={
            roster.isPending
              ? 'Die Kaderdaten werden noch geladen.'
              : 'Kickbase führt für diesen Klub gerade keine Spieler.'
          }
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {players.map((player) => (
            <li key={player.id}>
              <PlayerRow player={player} leagueId={leagueId} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * One player: portrait, name over position and probability, the owning
 * manager, and the money.
 *
 * The **probability sits on the second line beside the position**, not next to
 * the name. Beside the name it would collide with the availability mark, and
 * the two mean different things — "verletzt" is a fact, "unlikely to start" is
 * somebody's estimate — which is the same separation the
 * [squad list](../squad/PlayerListTab.tsx) makes. Glyph only, no label: five
 * tier names repeated down thirty rows is a lot of text for a mark the reader
 * learns to recognise in seconds, and each badge keeps its tooltip.
 *
 * The **availability mark stays** beside the name even though it is not one of
 * the columns this list is for. A `prob` tier does not imply it — an injured
 * player often carries no assessment at all — so dropping it would lose the one
 * signal a scouting list must not be wrong about.
 *
 * The **owner** sits between the name and the numbers, because that is what the
 * eye is scanning for: a column of manager avatars down the right-hand side
 * answers "what is still free here" in one sweep, where the same badges beside
 * the names would have to be hunted for.
 *
 * The whole row is a link to the player's own page, where the season history,
 * the market-value chart and the ownership detail live.
 */
function PlayerRow({
  player,
  leagueId,
}: {
  player: TeamSquadPlayer
  leagueId: string
}) {
  const changeDay = player.marketValueChangeDay
  const ChangeIcon =
    changeDay !== undefined && changeDay < 0 ? TrendingDown : TrendingUp

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
        </span>

        <span className="mt-0.5 flex items-center gap-1.5">
          <span
            title={POSITION_NAME[player.position]}
            className="text-[0.625rem] tracking-wide text-faint uppercase"
          >
            {POSITION_LABEL[player.position]}
          </span>
          {player.startProbability !== undefined && (
            <StartProbabilityBadge tier={player.startProbability} size={13} />
          )}
        </span>
      </div>

      {player.owner !== undefined && (
        <OwnerBadge owner={player.owner} size={22} />
      )}

      <div className="w-20 shrink-0 text-right">
        {/* A dash, not `0 €`: the value has not arrived, and a zero would read
            as a worthless player rather than as a pending request. */}
        <span className="nums block text-sm font-semibold text-ink">
          {player.marketValue === undefined ? '–' : money(player.marketValue)}
        </span>

        {/* The **last 24 hours**, drawn exactly as the squad list draws it —
            the arrow is the same signal as the amount, its direction, so the
            two cannot contradict each other, and it is omitted on a flat day
            rather than pointing nowhere. */}
        <span
          title="Marktwertänderung in den letzten 24 Stunden"
          className={cn(
            'nums flex items-center justify-end gap-0.5 text-xs',
            changeDay !== undefined && changeDay > 0 && 'text-positive',
            changeDay !== undefined && changeDay < 0 && 'text-negative',
            (changeDay === undefined || changeDay === 0) && 'text-faint',
          )}
        >
          {changeDay !== undefined && changeDay !== 0 && (
            <ChangeIcon size={11} aria-hidden="true" className="shrink-0" />
          )}
          {moneyDelta(changeDay)}
          <span className="sr-only"> in den letzten 24 Stunden</span>
        </span>
      </div>
    </Link>
  )
}
