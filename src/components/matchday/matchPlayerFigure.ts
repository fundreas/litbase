import type { MatchPlayer, PlayerFigure } from '@/api/models'

/**
 * The one figure a player in a match gets: **the points when they are known,
 * `–` when they are not.** Never `0`.
 *
 * That distinction is why `MatchPlayer.points` is optional in the first place.
 * A match that has not kicked off is not a blank performance, and a `0` on a
 * portrait an hour before kick-off would read as a verdict.
 *
 * Only two of [`PlayerFigure`](../../api/models.ts)'s four cases can arise
 * here, which is the difference from the squad and duel pitches'
 * [`playerFigure()`](../player/playerFigure.ts): `bench` is a *Kickbase*
 * lineup decision and has no meaning for a club's real team sheet, and a
 * `kickoff` time would be redundant when the whole page is one match whose
 * header already says when it starts.
 *
 * Shared by the pitch and the ranking so the two cannot disagree about what a
 * dash means, and its own module so both files stay components-only for Fast
 * Refresh.
 */
export function matchPlayerFigure(player: MatchPlayer): PlayerFigure {
  return player.points === undefined
    ? { kind: 'unknown' }
    : { kind: 'points', points: player.points }
}
