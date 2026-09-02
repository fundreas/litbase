import axios from 'axios'

/**
 * Everything the UI needs to render a failure, normalised so components never
 * have to branch on `axios.isAxiosError`.
 */
export class ApiError extends Error {
  readonly status: number | undefined
  readonly code: string
  readonly isNetwork: boolean
  readonly isUnauthorized: boolean

  constructor(message: string, opts: { status?: number; code: string }) {
    super(message)
    this.name = 'ApiError'
    this.status = opts.status
    this.code = opts.code
    this.isNetwork = opts.code === 'network'
    this.isUnauthorized = opts.status === 401
  }
}

interface KickbaseErrorBody {
  /** Kickbase returns human-readable errors under `err` or `message`. */
  err?: string
  message?: string
  msg?: string
}

/** Turn anything thrown by axios into an {@link ApiError}. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  if (axios.isAxiosError<KickbaseErrorBody>(error)) {
    if (error.code === 'ERR_CANCELED') {
      return new ApiError('Request cancelled.', { code: 'cancelled' })
    }
    const status = error.response?.status
    if (status === undefined) {
      return new ApiError(
        'Could not reach Kickbase. Check your connection and try again.',
        { code: 'network' },
      )
    }
    const body = error.response?.data
    const serverMessage =
      typeof body === 'object' && body !== null
        ? (body.err ?? body.message ?? body.msg)
        : undefined

    return new ApiError(serverMessage ?? defaultMessageFor(status), {
      status,
      code: `http_${status}`,
    })
  }

  return new ApiError(
    error instanceof Error ? error.message : 'Something went wrong.',
    { code: 'unknown' },
  )
}

function defaultMessageFor(status: number): string {
  switch (status) {
    case 400:
      return 'Kickbase rejected that request.'
    case 401:
      return 'Your session has expired. Please sign in again.'
    case 403:
      return "You don't have access to this."
    case 404:
      return 'Not found.'
    case 429:
      return 'Too many requests — give Kickbase a moment.'
    default:
      return status >= 500
        ? 'Kickbase is having trouble right now. Try again shortly.'
        : `Request failed (${String(status)}).`
  }
}
