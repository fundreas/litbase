import {
  teamResult,
  TEAM_RESULT_LABEL,
  type TeamSeasonFixture,
} from '@/api/models'
import { FORM_DEPTH } from '@/components/ui/formDepth'
import { RESULT_MARK } from '@/components/ui/resultMark'
import { cn } from '@/lib/cn'

/** How big each mark is drawn, in px — the duel strip's size, for its reasons. */
const MARK = 12

/**
 * **A club's last five results, newest first** — ✓, – or ✗, fading as they
 * recede into the season.
 *
 * The compact cousin of the club page's
 * [form card](./TeamOverviewTab.tsx): the same window and the same
 * newest-first direction, shrunk from a row of 32px lettered discs with
 * scorelines under them to something that fits under a club's name in a
 * [league table](../../pages/SeasonPage.tsx). A table position six matchdays
 * old says nothing about who is climbing, which is exactly the question a
 * reader opens a table with — and until this existed the answer was eighteen
 * visits to eighteen club pages.
 *
 * **The same marks the [duel strip](../ranking/DuelFormStrip.tsx) draws**, from
 * [`RESULT_MARK`](../ui/resultMark.ts). It drew **S / U / N** for a day — what
 * a printed Bundesliga table does, and what the form card still does at full
 * size — and the letters turned out to be the weaker half of the pair at this
 * size: three glyphs that differ only as letterforms, against three that differ
 * as
 * *shapes*, and the shape is what survives the fade. The two strips now say the
 * same thing the same way about two different competitions, down to the
 * [depth curve](../ui/formDepth.ts).
 *
 * **Shape, never colour alone** — the rule the form card and the probability
 * badge follow.
 *
 * The whole strip is **one** labelled `role="img"`, not five: five marks each
 * announcing themselves would be five screen-reader stops on a row that has a
 * placement, a club, three numbers and a fixture to get through. The label
 * carries the matchday and the scoreline of each, which have nowhere to go on
 * screen beside a 12px mark.
 *
 * Drawn only where something has been played. A club before its first whistle —
 * and the whole table before the season starts — gets nothing rather than five
 * empty slots.
 */
export function ClubFormStrip({
  form,
  className,
}: {
  /** The last results, newest first and already cut to the fade's length. */
  form: TeamSeasonFixture[]
  className?: string
}) {
  if (form.length === 0) return null

  const label = `Form: ${form
    .map((fixture) => {
      const result = teamResult(fixture)
      const outcome =
        result === undefined ? '–' : TEAM_RESULT_LABEL[result].toLowerCase()
      return `${String(fixture.day)}. ${outcome} ${String(fixture.goalsFor ?? 0)}:${String(fixture.goalsAgainst ?? 0)}`
    })
    .join(', ')}`

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn('flex shrink-0 items-center gap-0.5', className)}
    >
      {form.map((fixture, index) => {
        /* Non-null by construction — the selector keeps only finished
           fixtures — but a fixture that somehow carries no result is skipped
           rather than drawn as something, which is the same honesty the
           table's goal columns show with `–:–`. */
        const result = teamResult(fixture)
        if (result === undefined) return null
        const mark = RESULT_MARK[result]
        return (
          <mark.Icon
            key={fixture.matchId}
            size={MARK}
            aria-hidden="true"
            style={{ opacity: FORM_DEPTH[index] }}
            className={cn('shrink-0', mark.className)}
          />
        )
      })}
    </span>
  )
}
