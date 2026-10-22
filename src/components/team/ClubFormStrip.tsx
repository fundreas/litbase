import {
  teamResult,
  TEAM_RESULT_LABEL,
  TEAM_RESULT_LETTER,
  type TeamResult,
  type TeamSeasonFixture,
} from '@/api/models'
import { FORM_DEPTH } from '@/components/ui/formDepth'
import { cn } from '@/lib/cn'

/** The letter's colour per result — the fill and the border are the card's. */
const RESULT_CLASS: Record<TeamResult, string> = {
  win: 'text-positive',
  draw: 'text-muted',
  loss: 'text-negative',
}

/**
 * **A club's last five results, newest first** — S, U or N, fading as they
 * recede into the season.
 *
 * The compact cousin of the club page's
 * [form card](./TeamOverviewTab.tsx): the same window, the same letters and the
 * same newest-first direction, shrunk from a row of 32px discs with scorelines
 * under them to something that fits under a club's name in a
 * [league table](../../pages/SeasonPage.tsx). A table position six matchdays
 * old says nothing about who is climbing, which is exactly the question a
 * reader opens a table with — and until this existed the answer was eighteen
 * visits to eighteen club pages.
 *
 * **Letters, not the ✓/–/✗ the [duel strip](../ranking/DuelFormStrip.tsx)
 * draws.** The two strips are the same claim about two competitions, and they
 * share the [fade](../ui/formDepth.ts) that makes them read alike — but a
 * club's results are S/U/N everywhere else in the app and in every printed
 * Bundesliga table, while a manager's duel is won or lost against one named
 * opponent. Each keeps the notation its own screens already use.
 *
 * **Letter *and* colour, never colour alone** — the rule the form card and the
 * probability badge follow. No disc behind the letter: at this size the border
 * and fill would be most of the mark, and the letters are distinguishable
 * without them.
 *
 * The whole strip is **one** labelled `role="img"`, not five: five marks each
 * announcing themselves would be five screen-reader stops on a row that has a
 * placement, a club, three numbers and a fixture to get through. The label
 * carries the matchday and the scoreline of each, which have nowhere to go on
 * screen at 10px.
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
      className={cn(
        'nums flex shrink-0 items-center gap-[3px] text-[0.625rem] leading-none font-bold',
        className,
      )}
    >
      {form.map((fixture, index) => {
        /* Non-null by construction — the selector keeps only finished
           fixtures — but a fixture that somehow carries no result draws a dash
           rather than throwing, which is the same answer the table's goal
           columns give. */
        const result = teamResult(fixture)
        return (
          <span
            key={fixture.matchId}
            aria-hidden="true"
            style={{ opacity: FORM_DEPTH[index] }}
            className={
              result === undefined ? 'text-faint' : RESULT_CLASS[result]
            }
          >
            {result === undefined ? '–' : TEAM_RESULT_LETTER[result]}
          </span>
        )
      })}
    </span>
  )
}
