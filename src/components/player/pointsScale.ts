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
 * Where the three positive bands begin, ascending.
 *
 * A triple rather than three named constants because the two scales below
 * differ **only** in these numbers — same colours, same meanings, same
 * boundary rule — and pairing them up is what makes that obvious rather than
 * something to be noticed by diffing two functions.
 */
type Thresholds = readonly [good: number, strong: number, elite: number]

/**
 * **One player, one match.** 100 / 200 / 300.
 *
 * The original scale, and the one every player-facing figure in the app uses:
 * the match rows on a player's page, his season grid, the plates on a pitch.
 * 300 is roughly the best game of somebody's season, which is what makes gold
 * mean something.
 */
export const PLAYER_POINTS_BANDS: Thresholds = [100, 200, 300]

/**
 * **A whole club, one matchday.** 800 / 1400 / 2000.
 *
 * A club's yield is the sum of everyone who played — eleven starters and
 * whoever came on, so fourteen to sixteen scores — which puts a routine
 * matchday an order of magnitude above a single player's. Run through
 * {@link PLAYER_POINTS_BANDS} it lands in `elite` every single week, and a
 * column of uniformly gold bars says nothing at all. That is exactly what
 * shipped on the [club page](../../../docs/pages/team.md#the-bar-is-the-rows-bottom-edge)
 * before these existed.
 *
 * The boundaries are calibrated from two things, and both are worth recording
 * because neither is a measurement of the quantity itself:
 *
 *  - **Above 2500 is very rare**, observed from the club page's own Spiele tab
 *    across a season's fixtures. That anchors the top.
 *  - **Individual matchday scores** probed live on Bundesliga matchday 2 ran
 *    150–290 for a fixture's best players, with the long tail well below. A
 *    club fielding ~15 of them at a routine 80–100 lands around 1200–1400.
 *
 * So: below **800** is a bad afternoon, **800–1399** is routine and stays
 * white-to-lime, **1400–1999** is a strong week, and **2000** and up is the
 * gold that 300 is for a player — occasional, notable, and comfortably short
 * of the 2500 that almost never happens.
 *
 * **Calibrated by eye, not measured.** Nothing has counted the distribution of
 * club matchday totals across a season; the numbers above are a defensible
 * reading of two indirect signals. If the bars turn out to skew, this triple is
 * the one place to change and every consumer follows.
 */
export const TEAM_POINTS_BANDS: Thresholds = [800, 1400, 2000]

/**
 * Which band a score falls in, on whichever scale it is measured against.
 *
 * Boundaries are **inclusive at the bottom**: on the player scale 100 is
 * already `good`, 200 is `strong`, 300 is `elite`. A score sitting exactly on a
 * boundary should read as the achievement it just reached, not the one it just
 * left.
 *
 * The scale is an **explicit argument with no default**. A default would be a
 * silent invitation to colour a club's 1300 as though it were a player's, which
 * is the bug these thresholds exist to fix — and the wrong answer looks
 * perfectly plausible, since it is a real colour on a real scale.
 */
export function pointsBand(points: number, bands: Thresholds): PointsBand {
  const [good, strong, elite] = bands
  if (points < 0) return 'negative'
  if (points < good) return 'low'
  if (points < strong) return 'good'
  if (points < elite) return 'strong'
  return 'elite'
}

/** The colour for a score, ready for a `style` prop. */
export function pointsColor(points: number, bands: Thresholds): string {
  return BAND_COLOR[pointsBand(points, bands)]
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
