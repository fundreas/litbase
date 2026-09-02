import { readJson, remove, writeJson } from '@/lib/storage'

/**
 * Persistence for the signed-in session.
 *
 * ## Why there is no refresh token
 *
 * Kickbase's v4 API issues a single bearer token (`tkn`) with an expiry
 * (`tknex`, ~7 days) and no refresh token — `/v4/user/refresh`,
 * `/v4/user/refreshtoken` and `/v4/user/token` all return 404. The only way to
 * obtain a new token is to POST credentials to `/v4/user/login` again.
 *
 * So "keep me signed in" is implemented in two tiers:
 *
 *  1. **Always** — the token and its expiry are persisted. Closing and
 *     reopening the page restores the session for up to ~7 days. This is the
 *     safe default and covers the common case.
 *  2. **Opt-in** — if the user ticks "Keep me signed in", the credentials are
 *     persisted too, so the app can silently re-login when the token nears
 *     expiry (or a request comes back 401) without any prompt.
 *
 * Tier 2 means a password sits in localStorage. That is a real trade-off, so it
 * is off by default, clearly labelled in the login form, and wiped on logout.
 * The obfuscation below is deliberately *not* called encryption: a browser can
 * keep no secret from script running on its own origin. It only stops the
 * password from being readable at a glance in devtools.
 */

const SESSION_KEY = 'litbase.session.v1'
const CREDENTIALS_KEY = 'litbase.credentials.v1'
const LAST_LEAGUE_KEY = 'litbase.lastLeagueId.v1'
const LAST_EMAIL_KEY = 'litbase.lastEmail.v1'

export interface StoredUser {
  id: string
  name: string
  email: string
  /** Avatar: absolute URL or CDN-relative path. */
  avatar?: string
}

export interface StoredSession {
  token: string
  /** Epoch milliseconds. */
  expiresAt: number
  user: StoredUser
}

interface StoredCredentials {
  email: string
  /** Obfuscated, not encrypted — see the note above. */
  secret: string
}

/* -------------------------------------------------------------------------- */
/* Session                                                                    */
/* -------------------------------------------------------------------------- */

function isStoredSession(value: unknown): value is StoredSession {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<StoredSession>
  return (
    typeof candidate.token === 'string' &&
    typeof candidate.expiresAt === 'number' &&
    typeof candidate.user === 'object' &&
    candidate.user !== null &&
    typeof candidate.user.id === 'string'
  )
}

export function loadSession(): StoredSession | null {
  const session = readJson<unknown>(SESSION_KEY)
  if (!isStoredSession(session)) {
    if (session !== null) remove(SESSION_KEY)
    return null
  }
  return session
}

export function saveSession(session: StoredSession): void {
  writeJson(SESSION_KEY, session)
}

export function clearSession(): void {
  remove(SESSION_KEY)
}

/* -------------------------------------------------------------------------- */
/* Credentials (opt-in)                                                       */
/* -------------------------------------------------------------------------- */

/** Reversible byte-level scramble. See the module note on why this is enough. */
function scramble(input: string): string {
  const bytes = new TextEncoder().encode(input)
  const out = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i += 1) {
    out[i] = (bytes[i] ?? 0) ^ ((i * 31 + 0x5a) & 0xff)
  }
  return btoa(String.fromCharCode(...out))
}

function unscramble(input: string): string {
  const raw = atob(input)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) {
    out[i] = raw.charCodeAt(i) ^ ((i * 31 + 0x5a) & 0xff)
  }
  return new TextDecoder().decode(out)
}

export function saveCredentials(email: string, password: string): void {
  try {
    const payload: StoredCredentials = {
      email,
      secret: scramble(password),
    }
    writeJson(CREDENTIALS_KEY, payload)
  } catch {
    // Non-latin passwords could break btoa; failing to persist is acceptable.
    remove(CREDENTIALS_KEY)
  }
}

export function loadCredentials(): { email: string; password: string } | null {
  const stored = readJson<StoredCredentials>(CREDENTIALS_KEY)
  if (!stored || typeof stored.email !== 'string') return null
  try {
    return { email: stored.email, password: unscramble(stored.secret) }
  } catch {
    remove(CREDENTIALS_KEY)
    return null
  }
}

export function clearCredentials(): void {
  remove(CREDENTIALS_KEY)
}

export function hasStoredCredentials(): boolean {
  return loadCredentials() !== null
}

/* -------------------------------------------------------------------------- */
/* Last used email                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The address the user last registered or signed in with, so the login form
 * can pre-fill it. Just an email — no password — which is why it survives
 * sign-out: the point is to save typing on the *next* sign-in.
 */
export function loadLastEmail(): string | null {
  return readJson<string>(LAST_EMAIL_KEY)
}

export function saveLastEmail(email: string): void {
  const trimmed = email.trim()
  if (trimmed !== '') writeJson(LAST_EMAIL_KEY, trimmed)
}

export function clearLastEmail(): void {
  remove(LAST_EMAIL_KEY)
}

/* -------------------------------------------------------------------------- */
/* Last visited league                                                        */
/* -------------------------------------------------------------------------- */

export function loadLastLeagueId(): string | null {
  return readJson<string>(LAST_LEAGUE_KEY)
}

export function saveLastLeagueId(leagueId: string): void {
  writeJson(LAST_LEAGUE_KEY, leagueId)
}

export function clearLastLeagueId(): void {
  remove(LAST_LEAGUE_KEY)
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Treat a token as expired slightly early to avoid racing the server clock. */
const EXPIRY_SKEW_MS = 60_000

export function isExpired(expiresAt: number, now = Date.now()): boolean {
  return expiresAt - EXPIRY_SKEW_MS <= now
}

/** How long before real expiry a silent re-login is attempted (12h). */
export const REFRESH_LEAD_MS = 12 * 60 * 60 * 1000

export function shouldRefreshNow(expiresAt: number, now = Date.now()): boolean {
  return expiresAt - REFRESH_LEAD_MS <= now
}
