import { Target } from 'lucide-react'

import {
  projectedDescription,
  projectedTextClass,
} from '@/components/squad/expectedPointsLabels'
import { cn } from '@/lib/cn'
import type { ProjectedPoints } from '@/lib/expectedPoints'
import { points } from '@/lib/format'

/** The same rule, for the callers that draw it as a bordered chip. */
function projectedChipClass(projected: ProjectedPoints): string {
  return projected.own > 0
    ? 'border border-accent/40 bg-accent/10'
    : 'border border-warning/40 bg-warning/10'
}

/**
 * **The projected total as a plate reads it** — the target glyph, the figure.
 *
 * The same shape as {@link ExpectedPointsFigure} and for the same reason: a
 * number in a colour is what a real total looks like, and the glyph is what
 * says this one has not happened yet. `className` is the caller's chrome,
 * because the four places this appears — a pitch corner, a duel's name pill, a
 * full-screen bar, the live header — share no background and no size.
 */
export function ProjectedPointsFigure({
  projected,
  iconSize = 9,
  /** `chip` adds the border and fill a figure needs off the grass. */
  variant = 'plain',
  className,
}: {
  projected: ProjectedPoints
  iconSize?: number
  variant?: 'plain' | 'chip'
  className?: string
}) {
  const label = projectedDescription(projected)

  return (
    <span
      title={label}
      className={cn(
        'nums flex shrink-0 items-center gap-0.5 font-semibold',
        projectedTextClass(projected),
        variant === 'chip' && projectedChipClass(projected),
        variant === 'chip' && 'rounded-full px-2 py-0.5',
        className,
      )}
    >
      <Target size={iconSize} aria-hidden="true" className="shrink-0" />
      <span aria-hidden="true">{points(projected.total)}</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}

/**
 * **The expected figure as a pitch plate reads it** — the target glyph, then
 * the number.
 *
 * The chip below is a row's shape: a border, a fill, a pill. None of that
 * survives at plate size, where the whole figure gets about five characters
 * over a portrait — so what carries across from the row is the glyph and the
 * colour, which are the two things that say *this is a prediction, and whose*.
 * Without the target the plate is a bare number in a colour, and a bare number
 * on a pitch is what points already scored look like.
 *
 * `fontSize` is the plate's own, from
 * [`pitchMetrics`](./pitchMetrics.ts): the glyph is sized from the text rather
 * than fixed, because the same plate is 10px on a phone's head-to-head pitch
 * and 16px on a desktop's single eleven, and a fixed glyph would be a speck at
 * one end and a dinner plate at the other.
 *
 * The colour is the caller's — it is set on the plate, which also colours a
 * real score and a kick-off time, so this inherits rather than fighting it.
 */
export function ExpectedPointsFigure({
  value,
  fontSize,
}: {
  value: number
  fontSize: number
}) {
  return (
    <>
      <Target
        size={Math.max(7, Math.round(fontSize * 0.8))}
        aria-hidden="true"
        className="shrink-0"
      />
      <span className="min-w-0 truncate">{points(value)}</span>
    </>
  )
}

/**
 * **What he is expected to score**, as a chip on a squad row.
 *
 * Two figures live in this one chip, and the difference between them is the
 * whole reason it takes a flag: **your own guess is the app's accent green,
 * the model's prediction is orange.** A prediction is a default — it is there
 * on every row from the moment the file loads, which is what makes the pitch
 * total mean something before anybody has typed anything — and drawing it in
 * the colour the app reserves for its own actionable figures would quietly
 * credit the reader with four hundred decisions he never made.
 *
 * The prediction keeps a **dashed** edge behind the colour, the same idiom the
 * market tab uses for a day that has not happened yet. Orange against green is
 * the one pair a red-green reader cannot separate, and a chip this small — ten
 * pixels of text in the corner of a row — has nothing else to go on.
 *
 * Only ever drawn when there *is* a figure: no guess, and no prediction
 * either — a bye, a player the model has no file for, a competition it does
 * not cover — is a chip that is simply absent.
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
  /** The model's figure rather than the reader's — see above. */
  isForecast = false,
  /** Inside a button that already says what it is — see {@link ExpectedPointsTarget}. */
  decorative = false,
  className,
}: {
  value: number
  isForecast?: boolean
  decorative?: boolean
  className?: string
}) {
  const label = isForecast
    ? `Prognose: ${points(value)} Punkte`
    : `Erwartete Punkte: ${points(value)}`

  return (
    <span
      {...(decorative
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': label, title: label })}
      className={cn(
        'nums flex shrink-0 items-center gap-0.5 rounded-full border px-1 py-px',
        'text-[0.625rem] leading-none font-semibold',
        isForecast
          ? 'border-dashed border-warning/45 bg-warning/10 text-warning'
          : 'border-accent/40 bg-accent/15 text-accent',
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
 * **It is visible whether or not a figure exists**, unlike the badge, and that
 * is the whole difference: with no crest to tap, an affordance that only
 * appeared once you had used it could never be found the first time. Empty it
 * is a faint outline that reads as "nothing here yet"; filled it is the same
 * chip the squad list draws — orange for the model's figure, accent green for
 * yours — so a figure looks identical wherever it is met.
 */
export function ExpectedPointsTarget({
  value,
  /** The model's figure rather than the reader's — see {@link ExpectedPointsBadge}. */
  isForecast = false,
  playerName,
  onClick,
  className,
}: {
  /** The figure that stands for him, or `undefined` when none does. */
  value: number | undefined
  isForecast?: boolean
  /** Named in the label, since a row is one of thirty on the screen. */
  playerName: string
  onClick: () => void
  className?: string
}) {
  const label =
    value === undefined
      ? `Erwartete Punkte für ${playerName} eintragen`
      : isForecast
        ? `Prognose für ${playerName}: ${points(value)} Punkte — eigene Erwartung eintragen`
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
        <ExpectedPointsBadge value={value} isForecast={isForecast} decorative />
      )}
    </button>
  )
}
