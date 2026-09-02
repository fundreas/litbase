/** Typed, validated access to the Vite env. Import this, not `import.meta.env`. */

const DEFAULT_API_BASE_URL = 'https://api.kickbase.com'
const DEFAULT_CDN_BASE_URL = 'https://kickbase.b-cdn.net'

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

export const env = {
  apiBaseUrl: trimTrailingSlash(
    import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL,
  ),
  cdnBaseUrl: trimTrailingSlash(
    import.meta.env.VITE_CDN_BASE_URL || DEFAULT_CDN_BASE_URL,
  ),
  isDev: import.meta.env.DEV,
} as const
