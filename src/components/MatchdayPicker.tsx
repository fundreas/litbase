import { Check, ChevronDown } from 'lucide-react'
import { useState } from 'react'

import {
  matchdayState,
  type MatchdayState,
  type SeasonMatchday,
  type SeasonSchedule,
} from '@/api/models'
import { Drawer } from '@/components/ui/Drawer'
import { StepButton } from '@/components/ui/StepButton'
import { cn } from '@/lib/cn'
import { dateRange } from '@/lib/format'

const STATE_LABEL: Record<MatchdayState, string> = {
  finished: 'Beendet',
  live: 'Live',
  upcoming: 'Offen',
}

const STATE_CLASS: Record<MatchdayState, string> = {
  finished: 'text-faint',
  live: 'text-accent',
  upcoming: 'text-muted',
}

/**
 * The selected matchday, and three ways to another one.
 *
 * **Shared, not duel-specific** — it lived under `components/duels/` while the
 * [Duels](../../docs/pages/duels.md) page was its only caller, and moved up
 * here when the [Matchday](../../docs/pages/matchday.md) page needed the same
 * control. Both pages keep the selection in `?day=`, so the picker itself holds
 * no state beyond whether its drawer is open.
 *
 * The heading of the page is itself the control: the middle block is a button,
 * so the thing you are looking at is the thing you tap for the full list. The
 * alternative — a separate "Spieltag wählen" button beside a static label —
 * spends a second row of a phone screen saying the same thing twice.
 *
 * **A step either side of it.** Stepping to the neighbouring matchday is what
 * this control is used for nearly every time; making that go through a drawer
 * of 34 rows was three taps for something that should be one. The arrows flank
 * the label rather than sitting under it, so the block stays one row tall, and
 * they disable at the ends of the season instead of vanishing — a control that
 * disappears takes the layout with it.
 *
 * The list still opens in a drawer on the **right**. Left belongs to the app's
 * navigation, and two drawers arriving from the same edge read as the same
 * surface.
 */
export function MatchdayPicker({
  schedule,
  selectedDay,
  onSelect,
}: {
  schedule: SeasonSchedule
  selectedDay: number
  onSelect: (day: number) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const selected = schedule.matchdays.find((entry) => entry.day === selectedDay)

  /*
   * The neighbours are taken from the schedule rather than `selectedDay ± 1`,
   * so a gap in the fixture list can never step onto a matchday that does not
   * exist. The list is sorted ascending by `useSeasonSchedule`.
   */
  const index = schedule.matchdays.findIndex(
    (entry) => entry.day === selectedDay,
  )
  const previous = index > 0 ? schedule.matchdays[index - 1] : undefined
  const next =
    index >= 0 && index < schedule.matchdays.length - 1
      ? schedule.matchdays[index + 1]
      : undefined

  return (
    <>
      <div className="flex items-stretch gap-2">
        <StepButton
          direction="previous"
          label={
            previous === undefined
              ? 'Kein früherer Spieltag'
              : `${String(previous.day)}. Spieltag`
          }
          disabled={previous === undefined}
          onClick={() => {
            if (previous !== undefined) onSelect(previous.day)
          }}
        />

        <button
          type="button"
          onClick={() => {
            setIsOpen(true)
          }}
          aria-haspopup="dialog"
          className={cn(
            'flex min-w-0 flex-1 items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 text-left',
            'transition-colors hover:border-accent/40 hover:bg-surface-2',
          )}
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span className="nums truncate text-base font-bold text-ink">
                {selectedDay}. Spieltag
              </span>
              {selected !== undefined && <StateChip matchday={selected} />}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted">
              {selected === undefined
                ? 'Kein Spielplan'
                : dateRange(selected.start, selected.end)}
            </span>
          </span>
          <ChevronDown size={20} className="shrink-0 text-faint" />
        </button>

        <StepButton
          direction="next"
          label={
            next === undefined
              ? 'Kein späterer Spieltag'
              : `${String(next.day)}. Spieltag`
          }
          disabled={next === undefined}
          onClick={() => {
            if (next !== undefined) onSelect(next.day)
          }}
        />
      </div>

      <Drawer
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Spieltag wählen"
        side="right"
      >
        <ul className="flex flex-col gap-1">
          {schedule.matchdays.map((matchday) => (
            <li key={matchday.day}>
              <MatchdayRow
                matchday={matchday}
                isSelected={matchday.day === selectedDay}
                isCurrent={matchday.day === schedule.currentDay}
                onSelect={() => {
                  onSelect(matchday.day)
                  setIsOpen(false)
                }}
              />
            </li>
          ))}
        </ul>
      </Drawer>
    </>
  )
}

function MatchdayRow({
  matchday,
  isSelected,
  isCurrent,
  onSelect,
}: {
  matchday: SeasonMatchday
  isSelected: boolean
  isCurrent: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isSelected ? 'true' : undefined}
      // The drawer mounts on open, so a ref callback on the selected row is
      // the moment to scroll it into view — 34 matchdays do not fit, and
      // opening the list at matchday 1 in April would be useless.
      ref={
        isSelected
          ? (node) => {
              node?.scrollIntoView({ block: 'center' })
            }
          : undefined
      }
      className={cn(
        'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors',
        isSelected
          ? 'bg-accent/15 text-accent'
          : 'text-muted hover:bg-surface-2 hover:text-ink',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="nums truncate text-sm font-semibold">
            {matchday.day}. Spieltag
          </span>
          {isCurrent && (
            <span className="shrink-0 text-[0.6875rem] text-faint">
              aktuell
            </span>
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs">
          <span className="truncate text-faint">
            {dateRange(matchday.start, matchday.end)}
          </span>
          <StateChip matchday={matchday} />
        </span>
      </span>
      {isSelected && <Check size={16} className="shrink-0" />}
    </button>
  )
}

/** Beendet / Live / Offen, computed against the clock rather than stored. */
function StateChip({ matchday }: { matchday: SeasonMatchday }) {
  const state = matchdayState(matchday)

  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-1 text-[0.6875rem] font-medium',
        STATE_CLASS[state],
      )}
    >
      {state === 'live' && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
      )}
      {STATE_LABEL[state]}
    </span>
  )
}
