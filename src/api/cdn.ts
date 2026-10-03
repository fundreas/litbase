import { env } from '@/lib/env'

/**
 * Resolve a Kickbase image reference to a usable URL.
 *
 * The API is inconsistent: some payloads carry absolute URLs (`profile` on the
 * login user), most carry CDN-relative paths (`content/file/….png`,
 * `user/….jpeg`). This handles both and returns `undefined` for empty values
 * so callers can fall back to initials or a placeholder.
 */
export function cdnUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${env.cdnBaseUrl}/${path.replace(/^\/+/, '')}`
}

/**
 * A player's portrait **from his id alone**, for the one source that names
 * players without picturing them.
 *
 * Kickbase's payloads carry a content-hashed path (`content/file/….png`) and
 * nothing derives it from the id — but the CDN also keeps a pool keyed by the
 * id itself, the same convention the activity feed's `prurl`
 * (`pool/players/{pi}.jpg`) already shows. `pool/playersbig/{pi}.png` is the
 * 1100×800 cutout the app draws everywhere else; probed 2026-10-03 it answered
 * the *current* season's kit where a hashed path taken from an older payload
 * still answered a two-season-old one.
 *
 * **The pool is not complete.** Recently added players 403 — 22 of the top 100
 * on matchday 4 — so this is a best effort and the caller must be able to fall
 * back. [`Avatar`](../components/ui/Avatar.tsx) already does, to initials, the
 * same way it handles a player with no picture at all.
 *
 * Only worth reaching for when there is no `pim` to use: a path the API served
 * is the authority, this is the guess.
 */
export function playerPortraitUrl(playerId: string): string {
  return `${env.cdnBaseUrl}/pool/playersbig/${playerId}.png`
}
