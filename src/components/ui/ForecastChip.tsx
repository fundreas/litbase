/**
 * The mark that says **"this figure has not happened yet"**.
 *
 * Two letters rather than the word: it rides beside a date or a price in a row
 * that already has a weekday, a value and a change in it, and *Prognose*
 * spelled out there pushed the date off a phone-width line. The full word is
 * the `title`, and the `sr-only` span is what a screen reader reads instead of
 * spelling out "eff cee".
 *
 * Shared, because a predicted market value is now drawn in two places that
 * know nothing about each other — the
 * [market tab](../player/PlayerMarketTab.tsx)'s day list and the
 * [scenario](../../pages/WhatIfPage.tsx)'s Kader, where every row carries the
 * value the sale would fetch on the chosen day. One mark for one meaning: a
 * second chip invented locally would be a second thing to learn.
 */
export function ForecastChip() {
  return (
    <span
      title="Prognose"
      className="shrink-0 rounded border border-accent/40 bg-accent/10 px-1 py-px text-[0.5625rem] font-bold tracking-wide text-accent uppercase"
    >
      <span aria-hidden="true">FC</span>
      <span className="sr-only">Prognose</span>
    </span>
  )
}
