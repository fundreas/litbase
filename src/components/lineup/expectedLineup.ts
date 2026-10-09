import {
  EXPECTED_STATUS_LABEL,
  EXPECTED_TIER,
  type ExpectedPlayer,
  type ExpectedStatus,
  type ExpectedTier,
} from '@/api/models'
import { PLAYER_AVAILABILITY } from '@/api/types'

/**
 * The run's own status word as Kickbase's `st` code, so the predicted sheets
 * can wear the **same availability mark as every other screen**: the red cross
 * and the red card of
 * [`PlayerStatusBadge`](../squad/PlayerStatusBadge.tsx).
 *
 * `fit` and `unknown` map to nothing, which is what the badge renders for
 * `FIT` anyway — the two are different claims about why there is no mark, and
 * neither is a claim worth a glyph.
 *
 * `absent` takes the plain cross rather than a mark of its own: the file uses
 * it for "not available", without saying why, and three shades of red disc is
 * a legend nobody reads. The tooltip carries the actual word.
 */
export function expectedStatusCode(status: ExpectedStatus | undefined): number {
  switch (status) {
    case 'injured':
    case 'absent':
      return PLAYER_AVAILABILITY.INJURED
    case 'questionable':
      return PLAYER_AVAILABILITY.DOUBTFUL
    case 'rehab':
      return PLAYER_AVAILABILITY.BUILDING_UP
    case 'suspended':
      return PLAYER_AVAILABILITY.SUSPENDED
    default:
      return PLAYER_AVAILABILITY.FIT
  }
}

/** `78 %` — German spacing, as everywhere else in the app a share is printed. */
export function chance(value: number | undefined): string {
  return value === undefined ? '–' : `${String(Math.round(value * 100))} %`
}

/**
 * The ring around a portrait, by tier.
 *
 * Quieter than the badge in the corner and saying the same thing, which is the
 * point: at a glance the eleven separates into the players the run is sure of
 * and the ones it is guessing at, without anybody reading a single glyph.
 */
export const TIER_RING_CLASS: Record<ExpectedTier, string> = {
  sure: 'ring-white/80',
  likely: 'ring-white/55',
  coin_flip: 'ring-warning/80',
  bench: 'ring-white/25',
  out: 'ring-white/15',
}

/**
 * Everything a predicted portrait shows and everything it cannot: who he is,
 * how sure the run is, what it expects of him, and why he might not play.
 *
 * The tooltip *and* the accessible name, as on the
 * [match pitch](../matchday/MatchLineupTab.tsx) — a portrait is a photograph,
 * a name and a percentage, and this is the reader who is asking for the rest.
 */
export function expectedPlayerLabel(player: ExpectedPlayer): string {
  const parts = [
    `${player.name}: ${EXPECTED_TIER[player.tier].label}`,
    `Startelf ${chance(player.startChance)}`,
  ]

  if (player.playChance !== undefined) {
    parts.push(`Einsatz ${chance(player.playChance)}`)
  }
  if (player.expected !== undefined) {
    parts.push(`${String(player.expected)} erwartete Punkte`)
  }
  if (player.status !== undefined && player.status !== 'fit') {
    parts.push(EXPECTED_STATUS_LABEL[player.status])
  }
  if (player.replaces !== undefined) {
    parts.push(`käme voraussichtlich für ${player.replaces.name}`)
  }

  return parts.join(' · ')
}
