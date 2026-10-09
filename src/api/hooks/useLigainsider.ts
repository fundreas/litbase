import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { qk } from '@/api/queryKeys'

/**
 * Where every Bundesliga player and club lives on ligainsider.de, by Kickbase
 * id — each value an absolute URL.
 */
export interface LigainsiderIndex {
  /** Kickbase player id → the player's page, which carries his news. */
  playerUrl: Map<string, string>
  /** Kickbase club id → the club's news page. */
  teamUrl: Map<string, string>
}

/** `public/ligainsider.json`, as `scripts/ligainsider/build.mjs` writes it. */
interface LigainsiderWireFile {
  baseUrl?: unknown
  teams?: unknown
  players?: unknown
}

/**
 * The file ships with the app, under the same base path as `index.html`, so
 * on Pages that is `/litbase/ligainsider.json` and in dev it is at the root.
 */
const LIGAINSIDER_FILE = `${import.meta.env.BASE_URL}ligainsider.json`

/**
 * **Which ligainsider page is which Kickbase player or club.**
 *
 * ligainsider.de carries the news this app has no source for — injuries,
 * line-up hints, transfer talk — and sends no CORS headers, so the browser
 * cannot read it and the app has no server to read it from. What the app *can*
 * do is link out, and for that it only needs to know which of ligainsider's
 * pages is which Kickbase id. That table is a static file built by
 * `npm run ligainsider` (see [the docs](../../../docs/ligainsider.md)), which
 * pairs the two sites by name within club, and this hook reads it once per
 * session.
 *
 * **A missing or malformed file resolves to `null`, not an error.** The link is
 * an extra on pages that are complete without it; nothing should fail or retry
 * because the file was not deployed. The same handling, and the same reason
 * for calling `fetch` rather than the axios instance, as
 * [`usePointcast`](./usePointcast.ts).
 */
export function useLigainsider(): UseQueryResult<LigainsiderIndex | null> {
  return useQuery({
    queryKey: qk.ligainsider,
    // The file changes only with a deploy, and a deploy changes the app's own
    // asset hashes too — a session never needs to ask twice.
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const response = await fetch(LIGAINSIDER_FILE)
      if (!response.ok) return null
      // The dev server and the SPA fallback both answer an unknown path with
      // `index.html` and a 200 — the content type is what tells them apart.
      if (
        !(response.headers.get('content-type') ?? '').includes(
          'application/json',
        )
      ) {
        return null
      }

      const file = (await response.json()) as LigainsiderWireFile
      if (file === null || typeof file !== 'object') return null
      if (typeof file.baseUrl !== 'string') return null

      return {
        playerUrl: urlsByKickbaseId(file.baseUrl, file.players, ''),
        teamUrl: urlsByKickbaseId(file.baseUrl, file.teams, 'verein/news/'),
      } satisfies LigainsiderIndex
    },
  })
}

/**
 * One section of the file as a map of absolute URLs.
 *
 * Each entry is `{ "path": "michael-olise_37170" }` or
 * `{ "path": "fc-bayern-muenchen/1" }`; the suffix is what hangs off the club
 * path to reach its news (a player's page carries his news itself).
 */
function urlsByKickbaseId(
  baseUrl: string,
  section: unknown,
  suffix: string,
): Map<string, string> {
  const urls = new Map<string, string>()
  if (section === null || typeof section !== 'object') return urls

  for (const [kickbaseId, entry] of Object.entries(section)) {
    const path = (entry as { path?: unknown } | null)?.path
    if (typeof path !== 'string' || path === '') continue
    urls.set(kickbaseId, `${baseUrl}/${path}/${suffix}`)
  }
  return urls
}
