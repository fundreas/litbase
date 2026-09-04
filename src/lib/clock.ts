/**
 * The app's notion of *now*.
 *
 * Everything that decides whether a match has kicked off, whether a matchday
 * is running, or whether a player can still score reads the clock through
 * {@link nowMs} — never `Date.now()` directly. That single seam is what lets
 * the [live development profile](../dev/simulation.ts) put the app inside a
 * matchday that is not currently being played, which is otherwise only
 * testable for a few hours a week.
 *
 * **The offset is football time only.** Session expiry, token refresh and
 * anything else in [`auth`](../auth) deliberately keep using `Date.now()`: a
 * clock shifted a week back would make a perfectly good token look expired,
 * and one shifted forward would fire the refresh timer immediately. The two
 * notions of time are genuinely different here, and conflating them wastes an
 * afternoon.
 *
 * In a production build the offset is nailed to zero — {@link env.devProfile}
 * is `undefined` unless `import.meta.env.DEV` — so `nowMs()` is `Date.now()`
 * with one addition.
 */

import { env } from '@/lib/env'

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/** `+36h`, `-90m`, `2d` — a signed offset from the real clock. */
const OFFSET_PATTERN = /^([+-]?)(\d+(?:\.\d+)?)(m|h|d)$/

const UNIT_MS: Record<string, number> = {
  m: MINUTE_MS,
  h: HOUR_MS,
  d: DAY_MS,
}

/**
 * How far ahead of the real clock the app believes it is, in milliseconds.
 *
 * Module state rather than context, because {@link nowMs} is called from pure
 * functions in [`models`](../api/models.ts) that have no business taking a
 * React dependency — and because there is exactly one clock.
 */
let offsetMs = parseOffset(env.devProfile?.now)

/**
 * `VITE_NOW` as an offset from the real clock.
 *
 * Accepts an absolute instant or a relative offset; anything unparseable is
 * ignored with a warning rather than throwing, because a typo in a dev
 * variable should not take the app down.
 */
function parseOffset(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return 0
  const raw = value.trim()

  const relative = OFFSET_PATTERN.exec(raw)
  if (relative !== null) {
    const [, sign, amount, unit] = relative
    const unitMs = UNIT_MS[unit ?? '']
    if (unitMs !== undefined) {
      return Number(amount) * unitMs * (sign === '-' ? -1 : 1)
    }
  }

  const absolute = Date.parse(raw)
  if (!Number.isNaN(absolute)) return absolute - Date.now()

  console.warn(
    `[clock] VITE_NOW="${raw}" is neither an instant nor an offset like "+36h" — ignored.`,
  )
  return 0
}

/**
 * Now, as the app should understand it. Real time unless a dev profile has
 * moved it, and it **keeps ticking** either way — the offset is added to the
 * real clock rather than freezing it, so a simulated matchday progresses while
 * you watch it.
 */
export function nowMs(): number {
  return Date.now() + offsetMs
}

/**
 * Put the clock at `timestamp`. Dev profiles only; ignored in a build.
 *
 * Called once by the simulation, from the moment it first sees the fixture
 * list — the anchor it needs (a matchday's first kick-off) lives in that
 * payload, so the offset cannot be known from the env alone.
 */
export function shiftClockTo(timestamp: number): void {
  if (env.devProfile === undefined) return
  offsetMs = timestamp - Date.now()
}

/** True when the app is not living in real time. Drives the dev badge. */
export function isClockShifted(): boolean {
  return offsetMs !== 0
}
