import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { useState } from 'react'

import {
  MARKET_VALUE_WINDOWS,
  purchasePremium,
  windowSlice,
  type MarketValueDay,
  type MarketValueHistory,
  type MarketValueWindow,
  type PlayerDetail,
  type PlayerOwnership,
} from '@/api/models'
import { MarketValueChart } from '@/components/player/MarketValueChart'
import { MarketValueCard } from '@/components/player/PlayerStatCards'
import { Avatar } from '@/components/ui/Avatar'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { money, moneyDelta, weekdayDate } from '@/lib/format'

/**
 * The market value: where it is, where it has been, and what it has cost the
 * manager who owns the player.
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
  ownership,
}: {
  player: PlayerDetail
  history: MarketValueHistory
  /** Absent while loading, and for a player nobody owns. */
  ownership: PlayerOwnership | undefined
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

      {ownership !== undefined && (
        <OwnershipCard ownership={ownership} marketValue={player.marketValue} />
      )}

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

/** What the owner paid, what it was worth then, and where they stand now. */
function OwnershipCard({
  ownership,
  marketValue,
}: {
  ownership: PlayerOwnership
  marketValue: number
}) {
  const premium = purchasePremium(ownership)

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Avatar
              src={ownership.managerImage}
              name={ownership.managerName}
              size={20}
            />
            {ownership.managerName ?? 'Manager'}
            {ownership.isViewer && (
              <span className="text-xs font-medium text-accent">du</span>
            )}
          </span>
        }
        action={
          <span
            className={cn(
              'nums text-sm font-bold',
              ownership.profitLoss > 0 && 'text-positive',
              ownership.profitLoss < 0 && 'text-negative',
              ownership.profitLoss === 0 && 'text-faint',
            )}
          >
            {moneyDelta(ownership.profitLoss)}
          </span>
        }
      />

      {ownership.wasGranted ? (
        <p className="px-4 py-3 text-xs text-muted">
          Beim Ligastart zugeteilt, nicht gekauft — Kickbase führt den
          Einstandswert mit dem damaligen Marktwert, deshalb steht der
          Gewinn/Verlust auf {moneyDelta(ownership.profitLoss)}. Aktueller
          Marktwert: <strong className="text-ink">{money(marketValue)}</strong>.
        </p>
      ) : (
        <dl className="grid grid-cols-3 divide-x divide-line">
          <div className="px-3 py-2.5">
            <dt className="truncate text-[0.6875rem] tracking-wide text-faint uppercase">
              Gezahlt
            </dt>
            <dd className="nums mt-0.5 truncate text-sm font-semibold text-ink">
              {money(ownership.purchasePrice)}
            </dd>
          </div>
          <div className="px-3 py-2.5">
            <dt className="truncate text-[0.6875rem] tracking-wide text-faint uppercase">
              Wert damals
            </dt>
            <dd className="nums mt-0.5 truncate text-sm font-semibold text-ink">
              {ownership.marketValueAtPurchase === undefined
                ? '–'
                : money(ownership.marketValueAtPurchase)}
            </dd>
          </div>
          <div className="px-3 py-2.5">
            <dt className="truncate text-[0.6875rem] tracking-wide text-faint uppercase">
              Aufschlag
            </dt>
            <dd
              className={cn(
                'nums mt-0.5 truncate text-sm font-semibold',
                premium === undefined && 'text-faint',
                premium !== undefined && premium > 0 && 'text-negative',
                premium !== undefined && premium < 0 && 'text-positive',
                premium === 0 && 'text-ink',
              )}
            >
              {premium === undefined ? '–' : moneyDelta(premium)}
            </dd>
          </div>
        </dl>
      )}

      {ownership.since !== undefined && (
        <p className="border-t border-line px-4 py-2 text-[0.6875rem] text-faint">
          Im Kader seit {weekdayDate(ownership.since)}
        </p>
      )}
    </Card>
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
