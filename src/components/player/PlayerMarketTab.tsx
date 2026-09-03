import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { useState } from 'react'

import {
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
 */
export function PlayerMarketTab({
  player,
  history,
}: {
  player: PlayerDetail
  history: MarketValueHistory
}) {
  const [window, setWindow] = useState<MarketValueWindow>(
    // 3 months: long enough to show a trend, short enough that a single day's
    // move is still visible on it.
    MARKET_VALUE_WINDOWS[1],
  )

  if (history.days.length === 0) {
    return (
      <EmptyState
        title="Kein Marktwertverlauf"
        description="Für diesen Spieler liefert Kickbase keine Werte der letzten zwölf Monate."
      />
    )
  }

  const { chart, rows } = windowSlice(history, window)

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
          {rows.map((day) => (
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

/** One day: what the player was worth, and what changed overnight. */
function DayRow({ day }: { day: MarketValueDay }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <span className="min-w-0 flex-1 truncate text-sm text-muted">
        {weekdayDate(day.date)}
      </span>
      <span className="nums shrink-0 text-sm font-semibold text-ink">
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
