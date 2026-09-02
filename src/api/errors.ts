import axios from 'axios'

/**
 * Everything the UI needs to render a failure, normalised so components never
 * have to branch on `axios.isAxiosError`.
 *
 * ## Kickbase's error conventions, as observed
 *
 * Failures come back as `{ err: <number>, errMsg: <string>, svcs: [] }`, and
 * the HTTP status is not a reliable guide to what happened:
 *
 *  - `403` — missing, malformed or expired token. **Not 401.** This is the
 *    status that means "re-authenticate".
 *  - `401` — wrong email or password on `/v4/user/login`. Only login uses it.
 *  - `500` — several *validation* errors, e.g. `PasswordTooWeak` and
 *    `InvalidEMailAddress` on register. These are permanent, despite the 5xx.
 *  - `400` — other semantic errors, e.g. `EMailAddressAlreadyTaken`.
 *
 * So `errMsg` is the trustworthy signal and the status is a fallback. That is
 * why `apiError` exists and why `isPermanent` does not simply test `< 500`.
 */
export class ApiError extends Error {
  readonly status: number | undefined
  readonly code: string
  readonly isNetwork: boolean
  /** Token missing, invalid or expired (403), or credentials rejected (401). */
  readonly isUnauthenticated: boolean
  /** Kickbase's numeric code, e.g. `2020`. */
  readonly apiCode: number | undefined
  /** Kickbase's symbolic name, e.g. `PasswordTooWeak`. */
  readonly apiError: string | undefined

  constructor(
    message: string,
    opts: {
      status?: number
      code: string
      apiCode?: number
      apiError?: string
    },
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = opts.status
    this.code = opts.code
    this.apiCode = opts.apiCode
    this.apiError = opts.apiError
    this.isNetwork = opts.code === 'network'
    this.isUnauthenticated = opts.status === 403 || opts.status === 401
  }

  /**
   * True when retrying cannot help: the server gave a semantic reason, or the
   * status is a client error. A validation error served as 500 counts as
   * permanent, which is why `apiError` is checked first.
   */
  get isPermanent(): boolean {
    if (this.isNetwork) return false
    if (this.apiError !== undefined) return true
    return this.status !== undefined && this.status < 500
  }
}

interface KickbaseErrorBody {
  /** Numeric error code. */
  err?: number | string
  /** Symbolic error name — the useful field. */
  errMsg?: string
  message?: string
  msg?: string
}

/**
 * German copy for the error names seen from the API. Anything unmapped falls
 * back to the status-based message, so an unknown `errMsg` still reads sanely.
 */
const MESSAGE_BY_API_ERROR: Record<string, string> = {
  AccessDenied: 'E-Mail oder Passwort ist falsch.',
  InvalidEMailAddress: 'Diese E-Mail-Adresse ist ungültig.',
  PasswordTooWeak:
    'Das Passwort ist zu schwach. Verwende mindestens 8 Zeichen mit Zahlen und Groß-/Kleinschreibung.',
  EMailAddressAlreadyTaken:
    'Für diese E-Mail-Adresse gibt es bereits ein Konto.',
  UserNameAlreadyTaken: 'Dieser Benutzername ist schon vergeben.',
  // Returned as HTTP 500 when joining a league that does not exist.
  NotFound: 'Diese Liga gibt es nicht mehr.',
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
        'Kickbase ist nicht erreichbar. Prüfe deine Verbindung und versuche es erneut.',
        { code: 'network' },
      )
    }

    const body = error.response?.data
    const envelope =
      typeof body === 'object' && body !== null ? body : undefined

    const apiError =
      typeof envelope?.errMsg === 'string' ? envelope.errMsg : undefined
    const apiCode = typeof envelope?.err === 'number' ? envelope.err : undefined

    // Order matters: a mapped errMsg beats a free-text message, which beats
    // the generic status copy. `err` is a *number* here, never a message —
    // rendering it directly would put "2020" in front of the user.
    const message =
      (apiError !== undefined ? MESSAGE_BY_API_ERROR[apiError] : undefined) ??
      envelope?.message ??
      envelope?.msg ??
      defaultMessageFor(status)

    return new ApiError(message, {
      status,
      code: apiError ?? `http_${String(status)}`,
      apiCode,
      apiError,
    })
  }

  return new ApiError(
    error instanceof Error ? error.message : 'Etwas ist schiefgelaufen.',
    { code: 'unknown' },
  )
}

function defaultMessageFor(status: number): string {
  switch (status) {
    case 400:
      return 'Kickbase hat die Anfrage abgelehnt.'
    case 401:
      return 'E-Mail oder Passwort ist falsch.'
    case 403:
      return 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.'
    case 404:
      return 'Nicht gefunden.'
    case 429:
      return 'Zu viele Anfragen — gib Kickbase einen Moment.'
    default:
      return status >= 500
        ? 'Bei Kickbase gibt es gerade ein Problem. Versuche es in Kürze erneut.'
        : `Anfrage fehlgeschlagen (${String(status)}).`
  }
}
