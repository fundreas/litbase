import { QueryClientProvider } from '@tanstack/react-query'
import { Suspense, useState } from 'react'
import { RouterProvider } from 'react-router'

import { createQueryClient } from '@/api/queryClient'
import { AuthProvider } from '@/auth/AuthProvider'
import { LoadingState } from '@/components/ui/States'
import { router } from '@/routes/router'

// The React Query devtools badge is deliberately not mounted — it floats over
// the UI on every screen. `@tanstack/react-query-devtools` is still installed,
// so bringing it back is a lazy import plus one dev-only element.

/**
 * Provider stack, outermost first:
 *
 *   QueryClientProvider  — the cache; must be outside AuthProvider, which
 *                          clears it on sign-out.
 *   AuthProvider         — session, token plumbing, silent renewal.
 *   RouterProvider       — routes, which are guarded by `useAuth`.
 */
export default function App() {
  // useState, not a module-level constant: one client per mounted app, and
  // Fast Refresh does not hand a stale client to a fresh tree.
  const [queryClient] = useState(createQueryClient)

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Suspense fallback={<LoadingState className="min-h-dvh" />}>
          <RouterProvider router={router} />
        </Suspense>
      </AuthProvider>
    </QueryClientProvider>
  )
}
