import { anonymousRequest, post } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import type { LoginRequest, LoginResponse } from '@/api/types'
import type { StoredSession } from '@/auth/authStorage'

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

  return sessionFromLogin(data)
}

function sessionFromLogin(data: LoginResponse): StoredSession {
  const expiresAt = Date.parse(data.tknex)

  return {
    token: data.tkn,
    // Fall back to 6 days if the server ever sends an unparseable expiry, so a
    // bad date can't lock the user out immediately.
    expiresAt: Number.isNaN(expiresAt)
      ? Date.now() + 6 * 24 * 60 * 60 * 1000
      : expiresAt,
    user: {
      id: data.u.id,
      name: data.u.name,
      email: data.u.email,
      avatar: data.u.profile ?? data.u.uim,
    },
  }
}
