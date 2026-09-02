import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-5xl font-bold text-accent">404</p>
      <p className="text-sm text-muted">Diese Seite gibt es nicht.</p>
      <Link
        to="/"
        className="inline-flex h-11 items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink shadow-raise transition-[filter] hover:brightness-110"
      >
        Zur Startseite
      </Link>
    </div>
  )
}
