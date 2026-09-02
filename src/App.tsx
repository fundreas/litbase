import { QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense, useState } from 'react'
import { RouterProvider } from 'react-router'

import { createQueryClient } from '@/api/queryClient'
import { AuthProvider } from '@/auth/AuthProvider'
import { LoadingState } from '@/components/ui/States'
import { env } from '@/lib/env'
import { router } from '@/routes/router'

// Devtools are dev-only and lazy, so they never reach the production bundle.
const ReactQueryDevtools = lazy(async () => ({
  default: (await import('@tanstack/react-query-devtools')).ReactQueryDevtools,
}))

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
      {env.isDev && (
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} />
        </Suspense>
      )}
    </QueryClientProvider>
  )
}
