import { cdnUrl } from '@/api/cdn'
import type { TeamSummary } from '@/api/hooks/useCompetition'
import { cn } from '@/lib/cn'

/**
 * **The club, as a watermark** — an oversized crest behind a player's row,
 * cropped by the row's own edges and faded out before the figures at its end.
 *
 * It began on the [market row](../market/MarketRow.tsx) in place of a 16px
 * crest at the end of the name's line. That crest answered *which Müller* in
 * principle and not in practice: a Bundesliga badge at 16px is a coloured
 * speck, and it was competing for the few pixels the one line that must not
 * truncate — the name — had left on a 360px phone. In the background it costs
 * the row **no width at all** and is finally large enough to be recognised:
 * about 76px of crest against 16.
 *
 * Every list of players that knows its players' clubs now draws it, so a
 * player met on the market, in one's own Kader, in a rival's, or in a ranking
 * is placed the same way each time.
 *
 * **Behind the text, not behind the player.** It was tried behind the portrait
 * too — the cutouts are transparent PNGs, so a badge there fills the space
 * around the figure the way a football card does — and the two were drawn side
 * by side for a while to be compared. The portrait one lost: that column is
 * already a picture, and a second one under it costs the player his legibility
 * for a fact the row states anyway. Behind the text the badge has ground of
 * its own.
 *
 * Three things keep it from becoming noise:
 *
 *  - **Cropped, not shrunk**: 111% of the row, centred, so 90% of the badge is
 *    on screen and 5% goes past each edge. Air around a watermark is the thing
 *    the eye finds first, and a symmetric overshoot makes the crop a frame
 *    rather than an event.
 *  - **It sits at the left of its box and fades towards the right**, so it
 *    never ends on an edge of its own: it picks up where the portrait's own
 *    fade leaves off, and the figures at the end of the row — points, money,
 *    a fixture crest — keep clean ground.
 *  - **13 %**, a tint rather than a picture: enough to read the shape and the
 *    club's colours at a glance, not enough to compete with the text over it.
 *
 * Decorative, and `aria-hidden`: the club is named in the row's own label or
 * tooltip wherever the row names it at all, so nothing is lost to a screen
 * reader or to a reader who does not know the badge.
 *
 * ## What the host has to be
 *
 * `relative isolate overflow-hidden`, and nothing else. `relative` makes it the
 * badge's containing block, `overflow-hidden` is what crops it, and `isolate`
 * is the load-bearing one: without a stacking context of its own the `-z-10`
 * would put the crest behind the **row's** background rather than behind the
 * row's text, and it would simply never appear.
 */
export function ClubWatermark({ team }: { team: TeamSummary | undefined }) {
  const src = cdnUrl(team?.image)
  if (src === undefined) return null

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn(
        'pointer-events-none absolute -z-10 select-none',
        // **111 % of the row, centred**: 90 % of the badge on screen and about
        // 5 % past each end. The overshoot is what makes it read as zoomed in
        // rather than placed, and centring keeps the two cuts symmetrical so
        // neither looks like a mistake.
        'top-1/2 left-0 h-[111%] w-auto -translate-y-1/2 opacity-[0.13]',
        // Anchored to the **left**, where the portrait's own fade leaves off,
        // and dissolving towards the right: the two pictures read as one run
        // across the left of the row, and the badge keeps clear of whatever
        // the row ends with — a fixture crest, an owner's face, a figure.
        '[mask-image:linear-gradient(to_right,#000_0%,#000_45%,transparent_96%)]',
      )}
    />
  )
}
