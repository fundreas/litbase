import type { ExpectedPointsEntry, ProjectedPoints } from '@/lib/expectedPoints'
import { points } from '@/lib/format'

/**
 * **The colours and the wording for an expected figure drawn as bare text.**
 *
 * The chips in [`ExpectedPointsBadge`](./ExpectedPointsBadge.tsx) carry their
 * own; these are for the places that cannot — a pitch plate five characters
 * wide, a corner pill on the grass — and for the screen-reader text every one
 * of them needs, since the whole distinction this feature draws is a colour.
 *
 * A module of its own so the component file exports components only, which is
 * what keeps fast refresh working on it.
 */

/**
 * **The two colours, for the places that draw the figure as bare text.**
 *
 * A pitch plate is five characters wide over a portrait and has no room for a
 * chip, so the colour has to do the work on its own there — and it must be the
 * *same* colour it is inside a chip, or the reader would have two vocabularies
 * for one distinction. Exported rather than duplicated for exactly that
 * reason: [the live pitch](./LiveTab.tsx) and the
 * [roster pitches](../roster/RosterPitch.tsx) both read it.
 */
export function expectedTextClass(entry: ExpectedPointsEntry): string {
  return entry.isOwn ? 'text-accent' : 'text-warning'
}

/**
 * What a figure about a match still to come says out loud.
 *
 * Spelled out for the places where the number is alone on a plate or beside a
 * kick-off time: `231` there could be points already scored, and the whole
 * point of the two colours is a distinction a screen reader cannot see.
 */
export function expectedDescription(entry: ExpectedPointsEntry): string {
  return entry.isOwn
    ? `Erwartete Punkte: ${points(entry.value)} (deine Schätzung)`
    : `Erwartete Punkte: ${points(entry.value)} (Prognose)`
}

/**
 * **The projected total, in the colour of whatever is carrying it.**
 *
 * Accent green as soon as any of the projection is the reader's own guess,
 * orange while it is all the model's — the same rule the chip over his own
 * pitch follows, and the same two colours everything else about this feature
 * uses. A total that is *entirely* settled scores is neither: it is a result,
 * and `isProjection()` is what tells a caller not to draw this at all.
 */
export function projectedTextClass(projected: ProjectedPoints): string {
  return projected.own > 0 ? 'text-accent' : 'text-warning'
}

/**
 * The projected total spelled out — the figure, and what it is made of.
 *
 * Every caller draws this number tiny, in the corner of a pitch or beside a
 * manager's name, where there is room for four digits and a glyph and nothing
 * else. The composition is the part that says whether it is a projection or
 * nearly a result, so it goes in the tooltip and the screen-reader text rather
 * than being dropped: *1.240 — 4 gespielt, 5 Prognose, 2 eigene Schätzungen*.
 *
 * The parts that are zero are left out. "0 eigene Schätzungen" is a fact about
 * nothing.
 */
export function projectedDescription(projected: ProjectedPoints): string {
  const parts: string[] = []
  if (projected.scored > 0) parts.push(`${points(projected.scored)} gespielt`)
  if (projected.forecast > 0) {
    parts.push(`${points(projected.forecast)} Prognose`)
  }
  if (projected.own > 0) {
    parts.push(
      projected.own === 1
        ? 'eine eigene Schätzung'
        : `${points(projected.own)} eigene Schätzungen`,
    )
  }
  if (projected.missing > 0) {
    parts.push(`${points(projected.missing)} ohne Wert`)
  }

  const made = parts.length === 0 ? '' : ` — ${parts.join(', ')}`
  return `Voraussichtliche Punkte: ${points(projected.total)}${made}`
}
