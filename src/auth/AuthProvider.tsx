import { useQueryClient } from '@tanstack/react-query'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { setReauthHandler, setTokenProvider } from '@/api/client'
import { ApiError } from '@/api/errors'
import { login, register } from '@/auth/authApi'
import { AuthContext, type AuthContextValue } from '@/auth/authContext'
import {
  clearCredentials,
  clearLastLeagueId,
  clearSession,
  hasStoredCredentials,
  isExpired,
  loadCredentials,
  loadSession,
  REFRESH_LEAD_MS,
  saveCredentials,
  saveLastEmail,
  saveSession,
  shouldRefreshNow,
  type StoredSession,
} from '@/auth/authStorage'

/**
 * Owns the session and keeps it alive.
 *
 * Three things happen here:
 *
 *  1. **Hydration** — the persisted session is read synchronously during the
 *     first render, so a returning user never sees a login flash.
 *  2. **Token plumbing** — the axios instance is handed a getter for the
 *     current token, via a ref so it is always the live value.
 *  3. **Renewal** — because Kickbase has no refresh endpoint (see
 *     `authStorage.ts`), renewal is a silent re-login using the stored
 *     credentials. It is triggered by a timer 12h before expiry, on tab focus,
 *     on reconnect, and reactively by any authenticated request that comes
 *     back **403** — the status Kickbase uses for a dead token (401 is only
 *     for rejected login credentials). See `api/errors.ts`.
 *
 * Must be rendered inside a `QueryClientProvider`: signing out clears the cache
 * so one user's data can never be shown to the next.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const [session, setSession] = useState<StoredSession | null>(() => {
    const stored = loadSession()
    if (!stored) return null
    // A token that is already dead is only useful if we can silently replace it.
    if (isExpired(stored.expiresAt) && !hasStoredCredentials()) {
      clearSession()
      return null
    }
    return stored
  })
  const [isBusy, setIsBusy] = useState(false)
  const [isRemembered, setIsRemembered] = useState(hasStoredCredentials)

  // The interceptor reads the token outside of React's render cycle, so it
  // needs a ref rather than the state value captured in a closure. Every path
  // that changes the session (applySession, signOut) updates this ref too, so
  // it never has to be re-synced during render.
  const tokenRef = useRef<string | null>(session?.token ?? null)

  useEffect(() => {
    setTokenProvider(() => tokenRef.current)
    return () => {
      setTokenProvider(() => null)
    }
  }, [])

  const applySession = useCallback((next: StoredSession) => {
    tokenRef.current = next.token
    saveSession(next)
    setSession(next)
  }, [])

  const signOut = useCallback(() => {
    tokenRef.current = null
    clearSession()
    clearCredentials()
    clearLastLeagueId()
    setIsRemembered(false)
    setSession(null)
    // Drop every cached response — it belonged to the signed-out account.
    queryClient.clear()
  }, [queryClient])

  /**
   * Shared tail of sign-in and sign-up.
   *
   * Credentials are **always** persisted. Kickbase has no refresh endpoint, so
   * without them a session dies at the token's ~7-day expiry with no way to
   * renew it — which is a poor default for an app people check weekly. Both
   * forms state this in plain text rather than offering a toggle.
   */
  const adoptSession = useCallback(
    (next: StoredSession, email: string, password: string) => {
      // A different account must not inherit the previous one's league, which
      // `/` would otherwise try to restore.
      if (session !== null && session.user.id !== next.user.id) {
        clearLastLeagueId()
      }

      saveCredentials(email, password)
      // Deliberately not cleared on sign-out — it only saves typing on the
      // next sign-in and holds no secret.
      saveLastEmail(email)
      setIsRemembered(true)
      applySession(next)
    },
    [applySession, session],
  )

  const signIn = useCallback<AuthContextValue['signIn']>(
    async ({ email, password }) => {
      setIsBusy(true)
      try {
        adoptSession(await login(email, password), email, password)
      } finally {
        setIsBusy(false)
      }
    },
    [adoptSession],
  )

  const signUp = useCallback<AuthContextValue['signUp']>(
    async ({ email, username, password }) => {
      setIsBusy(true)
      try {
        const next = await register({ email, username, password })
        adoptSession(next, email, password)
        // A fresh account has no leagues, so there is nothing to remember yet.
        clearLastLeagueId()
      } finally {
        setIsBusy(false)
      }
    },
    [adoptSession],
  )

  /* ---------------------------------------------------------------------- */
  /* Silent renewal                                                          */
  /* ---------------------------------------------------------------------- */

  // Concurrent auth failures must produce one login call, not one per request.
  const renewalInFlight = useRef<Promise<string | null> | null>(null)

  const renewSession = useCallback(async (): Promise<string | null> => {
    if (renewalInFlight.current) return renewalInFlight.current

    const credentials = loadCredentials()
    if (!credentials) {
      // Nothing to renew with: the user has to sign in by hand.
      signOut()
      return null
    }

    const attempt = (async () => {
      setIsBusy(true)
      try {
        const next = await login(credentials.email, credentials.password)
        applySession(next)
        return next.token
      } catch (error) {
        // Credentials that the server rejects will never start working, so stop
        // retrying and send the user to the login screen. A network blip or a
        // Kickbase outage, on the other hand, keeps the session intact.
        if (error instanceof ApiError && error.isPermanent) signOut()
        return null
      } finally {
        setIsBusy(false)
        renewalInFlight.current = null
      }
    })()

    renewalInFlight.current = attempt
    return attempt
  }, [applySession, signOut])

  // Reactive path: an authenticated 403 (or 401) gets one renewal + one retry.
  useEffect(() => {
    setReauthHandler(renewSession)
    return () => {
      setReauthHandler(null)
    }
  }, [renewSession])

  // Proactive path: renew shortly before the token dies, and whenever the user
  // returns to a tab that has been sitting in the background for days.
  useEffect(() => {
    if (!session) return

    let timer: number | undefined

    const check = () => {
      if (!isRemembered) return
      if (shouldRefreshNow(session.expiresAt)) {
        void renewSession()
        return
      }
      const delay = session.expiresAt - REFRESH_LEAD_MS - Date.now()
      timer = window.setTimeout(
        () => {
          void renewSession()
        },
        Math.max(delay, 1000),
      )
    }

    const onWake = () => {
      if (document.visibilityState !== 'visible') return
      // A dead token with no way to renew it means the session is over.
      if (isExpired(session.expiresAt) && !isRemembered) {
        signOut()
        return
      }
      check()
    }

    check()
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('online', onWake)

    return () => {
      if (timer !== undefined) window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('online', onWake)
    }
  }, [session, isRemembered, renewSession, signOut])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      isAuthenticated: session !== null,
      isBusy,
      expiresAt: session?.expiresAt ?? null,
      isRemembered,
      signIn,
      signUp,
      signOut,
    }),
    [session, isBusy, isRemembered, signIn, signUp, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
