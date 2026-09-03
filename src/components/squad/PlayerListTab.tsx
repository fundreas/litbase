import { Shirt } from 'lucide-react'
import { useState } from 'react'

import {
  POSITION_LABEL,
  START_PROBABILITY,
  type PositionKey,
  type SquadMember,
  type StartProbability,
  type TeamFixture,
} from '@/api/models'
import { FixtureBadge } from '@/components/squad/FixtureBadge'
import { StartProbabilityBadge } from '@/components/squad/StartProbabilityBadge'
import type { LineupEditor } from '@/components/squad/useLineupEditor'
import { Avatar } from '@/components/ui/Avatar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/cn'
import { money, moneyDelta, points } from '@/lib/format'

const POSITION_ORDER: PositionKey[] = ['gk', 'def', 'mid', 'fwd']

/**
 * The full squad as a grouped list, and a second place to edit the lineup.
 *
 * The shirt rail on each row is a control: tap it to field a benched player or
 * to take a fielded one off. Membership comes from the shared editor rather
 * than from the server's `lo`, so a change made here is on the pitch the moment
 * you switch tabs — `lo` lags by a save round trip and used to show stale rows
 * for about a second after every edit.
 *
 * **Adding is immediate; removing asks first.** The asymmetry is deliberate.
 * The rail is small, sits at the very edge of the row, and the rows scroll
 * under a thumb — a mis-tap on a fielded player would quietly drop him and cost
 * 100 points, and nothing on this screen would show what had happened. A
 * mis-tap that *adds* someone is visible and free to undo, so it needs no
 * dialog. On the pitch a player's portrait is a large, deliberate target and
 * the removal shows itself, so that path stays immediate.
 */
export function PlayerListTab({
  squad,
  editor,
  fixtureByTeamId,
  startProbabilities,
}: {
  squad: SquadMember[]
  editor: LineupEditor
  fixtureByTeamId: Map<string, TeamFixture> | undefined
  startProbabilities: Map<string, StartProbability>
}) {
  // The player awaiting a removal confirmation, if any.
  const [pendingRemoval, setPendingRemoval] = useState<SquadMember | null>(null)

  const handleToggle = (player: SquadMember) => {
    if (editor.isFielded(player.id)) {
      setPendingRemoval(player)
      return
    }
    // Adding, or opening the swap dialog when the position is full — both are
    // the editor's job.
    editor.toggle(player)
  }

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
                isFielded={editor.isFielded(player.id)}
                fixture={fixtureByTeamId?.get(player.teamId)}
                startProbability={startProbabilities.get(player.id)}
                onToggle={handleToggle}
              />
            ))}
          </ul>
        </section>
      ))}

      <ConfirmDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemoval(null)
        }}
        title="Spieler aus der Aufstellung nehmen?"
        description={
          pendingRemoval === null ? undefined : (
            <>
              <strong className="font-semibold text-ink">
                {/* `firstName` is optional in the API — filtered rather than
                    interpolated, so a missing one leaves no stray space. */}
                {[pendingRemoval.firstName, pendingRemoval.lastName]
                  .filter(Boolean)
                  .join(' ')}
              </strong>{' '}
              wird auf die Bank gesetzt. Bleibt der Platz leer, kostet dich das
              100 Punkte.
            </>
          )
        }
        confirmLabel="Auf die Bank"
        onConfirm={() => {
          if (pendingRemoval !== null) editor.remove(pendingRemoval.id)
          setPendingRemoval(null)
        }}
      />
    </div>
  )
}

function PlayerRow({
  player,
  isFielded,
  fixture,
  startProbability,
  onToggle,
}: {
  player: SquadMember
  isFielded: boolean
  fixture: TeamFixture | undefined
  /** Absent until it loads, and absent for good without Membership. */
  startProbability: StartProbability | undefined
  onToggle: (player: SquadMember) => void
}) {
  return (
    <li className="flex items-stretch overflow-hidden rounded-card border border-line bg-surface">
      {/* Full-height rail, and the row's lineup control. Always rendered,
          tinted only when fielded, so rows stay aligned either way. The
          outline shirt reads as an empty slot inviting a tap, rather than as
          a disabled version of the filled one. */}
      <button
        type="button"
        onClick={() => {
          onToggle(player)
        }}
        aria-pressed={isFielded}
        title={
          isFielded ? 'Aus der Aufstellung nehmen' : 'In die Aufstellung setzen'
        }
        className={cn(
          'flex w-7 shrink-0 items-center justify-center self-stretch border-r transition-colors',
          'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus-visible:ring-inset',
          isFielded
            ? 'border-accent/30 bg-accent/15 text-accent hover:bg-accent/25'
            : 'border-line bg-surface-2/40 text-faint hover:bg-surface-2',
        )}
      >
        <span className="sr-only">
          {isFielded ? 'Aufgestellt' : 'Nicht aufgestellt'}
        </span>
        <Shirt
          size={15}
          strokeWidth={isFielded ? 2 : 1.5}
          className={cn(!isFielded && 'opacity-40')}
        />
      </button>

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
          {/* The probability leads the stats line rather than sitting beside
              the name. Next to the name it would collide with the availability
              dot, and the two mean different things — "unfit" is a fact,
              "unlikely to start" is someone's estimate. The label rides along
              wherever the row is wide enough for it; on a phone the glyph and
              its tooltip carry it alone. */}
          <span className="flex items-center gap-1.5 text-xs text-muted">
            {startProbability !== undefined && (
              <>
                <StartProbabilityBadge tier={startProbability} size={13} />
                <span className="hidden truncate font-medium text-ink/75 sm:inline">
                  {START_PROBABILITY[startProbability].label}
                </span>
                <span aria-hidden="true" className="text-line">
                  ·
                </span>
              </>
            )}
            <span className="nums truncate">
              {points(player.totalPoints)} Pkt · ⌀{' '}
              {points(player.averagePoints)}
            </span>
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
