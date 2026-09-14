import { Navigate, Outlet, useLocation } from 'react-router'

import { useDailyBonus } from '@/api/hooks/useDailyBonus'
import { useAuth } from '@/auth/useAuth'

/**
 * Gate for everything behind the login. Because the session is hydrated from
 * localStorage synchronously, there is no "checking…" state to render — a
 * returning user goes straight to the page they asked for.
 *
 * It is also where the [daily login bonus](../api/hooks/useDailyBonus.ts) is
 * collected: this component is the app's one "the reader is signed in" seam,
 * it stays mounted across every navigation behind it, and the bonus is paid
 * per account rather than per league.
 */
export function RequireAuth() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  // Before the gate below, because hooks cannot live behind a return. The hook
  // does nothing until there is a session.
  useDailyBonus()

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        // Remember where they were headed so login can send them back.
        state={{ from: location.pathname + location.search }}
      />
    )
  }

  return <Outlet />
}

/** Inverse gate: keeps a signed-in user off the login screen. */
export function RedirectIfAuthenticated({
  children,
}: {
  children: React.ReactNode
}) {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/" replace />
  return children
}
