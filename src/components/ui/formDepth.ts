/**
 * **How far back each mark on a form strip is, as opacity** — newest first.
 *
 * The last result is at full strength because it is the one that still means
 * something; the fifth is at a quarter because it is over a month ago and the
 * row is making a point about *now*. The curve is steep early and flat late:
 * the difference between last week and the week before matters more than the
 * difference between four weeks ago and five.
 *
 * One table, two strips. A manager's
 * [last five duels](../ranking/DuelFormStrip.tsx) on the standings and a
 * club's [last five results](../team/ClubFormStrip.tsx) on the league table are
 * the same claim about two different competitions, and a reader who learns the
 * fade on one must not meet a second version of it on the other. It is also
 * the same device the Kader row's
 * [fixture track](../squad/FixtureTrack.tsx) runs in the other direction — the
 * future receding to the right rather than the past.
 *
 * Index past the end is `undefined`, which React drops: a strip longer than
 * this would silently lose its fade, so both callers cut to its length.
 */
export const FORM_DEPTH = [1, 0.74, 0.54, 0.38, 0.26]

/** How many marks a form strip shows — the length of {@link FORM_DEPTH}. */
export const FORM_LENGTH = FORM_DEPTH.length
