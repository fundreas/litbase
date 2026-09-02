import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ApiError } from '@/api/errors'
import { useSaveLineup, type LineupWrite } from '@/api/hooks/useLineup'
import type { SquadMember } from '@/api/models'
import {
  buildSlots,
  canAddPosition,
  containerFormation,
  countPositions,
  effectiveFormation,
  formationLabel,
  LINEUP_SIZE,
  type Formation,
  type PositionCounts,
} from '@/lib/lineup'

/** Rapid taps collapse into one request instead of eleven. */
const SAVE_DEBOUNCE_MS = 600

export interface LineupEditor {
  /** Fielded players, in the order they were added. */
  lineup: SquadMember[]
  counts: PositionCounts
  /** The shape actually on the pitch, e.g. `2-1-0` while being assembled. */
  formation: Formation
  isFielded: (playerId: string) => boolean
  /** True when this player could join without displacing anyone. */
  hasRoomFor: (player: SquadMember) => boolean
  /** Field him, bench him, or open the swap dialog — whichever applies. */
  toggle: (player: SquadMember) => void
  remove: (playerId: string) => void
  /**
   * Rearrange the fielded players. Takes the complete new id order and
   * ignores anything that is not a permutation of the current lineup.
   */
  reorder: (orderedIds: string[]) => void
  /** Set while the swap dialog is deciding who makes way. */
  incoming: SquadMember | null
  cancelSwap: () => void
  confirmSwap: (outgoing: SquadMember) => void
  isSaving: boolean
  saveError: string | null
}

/**
 * The lineup, and everything that mutates it.
 *
 * Lives in a hook rather than inside the pitch because **both squad tabs edit
 * the same lineup**: the list toggles a player from his row, the pitch from
 * his portrait. Two copies of this state would let the tabs disagree, and the
 * list previously worked around that by reading the server's `lo` instead —
 * which lagged by a save round trip.
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
 * The initial lineup is seeded from the squad's `lo` slot index, where slot 0
 * is the goalkeeper and benched players have no `lo` at all — see
 * {@link seedLineup}.
 */
export function useLineupEditor({
  squad,
  leagueId,
}: {
  squad: SquadMember[]
  leagueId: string
}): LineupEditor {
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
  const formation = useMemo(() => effectiveFormation(counts), [counts])

  const fieldedIds = useMemo(() => new Set(lineupIds), [lineupIds])

  /* ------------------------------------------------------------------ */
  /* Persistence                                                         */
  /* ------------------------------------------------------------------ */

  /**
   * What to send.
   *
   * A partial lineup *is* saveable, but not by sending a short list: `players`
   * must always be eleven positional slots, `type` must be a real formation,
   * and empty slots are `""`. So the write declares a legal *container*
   * formation big enough to hold what is selected — a different thing from the
   * effective shape shown to the user.
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
   * the same. Keying on content makes an unchanged lineup a no-op however
   * often its objects are rebuilt.
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

  /* ------------------------------------------------------------------ */
  /* Editing                                                             */
  /* ------------------------------------------------------------------ */

  const remove = useCallback((playerId: string) => {
    setIsDirty(true)
    setLineupIds((current) => current.filter((id) => id !== playerId))
  }, [])

  /**
   * Reorder the eleven without changing who is in it.
   *
   * Order is not cosmetic: `players` is posted positionally, so a player's
   * index within his position group *is* the slot Kickbase gives him and comes
   * back as `lo`. Moving the third midfielder to the front is therefore a real
   * edit that has to be saved — see {@link buildSlots}.
   *
   * Guarded rather than trusted, because the caller composes this order from a
   * drag preview that a squad refetch could have outrun: anything that is not
   * a permutation of the current lineup is dropped, so a stale drag can never
   * bench a player or resurrect one.
   */
  const reorder = useCallback(
    (orderedIds: string[]) => {
      const unique = new Set(orderedIds)
      if (unique.size !== lineupIds.length) return
      if (!lineupIds.every((id) => unique.has(id))) return
      if (orderedIds.every((id, index) => id === lineupIds[index])) return

      setIsDirty(true)
      setLineupIds(orderedIds)
    },
    [lineupIds],
  )

  const toggle = useCallback(
    (player: SquadMember) => {
      if (fieldedIds.has(player.id)) {
        remove(player.id)
        return
      }
      if (canAddPosition(counts, player.position)) {
        setIsDirty(true)
        setLineupIds((current) => [...current, player.id])
        return
      }
      // No room for this position: ask who makes way rather than silently
      // refusing the tap.
      setIncoming(player)
    },
    [counts, fieldedIds, remove],
  )

  const confirmSwap = useCallback((outgoing: SquadMember) => {
    setIncoming((pending) => {
      if (pending === null) return null
      setIsDirty(true)
      setLineupIds((current) => [
        ...current.filter((id) => id !== outgoing.id),
        pending.id,
      ])
      return null
    })
  }, [])

  const cancelSwap = useCallback(() => {
    setIncoming(null)
  }, [])

  return {
    lineup,
    counts,
    formation,
    isFielded: (playerId) => fieldedIds.has(playerId),
    hasRoomFor: (player) => canAddPosition(counts, player.position),
    toggle,
    remove,
    reorder,
    incoming,
    cancelSwap,
    confirmSwap,
    isSaving: save.isPending,
    saveError,
  }
}

/**
 * Initial lineup from the squad's `lo` slot index.
 *
 * **Membership is `lo !== undefined`, not `lo > 0`.** Slot `0` is the
 * goalkeeper, and an earlier version used `(lo ?? 0) > 0`, which conflates
 * "benched" (no `lo`) with "keeper" (`lo === 0`) — so the keeper was silently
 * dropped on every reload and a saved eleven came back as ten.
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
