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
