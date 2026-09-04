import type { MatchPlayerOwner } from '@/api/models'

/**
 * What an ownership badge actually asserts, in words.
 *
 * **Three different claims, three different sentences**, because the badge can
 * be standing on any of three facts and they are not interchangeable:
 *
 *  - *In der Aufstellung von X* — he was in that manager's eleven **that
 *    matchday**. The matchday's own record.
 *  - *Im Kader von X, nicht aufgestellt* — that manager owned him then and left
 *    him out. The answer to "why did he score me nothing".
 *  - *Gehört X* — he is that manager's **today**, which is the last-resort
 *    fallback for a matchday the snapshot has nothing for. Deliberately worded
 *    in the present tense, because that is all it knows.
 *
 * Conflating the first with the third is how a past matchday came to credit
 * transferred players to their new manager — see
 * [`OwnerSource`](../../api/models.ts).
 *
 * Its own module rather than a second export from
 * [`OwnerBadge`](./OwnerBadge.tsx), so that file stays components-only and Fast
 * Refresh keeps working — and so the pitch's portrait tooltip, which has no
 * badge to hang the wording off, says the same thing the badge does.
 */
export function ownerLabel(owner: MatchPlayerOwner): string {
  if (owner.source !== 'matchdayLineup') {
    return owner.isViewer ? 'Dein Spieler' : `Gehört ${owner.name}`
  }
  if (owner.wasFielded) {
    return owner.isViewer
      ? 'In deiner Aufstellung an diesem Spieltag'
      : `In der Aufstellung von ${owner.name} an diesem Spieltag`
  }
  return owner.isViewer
    ? 'In deinem Kader, aber nicht aufgestellt'
    : `Im Kader von ${owner.name}, nicht aufgestellt`
}
