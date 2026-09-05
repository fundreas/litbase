import type { PlayerFigure } from '@/api/models'
import { kickoff, kickoffShort, points } from '@/lib/format'

/**
 * A player's one figure, as text.
 *
 * The *decision* — points, bench, kick-off or nothing — is
 * [`playerFigure()`](../../api/models.ts); this is only the wording, and it is
 * shared so the two pitches and the two lists cannot disagree about it.
 *
 * The **bench case is normally drawn as** [`BenchMark`](./BenchMark.tsx), the
 * armchair, rather than through this function: a mark where a number would go
 * says "nothing here counts" in a tenth of the width the word took. The string
 * stays for the two pitch plates, where a benched player cannot appear at all,
 * and to keep the switch total.
 *
 * The kick-off is **the time on the day it is played and the weekday before
 * that** — `18:30` today, `So` for a match still two nights away. Never the
 * date: a matchday page covers one weekend, the row or plate it sits in
 * already says which fixture it is, and on a pitch plate the width is the
 * portrait's — about five characters at the sizes a phone gets. See
 * [`kickoffShort()`](../../lib/format.ts) for why the near case and the far
 * case want different halves of the same instant.
 */
export function figureLabel(figure: PlayerFigure): string {
  switch (figure.kind) {
    case 'points':
      return points(figure.points)
    case 'bench':
      return 'Bank'
    case 'kickoff':
      return kickoffShort(figure.kickoff)
    case 'unknown':
      return '–'
  }
}

/**
 * The same thing spelled out for assistive tech, where there is no column
 * heading or dimmed row to carry the context.
 *
 * The kick-off is given **in full** here — `Anpfiff So, 6. Sep. · 15:30` — so
 * the day and the time are both stated once, whichever of the two the visible
 * label had room for.
 */
export function figureDescription(figure: PlayerFigure): string {
  switch (figure.kind) {
    case 'points':
      return `${points(figure.points)} Punkte`
    case 'bench':
      return 'auf der Bank, zählt nicht'
    case 'kickoff':
      return `Anpfiff ${kickoff(figure.kickoff)}`
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
