import { useSyncExternalStore } from 'react'

import type { PointcastPrediction } from '@/api/models'
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

/**
 * What the dialog opens with when there is **neither a guess nor a
 * prediction** — a player the model has no file for, or a matchday it has not
 * reached.
 *
 * A round hundred rather than an empty field, for the reason the sheet spells
 * out: it puts the question where it belongs, *more than that or less?*
 */
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
 * **Every matchday's guesses at once**, for the one reader that spans them: a
 * player's [season](../components/player/PlayerPerformanceTab.tsx), where the
 * rows are matchdays rather than players.
 *
 * The store's own shape, handed out as it is stored. A per-player projection
 * would be tidier to use and impossible to return safely — `getSnapshot` has
 * to hand back the same reference until something actually changes, and a
 * fresh object per call re-renders for ever.
 */
export type ExpectedPointsByMatchday = Readonly<
  Record<string, Readonly<Record<string, number>>>
>

export function useAllExpectedPoints(): ExpectedPointsByMatchday {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY_STORE)
}

/** The server-render answer for {@link useAllExpectedPoints}. */
const EMPTY_STORE: ExpectedPointsByMatchday = Object.freeze({})

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
 * **A figure on a row, and where it came from.**
 *
 * The two are inseparable. A prediction and a guess are drawn differently, and
 * a reader who cannot tell them apart cannot tell what he has already decided
 * from what a model decided for him — so nothing in the app carries the number
 * around without the flag.
 */
export interface ExpectedPointsEntry {
  value: number
  /** `true` when the reader typed it, `false` when it is the model's. */
  isOwn: boolean
}

/**
 * **What a player is expected to score, whoever said so** — the reader's guess
 * where he made one, the [pointcast](../api/hooks/usePointcast.ts) prediction
 * everywhere else.
 *
 * A lookup rather than a merged record: the prediction file holds every player
 * in the competition and a screen asks about twenty of them, so building four
 * hundred entries per render to read a squad's worth would be work nobody
 * wants. Construct it with {@link expectedPointsView}, once per set of inputs.
 */
export interface ExpectedPointsView {
  /** The figure that stands for a player, or `undefined` if none does. */
  entry: (playerId: string) => ExpectedPointsEntry | undefined
}

/**
 * The view over one matchday's guesses and predictions.
 *
 * **A guess always wins.** That is the whole rule: the prediction is a
 * default, and the reader typing over it is the point of the feature — the
 * model never gets a second say, not even when it is refreshed afterwards.
 *
 * `predictions` is `undefined` while the file loads, has 404ed, or names a
 * competition the run does not cover, and the view then answers with guesses
 * alone — which is exactly what this feature was before there was a model.
 */
export function expectedPointsView(
  own: ExpectedPointsByPlayer,
  predictions: ReadonlyMap<string, PointcastPrediction> | undefined,
): ExpectedPointsView {
  return {
    entry: (playerId) => {
      const stored = own[playerId]
      if (stored !== undefined) return { value: stored, isOwn: true }

      const predicted = predictions?.get(playerId)
      if (predicted === undefined) return undefined
      return { value: predicted.expected, isOwn: false }
    },
  }
}

/**
 * **What an eleven will end the matchday on**, as far as anything can say
 * yet: the points a player has actually scored, and where he has none, what he
 * is expected to score.
 *
 * `SUM(coalesce(real, own guess, prediction))`, in that order, which is the
 * only order that makes sense — a real score is a fact, a guess is the
 * reader's own correction of the model, and the model is the floor. The three
 * kinds are counted separately because the total alone cannot say what it is:
 * 1.240 off eleven settled matches is a result, and 1.240 off eleven
 * predictions is a projection, and a reader has to be able to tell which he is
 * looking at.
 *
 * **Only the players handed in.** Every caller passes a fielded eleven — the
 * bench scores nothing — and no empty-slot penalty is modelled here: that is
 * the [live header's](../components/squad/LiveTab.tsx) own chip, and folding
 * it in would make this figure disagree with the rows it is drawn over.
 */
export interface ProjectedPoints {
  /** The sum, over every player who contributed anything. */
  total: number
  /** How many contributed a real score. */
  scored: number
  /** How many contributed the reader's own guess. */
  own: number
  /** How many contributed the model's prediction. */
  forecast: number
  /** How many contributed nothing: no points, no guess, no prediction. */
  missing: number
}

export function projectedPointsTotal(
  players: readonly { id: string; points?: number }[],
  expected: ExpectedPointsView,
): ProjectedPoints {
  const result: ProjectedPoints = {
    total: 0,
    scored: 0,
    own: 0,
    forecast: 0,
    missing: 0,
  }

  for (const player of players) {
    if (player.points !== undefined) {
      result.total += player.points
      result.scored += 1
      continue
    }

    const entry = expected.entry(player.id)
    if (entry === undefined) {
      result.missing += 1
      continue
    }

    result.total += entry.value
    if (entry.isOwn) result.own += 1
    else result.forecast += 1
  }

  return result
}

/** Is any of this total still a projection rather than a result? */
export function isProjection(projected: ProjectedPoints): boolean {
  return projected.own + projected.forecast > 0
}

/**
 * What a set of players is expected to score between them, and how much of
 * that the reader stands behind himself.
 *
 * The counts travel with the sum because the sum alone is a half-truth: 480
 * points off four players and 480 off eleven mean very different things, and
 * the reader has no way to tell them apart from the total. {@link ownCount} is
 * the second half of the same point — a total that is all model is a different
 * claim from one the reader put together himself.
 */
export function expectedPointsTotal(
  players: readonly { id: string }[],
  expected: ExpectedPointsView,
): { total: number; count: number; ownCount: number } {
  let total = 0
  let count = 0
  let ownCount = 0

  for (const player of players) {
    const entry = expected.entry(player.id)
    if (entry === undefined) continue
    total += entry.value
    count += 1
    if (entry.isOwn) ownCount += 1
  }

  return { total, count, ownCount }
}
