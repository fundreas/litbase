import { Eye, EyeOff } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'

import { ApiError } from '@/api/errors'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { storageAvailable } from '@/lib/storage'

/**
 * Account creation against `/v4/user/register`.
 *
 * Kickbase creates the account outright — no confirmation email to click — and
 * the response already carries a usable bearer token. So a successful submit
 * signs the user in on the spot and goes straight to `/leagues`; the login
 * form is never involved. See `docs/pages/register.md`.
 */
export function RegisterPage() {
  const { signUp, isBusy } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    // Cheap client-side gate so the obvious cases do not cost a round trip.
    // The server is still the authority — it rejects weak passwords with
    // `PasswordTooWeak`, whose exact policy is not documented.
    if (password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen haben.')
      return
    }

    try {
      await signUp({ email, username, password })
      // Straight to the league gate, not via `/` — the new account has no
      // remembered league to restore, and `replace` keeps the form out of
      // the back-button history now that the session is live.
      await navigate('/leagues', { replace: true })
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Registrierung fehlgeschlagen.',
      )
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            lit<span className="text-accent">base</span>
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Neues Kickbase-Konto anlegen
          </p>
        </div>

        <form
          onSubmit={(event) => {
            void handleSubmit(event)
          }}
          className="flex flex-col gap-4"
          noValidate
        >
          <Input
            label="E-Mail"
            type="email"
            name="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
            }}
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            required
            placeholder="du@example.com"
          />

          <Input
            label="Benutzername"
            type="text"
            name="username"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value)
            }}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="Optional"
            hint="Leer lassen, und Kickbase vergibt einen Namen."
          />

          <Input
            label="Passwort"
            type={showPassword ? 'text' : 'password'}
            name="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
            }}
            autoComplete="new-password"
            required
            placeholder="Mindestens 8 Zeichen"
            hint="Zahlen und Groß-/Kleinschreibung mischen."
            trailing={
              <button
                type="button"
                onClick={() => {
                  setShowPassword((value) => !value)
                }}
                aria-label={
                  showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'
                }
                className="flex h-10 w-10 items-center justify-center rounded-lg text-faint transition-colors hover:text-ink"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />

          {/* No "stay signed in" choice here: a new account is always kept
              signed in, so the wording states what happens rather than
              offering a toggle. */}
          <p className="rounded-xl border border-line bg-surface px-3 py-2.5 text-xs leading-snug text-faint">
            Du wirst direkt angemeldet und bleibst es. Dazu speichert litbase
            deine Zugangsdaten in diesem Browser, damit die Sitzung im
            Hintergrund erneuert werden kann. Über{' '}
            <span className="text-muted">Abmelden</span> werden sie wieder
            gelöscht.
          </p>

          {error !== null && (
            <p
              role="alert"
              className="rounded-xl border border-negative/30 bg-negative/10 px-3 py-2.5 text-sm text-negative"
            >
              {error}
            </p>
          )}

          {!storageAvailable && (
            <p className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs text-warning">
              Dein Browser blockiert die lokale Speicherung. Das Konto wird
              angelegt und du wirst angemeldet, die Sitzung gilt aber nur für
              diesen Tab.
            </p>
          )}

          <Button type="submit" size="lg" fullWidth isLoading={isBusy}>
            Konto erstellen
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Schon ein Konto?{' '}
          <Link
            to="/login"
            className="font-semibold text-accent underline-offset-4 hover:underline"
          >
            Anmelden
          </Link>
        </p>

        <p className="mt-4 text-center text-xs leading-relaxed text-faint">
          Mit dem Erstellen des Kontos akzeptierst du die Nutzungsbedingungen
          von Kickbase. Deine Daten gehen direkt an api.kickbase.com — litbase
          hat keinen eigenen Server.
        </p>
      </div>
    </div>
  )
}
