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
const configuredOffsetMs = parseOffset(env.devProfile?.now)

let offsetMs = configuredOffsetMs ?? 0

/**
 * `VITE_NOW` as an offset from the real clock, or `undefined` when it is not
 * set (or is not readable).
 *
 * Accepts an absolute instant or a relative offset; anything unparseable is
 * ignored with a warning rather than throwing, because a typo in a dev
 * variable should not take the app down. The `undefined` matters beyond
 * "nothing to do": it is what tells {@link isClockPinned} apart from a
 * deliberate `VITE_NOW=+0h`.
 */
function parseOffset(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined
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
  return undefined
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
 *
 * **A clock pinned by `VITE_NOW` is not moved.** An explicit instant is a
 * more specific instruction than "an hour into the matchday", so the two
 * compose rather than fight: the simulation still makes its matchday live,
 * and you decide where in it you are standing.
 */
export function shiftClockTo(timestamp: number): void {
  if (env.devProfile === undefined || isClockPinned()) return
  offsetMs = timestamp - Date.now()
}

/** True when the app is not living in real time. Drives the dev badge. */
export function isClockShifted(): boolean {
  return offsetMs !== 0
}

/**
 * True when `VITE_NOW` set the clock, rather than the simulation anchoring it.
 *
 * The distinction is only about **who wins**: a pinned clock is an instruction
 * from the person running the app and outranks the simulation's default.
 */
export function isClockPinned(): boolean {
  return configuredOffsetMs !== undefined
}
