import type { PlayerFigure } from '@/api/models'
import { points, time } from '@/lib/format'

/**
 * A player's one figure, as text.
 *
 * The *decision* — points, bench, kick-off or nothing — is
 * [`playerFigure()`](../../api/models.ts); this is only the wording, and it is
 * shared so the two pitches and the two lists cannot disagree about it.
 *
 * The kick-off is the **time alone** (`18:30`), not the date. A matchday page
 * covers one weekend, the row or plate it sits in already says which fixture
 * it is, and on a pitch plate the width is the portrait's — about five
 * characters at the sizes a phone gets.
 */
export function figureLabel(figure: PlayerFigure): string {
  switch (figure.kind) {
    case 'points':
      return points(figure.points)
    case 'bench':
      return 'Bank'
    case 'kickoff':
      return time(figure.kickoff)
    case 'unknown':
      return '–'
  }
}

/**
 * The same thing spelled out for assistive tech, where there is no column
 * heading or dimmed row to carry the context.
 */
export function figureDescription(figure: PlayerFigure): string {
  switch (figure.kind) {
    case 'points':
      return `${points(figure.points)} Punkte`
    case 'bench':
      return 'auf der Bank, zählt nicht'
    case 'kickoff':
      return `Anpfiff ${time(figure.kickoff)}`
    case 'unknown':
      return 'noch keine Punkte'
  }
}

/**
 * Whether a figure is a real score, which is what decides how loudly it is
 * drawn: a number gets full contrast, a placeholder stays quiet.
 */
export function isScore(figure: PlayerFigure): boolean {
  return figure.kind === 'points'
}
