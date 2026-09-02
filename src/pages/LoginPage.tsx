import { Eye, EyeOff } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'

import { ApiError } from '@/api/errors'
import { loadLastEmail } from '@/auth/authStorage'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { storageAvailable } from '@/lib/storage'

interface LocationState {
  from?: string
}

export function LoginPage() {
  const { signIn, isBusy } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Pre-filled with the address last registered or signed in with, so a
  // returning user only types a password. Read once, in the initializer.
  const [email, setEmail] = useState(() => loadLastEmail() ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      await signIn({ email, password })
      const from = (location.state as LocationState | null)?.from
      await navigate(from ?? '/', { replace: true })
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 401
          ? 'E-Mail oder Passwort ist falsch.'
          : caught instanceof Error
            ? caught.message
            : 'Anmeldung fehlgeschlagen.',
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
            Mit deinem Kickbase-Konto anmelden
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
            label="Passwort"
            type={showPassword ? 'text' : 'password'}
            name="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
            }}
            autoComplete="current-password"
            required
            placeholder="••••••••"
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

          {/* Staying signed in is no longer a choice, so this states what
              happens instead of offering a toggle. The information itself is
              kept: it is the one place a real trade-off is disclosed. */}
          <p className="rounded-xl border border-line bg-surface px-3 py-3 text-sm">
            <span className="font-medium text-ink">Du bleibst angemeldet</span>
            <span className="mt-0.5 block text-xs leading-snug text-faint">
              Kickbase gibt kein Refresh-Token aus — ohne gespeicherte
              Zugangsdaten endet die Sitzung, sobald das Token abläuft (ca. 7
              Tage). litbase speichert sie deshalb in diesem Browser, damit die
              Anmeldung im Hintergrund erneuert werden kann. Über{' '}
              <span className="text-muted">Abmelden</span> werden sie wieder
              gelöscht.
            </span>
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
              Dein Browser blockiert die lokale Speicherung. Die Anmeldung
              funktioniert, gilt aber nur für diesen Tab.
            </p>
          )}

          <Button type="submit" size="lg" fullWidth isLoading={isBusy}>
            Anmelden
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Noch kein Konto?{' '}
          <Link
            to="/register"
            className="font-semibold text-accent underline-offset-4 hover:underline"
          >
            Registrieren
          </Link>
        </p>

        <p className="mt-4 text-center text-xs leading-relaxed text-faint">
          Deine Zugangsdaten gehen direkt an api.kickbase.com. litbase hat
          keinen eigenen Server.
        </p>
      </div>
    </div>
  )
}
