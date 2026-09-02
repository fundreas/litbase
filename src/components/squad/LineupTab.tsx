import { AlertTriangle, UserMinus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { ApiError } from '@/api/errors'
import { useSaveLineup, type LineupWrite } from '@/api/hooks/useLineup'
import { useCurrentMatchday } from '@/api/hooks/useMatchday'
import {
  POSITION_LABEL,
  POSITION_NAME,
  type PositionKey,
  type SquadMember,
  type TeamFixture,
} from '@/api/models'
import { FixtureBadge } from '@/components/squad/FixtureBadge'
import { Pitch } from '@/components/squad/Pitch'
import { Avatar } from '@/components/ui/Avatar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { points } from '@/lib/format'
import {
  buildSlots,
  canAddPosition,
  containerFormation,
  countPositions,
  effectiveFormation,
  emptySlotPenalty,
  formationLabel,
  LINEUP_SIZE,
  missingAtPosition,
  removalCandidates,
} from '@/lib/lineup'

/** Rows top-to-bottom on a vertical pitch: attack first, keeper last. */
const ROW_ORDER: PositionKey[] = ['fwd', 'mid', 'def', 'gk']

/** Bench grouping, and the order player ids are sent to the API in. */
const BENCH_ORDER: PositionKey[] = ['gk', 'def', 'mid', 'fwd']

/** Rapid taps collapse into one request instead of eleven. */
const SAVE_DEBOUNCE_MS = 600

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
 * Partial lineups save too: `players` is always eleven positional slots with
 * `""` for the empty ones, declared inside a legal container formation. See
 * the note on `write` below and `lib/lineup.ts`.
 *
 * The initial lineup is seeded from the squad's `lo` slot index, where slot 0
 * is the goalkeeper and benched players have no `lo` at all. See
 * {@link seedLineup}, whose earlier `lo > 0` test is exactly why the keeper
 * used to disappear on reload.
 */
export function LineupTab({
  squad,
  leagueId,
  competitionId,
}: {
  squad: SquadMember[]
  leagueId: string
  competitionId: string
}) {
  const [lineupIds, setLineupIds] = useState<string[]>(() => seedLineup(squad))
  const [incoming, setIncoming] = useState<SquadMember | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  // Gates the save effect so the server-seeded lineup is never written back
  // unchanged. State rather than a ref so flipping it re-runs that effect.
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
  // The shape actually fielded — not the nearest legal formation. At eleven
  // players this is guaranteed to be one of the ten allowed formations.
  const formation = useMemo(() => effectiveFormation(counts), [counts])

  const matchday = useCurrentMatchday(competitionId)
  const fixtureByTeamId = matchday.data?.fixtureByTeamId

  /**
   * An incomplete lineup is legal and it saves — but every empty slot costs
   * 100 points, so the warning quotes the actual figure rather than the count.
   * "2 Plätze sind leer" is easy to shrug at; "das kostet dich 200 Punkte" is
   * not, and 200 points is a bigger swing than most transfer decisions.
   *
   * The two causes need different wording. Usually the squad is big enough and
   * players simply have not been picked. But a squad of fewer than eleven
   * cannot be completed at all, and telling someone to "pick more players"
   * when they own nine is useless — that case names the real problem instead.
   */
  const missing = LINEUP_SIZE - lineup.length
  const isIncomplete = missing > 0
  const isSquadTooSmall = squad.length < LINEUP_SIZE
  const penalty = emptySlotPenalty(lineup.length)

  const cost = `${missing === 1 ? 'Ein leerer Platz kostet' : `${String(missing)} leere Plätze kosten`} dich ${points(penalty)} Punkte.`

  const incompleteMessage = isSquadTooSmall
    ? `Unvollständige Aufstellung: dein Kader hat nur ${String(squad.length)} von ${String(LINEUP_SIZE)} nötigen Spielern. ${cost} Kaufe Spieler auf dem Transfermarkt.`
    : `Unvollständige Aufstellung: ${cost}`

  /* ---------------------------------------------------------------------- */
  /* Persistence                                                             */
  /* ---------------------------------------------------------------------- */

  /**
   * What to send.
   *
   * A partial lineup *is* saveable, but not by sending a short list: `players`
   * must always be eleven positional slots, `type` must be a real formation,
   * and empty slots are `""`. So the write declares a legal *container*
   * formation big enough to hold what is selected — which is a different thing
   * from the effective shape shown to the user.
   *
   * An all-empty array is a no-op on the server rather than a clear, so an
   * empty lineup goes to `/lineup/clear` instead.
   */
  const write: LineupWrite =
    lineup.length === 0
      ? { kind: 'clear' }
      : {
          kind: 'save',
          formation: formationLabel(containerFormation(counts)),
          playerIds: buildSlots(lineup, containerFormation(counts)),
        }

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
    write.kind === 'clear'
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

    const timer = window.setTimeout(() => {
      const run = async () => {
        const pending = writeRef.current

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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between gap-3 px-0.5">
        <p
          className={cn(
            'nums flex items-center gap-2 text-sm',
            isIncomplete ? 'text-warning' : 'text-muted',
          )}
        >
          <span>
            <span
              className={cn(
                'font-semibold',
                isIncomplete ? 'text-warning' : 'text-ink',
              )}
            >
              {lineup.length}/{LINEUP_SIZE}
            </span>{' '}
            aufgestellt
          </span>

          {isIncomplete && (
            /* The count and this chip are the whole warning — there is no
               banner any more. The glyphs are `aria-hidden` and the full
               sentence rides along as screen-reader text, so nothing is lost
               to assistive tech by compressing it to "−200". */
            <span
              title={incompleteMessage}
              className="flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning"
            >
              <AlertTriangle size={12} aria-hidden="true" />
              <span aria-hidden="true">−{points(penalty)}</span>
              <span className="sr-only">{incompleteMessage}</span>
            </span>
          )}

          {save.isPending && (
            <span className="flex items-center gap-1 text-xs text-faint">
              <Spinner size={12} />
              Speichern …
            </span>
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

      <Pitch className="flex-1">
        {/* Four equal bands, one per position, always rendered.
            Distributing rows with `justify-around` instead made the geometry
            depend on how many rows happened to exist, so a lineup missing a
            position sat at a different height from one that had it — obvious
            on a big screen. Fixed bands keep every player where the position
            says they belong. Each band always has content: the mandatory
            minimums guarantee at least one avatar or placeholder in all
            four. */}
        {/* `flex-1`, not `h-full`. As a flex item this grid's `height: 100%`
            resolved against its own content rather than the parent, so it sat
            at its natural 394px inside a 479px pitch and left a band of empty
            grass under the keeper. Growing into the space is the reliable
            way to fill it. */}
        <div className="grid min-h-0 flex-1 grid-rows-4 px-2 py-3">
          {ROW_ORDER.map((position) => (
            <PitchRow
              key={position}
              position={position}
              players={lineup.filter((player) => player.position === position)}
              placeholders={missingAtPosition(counts, position)}
              fixtureByTeamId={fixtureByTeamId}
              onRemove={remove}
            />
          ))}
        </div>
      </Pitch>

      <Bench
        squad={squad}
        lineupIds={lineupIds}
        fixtureByTeamId={fixtureByTeamId}
        onAdd={add}
      />

      <SwapDialog
        incoming={incoming}
        lineup={lineup}
        fixtureByTeamId={fixtureByTeamId}
        onCancel={() => {
          setIncoming(null)
        }}
        onConfirm={swap}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Pitch                                                                      */
/* -------------------------------------------------------------------------- */

function PitchRow({
  position,
  players,
  placeholders,
  fixtureByTeamId,
  onRemove,
}: {
  position: PositionKey
  players: SquadMember[]
  /** Mandatory places of this position still to fill. */
  placeholders: number
  fixtureByTeamId: Map<string, TeamFixture> | undefined
  onRemove: (playerId: string) => void
}) {
  return (
    // `min-h-0` lets a crowded band (five defenders on a narrow phone) wrap
    // and scroll inside itself rather than pushing the other bands out of
    // their share of the pitch.
    <div className="no-scrollbar flex min-h-0 flex-wrap items-center justify-center gap-1 overflow-y-auto">
      {players.map((player) => (
        <PitchPlayer
          key={player.id}
          player={player}
          fixture={fixtureByTeamId?.get(player.teamId)}
          onClick={() => {
            onRemove(player.id)
          }}
        />
      ))}
      {Array.from({ length: placeholders }, (_, index) => (
        <EmptySlot key={index} position={position} />
      ))}
    </div>
  )
}

/**
 * A place the lineup still has to fill. Not interactive: tapping it could not
 * do anything unambiguous, and the bench below is where players are picked.
 */
function EmptySlot({ position }: { position: PositionKey }) {
  const label = `Noch kein ${POSITION_NAME[position]} aufgestellt`
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="flex w-16 shrink-0 flex-col items-center gap-1 p-1"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-white/45 text-[0.625rem] font-semibold text-white/70">
        {POSITION_LABEL[position]}
      </span>
      <span className="rounded bg-black/35 px-1 py-0.5 text-[0.625rem] font-medium text-white/70">
        offen
      </span>
    </span>
  )
}

function PitchPlayer({
  player,
  fixture,
  onClick,
}: {
  player: SquadMember
  fixture: TeamFixture | undefined
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

      {/* One plate, two lines: name over fixture. Two separate chips read as
          unrelated badges floating over the grass. */}
      <span className="flex max-w-full flex-col items-center gap-0.5 rounded bg-black/55 px-1 py-0.5 leading-tight">
        <span className="max-w-full truncate text-[0.625rem] font-semibold text-white">
          {player.lastName}
        </span>
        <FixtureBadge fixture={fixture} tone="onPitch" size="sm" />
      </span>
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/* Bench                                                                      */
/* -------------------------------------------------------------------------- */

function Bench({
  squad,
  lineupIds,
  fixtureByTeamId,
  onAdd,
}: {
  squad: SquadMember[]
  lineupIds: string[]
  fixtureByTeamId: Map<string, TeamFixture> | undefined
  onAdd: (player: SquadMember) => void
}) {
  const fielded = new Set(lineupIds)

  // The bench is what is *not* fielded. Players move between the pitch and
  // here rather than appearing in both.
  const grouped = BENCH_ORDER.map((position) => ({
    position,
    players: squad
      .filter(
        (player) => player.position === position && !fielded.has(player.id),
      )
      .sort((a, b) => b.marketValue - a.marketValue),
  })).filter((group) => group.players.length > 0)

  return (
    /* `shrink-0`: the bench keeps its natural height and the pitch above it
       absorbs whatever is left, rather than the two competing for space. */
    <section className="flex shrink-0 flex-col gap-2">
      <h2 className="px-0.5 text-[0.6875rem] font-semibold tracking-wider text-faint uppercase">
        Bank · tippen zum Aufstellen
      </h2>

      {grouped.length === 0 && (
        <p className="rounded-card border border-line bg-surface px-3 py-4 text-center text-sm text-muted">
          Alle Spieler sind aufgestellt.
        </p>
      )}

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
                  fixture={fixtureByTeamId?.get(player.teamId)}
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
  fixture,
  onClick,
}: {
  player: SquadMember
  fixture: TeamFixture | undefined
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${player.lastName} aufstellen`}
      className={cn(
        'flex w-[5rem] shrink-0 flex-col items-center gap-1 rounded-card border px-1 py-2',
        'border-line bg-surface transition-colors',
        'hover:border-accent/40 hover:bg-surface-2 active:bg-line',
      )}
    >
      {/* No dimmed or disabled state: every bench player is tappable, and one
          whose position is full simply routes through the swap dialog. Fading
          them would signal "unavailable" for something that always works. */}
      <Avatar src={player.image} name={player.lastName} size={36} />
      <span className="max-w-full truncate text-[0.6875rem] font-medium text-ink">
        {player.lastName}
      </span>
      {/* The next fixture replaces the average-points line: on a card this
          size only one secondary fact fits, and which club a player faces is
          the one that decides whether to field him this week. */}
      <FixtureBadge fixture={fixture} size="md" />
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
  fixtureByTeamId,
  onCancel,
  onConfirm,
}: {
  incoming: SquadMember | null
  lineup: SquadMember[]
  fixtureByTeamId: Map<string, TeamFixture> | undefined
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
                    'flex w-full items-stretch gap-3 overflow-hidden rounded-xl text-left',
                    // Border width is always 2 so selecting cannot nudge the
                    // row's height; the extra weight comes from a ring, which
                    // is drawn outside the box and costs no layout.
                    'border-2 transition-colors',
                    isSelected
                      ? 'border-accent bg-accent/10 ring-2 ring-accent/40'
                      : 'border-line bg-canvas hover:border-accent/40 hover:bg-surface-2',
                  )}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-3 py-2 pl-3">
                    <Avatar
                      src={player.image}
                      name={player.lastName}
                      size={32}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {player.lastName}
                      </span>
                      <span className="nums block truncate text-xs text-muted">
                        {POSITION_LABEL[player.position]} ·{' '}
                        {points(player.averagePoints)} ⌀
                      </span>
                    </span>
                  </span>

                  {/* Full-height panel on the right. No check mark: the whole
                      row carries the selected state, so a second indicator
                      would be redundant — and this is the space it frees. */}
                  <span
                    className={cn(
                      'flex shrink-0 items-center self-stretch border-l px-3',
                      isSelected
                        ? 'border-accent/40 bg-accent/10'
                        : 'border-line bg-surface/60',
                    )}
                  >
                    <FixtureBadge
                      fixture={fixtureByTeamId?.get(player.teamId)}
                      size="lg"
                      layout="stacked"
                    />
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
