/** Display formatting. Kickbase is a German product, so de-DE throughout. */

import { nowMs } from '@/lib/clock'

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

/**
 * `+150.000 €`, `−1.200.000 €` — the same signed figure, **to the euro**.
 *
 * For a difference the reader is actively steering: the
 * [offer dialog](../components/market/OfferDialog.tsx) adjusts a bid in steps
 * of one euro, and {@link moneyDelta}'s compact form would round the whole
 * bottom two rows of that keypad into no visible change at all. Same reason the
 * dialog's bounds are spelled out — see {@link moneyExact}.
 */
export function moneyDeltaExact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–'
  const formatted = fullEuro.format(Math.abs(value))
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

/** Below this, the countdown counts **seconds** — see {@link duration}. */
export const COUNTDOWN_SECONDS_FROM = 3 * 60

/**
 * `41 Std.`, `3 Std.`, `14 Min.`, `2:45` — for market listing countdowns.
 *
 * **Hours are the largest unit**, so a listing with two days on it reads
 * `41 Std.` rather than `1 Tag`. Days are the wrong currency here: the
 * question a countdown answers is "can I still think about this", and the
 * answer is arithmetic against the hours in an evening. Rounding 41 hours down
 * to "1 Tag" throws away most of what was asked.
 *
 * The last minutes are spelled out to the second. A listing settles at zero,
 * to whatever bid stands at that moment, so the closing minutes are the only
 * ones where the exact figure changes what you would do — and "1 Min." held
 * still for sixty seconds while the thing you were watching quietly ended.
 * Above {@link COUNTDOWN_SECONDS_FROM} the coarser units are enough, and the
 * caller can tick slowly.
 */
export function duration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'abgelaufen'

  if (seconds < COUNTDOWN_SECONDS_FROM) {
    const whole = Math.floor(seconds)
    const rest = whole % 60
    return `${String(Math.floor(whole / 60))}:${String(rest).padStart(2, '0')}`
  }

  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours >= 1) return `${String(hours)} Std.`
  return `${String(minutes)} Min.`
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

const weekdayDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

/** `Sa, 29. Aug.` — no year, for dates inside the running season. */
export function weekdayDate(iso: string | null | undefined): string {
  if (!iso) return '–'
  const parsed = Date.parse(iso)
  return Number.isNaN(parsed) ? '–' : weekdayDateFormatter.format(parsed)
}

const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * `18:30` — kick-off time, in the reader's own timezone.
 *
 * The API dates everything in UTC (`2026-09-05T16:30:00Z`), which is an hour
 * or two off what the fixture list says in Germany. `Intl` converts to the
 * browser's zone, which is the only one the reader cares about.
 */
export function time(iso: string | null | undefined): string {
  if (!iso) return '–'
  const parsed = Date.parse(iso)
  return Number.isNaN(parsed) ? '–' : timeFormatter.format(parsed)
}

const weekdayFormatter = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' })

/**
 * A kick-off in the width of a figure slot: **`15:30` today, `So` any other
 * day.**
 *
 * The slot is the one a player's points will land in, so it is about five
 * characters wide, and both readings have to fit in it. Which one is wanted
 * depends entirely on the distance:
 *
 *  - **Today**, the time is the whole question — 15:30 or 18:30 is the
 *    difference between "watch this now" and "this evening".
 *  - **Any other day**, the time is the wrong answer to a question nobody
 *    asked. A Friday-evening reader looking at a lineup wants to know that half
 *    of it does not play until Sunday; `15:30` on eleven portraits says they
 *    all kick off at once, which is exactly the impression a matchday spread
 *    over three days should not give.
 *
 * The weekday is abbreviated (`Fr`, `Sa`, `So`) — the same form
 * {@link weekdayDate} uses — because the slot cannot hold *Sonntag* and does
 * not need to: a matchday spans one weekend, so two letters are unambiguous.
 * The full kick-off rides along as the tooltip and the screen-reader text
 * wherever this is drawn.
 *
 * Read against {@link nowMs}, not `Date.now()`, so the
 * [live development profile](../dev/simulation.ts) sees the same "today"
 * everything else does.
 */
export function kickoffShort(
  iso: string | null | undefined,
  now: number = nowMs(),
): string {
  if (!iso) return '–'
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return '–'
  return isSameDay(parsed, now)
    ? timeFormatter.format(parsed)
    : weekdayFormatter.format(parsed)
}

/**
 * The same calendar day **in the reader's own timezone**, which is the only
 * sense of "today" a person means. Not a 24-hour window: a Sunday 15:30
 * kick-off is *tomorrow* from Saturday evening, and eighteen hours away.
 */
function isSameDay(a: number, b: number): boolean {
  const left = new Date(a)
  const right = new Date(b)
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

/**
 * `67'`, `90+'` — the minute a match is at.
 *
 * The API keeps counting into stoppage time: `95` was observed on a finished
 * match whose own `mtd` read `"90"`. Past ninety this collapses to `90+'`,
 * which is what a scoreboard shows and what a viewer expects — the exact figure
 * in the fourth minute of added time is not information anybody wanted.
 */
export function minute(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–'
  return value > 90 ? "90+'" : `${decimal.format(value)}'`
}

/** `Sa, 5. Sep. · 18:30` — a kick-off, spelled out in full. */
export function kickoff(iso: string | null | undefined): string {
  if (!iso) return '–'
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return '–'
  return `${weekdayDateFormatter.format(parsed)} · ${timeFormatter.format(parsed)}`
}

/**
 * `Fr, 4. Sep. – So, 6. Sep.` — a matchday's span.
 *
 * Collapses to a single date when both ends fall on the same day, which is
 * what an English week or a rescheduled matchday looks like.
 */
export function dateRange(
  fromIso: string | null | undefined,
  toIso: string | null | undefined,
): string {
  const from = weekdayDate(fromIso)
  const to = weekdayDate(toIso)
  return from === to ? from : `${from} – ${to}`
}

const relativeFormatter = new Intl.RelativeTimeFormat(LOCALE, {
  numeric: 'auto',
  style: 'short',
})

/**
 * `vor 5 Min.`, `vor 3 Std.`, `gestern`, `Do, 3. Sep.` — how long ago, for a
 * feed.
 *
 * Relative up to a day, because "vor 20 Min." is what a feed reader is asking
 * — was that before or after I looked last. Beyond a day the exact weekday
 * says more than "vor 4 Tagen" does, and it stops the whole log below the fold
 * reading as a countdown. `numeric: 'auto'` is what turns one day into
 * *gestern*.
 */
export function relativeTime(
  iso: string | null | undefined,
  now: number = nowMs(),
): string {
  if (!iso) return '–'
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return '–'
  const seconds = Math.round((parsed - now) / 1000)
  const minutes = Math.round(seconds / 60)
  const hours = Math.round(minutes / 60)
  if (Math.abs(seconds) < 60) return 'gerade eben'
  if (Math.abs(minutes) < 60) return relativeFormatter.format(minutes, 'minute')
  if (Math.abs(hours) < 24) return relativeFormatter.format(hours, 'hour')
  if (isSameDay(parsed, now - 86_400_000)) {
    return relativeFormatter.format(-1, 'day')
  }
  return weekdayDateFormatter.format(parsed)
}

/** Up to two letters for avatar fallbacks. */
export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  const letters = parts.map((part) => part.charAt(0).toUpperCase()).join('')
  return letters || '?'
}
