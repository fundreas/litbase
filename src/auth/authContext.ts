import { createContext } from 'react'

import type { StoredUser } from '@/auth/authStorage'

export interface AuthContextValue {
  /** `null` while no one is signed in. */
  user: StoredUser | null
  isAuthenticated: boolean
  /** True while a sign-in or silent re-login is in flight. */
  isBusy: boolean
  /** Epoch ms at which the current token stops working. */
  expiresAt: number | null
  /** True when credentials are persisted for silent re-login. */
  isRemembered: boolean
  /**
   * Sign in and stay signed in.
   *
   * There is no `remember` flag: credentials are always persisted, because
   * without them a session simply dies at the token's ~7-day expiry and
   * Kickbase offers no refresh endpoint. Both forms say so in plain text
   * instead of offering a toggle. See `authStorage.ts`.
   */
  signIn: (input: { email: string; password: string }) => Promise<void>
  /**
   * Create an account and sign straight into it — the register response
   * carries a usable token, and Kickbase has no email confirmation step.
   */
  signUp: (input: {
    email: string
    username: string
    password: string
  }) => Promise<void>
  signOut: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
