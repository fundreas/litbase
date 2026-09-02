import { anonymousRequest, post } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import type {
  LoginRequest,
  LoginResponse,
  LoginUser,
  RegisterRequest,
  RegisterResponse,
} from '@/api/types'
import type { StoredSession } from '@/auth/authStorage'

/** Six days, used only when the server sends an expiry we cannot parse. */
const FALLBACK_LIFETIME_MS = 6 * 24 * 60 * 60 * 1000

/**
 * Exchange credentials for a bearer token.
 *
 * Sent without an Authorization header — a stale token on the login call makes
 * Kickbase reject it.
 */
export async function login(
  email: string,
  password: string,
): Promise<StoredSession> {
  const body: LoginRequest = {
    em: email.trim(),
    pass: password,
    loy: false,
    rep: {},
  }

  const data = await post<LoginResponse>(
    endpoints.auth.login,
    body,
    anonymousRequest,
  )

  return toSession(data.tkn, data.tknex, data.u)
}

/**
 * Create an account and return its session.
 *
 * Kickbase creates the account outright — there is **no email confirmation
 * step** — and the response already contains a usable bearer token plus its
 * expiry. So registering signs the user in directly: no second request, and no
 * trip through the login form.
 *
 * `unm` may be empty; the server then generates a `KickbaseUser####` name.
 *
 * The fixed flags are per the Kickbase client's own registration call:
 * `tkn: ''` (no invite token), `rek: true` (terms accepted), `rept: false`
 * (no marketing opt-in), `rep: {}`.
 */
export async function register(input: {
  email: string
  username: string
  password: string
}): Promise<StoredSession> {
  const body: RegisterRequest = {
    em: input.email.trim(),
    unm: input.username.trim(),
    pass: input.password,
    tkn: '',
    rek: true,
    rept: false,
    rep: {},
  }

  const data = await post<RegisterResponse>(
    endpoints.auth.register,
    body,
    anonymousRequest,
  )

  // The token is always present in practice. The fallback exists only so a
  // future API change degrades into an extra login rather than a broken
  // session with an empty token.
  if (!data.tkn) return login(input.email, input.password)

  return toSession(data.tkn, data.tknex, data.u)
}

function toSession(
  token: string,
  expiresAtIso: string | undefined,
  user: LoginUser,
): StoredSession {
  const parsed = expiresAtIso === undefined ? NaN : Date.parse(expiresAtIso)

  return {
    token,
    // Falling back rather than trusting NaN: an unparseable expiry would
    // otherwise read as 0 and lock the user straight back out.
    expiresAt: Number.isNaN(parsed)
      ? Date.now() + FALLBACK_LIFETIME_MS
      : parsed,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.profile ?? user.uim,
    },
  }
}
