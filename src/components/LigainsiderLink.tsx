import { ExternalLink, Newspaper } from 'lucide-react'

import { useLigainsider } from '@/api/hooks/useLigainsider'

/**
 * The way out to ligainsider.de — a player's page, or a club's news.
 *
 * **A link, not the news itself**, because that is all a static app can do
 * with a site that sends no CORS headers; see
 * [`useLigainsider`](../api/hooks/useLigainsider.ts). It is a full-width row in
 * the same clothes as a card, so it reads as one more block of the page rather
 * than a footnote, and it sits last: it is where to go *next*, after the page
 * has said what it knows.
 *
 * Renders nothing until the index has loaded, and nothing at all for an id the
 * index does not know — a player the pairing script could not place, or a
 * competition ligainsider does not cover. A row that said "no link" would be a
 * row about the app's shortcomings.
 *
 * Opens in a new tab: the reader is leaving the app for another site, and the
 * back gesture should bring them back to this page, not to wherever they went
 * on ligainsider.
 */
export function LigainsiderLink({
  kind,
  id,
  name,
}: {
  kind: 'player' | 'team'
  /** The Kickbase id of the player or club. */
  id: string
  /** For the line under the title — "Aktuelle News zu Michael Olise". */
  name: string | undefined
}) {
  const index = useLigainsider()
  const url =
    kind === 'player'
      ? index.data?.playerUrl.get(id)
      : index.data?.teamUrl.get(id)

  if (url === undefined) return null

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 transition-colors hover:bg-surface-2/60"
    >
      <Newspaper
        size={18}
        aria-hidden="true"
        className="shrink-0 text-accent"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">
          News auf LigaInsider
        </span>
        <span className="block truncate text-xs text-muted">
          {name === undefined
            ? 'Verletzungen, Aufstellungen, Transfers'
            : `Aktuelle News zu ${name}`}
        </span>
      </span>
      <ExternalLink
        size={14}
        aria-hidden="true"
        className="shrink-0 text-faint"
      />
    </a>
  )
}
