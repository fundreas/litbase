import { useSyncExternalStore } from 'react'

import { readJson, writeJson } from '@/lib/storage'

/**
 * **What you think a player will score**, per matchday, kept on this device.
 *
 * A guess is not a fact Kickbase holds — there is no endpoint for it and no
 * other manager can see it — so it lives in `localStorage` and nowhere else.
 * The shape is `matchday → playerId → points`, which is the only arrangement
 * that answers the two questions asked of it: *what did I put down for this
 * player this week* (the badge on his row) and *what does my eleven add up to*
 * (the chip over the pitch).
 *
 * **Nothing is ever pruned.** Last week's guesses stay where they are once the
 * matchday rolls over, so a season's worth of them accumulates — that is
 * deliberate: they cost a few hundred bytes and they are the raw material for
 * ever asking "how good are my guesses?". Only an explicit deletion of a
 * single entry removes anything.
 *
 * ## Why a store and not a `useState`
 *
 * Three places read this and one of them writes it: the row shows a badge, the
 * pitch shows a total, and the dialog sets the number. They sit in different
 * branches of the tree — the list and the lineup are alternate views — so
 * threading the value through props would mean lifting it to the page and
 * handing every view a setter it mostly does not use. A module-level store
 * read through `useSyncExternalStore` gives all three the same value, updates
 * every one of them on a write, and survives the view switch that unmounts two
 * of them.
 */

const STORAGE_KEY = 'litbase.playerExpectedPoints.v1'

/** What the dialog opens with when nothing has been entered yet. */
export const DEFAULT_EXPECTED_POINTS = 100

/** `matchday → playerId → points`, exactly as it is stored. */
type ExpectedPointsStore = Record<string, Record<string, number>>

/** One matchday's guesses, as the components read them. */
export type ExpectedPointsByPlayer = Readonly<Record<string, number>>

/**
 * The answer for a matchday nobody has guessed on — and for no matchday at
 * all, which is what every consumer sees while the fixture list loads.
 *
 * One frozen constant rather than a fresh `{}` per call: `getSnapshot` must
 * return the same reference until something actually changes, or React
 * re-renders forever.
 */
const EMPTY: ExpectedPointsByPlayer = Object.freeze({})

let cache: ExpectedPointsStore | undefined
const listeners = new Set<() => void>()

/**
 * Whatever is in storage, sanitised.
 *
 * `localStorage` is editable by hand and outlives every version of this app,
 * so the parsed value is treated as untrusted: anything that is not a finite
 * number under two levels of plain object is dropped rather than allowed to
 * reach `toFixed` somewhere downstream.
 */
function load(): ExpectedPointsStore {
  const raw = readJson<unknown>(STORAGE_KEY)
  const store: ExpectedPointsStore = {}
  if (raw === null || typeof raw !== 'object') return store

  for (const [matchday, entries] of Object.entries(raw)) {
    if (entries === null || typeof entries !== 'object') continue
    const clean: Record<string, number> = {}
    for (const [playerId, value] of Object.entries(
      entries as Record<string, unknown>,
    )) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        clean[playerId] = value
      }
    }
    if (Object.keys(clean).length > 0) store[matchday] = clean
  }

  return store
}

function snapshot(): ExpectedPointsStore {
  cache ??= load()
  return cache
}

function emit(): void {
  for (const listener of listeners) listener()
}

/**
 * Another tab's write, adopted here.
 *
 * The `storage` event only fires in the *other* documents, which is exactly
 * what is wanted: this tab already updated itself in {@link write}. Dropping
 * the cache rather than parsing the event's `newValue` keeps one parse path.
 */
function onStorage(event: StorageEvent): void {
  if (event.key !== null && event.key !== STORAGE_KEY) return
  cache = undefined
  emit()
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener('storage', onStorage)
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('storage', onStorage)
  }
}

/**
 * Replace the whole store, in memory and on disk, and tell everyone.
 *
 * The in-memory copy is swapped **whether or not the write lands**: storage
 * can be unavailable — private mode, a full quota — and a guess that vanishes
 * the moment it is typed is worse than one that is merely forgotten on the
 * next reload. Every value here is disposable by nature.
 */
function write(next: ExpectedPointsStore): void {
  cache = next
  writeJson(STORAGE_KEY, next)
  emit()
}

/** One matchday's guesses. A stable reference until something changes. */
export function expectedPointsFor(
  matchday: number | undefined,
): ExpectedPointsByPlayer {
  if (matchday === undefined) return EMPTY
  return snapshot()[String(matchday)] ?? EMPTY
}

/** Put a guess down for one player on one matchday. */
export function setExpectedPoints(
  matchday: number,
  playerId: string,
  value: number,
): void {
  const key = String(matchday)
  const store = snapshot()
  write({ ...store, [key]: { ...store[key], [playerId]: value } })
}

/**
 * Take one player's guess back.
 *
 * The only thing that ever removes anything — and it removes exactly one
 * entry. A matchday left with no guesses at all drops out too, because an
 * empty map is not a record of anything; the matchdays that still hold
 * guesses are untouched, now and forever.
 */
export function clearExpectedPoints(matchday: number, playerId: string): void {
  const key = String(matchday)
  const store = snapshot()
  const entries = store[key]
  if (entries === undefined || !(playerId in entries)) return

  const { [playerId]: _removed, ...rest } = entries
  const { [key]: _day, ...others } = store
  write(Object.keys(rest).length === 0 ? others : { ...others, [key]: rest })
}

/**
 * The guesses for one matchday, re-rendering the caller when they change.
 *
 * `undefined` while the fixture list is still loading — the matchday number
 * comes from the same query as the fixtures — and then the empty record, so a
 * component never has to branch on "not known yet".
 */
export function useExpectedPoints(
  matchday: number | undefined,
): ExpectedPointsByPlayer {
  return useSyncExternalStore(
    subscribe,
    () => expectedPointsFor(matchday),
    () => EMPTY,
  )
}

/**
 * What a set of players is expected to score between them, and how many of
 * them have actually been guessed at.
 *
 * The count travels with the sum because the sum alone is a half-truth: 480
 * points off four players and 480 off eleven mean very different things, and
 * the reader has no way to tell them apart from the total.
 */
export function expectedPointsTotal(
  players: readonly { id: string }[],
  expected: ExpectedPointsByPlayer,
): { total: number; count: number } {
  let total = 0
  let count = 0

  for (const player of players) {
    const value = expected[player.id]
    if (value === undefined) continue
    total += value
    count += 1
  }

  return { total, count }
}
