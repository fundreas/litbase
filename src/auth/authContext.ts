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
   * Create an account and sign straight into it. Kickbase has no email
   * confirmation step, so this resolves to an authenticated session.
   */
  signUp: (input: {
    email: string
    username: string
    password: string
    remember: boolean
  }) => Promise<void>
  signOut: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
