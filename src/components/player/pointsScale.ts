/**
 * How a matchday score is coloured.
 *
 * Kickbase points have no natural ceiling and no scale a newcomer knows, so a
 * bare number says little on its own: 87 is a quiet afternoon, 340 is the best
 * game of someone's season, and nothing about the digits says which. Five
 * bands turn the figure into a judgement you can read without stopping.
 *
 * Colours are **literals rather than theme tokens**, for the same reason the
 * lineup-probability badge uses literals: this is a five-step scale and the
 * palette has one green, one red and one amber. Borrowing `accent` for a band
 * would also make a passive number compete with every control on the page.
 *
 * The ramp is deliberately not a simple dark→bright one. It runs red, white,
 * lime, green, gold — white is the unremarkable middle, and the top band is
 * gold because a 300-point game is a trophy, not just more green.
 */
export type PointsBand = 'negative' | 'low' | 'good' | 'strong' | 'elite'

const BAND_COLOR: Record<PointsBand, string> = {
  negative: 'oklch(0.68 0.19 22)',
  low: 'oklch(0.97 0.005 260)',
  good: 'oklch(0.85 0.2 130)',
  strong: 'oklch(0.65 0.17 150)',
  elite: 'oklch(0.86 0.17 92)',
}

/**
 * Which band a score falls in.
 *
 * Boundaries are **inclusive at the bottom**: 100 is already `good`, 200 is
 * `strong`, 300 is `elite`. A score sitting exactly on a boundary should read
 * as the achievement it just reached, not the one it just left.
 */
export function pointsBand(points: number): PointsBand {
  if (points < 0) return 'negative'
  if (points < 100) return 'low'
  if (points < 200) return 'good'
  if (points < 300) return 'strong'
  return 'elite'
}

/** The colour for a score, ready for a `style` prop. */
export function pointsColor(points: number): string {
  return BAND_COLOR[pointsBand(points)]
}

/**
 * How full the bar under a match row should be, as a fraction of its track.
 *
 * A **negative score does not grow the bar.** Scaling it by magnitude would
 * draw a long bar for a bad game, and a long bar reads as good however it is
 * coloured. It gets a short fixed marker instead — enough to show the row is
 * below zero at a glance, with the red figure beside it carrying the amount.
 */
export function pointsFraction(points: number, scale: number): number {
  if (points < 0) return 0.05
  if (scale <= 0) return 0
  return Math.min(1, points / scale)
}
