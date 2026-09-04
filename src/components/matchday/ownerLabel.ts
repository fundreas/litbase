import type { MatchPlayerOwner } from '@/api/models'

/**
 * What an ownership badge actually asserts, in words.
 *
 * **Two different claims, two different sentences.** *In der Aufstellung von X*
 * is the matchday's own record, from the snapshot's league-wide `us`; *Gehört X*
 * is who owns the player today, and is only ever used for a matchday that has
 * not been played. Conflating them is how a past matchday came to credit
 * transferred players to their new manager — see
 * [`OwnerSource`](../../api/models.ts).
 *
 * Its own module rather than a second export from
 * [`OwnerBadge`](./OwnerBadge.tsx), so that file stays components-only and Fast
 * Refresh keeps working — and so the pitch's portrait tooltip, which has no
 * badge to hang the wording off, says the same thing the badge does.
 */
export function ownerLabel(owner: MatchPlayerOwner): string {
  if (owner.source === 'matchdayLineup') {
    return owner.isViewer
      ? 'In deiner Aufstellung an diesem Spieltag'
      : `In der Aufstellung von ${owner.name} an diesem Spieltag`
  }
  return owner.isViewer ? 'Dein Spieler' : `Gehört ${owner.name}`
}
