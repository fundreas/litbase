/**
 * How often the app re-reads things that change **while a match is being
 * played**.
 *
 * One module because this is a policy, not an implementation detail of any one
 * hook: five hooks had their own `LIVE_POLL_MS = 60_000` and changing the feel
 * of a live matchday meant changing all five and hoping none was missed.
 */

/**
 * The live rate: **ten seconds.**
 *
 * A minute was too slow to be worth watching. A goal in the 63rd minute could
 * sit unreported until the 64th, and points that arrive in a lump every sixty
 * seconds read as a page that has stalled rather than one that is following a
 * match. Ten seconds is short enough that the number under a portrait moves
 * while you are looking at it.
 *
 * It is charged **per running subject**, and callers already narrow that as far
 * as it goes:
 *
 *  - [`useLiveMatches`](./hooks/useLiveMatches.ts) — per match, and only ones
 *    that have kicked off and are not over.
 *  - [`useMatchDetails`](./hooks/useMatchDetails.ts) — the one match on screen.
 *  - [`useMatchdayPoints`](./hooks/useMatchdayPoints.ts) — per player, and only
 *    those whose own club match is under way. This is the expensive one: a
 *    full fixture's thirty-six players cost thirty-six requests a tick, so a
 *    match page open on the lineup tab is the heaviest thing the app does. It
 *    is bounded by the players actually playing, it stops dead at the final
 *    whistle, and it pauses whenever the tab is not focused.
 *
 * Nothing polls at this rate outside a running match, which is the whole point
 * of gating it per subject rather than per page.
 */
export const LIVE_POLL_MS = 10_000

/**
 * The rate for the **season fixture list**, which stays at a minute.
 *
 * Deliberately not the live rate. That payload is the whole season in one
 * response and the only thing in it that moves during a matchday is `st`, the
 * flag that says a match is over — so it is worth re-reading around the final
 * whistle and worth nothing in between. Polling a season every ten seconds to
 * learn a boolean would be the app's largest response fetched for its smallest
 * fact.
 *
 * The live score deliberately does not come from there — see
 * [`useLiveMatches`](./hooks/useLiveMatches.ts).
 */
export const MATCHDAY_STATE_POLL_MS = 60_000
