import { Target } from 'lucide-react'

import { cn } from '@/lib/cn'
import { points } from '@/lib/format'

/**
 * **What you expect him to score**, as a chip on a squad row.
 *
 * Only ever drawn when a guess exists: an empty slot on every row would be a
 * column of nothing, and the whole feature is opt-in per player. Its absence
 * is the "not guessed yet" state.
 *
 * The target glyph is what keeps a bare accent number from reading as points
 * already scored — the one thing on a squad row it could plausibly be
 * confused with. It is `aria-hidden`, and the chip carries the whole sentence
 * as its label and its tooltip, because three characters in a corner explain
 * nothing on their own. The [legend](./SquadLegendDialog.tsx) explains it once
 * for good.
 */
export function ExpectedPointsBadge({
  value,
  /** Inside a button that already says what it is — see {@link ExpectedPointsTarget}. */
  decorative = false,
  className,
}: {
  value: number
  decorative?: boolean
  className?: string
}) {
  const label = `Erwartete Punkte: ${points(value)}`

  return (
    <span
      {...(decorative
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': label, title: label })}
      className={cn(
        'nums flex shrink-0 items-center gap-0.5 rounded-full border px-1 py-px',
        'border-accent/40 bg-accent/15 text-[0.625rem] leading-none font-semibold text-accent',
        className,
      )}
    >
      <Target size={9} aria-hidden="true" className="shrink-0" />
      {points(value)}
    </span>
  )
}

/**
 * **The way in to the guess, on a row that has no crest to hang it on.**
 *
 * One's own squad opens the [sheet](./ExpectedPointsDialog.tsx) from the
 * fixture panel, because that panel is already there and is already about the
 * coming matchday. A [rival's Kader](../manager/ManagerSquadTab.tsx) has no
 * such panel, and a [club's roster](../team/TeamSquadTab.tsx) would be thirty
 * copies of one crest — every player faces the same opponent — so those rows
 * get a target of their own at the end instead.
 *
 * **It is visible whether or not a guess exists**, unlike the badge, and that
 * is the whole difference: with no crest to tap, an affordance that only
 * appeared once you had used it could never be found the first time. Empty it
 * is a faint outline that reads as "nothing here yet"; filled it is the same
 * chip the squad list draws, so a guess looks identical wherever it is met.
 */
export function ExpectedPointsTarget({
  value,
  playerName,
  onClick,
  className,
}: {
  /** The stored guess, or `undefined` when there is none yet. */
  value: number | undefined
  /** Named in the label, since a row is one of thirty on the screen. */
  playerName: string
  onClick: () => void
  className?: string
}) {
  const label =
    value === undefined
      ? `Erwartete Punkte für ${playerName} eintragen`
      : `Erwartete Punkte für ${playerName}: ${points(value)} — ändern`

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        // `w-11`: a 44px target, which is the smallest a finger should be
        // asked for, and enough for a three-digit chip.
        'flex w-11 shrink-0 cursor-pointer items-center justify-center self-stretch',
        'border-l border-line transition-colors hover:bg-surface-2',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus-visible:ring-inset',
        className,
      )}
    >
      {value === undefined ? (
        <Target size={15} aria-hidden="true" className="text-faint/70" />
      ) : (
        <ExpectedPointsBadge value={value} decorative />
      )}
    </button>
  )
}
