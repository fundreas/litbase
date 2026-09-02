/** Display formatting. Kickbase is a German product, so de-DE throughout. */

const LOCALE = 'de-DE'

const compactEuro = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'EUR',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const fullEuro = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const decimal = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 })

const signedDecimal = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 0,
  signDisplay: 'exceptZero',
})

/** `12,4 Mio. €` — the default for money on a phone-width screen. */
export function money(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–'
  return compactEuro.format(value)
}

/** `12.350.000 €` — for detail views where the exact figure matters. */
export function moneyExact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–'
  return fullEuro.format(value)
}

/** Compact money with an explicit sign, for gains and losses. */
export function moneyDelta(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–'
  const formatted = compactEuro.format(Math.abs(value))
  if (value === 0) return formatted
  return `${value > 0 ? '+' : '−'}${formatted}`
}

export function points(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–'
  return decimal.format(value)
}

export function delta(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–'
  return signedDecimal.format(value)
}

/** `1.` — placement suffix as used in German tables. */
export function placement(value: number | null | undefined): string {
  if (value === null || value === undefined) return '–'
  return `${decimal.format(value)}.`
}

/** `2 Tage`, `3 Std.`, `14 Min.` — for market listing countdowns. */
export function duration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'abgelaufen'
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days >= 1) return `${String(days)} ${days === 1 ? 'Tag' : 'Tage'}`
  if (hours >= 1) return `${String(hours)} Std.`
  return `${String(Math.max(minutes, 1))} Min.`
}

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

export function date(iso: string | null | undefined): string {
  if (!iso) return '–'
  const parsed = Date.parse(iso)
  return Number.isNaN(parsed) ? '–' : dateFormatter.format(parsed)
}

/** Up to two letters for avatar fallbacks. */
export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  const letters = parts.map((part) => part.charAt(0).toUpperCase()).join('')
  return letters || '?'
}
