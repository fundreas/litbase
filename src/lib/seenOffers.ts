import { useSyncExternalStore } from 'react'

import { readJson, writeJson } from '@/lib/storage'

/**
 * **Which bids the reader has already been told about**, per league, kept on
 * this device.
 *
 * The one consumer is the shell's
 * [offer notice](../components/layout/OfferNotice.tsx): the row under the
 * header that says how many managers have bid on a player of yours. Closing
 * that row has to mean "I know about *these* bids" rather than "never show me
 * this again", and the next bid has to bring it back — so what is remembered
 * is a **set of offer ids**, not a flag and not a count. A count would be
 * fooled by one bid pulled and another placed between two polls, which is the
 * case the row exists for.
 *
 * Kickbase holds none of this: there is no "read" state on an offer anywhere
 * in the API, so it lives in `localStorage` and nowhere else. Keyed by league,
 * because the leagues are separate markets and a bid in one says nothing about
 * the other.
 *
 * ## Why a store and not a `useState`
 *
 * Because a dismissal that a refresh undoes is not a dismissal — the row would
 * be back on the next page load, saying the same thing about the same bids. It
 * has to be written down, and once something is written down the copy in React
 * state is a second source of the same truth. A module-level store read
 * through `useSyncExternalStore` keeps one: the notice renders off storage, and
 * a dismissal in one tab is a dismissal in the other, which is the same
 * arrangement [`expectedPoints`](./expectedPoints.ts) uses and for much the
 * same reason.
 */

const STORAGE_KEY = 'litbase.seenOffers.v1'

/** `leagueId → offer ids`, exactly as it is stored. */
type SeenStore = Record<string, string[]>

/**
 * The answer for a league nothing has been dismissed in.
 *
 * One frozen constant rather than a fresh `[]` per call: `getSnapshot` must
 * return the same reference until something actually changes, or React
 * re-renders forever.
 */
const EMPTY: readonly string[] = Object.freeze([])

let cache: SeenStore | undefined
const listeners = new Set<() => void>()

/**
 * Whatever is in storage, sanitised.
 *
 * `localStorage` is editable by hand and outlives every version of this app,
 * so the parsed value is treated as untrusted. Anything that is not a list of
 * strings under a league key is dropped — which shows the row once too often
 * rather than swallowing a bid, the right way round for a notice about money.
 */
function load(): SeenStore {
  const raw = readJson<unknown>(STORAGE_KEY)
  const store: SeenStore = {}
  if (raw === null || typeof raw !== 'object') return store

  for (const [leagueId, ids] of Object.entries(raw)) {
    if (!Array.isArray(ids)) continue
    const clean = ids.filter((id): id is string => typeof id === 'string')
    if (clean.length > 0) store[leagueId] = clean
  }

  return store
}

function snapshot(): SeenStore {
  cache ??= load()
  return cache
}

function emit(): void {
  for (const listener of listeners) listener()
}

/**
 * Another tab's dismissal, adopted here.
 *
 * The `storage` event only fires in the *other* documents, which is what is
 * wanted: this tab already updated itself in {@link markOffersSeen}.
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
 * Take these bids as told — and forget every other id in the league.
 *
 * Storing the ids standing **now** rather than adding to the ones already
 * there is what keeps the entry bounded: an offer that has been accepted,
 * declined or withdrawn cannot come back under the same id, so holding it
 * would only grow the key for the rest of the season.
 *
 * The in-memory copy is swapped **whether or not the write lands** — storage
 * can be unavailable, in private mode or on a full quota — because a row that
 * will not close is worse than one that reappears after a reload.
 */
export function markOffersSeen(leagueId: string, offerIds: string[]): void {
  const next = { ...snapshot(), [leagueId]: offerIds }
  cache = next
  writeJson(STORAGE_KEY, next)
  emit()
}

/**
 * The dismissed ids for one league, re-rendering the caller when they change.
 *
 * A stable reference until something does change, and the empty list for a
 * league with nothing dismissed — so the caller never branches on "not known
 * yet".
 */
export function useSeenOffers(leagueId: string): readonly string[] {
  return useSyncExternalStore(
    subscribe,
    () => snapshot()[leagueId] ?? EMPTY,
    () => EMPTY,
  )
}
