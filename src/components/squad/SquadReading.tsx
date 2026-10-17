import type { CurrentMatchday } from '@/api/hooks/useMatchday'
import { FixtureBadge } from '@/components/squad/FixtureBadge'
import {
  SQUAD_READING,
  type SquadReading,
} from '@/components/squad/useSquadReading'
import { cn } from '@/lib/cn'

/**
 * **The switch, as one labelled glyph that swaps when tapped** — the shell and
 * the reasoning of [`ValueModeButton`](./ValueMode.tsx), which it stands next
 * to.
 *
 * It names its state rather than showing both glyphs with one lit, the way the
 * [list/grid toggle](../ui/PairToggle.tsx) at the end of the row does: a coin
 * and a calendar side by side would say nothing about which of them is in the
 * rows, because neither glyph *is* the thing the rows show. The label is the
 * answer, and a tap swaps the label and every row at once.
 */
export function SquadReadingButton({
  value,
  onChange,
  className,
}: {
  value: SquadReading
  onChange: (next: SquadReading) => void
  className?: string
}) {
  const next: SquadReading = value === 'values' ? 'fixtures' : 'values'
  const current = SQUAD_READING[value]
  const Icon = current.icon

  return (
    <button
      type="button"
      onClick={() => {
        onChange(next)
      }}
      title={`${current.title} · tippen für: ${SQUAD_READING[next].title}`}
      aria-label={`Angezeigt: ${current.title}. Wechseln zu: ${SQUAD_READING[next].title}`}
      className={cn(
        'flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-2',
        'text-xs font-semibold text-muted transition-colors',
        'hover:border-accent/40 hover:bg-surface-2 hover:text-accent',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        className,
      )}
    >
      <Icon size={15} aria-hidden="true" className="shrink-0 text-accent" />
      {current.label}
    </button>
  )
}

/** How wide one crest in the strip is drawn, in px. */
const CREST = 24

/**
 * **A club's next few opponents, one crest per matchday** — what a squad row
 * carries in place of the money in the `fixtures` reading.
 *
 * The same [fixture badge](./FixtureBadge.tsx) the row already ends with,
 * four times over: the crest with the home-or-away chip on it, so a run of
 * away matches at big clubs reads as one shape down the column. A club with a
 * bye on one of the four gets that badge's dash, which is the honest answer
 * and keeps the four columns aligned across every row — the whole point of a
 * strip is that it can be read **down** the list as well as across it.
 *
 * **The matchday number rides under each crest** because nothing else on the
 * screen says which four these are. It is the smallest type in the app and
 * faint with it: the crests are the content, the numbers are the axis.
 *
 * Inert. The badges carry their tooltips and their screen-reader labels, and
 * the row underneath them is still the link to the player — a strip of four
 * targets inside a row that is already one would be four ways to mis-tap.
 */
export function UpcomingFixtures({
  matchdays,
  teamId,
}: {
  /** The next matchdays, in order — see `useUpcomingMatchdays`. */
  matchdays: CurrentMatchday[]
  /** The club whose fixtures to pick out of each one. */
  teamId: string
}) {
  return (
    <span className="flex shrink-0 items-start gap-1">
      {matchdays.map((matchday) => (
        <span
          key={matchday.day}
          className="flex flex-col items-center gap-0.5"
          style={{ width: CREST }}
        >
          <FixtureBadge
            fixture={matchday.fixtureByTeamId.get(teamId)}
            size={CREST}
            day={matchday.day}
          />
          <span className="nums text-[0.5625rem] leading-none text-faint">
            {matchday.day}
          </span>
        </span>
      ))}
    </span>
  )
}
