import axios from 'axios'

import { toApiError } from '@/api/errors'
import { env } from '@/lib/env'

/** Per-request flags carried through the interceptors. */
export interface RequestMeta {
  /** Skip the Authorization header — used by login. */
  skipAuth?: boolean
  /** Set internally once a request has already been retried after a 401. */
  retriedAfterReauth?: boolean
}

declare module 'axios' {
  // Teaches axios about our `meta` field so it survives request config typing.
  interface AxiosRequestConfig {
    meta?: RequestMeta
  }
}

/**
 * The single axios instance for all Kickbase traffic.
 *
 * Two hooks are installed from the auth layer at startup (see `AuthProvider`),
 * which keeps this module free of React and free of circular imports:
 *
 *  - {@link setTokenProvider} — where to read the current bearer token from.
 *  - {@link setReauthHandler} — what to do about a 401.
 */
export const api = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 20_000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    // Kickbase localises the prose it serves — the injury reasons in `stxt`
    // above all. Without this header they arrive in English ("Training deficit
    // - misses DFB-Pokal match") in the middle of an otherwise German UI; with
    // it, "Trainingsrückstand - verpasst DFB-Pokal-Spiel". Verified against a
    // live response. Everything else in the payloads is codes and numbers, so
    // this is the only thing the header changes.
    'Accept-Language': 'de-DE,de;q=0.9',
  },
})

type TokenProvider = () => string | null
type ReauthHandler = () => Promise<string | null>

let tokenProvider: TokenProvider = () => null
let reauthHandler: ReauthHandler | null = null

export function setTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider
}

/**
 * Register the recovery path for an expired token. It must return a fresh
 * token (the failed request is then retried once) or `null` to give up.
 * The handler is responsible for de-duplicating concurrent calls.
 */
export function setReauthHandler(handler: ReauthHandler | null): void {
  reauthHandler = handler
}

/** Mark a request as not needing (or wanting) the Authorization header. */
export const anonymousRequest = { meta: { skipAuth: true } } as const

api.interceptors.request.use((config) => {
  if (config.meta?.skipAuth !== true) {
    const token = tokenProvider()
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) throw toApiError(error)

    const config = error.config
    const status = error.response?.status

    // Kickbase answers **403** for a missing, invalid or expired token; 401 is
    // reserved for rejected login credentials. Both are treated as "the token
    // is no good" here. A genuine permission 403 (a resource the account may
    // not see) would cost one wasted renewal — acceptable, because the retry
    // is capped at one and concurrent renewals are de-duplicated.
    const isAuthFailure = status === 403 || status === 401
    const carriedToken =
      config?.meta?.skipAuth !== true && tokenProvider() !== null

    const canRetry =
      isAuthFailure &&
      carriedToken &&
      config !== undefined &&
      config.meta?.retriedAfterReauth !== true &&
      reauthHandler !== null

    if (canRetry) {
      const freshToken = await reauthHandler!()
      if (freshToken) {
        config.meta = { ...config.meta, retriedAfterReauth: true }
        config.headers.Authorization = `Bearer ${freshToken}`
        return api.request(config)
      }
    }

    throw toApiError(error)
  },
)

/** GET helper that unwraps `response.data` and throws {@link ApiError}. */
export async function get<T>(
  url: string,
  config?: Parameters<typeof api.get>[1],
): Promise<T> {
  const response = await api.get<T>(url, config)
  return response.data
}

/** POST helper that unwraps `response.data` and throws {@link ApiError}. */
export async function post<T>(
  url: string,
  body?: unknown,
  config?: Parameters<typeof api.post>[2],
): Promise<T> {
  const response = await api.post<T>(url, body, config)
  return response.data
}
