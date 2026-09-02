import { Shirt } from 'lucide-react'

import { useCurrentMatchday } from '@/api/hooks/useMatchday'
import {
  POSITION_LABEL,
  type PositionKey,
  type SquadMember,
  type TeamFixture,
} from '@/api/models'
import { FixtureBadge } from '@/components/squad/FixtureBadge'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'
import { money, moneyDelta, points } from '@/lib/format'

const POSITION_ORDER: PositionKey[] = ['gk', 'def', 'mid', 'fwd']

/**
 * The full squad as a grouped list.
 *
 * Lineup membership is read from the server's `lo` slot index rather than from
 * `LineupTab`'s local state. That is the right source here: the tabs never
 * mount together (Radix unmounts the inactive one), so the lineup tab's state
 * is already discarded on every tab switch and re-seeded from `lo`. `lo` is
 * effectively the store, and every edit is persisted and then invalidates this
 * query.
 *
 * The one visible consequence: switching tabs during the save debounce can
 * show the previous membership for about a second, until the refetch lands.
 */
export function PlayerListTab({
  squad,
  competitionId,
}: {
  squad: SquadMember[]
  competitionId: string
}) {
  // Shares the cache with the lineup tab, so this costs no extra request.
  const matchday = useCurrentMatchday(competitionId)
  const fixtureByTeamId = matchday.data?.fixtureByTeamId

  const byPosition = POSITION_ORDER.map((position) => ({
    position,
    players: squad
      .filter((player) => player.position === position)
      .sort((a, b) => b.marketValue - a.marketValue),
  })).filter((group) => group.players.length > 0)

  return (
    <div className="flex flex-col gap-5">
      {byPosition.map(({ position, players }) => (
        <section key={position} className="flex flex-col gap-2">
          <h2 className="px-1 text-[0.6875rem] font-semibold tracking-wider text-faint uppercase">
            {POSITION_LABEL[position]} · {players.length}
          </h2>
          <ul className="flex flex-col gap-2">
            {players.map((player) => (
              <PlayerRow
                key={player.id}
                player={player}
                fixture={fixtureByTeamId?.get(player.teamId)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function PlayerRow({
  player,
  fixture,
}: {
  player: SquadMember
  fixture: TeamFixture | undefined
}) {
  // `lo` is a 0-based slot, so presence — not truthiness — is the test.
  const isFielded = player.lineupOrder !== undefined

  return (
    <li className="flex items-stretch overflow-hidden rounded-card border border-line bg-surface">
      {/* Full-height rail. Always rendered, tinted only when fielded, so rows
          stay aligned whether or not the player is in the lineup. */}
      <span
        aria-hidden={!isFielded}
        title={isFielded ? 'Aufgestellt' : undefined}
        className={cn(
          'flex w-7 shrink-0 items-center justify-center self-stretch border-r',
          isFielded
            ? 'border-accent/30 bg-accent/15 text-accent'
            : 'border-line bg-surface-2/40',
        )}
      >
        {isFielded && <Shirt size={15} />}
      </span>
      {isFielded && <span className="sr-only">Aufgestellt</span>}

      <span className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5">
        <Avatar
          src={player.image}
          name={player.lastName}
          size={40}
          square
          className="bg-surface-2"
        />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">
            {player.lastName}
            {player.status !== 0 && (
              <span
                className="ml-1.5 align-middle text-xs text-negative"
                title="Nicht einsatzbereit"
              >
                ●
              </span>
            )}
          </span>
          <span className="nums block truncate text-xs text-muted">
            {points(player.totalPoints)} Pkt · ⌀ {points(player.averagePoints)}
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span className="nums block text-sm font-semibold text-ink">
            {money(player.marketValue)}
          </span>
          {/* Profit/loss only. The `mvt` trend arrow used to sit in front of
              it and read as if it belonged to this figure, when the two are
              different signals — a player can be up overall while trending
              down. The signed, coloured amount carries this one on its own. */}
          <span
            className={cn(
              'nums block text-xs',
              player.profitLoss > 0 && 'text-positive',
              player.profitLoss < 0 && 'text-negative',
              player.profitLoss === 0 && 'text-faint',
            )}
          >
            {moneyDelta(player.profitLoss)}
          </span>
        </span>
      </span>

      {/* Full-height fixture panel, matching the swap dialog's treatment. */}
      <span className="flex shrink-0 items-center self-stretch border-l border-line bg-canvas/40 px-2.5">
        <FixtureBadge fixture={fixture} size="lg" layout="stacked" />
      </span>
    </li>
  )
}
