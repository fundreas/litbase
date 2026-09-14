import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { get } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import { qk } from '@/api/queryKeys'
import type { BonusCollectItem, BonusCollectResponse } from '@/api/types'
import { useAuth } from '@/auth/useAuth'

/**
 * The daily login bonus (*Auflaufprämie*), collected for the reader.
 *
 * `GET /v4/bonus/collect` is **a write dressed as a `GET`**: calling it *is*
 * collecting, and nothing anywhere reads the pending state — so there is no
 * "you have a bonus waiting" to show and no way to check first. The only
 * sensible policy is to take it, which is what the Kickbase app does when it
 * opens. Here that means:
 *
 *  - **once when the app boots** with a session, and
 *  - **once per midnight after that**, for the tab that stays open overnight.
 *
 * The money lands in *every* league at once, which is why this sits at the
 * authenticated root ([`RequireAuth`](../../auth/RequireAuth.tsx)) rather than
 * anywhere league-scoped: it must not fire again when the league switches.
 *
 * Nothing is rendered from it. The bonus shows up where it always did — in
 * the budget, and in the [activity feed](./useActivities.ts) as a type-`22`
 * entry — so all this hook owes the UI is an invalidation of the two.
 *
 * Failure is deliberately quiet. A bonus that does not arrive is not worth a
 * screen, and what an already-collected day answers is unknown (see
 * [docs/api/user.md](../../../docs/api/user.md#get-v4bonuscollect)) — a `4xx`
 * for "already taken today" is a perfectly plausible shape, and it must not
 * reach the user as an error.
 */
export function useDailyBonus(): void {
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (!isAuthenticated) return

    let timer: number | undefined
    let cancelled = false

    const run = async () => {
      const credits = await collectDailyBonus()
      if (cancelled) return

      if (credits.length > 0) await settleCredits(queryClient, credits)
      if (cancelled) return

      // Rescheduled after each run rather than on an interval: the next
      // midnight is measured from the clock, so a device that slept through
      // one, or a throttled background tab that fired late, still lands on the
      // right one instead of drifting a run further behind every night.
      timer = window.setTimeout(() => void run(), msUntilAfterMidnight())
    }

    void run()

    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [isAuthenticated, queryClient])
}

/**
 * The local date the last collect was made for, `YYYY-MM-DD`.
 *
 * Module state, because the thing it protects is an account-wide write and not
 * one component's business: React's StrictMode mounts every effect twice in
 * development, a sign-out and back in remounts it, and none of those are a new
 * day. A full page reload does clear it, which is the intent — that *is* the
 * app opening again, and the server is the one that knows whether anything is
 * still owed.
 */
let collectedOn: string | null = null

/**
 * Take today's bonus, and answer what was paid — an empty list when there was
 * nothing to take, when it has already been taken in this session, or when the
 * request failed.
 */
async function collectDailyBonus(): Promise<BonusCollectItem[]> {
  const today = dayKey()
  if (collectedOn === today) return []
  // Claimed **before** the request, not after: two effects mounting in the
  // same tick must produce one collect, not two.
  collectedOn = today

  try {
    const data = await get<BonusCollectResponse>(endpoints.bonus.collect)
    return data.it ?? []
  } catch (error) {
    // A request that never arrived is not a day that was collected — let the
    // next attempt have it. Unless midnight has passed in the meantime, in
    // which case the claim belongs to the day after this one.
    if (collectedOn === today) collectedOn = null
    console.warn('[bonus] Auflaufprämie konnte nicht abgeholt werden.', error)
    return []
  }
}

/** Drop what the credits just made stale: the budgets, and the feed. */
async function settleCredits(
  queryClient: QueryClient,
  credits: BonusCollectItem[],
): Promise<void> {
  await Promise.all([
    // Carries `b` per league, so one credit dates the whole list.
    queryClient.invalidateQueries({ queryKey: qk.leagues.selection() }),
    ...credits.flatMap((credit) => [
      queryClient.invalidateQueries({ queryKey: qk.leagueMe(credit.li) }),
      queryClient.invalidateQueries({ queryKey: qk.activities(credit.li) }),
    ]),
  ])
}

/**
 * Milliseconds until just after the next local midnight.
 *
 * **The real clock, not [`nowMs()`](../../lib/clock.ts)**: the streak is the
 * server's calendar day, and a dev profile that shifts football time a week
 * forward has no business either skipping a collect or firing one immediately.
 * Same reasoning as the session timers in [`auth`](../../auth).
 */
function msUntilAfterMidnight(): number {
  const now = Date.now()
  const midnight = new Date(now)
  // Hour 24 of today is hour 0 of tomorrow, and `Date` normalises it across
  // month ends and DST for free.
  midnight.setHours(24, 0, 0, 0)
  // A minute past the hour rather than on it: timers are allowed to fire a
  // hair early, and one that does would still read yesterday's date and be
  // swallowed by the guard above — costing the streak a day.
  return midnight.getTime() - now + 60_000
}

/** Today, local, as `YYYY-MM-DD` — the day the bonus is counted in. */
function dayKey(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${String(now.getFullYear())}-${month}-${day}`
}
