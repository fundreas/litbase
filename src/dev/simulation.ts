/**
 * The **live development profile**: make a matchday that has already been
 * played behave as if it were being played right now.
 *
 * `npm run dev:live`. Everything else — `npm run dev`, every build — is
 * untouched, and the whole module is inert unless a dev profile asks for it.
 *
 * ## Why a payload rewrite rather than only a clock
 *
 * Moving [the clock](../lib/clock.ts) alone does not work, and the reason is
 * worth stating because it looks like it should. Whether a matchday is over is
 * **not** a comparison against the clock: `SeasonMatchday.isFinished` comes
 * from every fixture reporting `st === 2`, a flag the server sets. So:
 *
 *  - Shift the clock **forward** into the next matchday and the app does go
 *    live — but `ph` holds no points for a matchday nobody has played, so
 *    every row reads `–` and the total sits at zero. The states are testable,
 *    the numbers are not.
 *  - Shift it **back** into a played matchday and every fixture still says
 *    finished, so nothing is live at all — with the real points sitting right
 *    there in `ph`, unreachable.
 *
 * Hence this: the clock moves *and* the fixture list is rewritten so the
 * chosen matchday reports itself unfinished. Both then agree, and everything
 * downstream is genuinely real — real fixtures, real per-player points out of
 * `ph`, real standings for that `dayNumber`. Nothing is mocked; one
 * flag and one number are bent.
 *
 * ## What it costs in honesty
 *
 * **Only the clock is fake.** A replayed matchday reports itself unfinished,
 * which is what makes it live, and the pages still show the squad that was
 * actually fielded: the [matchday snapshot](../api/hooks/useMatchdaySquad.ts)
 * is used as soon as its lineup looks complete rather than only once a
 * matchday is over — which is precisely the case a simulated matchday is in.
 * So the fixtures, the players, the lineups and the points are all real. That
 * makes this convincing enough to be mistaken for a live result an hour later,
 * which is why the badge in the header says loudly that the app is
 * simulating.
 *
 * ## Adding another transform
 *
 * One function per wire payload, called from that payload's `queryFn` — the
 * single place it enters the app, before mapping, so every consumer and the
 * query cache see the same thing. {@link simulateMatchdays} is the only one
 * needed so far: it is what `day`, `st` and the clock all come from.
 */

import type { MatchdaysResponse } from '@/api/types'
import { isClockPinned, nowMs, shiftClockTo } from '@/lib/clock'
import { env } from '@/lib/env'

/** `st` on a fixture: what the server says about a match. */
const STATUS_UPCOMING = 0
const STATUS_FINISHED = 2

/**
 * How long a simulated match takes, kick-off to final whistle.
 *
 * 90 minutes plus a half-time and stoppage — near enough that a matchday one
 * hour in has its early kick-offs *running* and, three hours in, finished.
 */
const MATCH_MINUTES = 110

/** How far into the matchday the profile starts, when nothing says otherwise. */
const DEFAULT_MINUTE = 60

const MINUTE_MS = 60_000

export interface Simulation {
  /** The matchday being replayed. */
  day: number
  /**
   * Where the clock stands, in minutes past that matchday's first kick-off.
   *
   * **Measured, not configured** — so it stays truthful when `VITE_NOW` pinned
   * the clock somewhere other than `VITE_SIMULATE_MINUTE` would have put it.
   * Negative means the clock sits *before* the first kick-off, which is a
   * legitimate thing to want to look at (the matchday then reads `upcoming`,
   * and the Live tab is correctly absent).
   */
  minute: number
}

/**
 * Set once, when the fixture list first arrives — the anchor is that
 * matchday's earliest kick-off, which only the payload knows.
 *
 * Once set it is never moved: re-anchoring on every refetch would reset the
 * simulated matchday to minute 60 each time the window regained focus, so it
 * would never appear to progress.
 */
let active: Simulation | null = null

/** What the profile is currently pretending, or `null` when living in real time. */
export function activeSimulation(): Simulation | null {
  return active
}

/** Is the live profile on at all? Cheap, and safe to call during render. */
export function isSimulationEnabled(): boolean {
  const profile = env.devProfile
  if (profile === undefined) return false
  return profile.isLiveProfile || profile.matchday !== undefined
}

function configuredNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/**
 * The fixture list, with one matchday made live.
 *
 * Called from `useMatchdaysQuery`'s `queryFn` — see
 * [`useMatchday`](../api/hooks/useMatchday.ts). Returns its input untouched
 * unless the profile is on, so the production path is one boolean.
 *
 * Two edits, and no more:
 *
 *  1. **`day`** becomes the simulated matchday, so everything that asks the
 *     competition what is current gets that answer — the squad page's Live
 *     tab, the duel picker's default, the matchday every points lookup is for.
 *     The lookup *inside* `ph` is anchored on the player payload's own `day`,
 *     which is not simulated, so a replayed matchday still reads its own real
 *     points rather than following the bent number.
 *  2. **`st`** on that matchday's fixtures is recomputed from the simulated
 *     clock: finished once the match would be over, upcoming otherwise. A
 *     fixture that has not kicked off yet also has its goals stripped, since
 *     the real payload carries the final score of a match that, in here, has
 *     not started.
 */
export function simulateMatchdays(data: MatchdaysResponse): MatchdaysResponse {
  const profile = env.devProfile
  if (profile === undefined || !isSimulationEnabled()) return data

  // Default: the matchday most recently played. It is the one with a full set
  // of real points, which is the whole reason to replay a past matchday, and
  // it needs no configuration to stay correct as the season moves on.
  const day = configuredNumber(profile.matchday) ?? Math.max(1, data.day - 1)
  const minute = configuredNumber(profile.minute) ?? DEFAULT_MINUTE

  const matchday = (data.it ?? []).find((entry) => entry.day === day)
  if (matchday === undefined) {
    console.warn(
      `[simulation] matchday ${String(day)} is not in the fixture list — running in real time.`,
    )
    return data
  }

  const kickoffs = (matchday.it ?? [])
    .map((fixture) => Date.parse(fixture.dt))
    .filter((value) => !Number.isNaN(value))
  const firstKickoff = kickoffs.length === 0 ? undefined : Math.min(...kickoffs)

  if (firstKickoff === undefined) {
    console.warn(
      `[simulation] matchday ${String(day)} has no kick-off times — running in real time.`,
    )
    return data
  }

  if (active === null) {
    // A no-op when `VITE_NOW` pinned the clock — an explicit instant outranks
    // this default, and the two compose: the matchday still goes live, the
    // person running the app still chooses where in it they stand.
    shiftClockTo(firstKickoff + minute * MINUTE_MS)
    active = {
      day,
      minute: Math.round((nowMs() - firstKickoff) / MINUTE_MS),
    }
    console.info(
      `[simulation] matchday ${String(day)}, minute ${String(active.minute)} — the clock reads ${new Date(nowMs()).toISOString()}${isClockPinned() ? ' (pinned by VITE_NOW)' : ''}.`,
    )
  }

  const at = nowMs()

  return {
    ...data,
    day,
    it: (data.it ?? []).map((entry) =>
      entry.day !== day
        ? entry
        : {
            ...entry,
            it: (entry.it ?? []).map((fixture) => {
              const kickoff = Date.parse(fixture.dt)
              if (Number.isNaN(kickoff)) return fixture

              const hasStarted = kickoff <= at
              const isOver = kickoff + MATCH_MINUTES * MINUTE_MS <= at

              return {
                ...fixture,
                st: isOver ? STATUS_FINISHED : STATUS_UPCOMING,
                t1g: hasStarted ? fixture.t1g : undefined,
                t2g: hasStarted ? fixture.t2g : undefined,
              }
            }),
          },
    ),
  }
}
