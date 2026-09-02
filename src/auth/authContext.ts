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
  signIn: (input: {
    email: string
    password: string
    remember: boolean
  }) => Promise<void>
  /**
   * Create an account and sign straight into it — the register response
   * carries a usable token, and Kickbase has no email confirmation step.
   *
   * Unlike {@link signIn} there is no `remember` flag: a fresh registration
   * always persists the credentials, so the session renews itself from the
   * start rather than expiring on a brand-new account.
   */
  signUp: (input: {
    email: string
    username: string
    password: string
  }) => Promise<void>
  signOut: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
