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
import { login } from '@/auth/authApi'
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
 *     `authStorage.ts`), renewal is a silent re-login using opt-in stored
 *     credentials. It is triggered by a timer 12h before expiry, on tab focus,
 *     on reconnect, and reactively by any request that comes back 401.
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

  const signIn = useCallback<AuthContextValue['signIn']>(
    async ({ email, password, remember }) => {
      setIsBusy(true)
      try {
        const next = await login(email, password)
        if (remember) {
          saveCredentials(email, password)
        } else {
          clearCredentials()
        }
        setIsRemembered(remember)
        applySession(next)
      } finally {
        setIsBusy(false)
      }
    },
    [applySession],
  )

  /* ---------------------------------------------------------------------- */
  /* Silent renewal                                                          */
  /* ---------------------------------------------------------------------- */

  // Concurrent 401s must produce one login call, not one per request.
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
        const isPermanent =
          error instanceof ApiError &&
          !error.isNetwork &&
          error.status !== undefined &&
          error.status < 500
        if (isPermanent) signOut()
        return null
      } finally {
        setIsBusy(false)
        renewalInFlight.current = null
      }
    })()

    renewalInFlight.current = attempt
    return attempt
  }, [applySession, signOut])

  // Reactive path: any 401 gets one renewal + one retry.
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
      signOut,
    }),
    [session, isBusy, isRemembered, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
