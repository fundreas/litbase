import { AlertTriangle, Check, UserMinus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { ApiError } from '@/api/errors'
import { useSaveLineup, type LineupWrite } from '@/api/hooks/useLineup'
import {
  POSITION_LABEL,
  type PositionKey,
  type SquadMember,
} from '@/api/models'
import { Pitch } from '@/components/squad/Pitch'
import { Avatar } from '@/components/ui/Avatar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/ui/Spinner'
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

/** Bench grouping, and the order player ids are sent to the API in. */
const BENCH_ORDER: PositionKey[] = ['gk', 'def', 'mid', 'fwd']

/** Rapid taps collapse into one request instead of eleven. */
const SAVE_DEBOUNCE_MS = 600

/** Write key for a lineup the API will not accept (one to ten players). */
const HELD_KEY = 'held'

/**
 * Interactive lineup, persisted to Kickbase.
 *
 * Every change is saved via `POST /v4/leagues/{id}/lineup`, which replaces the
 * lineup wholesale. Two consequences shape the code below:
 *
 *  - **Edits are coalesced.** Building an eleven from scratch is eleven taps;
 *    without debouncing that is eleven requests, each superseded by the next.
 *  - **Requests are serialised.** Because each payload is the complete state,
 *    an out-of-order response would leave the server holding a stale lineup.
 *    A save waits for the in-flight one and then sends whatever the *current*
 *    state is, so the last write always matches the last edit.
 *
 * Only a complete eleven can be sent — see the note on `write` below.
 *
 * The initial lineup is seeded from the squad's `lo` slot index, where slot 0
 * is the goalkeeper and benched players have no `lo` at all. See
 * {@link seedLineup}, whose earlier `lo > 0` test is exactly why the keeper
 * used to disappear on reload.
 */
export function LineupTab({
  squad,
  leagueId,
}: {
  squad: SquadMember[]
  leagueId: string
}) {
  const [lineupIds, setLineupIds] = useState<string[]>(() => seedLineup(squad))
  const [incoming, setIncoming] = useState<SquadMember | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  // State, not a ref: the "nicht gespeichert" chip depends on it, so a change
  // has to trigger a render.
  const [isDirty, setIsDirty] = useState(false)

  const save = useSaveLineup(leagueId)

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

  /* ---------------------------------------------------------------------- */
  /* Persistence                                                             */
  /* ---------------------------------------------------------------------- */

  /**
   * What the server can actually be told.
   *
   * `POST /lineup` requires a complete eleven — a partial lineup is rejected,
   * and there is in any case no formation string that describes one. Emptying
   * the lineup has its own endpoint. So there are exactly three states:
   *
   *  - **eleven players** → `POST /lineup`
   *  - **nobody** → `POST /lineup/clear`
   *  - **one to ten** → nothing to send; held locally and labelled as unsaved
   *
   * Holding is deliberate rather than a silent failure: the alternative is
   * firing a request on every tap that is known to come back an error. It does
   * mean the server keeps the last complete eleven while a partial lineup is
   * being assembled, which is why the UI says so plainly.
   */
  const write: LineupWrite | null =
    lineup.length === LINEUP_SIZE
      ? {
          kind: 'save',
          formation: formationLabel(formation),
          playerIds: orderPlayerIds(lineup),
        }
      : lineup.length === 0
        ? { kind: 'clear' }
        : null

  const isHeld = write === null

  /**
   * The write is identified by its *content*, not by the identity of the
   * objects it came from.
   *
   * That distinction is load-bearing. A successful save invalidates the squad
   * query, so `squad` refetches, `lineup` becomes a new array, and a `write`
   * rebuilt from it would be a new object — firing the effect again, which
   * saves, invalidates, refetches, for ever. Refetch-on-window-focus would do
   * the same. Deriving a string key and memoising the object *on that key*
   * makes an unchanged lineup a no-op however often its objects are rebuilt,
   * while keeping the effect's dependencies honest.
   */
  const writeKey =
    write === null
      ? HELD_KEY
      : write.kind === 'clear'
        ? 'clear'
        : `${write.formation}|${write.playerIds.join(',')}`

  // The freshest write, parked in a ref *after* render so the timer callback
  // can read it without the effect having to depend on its identity.
  const writeRef = useRef(write)
  useEffect(() => {
    writeRef.current = write
  })

  const inFlightRef = useRef<Promise<unknown> | null>(null)
  // `mutateAsync` is a stable reference in React Query v5.
  const { mutateAsync } = save

  useEffect(() => {
    // The seeded lineup came from the server; only user edits are worth saving.
    if (!isDirty) return
    // Nothing the API accepts for a partial lineup — see the note on `write`.
    if (writeKey === HELD_KEY) return

    const timer = window.setTimeout(() => {
      const run = async () => {
        const pending = writeRef.current
        if (pending === null) return

        // Serialise: never overlap two writes to the same resource, so the
        // last request to reach the server is the last edit the user made.
        try {
          await inFlightRef.current
        } catch {
          /* the previous save's failure is already reported */
        }

        const attempt = mutateAsync(pending)
          .then(() => {
            setSaveError(null)
          })
          .catch((error: unknown) => {
            setSaveError(
              error instanceof ApiError
                ? error.message
                : 'Aufstellung konnte nicht gespeichert werden.',
            )
          })

        inFlightRef.current = attempt
        await attempt
      }
      void run()
    }, SAVE_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [writeKey, isDirty, mutateAsync])

  /* ---------------------------------------------------------------------- */
  /* Editing                                                                 */
  /* ---------------------------------------------------------------------- */

  const remove = (playerId: string) => {
    setIsDirty(true)
    setLineupIds((current) => current.filter((id) => id !== playerId))
  }

  const add = (player: SquadMember) => {
    if (canAddPosition(counts, player.position)) {
      setIsDirty(true)
      setLineupIds((current) => [...current, player.id])
      return
    }
    // No room for this position: ask which player should make way rather than
    // silently refusing the tap.
    setIncoming(player)
  }

  const swap = (outgoing: SquadMember) => {
    if (!incoming) return
    setIsDirty(true)
    setLineupIds((current) => [
      ...current.filter((id) => id !== outgoing.id),
      incoming.id,
    ])
    setIncoming(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 px-0.5">
        <p className="nums flex items-center gap-2 text-sm text-muted">
          <span>
            <span className="font-semibold text-ink">
              {lineup.length}/{LINEUP_SIZE}
            </span>{' '}
            aufgestellt
          </span>
          {save.isPending ? (
            <span className="flex items-center gap-1 text-xs text-faint">
              <Spinner size={12} />
              Speichern …
            </span>
          ) : (
            isHeld &&
            isDirty && (
              <span
                className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[0.6875rem] font-medium text-warning"
                title="Kickbase speichert nur eine vollständige Elf. Ergänze die fehlenden Spieler."
              >
                nicht gespeichert
              </span>
            )
          )}
        </p>
        <p className="nums rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-accent">
          {formationLabel(formation)}
        </p>
      </div>

      {saveError !== null && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-negative/30 bg-negative/10 px-3 py-2.5 text-sm text-negative"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {saveError}
        </p>
      )}

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
        onConfirm={swap}
      />
    </div>
  )
}

/**
 * Player ids in formation reading order — keeper, defence, midfield, attack.
 *
 * The API docs do not say whether `players` is positional. Nothing suggests a
 * slot encoding, and this is the only ordering that reads consistently
 * alongside the `type` string, so it is what gets sent.
 */
function orderPlayerIds(lineup: SquadMember[]): string[] {
  return BENCH_ORDER.flatMap((position) =>
    lineup
      .filter((player) => player.position === position)
      .map((player) => player.id),
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

/**
 * Pick which fielded player makes way. Selection and confirmation are separate
 * steps: tapping a row only selects it, and the dialog's own confirm button
 * performs the swap — so a mis-tap in a scrolling list costs nothing.
 */
function SwapDialog({
  incoming,
  lineup,
  onCancel,
  onConfirm,
}: {
  incoming: SquadMember | null
  lineup: SquadMember[]
  onCancel: () => void
  onConfirm: (outgoing: SquadMember) => void
}) {
  // Selection is scoped to the player being brought on. Comparing during
  // render (rather than resetting in an effect) means a newly opened dialog
  // never paints with the previous visit's choice still highlighted.
  const incomingId = incoming?.id ?? null
  const [selection, setSelection] = useState<{
    forPlayerId: string | null
    outgoingId: string | null
  }>({ forPlayerId: incomingId, outgoingId: null })

  if (selection.forPlayerId !== incomingId) {
    setSelection({ forPlayerId: incomingId, outgoingId: null })
  }

  const candidates = useMemo(
    () => (incoming === null ? [] : removalCandidates(lineup, incoming)),
    [incoming, lineup],
  )

  const selectedId = selection.outgoingId
  const selected = candidates.find((player) => player.id === selectedId)
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
            ? 'Die Aufstellung ist voll. Wähle den Spieler, der Platz macht.'
            : 'Für diese Position ist kein Platz frei. Wähle den Spieler, der Platz macht.'
      }
      confirmLabel="Tauschen"
      cancelLabel="Abbrechen"
      isConfirmDisabled={selected === undefined}
      onConfirm={() => {
        if (selected) onConfirm(selected)
      }}
    >
      {candidates.length > 0 && (
        <ul
          role="radiogroup"
          aria-label="Spieler, der Platz macht"
          className="-mx-1 flex max-h-64 flex-col gap-1 overflow-y-auto overscroll-contain px-1"
        >
          {candidates.map((player) => {
            const isSelected = player.id === selectedId
            return (
              <li key={player.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => {
                    setSelection({
                      forPlayerId: incomingId,
                      outgoingId: player.id,
                    })
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors',
                    isSelected
                      ? 'border-accent bg-accent/10'
                      : 'border-line bg-canvas hover:border-accent/40 hover:bg-surface-2',
                  )}
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
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                      isSelected
                        ? 'border-accent bg-accent text-accent-ink'
                        : 'border-line',
                    )}
                  >
                    {isSelected && <Check size={13} />}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </ConfirmDialog>
  )
}

/* -------------------------------------------------------------------------- */
/* Seeding                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Initial lineup from the squad's `lo` slot index.
 *
 * **Membership is `lo !== undefined`, not `lo > 0`.** Slot `0` is the
 * goalkeeper, and an earlier version of this function used `(lo ?? 0) > 0`,
 * which conflates "benched" (no `lo`) with "keeper" (`lo === 0`) — so the
 * keeper was silently dropped on every reload and a saved eleven came back as
 * ten. Confirmed against real payloads: a fielded eleven carries `lo` `0…10`
 * and benched players carry no `lo` at all.
 *
 * Players are still re-validated against the formation rules, so unexpected
 * server data degrades to a partial pitch rather than an illegal one.
 */
function seedLineup(squad: SquadMember[]): string[] {
  const fielded = squad
    .filter((player) => player.lineupOrder !== undefined)
    .sort((a, b) => (a.lineupOrder ?? 0) - (b.lineupOrder ?? 0))
    .slice(0, LINEUP_SIZE)

  if (fielded.length === 0) return []

  const accepted: SquadMember[] = []
  for (const player of fielded) {
    const counts = countPositions(accepted.map((other) => other.position))
    if (canAddPosition(counts, player.position)) accepted.push(player)
  }
  return accepted.map((player) => player.id)
}
