import { QueryClient } from '@tanstack/react-query'

import { ApiError } from '@/api/errors'

const MINUTE = 60_000

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Kickbase data (market values, points) moves on the order of minutes,
        // not seconds. Per-query overrides tighten this where it matters.
        staleTime: 2 * MINUTE,
        gcTime: 30 * MINUTE,
        // On a phone the app is backgrounded constantly; refetching when the
        // user comes back is what makes it feel live.
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: (failureCount, error) => {
          // A 401 is handled by the auth layer's re-auth + single retry; a 4xx
          // will not fix itself. Only transient failures are worth repeating.
          if (error instanceof ApiError) {
            if (error.isUnauthorized) return false
            if (error.status !== undefined && error.status < 500) return false
          }
          return failureCount < 2
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: {
        retry: false,
      },
    },
  })
}
