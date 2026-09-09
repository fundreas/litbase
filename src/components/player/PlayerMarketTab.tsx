import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { useState } from 'react'

import { usePlayerForecast } from '@/api/hooks/usePlayerForecast'
import {
  forecastAhead,
  MARKET_VALUE_WINDOWS,
  windowSlice,
  type MarketValueDay,
  type MarketValueHistory,
  type MarketValueWindow,
  type PlayerDetail,
} from '@/api/models'
import { MarketValueChart } from '@/components/player/MarketValueChart'
import { MarketValueCard } from '@/components/player/PlayerStatCards'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/States'
import { useActiveLeague } from '@/league/useActiveLeague'
import { cn } from '@/lib/cn'
import { money, moneyDelta, weekdayDate } from '@/lib/format'

/**
 * The market value: where it is and where it has been.
 *
 * **No manager panel here.** Who owns the player, what they paid and how that
 * is going is the Details tab's Manager card; a second copy on this tab was
 * the same three facts a scroll apart.
 *
 * One request backs the whole tab. `/marketvalue/{days}` only answers for
 * `365` — every shorter window returns an empty list rather than an error — so
 * the four buttons slice one year of daily values rather than re-fetching.
 *
 * **The chart and the list are sampled differently on purpose.** The chart
 * draws every day in the window, because a line built from every tenth point
 * loses exactly the spikes worth looking at. The list steps by 1 / 3 / 5 / 10
 * days, because 365 rows is not something anyone reads. Both come from the
 * same slice, so they never disagree about the period.
 *
 * **The list is headed by the forecast**, from the
 * [foresight API](../../api/hooks/usePlayerForecast.ts) rather than Kickbase:
 * the next few days, newest first like the rest of the list, each row wearing
 * an `FC` chip so a prediction is never read as a value somebody stamped. It
 * is a second request to a foreign static host, so it is deliberately *not*
 * waited for — no skeleton, no error box — and the days simply appear on top
 * when they land. The chart is left alone: a forecast drawn in the same line
 * as the history would be a claim the model cannot make.
 */
export function PlayerMarketTab({
  player,
  history,
}: {
  player: PlayerDetail
  history: MarketValueHistory
}) {
  const { competitionId } = useActiveLeague()
  const [window, setWindow] = useState<MarketValueWindow>(
    // 1 month: the window a manager weighing a buy or sell actually cares
    // about — every day is plotted, so the last few moves read clearly.
    MARKET_VALUE_WINDOWS[0],
  )

  // Unconditional, as hooks must be — the early return below sits under it.
  const forecast = usePlayerForecast(competitionId, player.id)

  if (history.days.length === 0) {
    return (
      <EmptyState
        title="Kein Marktwertverlauf"
        description="Für diesen Spieler liefert Kickbase keine Werte der letzten zwölf Monate."
      />
    )
  }

  const { chart, rows } = windowSlice(history, window)

  // Newest first, like the history rows they sit on top of — so the column
  // reads forwards-to-backwards in time without a break in the middle.
  const predicted = [...forecastAhead(history, forecast.data)].reverse()

  return (
    <div className="flex flex-col gap-4">
      {/* The same card the Details tab leads with — one figure and its
          24-hour move, not two boxes to pair up by eye. */}
      <MarketValueCard
        marketValue={player.marketValue}
        changeDay={player.marketValueChangeDay}
      />

      <WindowToggle selected={window} onSelect={setWindow} />

      <MarketValueChart days={chart} />

      <ExtremesCard history={history} />

      <Card>
        <CardHeader
          title="Verlauf"
          action={
            <span className="text-xs text-faint">
              {window.step === 1
                ? 'täglich'
                : `alle ${String(window.step)} Tage`}
            </span>
          }
        />
        <ul className="divide-y divide-line">
          {[...predicted, ...rows].map((day) => (
            <li key={day.date}>
              <DayRow day={day} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function WindowToggle({
  selected,
  onSelect,
}: {
  selected: MarketValueWindow
  onSelect: (window: MarketValueWindow) => void
}) {
  return (
    <div
      role="group"
      aria-label="Zeitraum"
      className="flex gap-1 rounded-xl border border-line bg-surface p-1"
    >
      {MARKET_VALUE_WINDOWS.map((window) => {
        const isSelected = window.days === selected.days
        return (
          <button
            key={window.days}
            type="button"
            aria-pressed={isSelected}
            onClick={() => {
              onSelect(window)
            }}
            className={cn(
              'h-9 flex-1 rounded-lg text-sm font-medium transition-colors',
              isSelected
                ? 'bg-accent font-semibold text-accent-ink'
                : 'text-muted hover:text-ink',
            )}
          >
            {window.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * The twelve-month high and low.
 *
 * Computed from the series rather than read off the payload's `lmv`/`hmv`: the
 * API includes days from before the player entered the competition as `mv: 0`
 * and takes the plain minimum over them, so `lmv` is `0` for anyone who joined
 * the league inside the last year. The high is unaffected, but both are
 * derived here so the pair is consistent.
 */
function ExtremesCard({ history }: { history: MarketValueHistory }) {
  const { high, low } = history
  if (high === undefined || low === undefined) return null

  return (
    <div className="grid grid-cols-2 gap-2">
      <Extreme
        label="Höchstwert"
        day={high}
        icon={<ArrowUpRight size={12} aria-hidden="true" />}
        className="text-positive"
      />
      <Extreme
        label="Tiefstwert"
        day={low}
        icon={<ArrowDownRight size={12} aria-hidden="true" />}
        className="text-negative"
      />
    </div>
  )
}

function Extreme({
  label,
  day,
  icon,
  className,
}: {
  label: string
  day: MarketValueDay
  icon: React.ReactNode
  className: string
}) {
  return (
    <div className="rounded-card border border-line bg-surface px-3 py-2.5">
      <div className="flex items-center gap-1 text-[0.6875rem] tracking-wide text-faint uppercase">
        <span className={className}>{icon}</span>
        {label}
      </div>
      <div className="nums mt-0.5 truncate text-base font-semibold text-ink">
        {money(day.value)}
      </div>
      <div className="nums mt-0.5 truncate text-xs text-muted">
        {weekdayDate(day.date)}
      </div>
    </div>
  )
}

/**
 * One day: what the player was worth, and what changed overnight.
 *
 * A forecast day is the same row with a chip and a lighter value — the figures
 * line up with the real ones above and below it, which is the whole point of
 * listing them together, and the chip is what says which kind of day it is.
 */
function DayRow({ day }: { day: MarketValueDay }) {
  const isForecast = day.isForecast === true

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2',
        isForecast && 'bg-accent/[0.06]',
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="truncate text-sm text-muted">
          {weekdayDate(day.date)}
        </span>
        {isForecast && <ForecastChip />}
      </span>
      <span
        className={cn(
          'nums shrink-0 text-sm font-semibold',
          isForecast ? 'text-muted' : 'text-ink',
        )}
      >
        {money(day.value)}
      </span>
      <span
        className={cn(
          'nums w-20 shrink-0 text-right text-xs',
          day.change === undefined && 'text-faint',
          day.change !== undefined && day.change > 0 && 'text-positive',
          day.change !== undefined && day.change < 0 && 'text-negative',
          day.change === 0 && 'text-faint',
        )}
      >
        {day.change === undefined ? '–' : moneyDelta(day.change)}
      </span>
    </div>
  )
}

/**
 * The mark that says "this day has not happened yet".
 *
 * Two letters rather than the word: it rides in the row's date column next to
 * a weekday and a date, and *Prognose* spelled out there pushed the date off a
 * phone-width line. The full word is the `title`, and the `sr-only` span is
 * what a screen reader reads instead of spelling out "eff cee".
 */
function ForecastChip() {
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
