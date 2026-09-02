import { UserMinus, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  POSITION_LABEL,
  type PositionKey,
  type SquadMember,
} from '@/api/models'
import { Pitch } from '@/components/squad/Pitch'
import { Avatar } from '@/components/ui/Avatar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/cn'
import { points } from '@/lib/format'
import {
  canAddPosition,
  countPositions,
  displayFormation,
  formationLabel,
  LINEUP_SIZE,
  removalCandidates,
} from '@/lib/lineup'

/** Rows top-to-bottom on a vertical pitch: attack first, keeper last. */
const ROW_ORDER: PositionKey[] = ['fwd', 'mid', 'def', 'gk']

/** Bench grouping order: keeper first, then back to front. */
const BENCH_ORDER: PositionKey[] = ['gk', 'def', 'mid', 'fwd']

/**
 * Interactive lineup.
 *
 * **State is local to this component.** Kickbase does expose
 * `GET`/`POST /v4/leagues/{id}/lineup`, but neither contract has been
 * inspected, so nothing here is sent to the server and a reload resets it.
 * Swapping in the real thing means replacing the `useState` below with a query
 * plus a mutation — the rules in `lib/lineup.ts` and this UI stay as they are.
 *
 * The lineup is seeded from the squad's `lo` (lineup order) field, whose
 * meaning is inferred: non-zero appears to mean "fielded". If that seed turns
 * out to be invalid under the formation rules it is discarded and the lineup
 * starts empty, rather than rendering something the rules forbid.
 */
export function LineupTab({ squad }: { squad: SquadMember[] }) {
  const [lineupIds, setLineupIds] = useState<string[]>(() => seedLineup(squad))
  const [incoming, setIncoming] = useState<SquadMember | null>(null)

  const byId = useMemo(
    () => new Map(squad.map((player) => [player.id, player])),
    [squad],
  )

  const lineup = useMemo(
    () =>
      lineupIds
        .map((id) => byId.get(id))
        .filter((player): player is SquadMember => player !== undefined),
    [lineupIds, byId],
  )

  const counts = useMemo(
    () => countPositions(lineup.map((player) => player.position)),
    [lineup],
  )
  const formation = useMemo(() => displayFormation(counts), [counts])

  const remove = (playerId: string) => {
    setLineupIds((current) => current.filter((id) => id !== playerId))
  }

  const add = (player: SquadMember) => {
    if (canAddPosition(counts, player.position)) {
      setLineupIds((current) => [...current, player.id])
      return
    }
    // No room for this position: ask which player should make way rather than
    // silently refusing the tap.
    setIncoming(player)
  }

  const swap = (outgoing: SquadMember) => {
    if (!incoming) return
    setLineupIds((current) => [
      ...current.filter((id) => id !== outgoing.id),
      incoming.id,
    ])
    setIncoming(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 px-0.5">
        <p className="nums text-sm text-muted">
          <span className="font-semibold text-ink">
            {lineup.length}/{LINEUP_SIZE}
          </span>{' '}
          aufgestellt
        </p>
        <p className="nums rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-accent">
          {formationLabel(formation)}
        </p>
      </div>

      <Pitch>
        <div className="flex flex-col gap-1 px-2 py-4">
          {ROW_ORDER.map((position) => {
            const slots =
              position === 'gk'
                ? 1
                : formation[position as 'def' | 'mid' | 'fwd']
            const players = lineup.filter(
              (player) => player.position === position,
            )
            return (
              <PitchRow
                key={position}
                position={position}
                slotCount={slots}
                players={players}
                onRemove={remove}
              />
            )
          })}
        </div>
      </Pitch>

      <Bench squad={squad} lineupIds={lineupIds} counts={counts} onAdd={add} />

      <SwapDialog
        incoming={incoming}
        lineup={lineup}
        onCancel={() => {
          setIncoming(null)
        }}
        onPick={swap}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Pitch                                                                      */
/* -------------------------------------------------------------------------- */

function PitchRow({
  position,
  slotCount,
  players,
  onRemove,
}: {
  position: PositionKey
  slotCount: number
  players: SquadMember[]
  onRemove: (playerId: string) => void
}) {
  // Render every slot the formation allows, so empty ones read as invitations
  // rather than the row simply being short.
  const empty = Math.max(slotCount - players.length, 0)

  return (
    <div className="flex items-start justify-center gap-1">
      {players.map((player) => (
        <PitchPlayer
          key={player.id}
          player={player}
          onClick={() => {
            onRemove(player.id)
          }}
        />
      ))}
      {Array.from({ length: empty }, (_, index) => (
        <EmptySlot key={index} label={POSITION_LABEL[position]} />
      ))}
    </div>
  )
}

function PitchPlayer({
  player,
  onClick,
}: {
  player: SquadMember
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${player.lastName} – aus der Aufstellung nehmen`}
      aria-label={`${player.lastName} aus der Aufstellung nehmen`}
      className="group flex w-16 shrink-0 flex-col items-center gap-1 rounded-lg p-1 transition-colors active:bg-black/20"
    >
      <span className="relative">
        <Avatar
          src={player.image}
          name={player.lastName}
          size={44}
          className="ring-2 ring-white/70"
        />
        {player.status !== 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-negative"
            title="Nicht einsatzbereit"
          />
        )}
        {/* Only shows on hover/focus — on touch the label already explains it. */}
        <span className="absolute inset-0 hidden items-center justify-center rounded-full bg-black/55 group-hover:flex">
          <UserMinus size={16} className="text-white" />
        </span>
      </span>

      <span className="max-w-full truncate rounded bg-black/55 px-1 py-0.5 text-[0.625rem] font-semibold text-white">
        {player.lastName}
      </span>
    </button>
  )
}

function EmptySlot({ label }: { label: string }) {
  return (
    <span className="flex w-16 shrink-0 flex-col items-center gap-1 p-1">
      <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-white/40 text-[0.625rem] font-semibold text-white/60">
        {label}
      </span>
      <span className="h-[1.125rem]" />
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Bench                                                                      */
/* -------------------------------------------------------------------------- */

function Bench({
  squad,
  lineupIds,
  counts,
  onAdd,
}: {
  squad: SquadMember[]
  lineupIds: string[]
  counts: ReturnType<typeof countPositions>
  onAdd: (player: SquadMember) => void
}) {
  const fielded = new Set(lineupIds)

  const grouped = BENCH_ORDER.map((position) => ({
    position,
    players: squad
      .filter((player) => player.position === position)
      .sort((a, b) => b.marketValue - a.marketValue),
  })).filter((group) => group.players.length > 0)

  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-0.5 text-[0.6875rem] font-semibold tracking-wider text-faint uppercase">
        Kader · tippen zum Aufstellen
      </h2>

      {/* One sideways-scrolling strip, grouped by position with headings, so
          the whole squad stays reachable with a thumb. */}
      <div className="-mx-3 no-scrollbar flex gap-4 overflow-x-auto px-3 pb-1">
        {grouped.map((group) => (
          <div key={group.position} className="flex shrink-0 flex-col gap-1.5">
            <span className="text-[0.625rem] font-semibold tracking-wide text-faint">
              {POSITION_LABEL[group.position]}
            </span>
            <div className="flex gap-2">
              {group.players.map((player) => (
                <BenchPlayer
                  key={player.id}
                  player={player}
                  isFielded={fielded.has(player.id)}
                  isBlocked={!canAddPosition(counts, player.position)}
                  onClick={() => {
                    onAdd(player)
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function BenchPlayer({
  player,
  isFielded,
  isBlocked,
  onClick,
}: {
  player: SquadMember
  isFielded: boolean
  isBlocked: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={isFielded}
      onClick={onClick}
      aria-label={
        isFielded
          ? `${player.lastName} ist aufgestellt`
          : `${player.lastName} aufstellen`
      }
      className={cn(
        'flex w-[4.5rem] shrink-0 flex-col items-center gap-1 rounded-card border px-1 py-2',
        'transition-colors',
        isFielded
          ? 'cursor-not-allowed border-accent/40 bg-accent/10 opacity-55'
          : 'border-line bg-surface hover:border-accent/40 hover:bg-surface-2 active:bg-line',
      )}
    >
      <Avatar
        src={player.image}
        name={player.lastName}
        size={36}
        className={cn(isBlocked && !isFielded && 'opacity-60')}
      />
      <span className="max-w-full truncate text-[0.6875rem] font-medium text-ink">
        {player.lastName}
      </span>
      <span className="nums text-[0.625rem] text-faint">
        {points(player.averagePoints)} ⌀
      </span>
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/* Swap dialog                                                                */
/* -------------------------------------------------------------------------- */

function SwapDialog({
  incoming,
  lineup,
  onCancel,
  onPick,
}: {
  incoming: SquadMember | null
  lineup: SquadMember[]
  onCancel: () => void
  onPick: (outgoing: SquadMember) => void
}) {
  const candidates = useMemo(
    () => (incoming === null ? [] : removalCandidates(lineup, incoming)),
    [incoming, lineup],
  )

  const isFull = lineup.length >= LINEUP_SIZE

  return (
    <ConfirmDialog
      open={incoming !== null}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
      title={
        incoming === null
          ? 'Kein Platz'
          : `Für ${incoming.lastName} Platz machen`
      }
      description={
        candidates.length === 0
          ? 'Keiner der aufgestellten Spieler kann getauscht werden, ohne die Formationsregeln zu brechen.'
          : isFull
            ? 'Die Aufstellung ist voll. Wähle einen Spieler, der Platz macht.'
            : 'Für diese Position ist kein Platz frei. Wähle einen Spieler, der Platz macht.'
      }
      // The confirm button is not the action here — picking a row is — so the
      // dialog is reduced to a single dismiss control.
      confirmLabel="Schließen"
      cancelLabel="Abbrechen"
      onConfirm={onCancel}
    >
      {candidates.length > 0 && (
        <ul className="-mx-1 flex max-h-64 flex-col gap-1 overflow-y-auto overscroll-contain px-1">
          {candidates.map((player) => (
            <li key={player.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(player)
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-line bg-canvas px-3 py-2 text-left transition-colors hover:border-negative/40 hover:bg-negative/10"
              >
                <Avatar src={player.image} name={player.lastName} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {player.lastName}
                  </span>
                  <span className="nums block truncate text-xs text-muted">
                    {POSITION_LABEL[player.position]} ·{' '}
                    {points(player.averagePoints)} ⌀
                  </span>
                </span>
                <X size={16} className="shrink-0 text-faint" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </ConfirmDialog>
  )
}

/* -------------------------------------------------------------------------- */
/* Seeding                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Best-effort initial lineup from the squad's `lo` field.
 *
 * `lo` is documented as "lineup order" and appears to be non-zero for fielded
 * players, but that reading is not confirmed. The result is validated against
 * the formation rules and thrown away if it does not hold, so a wrong guess
 * degrades to an empty pitch rather than an illegal one.
 */
function seedLineup(squad: SquadMember[]): string[] {
  const fielded = squad
    .filter((player) => (player.lineupOrder ?? 0) > 0)
    .sort((a, b) => (a.lineupOrder ?? 0) - (b.lineupOrder ?? 0))
    .slice(0, LINEUP_SIZE)

  if (fielded.length === 0) return []

  // Re-add one at a time, dropping anyone the rules cannot accommodate.
  const accepted: SquadMember[] = []
  for (const player of fielded) {
    const counts = countPositions(accepted.map((other) => other.position))
    if (canAddPosition(counts, player.position)) accepted.push(player)
  }
  return accepted.map((player) => player.id)
}
