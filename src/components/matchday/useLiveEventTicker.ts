import { useEffect, useState } from 'react'

import { useEventTypeNames } from '@/api/hooks/usePlayerMatchEvents'
import type { MatchLineup } from '@/api/models'
import type { PlayerCenterEvent } from '@/api/types'

/**
 * How long one event holds the bar.
 *
 * Two seconds is long enough to read *name · action · points* and short enough
 * that a busy minute drains before it is stale — five slots per ten-second
 * poll, which is what {@link QUEUE_MAX} is sized against.
 */
export const TICKER_DISPLAY_MS = 2000

/**
 * How far behind the match the ticker is allowed to fall.
 *
 * The poll delivers a **batch**: ten seconds of twenty-two players' actions
 * arrive at once, and fifteen new events is an ordinary tick during a busy
 * spell. At two seconds each an uncapped queue would be half a minute behind
 * within one poll and minutes behind by half-time — announcing a pass while
 * the reader watches a goal go in.
 *
 * So the queue is a **window on the newest**, not a backlog: whatever is on
 * screen finishes its two seconds, and the overflow is dropped from the middle
 * — oldest first. Nothing is lost that the reader can't get in full, at leisure
 * and in order, from the [timeline tab](./MatchTimelineTab.tsx) and a player's
 * own [breakdown](../player/PlayerMatchEventsDialog.tsx). This bar is the
 * glance, not the record.
 */
const QUEUE_MAX = 4

/** One action, announced. */
export interface LiveEvent {
  /** `<playerId>:<ei>` — the row key, and what marks it as already announced. */
  id: string
  playerId: string
  playerName: string
  playerImage?: string
  /** Which half of the pitch he plays on, so the bar can take the club's ring. */
  side: 'home' | 'away'
  minute: number
  /** What the action was worth. Never `0` — see {@link toLiveEvent}. */
  points: number
  /** The catalogue's name, or a placeholder naming the code it could not resolve. */
  name: string
}

/** Name, portrait and side per player id, for both sheets. */
type Directory = Map<
  string,
  { name: string; image?: string; side: 'home' | 'away' }
>

function directoryOf(home: MatchLineup, away: MatchLineup): Directory {
  const directory: Directory = new Map()
  for (const [side, lineup] of [
    ['home', home],
    ['away', away],
  ] as const) {
    for (const player of [...lineup.starters, ...lineup.substitutes]) {
      directory.set(player.id, {
        name: player.name,
        image: player.image,
        side,
      })
    }
  }
  return directory
}

/**
 * One payload entry, if it is something to announce.
 *
 * Two kinds are dropped, and both for the reason the
 * [breakdown](../../api/hooks/usePlayerMatchEvents.ts) drops them:
 *
 *  1. **Reversals** — an entry carrying `cei` is Kickbase re-classifying an
 *     action it already reported, by appending a correction rather than editing
 *     the original. Announced, it reads as *Ball abgefangen −5* moments after
 *     *Ball abgefangen +5*, which describes the scoring system's second
 *     thoughts rather than the match. The entry it takes back has already had
 *     its two seconds; the corrected total is what the portrait shows.
 *  2. **Zero-point entries** — the fixture's own structure: kick-off, the
 *     halves, added time, full time, and whether the man started or sat. The
 *     pitch says who is on it and the scoreline says where the match stands;
 *     neither needs a notification.
 *
 * What is left is exactly what was asked for — the pass, the shot, the foul,
 * the assist, the goal — because on this scale every one of those is a scoring
 * action with a name in the catalogue.
 */
function toLiveEvent(
  event: PlayerCenterEvent,
  playerId: string,
  directory: Directory,
  catalogue: Map<number, string> | undefined,
): LiveEvent | undefined {
  if (event.ei === undefined) return undefined
  if (event.cei !== undefined) return undefined

  const points = event.p ?? 0
  if (points === 0) return undefined

  // A player the two sheets do not list. Nothing can be drawn for him — no
  // name, no portrait — and inventing a row for an id is worse than silence.
  const player = directory.get(playerId)
  if (player === undefined) return undefined

  return {
    id: `${playerId}:${event.ei}`,
    playerId,
    playerName: player.name,
    playerImage: player.image,
    side: player.side,
    minute: event.mt ?? 0,
    points,
    // A miss means the catalogue is short, not that the event is unknown — so
    // the code is shown rather than the word "unknown". Same fallback the
    // breakdown uses.
    name:
      event.eti === undefined
        ? 'Unbekannte Aktion'
        : (catalogue?.get(event.eti) ?? `Aktion ${String(event.eti)}`),
  }
}

/** Keep what is on screen; window the rest onto the newest. */
function append(queue: LiveEvent[], fresh: LiveEvent[]): LiveEvent[] {
  const showing = queue[0]
  if (showing === undefined) return fresh.slice(-QUEUE_MAX)
  return [showing, ...[...queue.slice(1), ...fresh].slice(-(QUEUE_MAX - 1))]
}

/**
 * **What just happened, one action at a time.**
 *
 * Turns the per-player action lists the
 * [points fan-out](../../api/hooks/useMatchdayPoints.ts) is already polling
 * into a stream: whatever appeared since the last look, announced for
 * {@link TICKER_DISPLAY_MS} each, newest queued behind.
 *
 * ## It costs nothing
 *
 * There is no live-events endpoint in this API — the match feed
 * (`/matches/{id}/details`) carries only goals, cards and substitutions, and
 * the fine-grained actions exist **only** per player, on
 * `/playercenter/{pid}`. Which is exactly what this screen is already reading
 * every ten seconds, for all twenty-two, to put a number on each portrait. The
 * actions come in the same payloads; until now they were discarded. So the
 * ticker adds **no request at all** — only the catalogue that names the codes,
 * one shared entry cached for a day.
 *
 * The poll rate is therefore also the resolution: an action shows up within ten
 * seconds of Kickbase scoring it, in a batch with everything else that tick,
 * not the instant it happens on the grass.
 *
 * ## Nothing that was already there is announced
 *
 * The first payload of a match in progress carries every action since kick-off
 * — hundreds of them. Opening the pitch in the 70th minute must not replay the
 * afternoon, so **the first pass that has data is a seed**: every `ei` in it is
 * marked as already announced and nothing is drawn. From then on, only ids that
 * were not in the previous look.
 *
 * An empty map is not that first pass — it is the fan-out still in flight, and
 * seeding on it would mark nothing and then flood on the next look. So seeding
 * waits for the first payload that actually has events, which every player
 * centre does from kick-off onwards (its structural entries are there from the
 * first minute).
 *
 * **Ids are tracked even while the stream is switched off**, which is what
 * makes the bell instant in both directions: silence, and then the next thing
 * that happens — not the twenty minutes the reader chose not to watch.
 */
export function useLiveEventTicker({
  home,
  away,
  events,
  enabled,
}: {
  home: MatchLineup
  away: MatchLineup
  /** Actions per player id, straight off the player-centre payloads. */
  events: Map<string, PlayerCenterEvent[]>
  enabled: boolean
}): LiveEvent | undefined {
  const names = useEventTypeNames(enabled)

  const [queue, setQueue] = useState<LiveEvent[]>([])
  /**
   * Every `<playerId>:<ei>` already accounted for, and the event count that
   * set was built from. `undefined` until the first payload seeds it.
   */
  const [seen, setSeen] = useState<
    { count: number; ids: Set<string> } | undefined
  >(undefined)
  const [wasEnabled, setWasEnabled] = useState(enabled)

  /*
   * Kickbase **appends**: an action, and a correction, are both new entries, so
   * the total number of them across the fixture only moves when there is
   * something to look at. That makes it a sound trigger and a cheap one — a sum
   * over twenty-two short arrays, against comparing the arrays themselves.
   */
  let eventCount = 0
  for (const list of events.values()) eventCount += list.length

  /*
   * Both of the blocks below adjust this hook's own state **during the
   * render** that observed the change, which is React's own answer to "a prop
   * changed and some state derived from it is now wrong" — and the reason
   * neither is an effect: an effect would paint one frame of the old queue
   * first, and this runs at most once per ten-second poll.
   *
   * They are pure, which is what makes that safe. Nothing is mutated: the seen
   * set is rebuilt rather than added to, and the queue is handed a value rather
   * than an updater. React re-invokes a component that sets state while
   * rendering — twice over in StrictMode — so anything that *accumulated* here
   * would accumulate twice. Recomputing from the same inputs cannot.
   */

  // Switched off mid-queue, the bar clears rather than finishing what it had
  // lined up: the bell is a request for quiet now.
  if (wasEnabled !== enabled) {
    setWasEnabled(enabled)
    if (!enabled) setQueue([])
  }

  if (eventCount > 0 && seen?.count !== eventCount) {
    const isSeed = seen === undefined
    const ids = new Set(seen?.ids)
    const directory = directoryOf(home, away)
    const fresh: LiveEvent[] = []

    for (const [playerId, list] of events) {
      for (const event of list) {
        if (event.ei === undefined) continue
        const id = `${playerId}:${event.ei}`
        if (ids.has(id)) continue
        ids.add(id)

        // The seed records the match so far without announcing it; a switched
        // off stream records it without announcing it either.
        if (isSeed || !enabled) continue

        const live = toLiveEvent(event, playerId, directory, names.data)
        if (live !== undefined) fresh.push(live)
      }
    }

    setSeen({ count: eventCount, ids })

    if (fresh.length > 0) {
      // In the order they happened. The payload's own order is by `ei`
      // descending, which is neither chronological nor stable across players.
      fresh.sort((a, b) => a.minute - b.minute || a.id.localeCompare(b.id))
      setQueue(append(queue, fresh))
    }
  }

  /*
   * The one thing here that is a genuine outside system: a clock. It advances
   * on the *head* rather than on the queue, so appending to the tail does not
   * restart the two seconds of whatever is being read right now.
   */
  const showing = queue[0]
  const showingId = showing?.id
  useEffect(() => {
    if (showingId === undefined) return
    const timer = setTimeout(() => {
      setQueue((queue) => queue.slice(1))
    }, TICKER_DISPLAY_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [showingId])

  return enabled ? showing : undefined
}
