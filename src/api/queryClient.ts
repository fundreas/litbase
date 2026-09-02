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
          // Auth failures are handled by the interceptor's renew-and-retry, and
          // anything Kickbase named in `errMsg` will not fix itself — including
          // the validation errors it serves as 500. Only genuinely transient
          // failures are worth repeating.
          if (error instanceof ApiError) {
            if (error.isUnauthenticated) return false
            if (error.isPermanent) return false
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
