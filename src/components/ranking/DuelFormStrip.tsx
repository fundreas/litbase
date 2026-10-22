import type { DuelFormEntry } from '@/api/hooks/useDuelForm'
import { DUEL_RESULT } from '@/components/ranking/duelResult'
import { FORM_DEPTH } from '@/components/ui/formDepth'
import { cn } from '@/lib/cn'

/** How big each mark is drawn, in px. */
const MARK = 12

/**
 * **A manager's last five duels, newest first** — won, drawn or lost, fading
 * as they recede into the season.
 *
 * The [standings](../../pages/RankingPage.tsx) already said how the current
 * duel went, which answers *this week* and nothing beyond it. A league table's
 * real question is who is on a run: a manager three points off the top who has
 * lost four straight is a different story from one who has won four, and the
 * number in the right-hand column tells neither. Five marks beside the name
 * tell both at a glance, read **down** the table as readily as across one row.
 *
 * **Newest on the left**, against the football convention of oldest-first. The
 * fade is what makes that the only readable direction: a strip that brightens
 * towards the right would have the eye start at the faintest mark and work
 * towards the loudest, which is the wrong way round for a fact about now. It
 * also matches the fixture track on a Kader row, where the next opponent leads
 * and the rest recede.
 *
 * **Shape carries it, not colour.** The three marks are the app's own —
 * ✓ for a win, – for a draw, ✗ for a loss, from
 * [`DUEL_RESULT`](./duelResult.ts) — so the strip survives being read by
 * somebody who cannot separate the green from the red, and a mark means the
 * same thing here as it does spelled out under a scoreline or on a manager's
 * season of duels. The whole strip is one labelled `role="img"`: five icons
 * each announcing themselves would be five stops on a row that has a name, a
 * score and a placement to get through.
 *
 * Drawn only where there is something to draw. A league that has played no
 * duel yet — and every league that plays none at all — gets nothing rather
 * than five empty slots.
 */
export function DuelFormStrip({
  form,
  className,
}: {
  /** Newest first, at most five — see `useLeagueDuelForm`. */
  form: DuelFormEntry[]
  className?: string
}) {
  if (form.length === 0) return null

  /* "Letzte Duelle: 34. Gewonnen, 33. Verloren, …" — the matchday numbers are
     the only thing that says *which* five these are, and there is no room for
     them on screen under 12px marks. So they live in the label, which is both
     the tooltip and what a screen reader reads. */
  const label = `Letzte Duelle: ${form
    .map(
      (entry) =>
        `${String(entry.day)}. ${DUEL_RESULT[entry.result].text.toLowerCase()}`,
    )
    .join(', ')}`

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn('flex shrink-0 items-center gap-0.5', className)}
    >
      {form.map((entry, index) => {
        const outcome = DUEL_RESULT[entry.result]
        return (
          <outcome.Icon
            key={entry.day}
            size={MARK}
            aria-hidden="true"
            style={{ opacity: FORM_DEPTH[index] }}
            className={cn('shrink-0', outcome.className)}
          />
        )
      })}
    </span>
  )
}
