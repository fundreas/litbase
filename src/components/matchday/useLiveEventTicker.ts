import { useEffect, useState } from 'react'

import { useEventTypeNames } from '@/api/hooks/usePlayerMatchEvents'
import type { MatchLineup } from '@/api/models'
import { LIVE_POLL_MS } from '@/api/polling'
import type { PlayerCenterEvent } from '@/api/types'

/**
 * The longest one action may hold the bar.
 *
 * Up from a flat two seconds, which was the whole schedule until the replay
 * below was built. Two seconds is the right length for a *queue* that is
 * usually behind; it is meanly short for a bar that is usually idle, and once
 * the points on the pitch started landing **with** the notification rather than
 * in a lump, most windows turned out to be quiet ones — a handful of actions
 * across twenty-two players in ten seconds. Three seconds is the reader
 * finishing *name · action · points* without hurrying, on the windows where
 * there is time to spare.
 */
export const REPLAY_MAX_MS = 3000

/**
 * The shortest, and the point at which the replay admits it is over budget.
 *
 * Below roughly this the strip stops being readable and starts strobing: four
 * hundred milliseconds is about one comfortable fixation, which buys the name
 * and the sign of the number and nothing else. Anything quicker is motion in
 * the corner of the eye that cannot be resolved into words, and — because the
 * figure on the plate counts inside its own slot — a number that is still
 * moving when the next one starts.
 *
 * It is a **floor, not a target**: ten seconds of window divided by this is
 * {@link QUEUE_MAX}, and a window with more announceable actions than that
 * cannot be replayed whole however it is sliced.
 */
export const REPLAY_MIN_MS = 400

/**
 * How far behind the match the replay is allowed to fall: **exactly one poll**.
 *
 * The poll delivers a **batch** — ten seconds of twenty-two players' actions
 * arrive at once — and the replay's whole job is to spread that batch back out
 * across the ten seconds before the next one lands. So the queue is sized at
 * precisely what the window can show at the floor rate, and a batch bigger than
 * that is one the window cannot hold whatever is done with it.
 *
 * ## Over budget: drop, and let the points land anyway
 *
 * Two policies were available and they differ in what they lie about.
 *
 * *Coalescing* — merging a player's consecutive actions into one row with the
 * summed delta — keeps every point attached to a notification, and invents a
 * notification that never happened: *Grimaldo · Erfolgreicher Pass · +4* for
 * four separate passes, or, worse, one row naming whichever action happened to
 * be last out of a pass, a foul and an assist. The strip's contract is that a
 * row is **an action**, and a match busy enough to overflow the queue is
 * exactly when a reader is least able to spot that it has quietly stopped
 * being one.
 *
 * *Dropping* is what happens instead, and it is lossy only in **notifications**
 * — never in points. The overflow is dropped from the middle, oldest first, so
 * the queue stays a window on the newest; and because a plate's figure is
 * derived as *authoritative minus what is still queued*
 * ({@link LiveReplay.pointsBehind}), an event that is dropped has its points
 * land **that instant**. The reader loses the sentence, not the number.
 *
 * Nothing is lost that cannot be had in full, at leisure and in order, from the
 * [timeline tab](./MatchTimelineTab.tsx) and a player's own
 * [breakdown](../player/PlayerMatchEventsDialog.tsx). This bar is the glance,
 * not the record.
 */
const QUEUE_MAX = Math.floor(LIVE_POLL_MS / REPLAY_MIN_MS)

/**
 * How long each of `count` actions may hold the bar, to drain one poll's batch
 * before the next lands.
 *
 * The budget is fixed **when the batch arrives** rather than recomputed as the
 * queue drains. Recomputing is the tempting version and it overruns: five
 * events at 2000ms each becomes four at 2500ms becomes three at 3000ms, and the
 * window is twelve seconds long by the end of a ten-second poll.
 */
function slotMs(count: number): number {
  const share = LIVE_POLL_MS / Math.max(1, count)
  return Math.min(REPLAY_MAX_MS, Math.max(REPLAY_MIN_MS, share))
}

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
 * What the replay hands the pitch.
 *
 * Two values that have to be read together, because the second is the price of
 * the first: the strip shows one action at a time, so the figures on the
 * portraits must be held back to match it.
 */
export interface LiveReplay {
  /** The action on the bar right now, or nothing between them. */
  event: LiveEvent | undefined
  /**
   * **Points a player has scored that have not been announced yet**, per player
   * id — what the pitch must subtract to show the match as the strip is telling
   * it.
   *
   * ## Why the figure is derived rather than accumulated
   *
   * The obvious build is a second map of *displayed* points, advanced by each
   * event's `p` as it is announced. It is also the one that drifts, and it
   * drifts in three separate ways at once:
   *
   *  - **Reversals are never announced** ({@link toLiveEvent}), so a player can
   *    gain or lose points with no announceable event at all.
   *  - **Over-budget windows drop notifications** ({@link QUEUE_MAX}).
   *  - Any arithmetic disagreement between the summed `p` of the actions and
   *    the total Kickbase states for the player — which is not guaranteed and
   *    has not been measured to the last point.
   *
   * Each of those is an accumulator quietly diverging from the truth, over
   * ninety minutes, on a screen whose whole claim is that it agrees with the
   * official app.
   *
   * So nothing is accumulated. This is the sum of the `p` of every event still
   * **queued behind** the one on the bar, and the pitch draws
   * `authoritative − pointsBehind`. Every one of the three failures then costs
   * a notification and nothing else:
   *
   *  - a reversal is in no queue, so it lands the moment the poll brings it;
   *  - a dropped event leaves the queue, so its points land that instant;
   *  - drift cannot exist, because the authoritative figure is the *base* of
   *    every sum rather than a value being chased.
   *
   * **When the queue drains, this map is empty**, so displayed points are
   * exactly authoritative points — the invariant that makes the replay honest,
   * enforced by construction rather than by a reconciliation step that could
   * be forgotten.
   *
   * Empty whenever the stream is off, which is what makes the bell snap the
   * pitch back to the plain truth.
   */
  pointsBehind: Map<string, number>
  /**
   * How long the current action holds the bar — {@link slotMs} of the batch it
   * arrived in. The pitch sizes its count-up against it, so the figure settles
   * before the next action is announced.
   */
  slotMs: number
}

/**
 * **What just happened, one action at a time — and the points landing with it.**
 *
 * Turns the per-player action lists the
 * [points fan-out](../../api/hooks/useMatchdayPoints.ts) is already polling
 * into a stream: whatever appeared since the last look, announced one at a
 * time, newest queued behind.
 *
 * ## The points move *with* the notification, not ahead of it
 *
 * This is the whole reason the hook returns a map as well as an event. The poll
 * lands a batch every ten seconds; before this, the portraits took the new
 * totals **immediately** and the strip then spent the next twenty seconds
 * working through the actions that had caused them. So the number changed, and
 * then — several actions later, or never, if the queue overflowed — something
 * explained it. The two halves of one event, told out of order.
 *
 * Now the batch is replayed: the figures are wound back by everything still
 * queued ({@link LiveReplay.pointsBehind}) and released one action at a time,
 * so a portrait's number moves **at the moment its action is named**. The club
 * total in the corner follows for free, because it is the sum of the same
 * figures.
 *
 * The replay is paced to drain inside one poll — see {@link slotMs} — so it is
 * caught up, not merely behind: a quiet window holds each action for three
 * seconds, a busy one hurries, and one busier than {@link QUEUE_MAX} drops
 * notifications rather than falling behind the match.
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
 * not the instant it happens on the grass. The replay spreads that batch back
 * out over the ten seconds; it cannot recover *when* inside them each action
 * really happened, which is what `mt` is for and why the rows are ordered by
 * it.
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
 * that happens — not the twenty minutes the reader chose not to watch. The
 * points are *not* held back while it is off: a switched-off stream has nothing
 * to be in step with, so the pitch shows the authoritative figures plainly.
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
}): LiveReplay {
  const names = useEventTypeNames(enabled)

  /**
   * The queue and the budget it was admitted under, in **one** piece of state.
   *
   * They are set together and read together: a slot length belongs to the batch
   * that produced it, and holding them apart invites a render where a new
   * queue is being drained at the old batch's pace.
   */
  const [replay, setReplay] = useState<{
    queue: LiveEvent[]
    slot: number
  }>({ queue: [], slot: REPLAY_MAX_MS })
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
   * first, and for the points that frame is the exact bug this replay exists
   * to remove — the whole batch landing on the portraits before a word is said
   * about any of it.
   *
   * They are pure, which is what makes that safe. Nothing is mutated: the seen
   * set is rebuilt rather than added to, and the queue is handed a value rather
   * than an updater. React re-invokes a component that sets state while
   * rendering — twice over in StrictMode — so anything that *accumulated* here
   * would accumulate twice. Recomputing from the same inputs cannot.
   */

  // Switched off mid-queue, the bar clears rather than finishing what it had
  // lined up: the bell is a request for quiet now. The held-back points are in
  // the queue, so emptying it releases them in the same breath — off means the
  // plain, authoritative pitch, immediately.
  if (wasEnabled !== enabled) {
    setWasEnabled(enabled)
    if (!enabled) setReplay({ queue: [], slot: REPLAY_MAX_MS })
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
      /*
       * In the order they happened: by minute, then by id for stability.
       * `mt` is the only clock on a `PlayerCenterEvent` — there is no
       * timestamp field — so two actions in the same minute are ordered by
       * `<playerId>:<ei>`, which is arbitrary but *fixed*, and a stable
       * arbitrary order beats one that reshuffles between renders.
       */
      fresh.sort((a, b) => a.minute - b.minute || a.id.localeCompare(b.id))
      const queue = append(replay.queue, fresh)
      setReplay({ queue, slot: slotMs(queue.length) })
    }
  }

  /*
   * The one thing here that is a genuine outside system: a clock. It advances
   * on the *head* rather than on the queue, so appending to the tail does not
   * restart the slot of whatever is being read right now.
   *
   * It does restart when the **budget** changes under a head that is still
   * showing, which happens only when a batch lands on a queue that has not
   * drained — an over-budget window. The head then gets up to one extra slot,
   * which at the floor is 400ms and at worst 3s against a 10s poll. Bounded,
   * self-correcting on the next empty queue, and cheaper than giving every
   * event its own deadline to carry.
   */
  const showing = replay.queue[0]
  const showingId = showing?.id
  const slot = replay.slot
  useEffect(() => {
    if (showingId === undefined) return
    const timer = setTimeout(() => {
      setReplay((current) => ({ ...current, queue: current.queue.slice(1) }))
    }, slot)
    return () => {
      clearTimeout(timer)
    }
  }, [showingId, slot])

  /*
   * What the pitch must hold back. **Everything behind the head**, because the
   * head's points are landing right now — that is what it means for it to be on
   * the bar. An empty queue therefore yields an empty map, which is the
   * drained-equals-authoritative invariant, unwritten.
   */
  const pointsBehind = new Map<string, number>()
  if (enabled) {
    for (const event of replay.queue.slice(1)) {
      pointsBehind.set(
        event.playerId,
        (pointsBehind.get(event.playerId) ?? 0) + event.points,
      )
    }
  }

  return {
    event: enabled ? showing : undefined,
    pointsBehind,
    slotMs: slot,
  }
}
