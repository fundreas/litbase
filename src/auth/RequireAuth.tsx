import { Navigate, Outlet, useLocation } from 'react-router'

import { useAuth } from '@/auth/useAuth'

/**
 * Gate for everything behind the login. Because the session is hydrated from
 * localStorage synchronously, there is no "checking…" state to render — a
 * returning user goes straight to the page they asked for.
 */
export function RequireAuth() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

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
