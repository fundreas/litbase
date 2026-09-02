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
 * Create an account.
 *
 * Kickbase creates the account outright: there is **no email confirmation
 * step**, and the new account can authenticate immediately (it comes back with
 * `emv: false`, which does not gate access). So this resolves to a usable
 * session, exactly like {@link login}.
 *
 * `unm` may be empty — the server then generates a `KickbaseUser####` name.
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

  // The account exists at this point either way. Whether registration hands
  // back a token is unconfirmed, so use one if it is there and otherwise sign
  // in with the credentials we just submitted.
  if (data.tkn !== undefined && data.tkn !== '') {
    return toSession(data.tkn, data.tknex, data.u)
  }

  return login(input.email, input.password)
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
