import { Shirt, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { Link } from 'react-router'

import {
  POSITION_LABEL,
  POSITION_NAME,
  type ManagerSquadMember,
  type PositionKey,
  type StartProbability,
} from '@/api/models'
import { useStartProbabilities } from '@/api/hooks/useStartProbabilities'
import { PlayerStatusBadge } from '@/components/squad/PlayerStatusBadge'
import { StartProbabilityBadge } from '@/components/squad/StartProbabilityBadge'
import { Avatar } from '@/components/ui/Avatar'
import { StatTile } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { money, moneyDelta, points } from '@/lib/format'

const POSITION_ORDER: PositionKey[] = ['gk', 'def', 'mid', 'fwd']

/**
 * **Every player this manager owns**, grouped by position, most valuable first.
 *
 * The squad **as it stands now**, not as it stood on the matchday the
 * [Aufstellung](./ManagerLineupTab.tsx) is showing — `/managers/{uid}/squad`
 * takes no `dayNumber` and silently ignores one, so today is all it can answer.
 * That is the honest division between the two tabs and worth stating on the
 * page: the lineup is a matchday, the Kader is a squad, and a player bought
 * yesterday is in the second and not the first.
 *
 * Three tiles above it, because they are what a rival's squad is actually read
 * for: how many players, what the lot is worth, and how many are fielded. The
 * team value is **summed from these rows** rather than taken from the
 * standings' `tv` — the two agree, and the sum is the one that cannot go stale
 * against the list under it.
 *
 * **Rows are the same design as one's own squad**: the 24-hour change under
 * the market value and the lineup probability under the name, both of which
 * this tab went without until 2026-09-08 — the change on the mistaken
 * grounds that the payload lacked it, the probability because nobody fetched
 * it. What stays off is what Kickbase only tells you about your own players:
 * the offer count, and the shirt as a *control*. The rail stays as a marker —
 * whether a player is in the eleven is the first thing you want from someone
 * else's squad — and every row opens the player's own page.
 *
 * **The probability costs a detail request per player**, the same gap-filling
 * fan-out the squad page runs for its own rows: `prob` is not on this payload.
 * Fifteen requests, once per half hour, against the `playerDetail` entries
 * the player pages and the market read too — so opening a player from here
 * finds his page already cached.
 */
export function ManagerSquadTab({
  squad,
  leagueId,
}: {
  squad: ManagerSquadMember[]
  leagueId: string
}) {
  const startProbabilities = useStartProbabilities(leagueId, squad)

  if (squad.length === 0) {
    return (
      <EmptyState
        icon={<Users size={22} />}
        title="Kein Kader"
        description="Für diesen Manager liefert Kickbase keine Spieler — vermutlich hat er die Liga verlassen."
      />
    )
  }

  const totalValue = squad.reduce((sum, player) => sum + player.marketValue, 0)
  const fielded = squad.filter((player) => player.isFielded).length

  const byPosition = POSITION_ORDER.map((position) => ({
    position,
    players: squad
      .filter((player) => player.position === position)
      .sort((a, b) => b.marketValue - a.marketValue),
  })).filter((group) => group.players.length > 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Spieler" value={points(squad.length)} />
        <StatTile label="Teamwert" value={money(totalValue)} />
        <StatTile
          label="Aufgestellt"
          value={points(fielded)}
          hint={fielded === 11 ? 'komplett' : 'von 11'}
        />
      </div>

      {byPosition.map((group) => (
        <section key={group.position} className="flex flex-col gap-1.5">
          <h3
            className="px-0.5 text-[0.6875rem] font-semibold tracking-wider text-faint uppercase"
            title={POSITION_NAME[group.position]}
          >
            {POSITION_LABEL[group.position]}
            <span className="nums ml-1.5 font-normal">
              {group.players.length}
            </span>
          </h3>

          <ul className="flex flex-col gap-1.5">
            {group.players.map((player) => (
              <PlayerRow
                key={player.id}
                player={player}
                startProbability={startProbabilities.get(player.id)}
                to={`/leagues/${leagueId}/players/${player.id}`}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * One player: whether he is fielded, who he is, how likely he is to start,
 * what he has scored and what he is worth — and what that moved overnight.
 *
 * The points line is the one thing this row says that the squad page's own does
 * not. There it would be noise — you know your own players — while about
 * somebody else's squad "what has this cost him all season" is half the reason
 * to look, and `p`/`ap` ride along on the payload either way.
 *
 * The probability and the 24-hour change are drawn exactly as the
 * [squad page](../squad/PlayerListTab.tsx) draws them, so a player reads the
 * same in his owner's squad as in yours.
 */
function PlayerRow({
  player,
  startProbability,
  to,
}: {
  player: ManagerSquadMember
  startProbability: StartProbability | undefined
  to: string
}) {
  const changeDay = player.marketValueChangeDay
  const ChangeIcon =
    changeDay !== undefined && changeDay < 0 ? TrendingDown : TrendingUp

  return (
    <li>
      <Link
        to={to}
        className={cn(
          'flex items-stretch overflow-hidden rounded-card border border-line bg-surface',
          'transition-colors hover:border-accent/40 hover:bg-surface-2',
        )}
      >
        {/* A marker, not a control: this is not the reader's team to change.
            Same rail, same colours as the squad page's, so "in the eleven"
            looks the same wherever it is read. */}
        <span
          className={cn(
            'flex w-7 shrink-0 items-center justify-center self-stretch border-r',
            player.isFielded
              ? 'border-accent/30 bg-accent/15 text-accent'
              : 'border-line bg-surface-2/40 text-faint',
          )}
        >
          <span className="sr-only">
            {player.isFielded ? 'Aufgestellt' : 'Nicht aufgestellt'}
          </span>
          <Shirt
            size={15}
            strokeWidth={player.isFielded ? 2 : 1.5}
            className={cn(!player.isFielded && 'opacity-40')}
          />
        </span>

        {/* Flush portrait, the squad row's arrangement: the Kickbase cutouts
            are transparent PNGs, so a wash grounds the figure and the inner
            edge is masked to dissolve into the row rather than end on a
            line. */}
        <Avatar
          src={player.image}
          name={player.lastName}
          fill
          className={cn(
            'w-14 self-stretch bg-transparent',
            'bg-linear-to-t from-surface-2/60 to-transparent to-70%',
            '[mask-image:linear-gradient(to_right,#000_65%,transparent)]',
          )}
        />

        <span className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-ink">
                {player.lastName}
              </span>
              <PlayerStatusBadge status={player.status} size={13} />
            </span>
            {/* Probability first, then the points: an estimate about the
                next matchday above a fact about the season so far. Both are
                one line each, and the badge is absent — not blank — for a
                player nobody has assessed. */}
            <span className="mt-0.5 flex items-center gap-1.5">
              {startProbability !== undefined && (
                <StartProbabilityBadge tier={startProbability} size={13} />
              )}
              <span className="nums truncate text-xs text-muted">
                {points(player.totalPoints)} Pkt
                {player.averagePoints !== undefined && (
                  <> · ⌀ {points(player.averagePoints)}</>
                )}
              </span>
            </span>
          </span>

          <span className="shrink-0 text-right">
            <span className="nums block text-sm font-semibold text-ink">
              {money(player.marketValue)}
            </span>
            {/* The last 24 hours in euros, arrow and amount — `tfhmvt`, which
                is on this payload after all. A flat day is a grey `±0`, as on
                the squad page: it is a fact about a night, unlike a profit of
                zero, which would be a claim about a trade. */}
            <span
              className={cn(
                'nums flex items-center justify-end gap-0.5 text-xs',
                changeDay !== undefined && changeDay > 0 && 'text-positive',
                changeDay !== undefined && changeDay < 0 && 'text-negative',
                (changeDay === undefined || changeDay === 0) && 'text-faint',
              )}
              title="Marktwertänderung in den letzten 24 Stunden"
            >
              {changeDay !== undefined && changeDay !== 0 && (
                <ChangeIcon size={11} aria-hidden="true" className="shrink-0" />
              )}
              {moneyDelta(changeDay)}
              <span className="sr-only"> in den letzten 24 Stunden</span>
            </span>
          </span>
        </span>
      </Link>
    </li>
  )
}
