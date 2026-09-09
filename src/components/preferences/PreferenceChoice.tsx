import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/cn'

/** One answer to a setting: what it is, what it looks like, what it is called. */
export interface PreferenceOption<T extends string> {
  value: T
  label: string
  icon: LucideIcon
  /**
   * What choosing it actually does, shown under the row **only while it is
   * the chosen one**.
   *
   * A line per option, all of them on screen at once, would turn a page of
   * three-word answers into a wall to read. One line that changes as you tap
   * is the same information at the moment it is relevant — and it doubles as
   * confirmation that the tap landed.
   */
  hint?: string
}

/**
 * One setting, as a row of segments: a name, and every answer to it visible
 * at once.
 *
 * A segmented row rather than a `<select>` or a stack of radios, because
 * every one of these has **two or three short answers and no cost to changing
 * your mind**. All of them being on screen means the choice can be read
 * without opening anything, and the tap that changes it is the same tap that
 * reveals what the alternatives were.
 *
 * It is a real `radiogroup`: arrow keys move between the segments, the group
 * is announced with its name, and the state is `aria-checked` rather than
 * only a colour. `tabIndex` follows the standard radio pattern — one stop for
 * the whole group, landing on the chosen segment.
 *
 * The generic keeps a setting's own union — `'left' | 'right' | 'hide'` — all
 * the way through, so a page cannot hand this an option that
 * [`Preferences`](../../preferences/preferences.ts) has no field for.
 */
export function PreferenceChoice<T extends string>({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string
  description?: string
  value: T
  options: readonly PreferenceOption<T>[]
  onChange: (value: T) => void
}) {
  const chosen = options.find((option) => option.value === value)

  return (
    <div className="px-4 py-3.5">
      <p className="text-sm font-semibold text-ink">{label}</p>
      {description !== undefined && (
        <p className="mt-0.5 text-xs leading-snug text-muted">{description}</p>
      )}

      <div
        role="radiogroup"
        aria-label={label}
        className="mt-3 flex gap-1 rounded-xl border border-line bg-canvas p-1"
      >
        {options.map((option) => {
          const isChosen = option.value === value
          const Icon = option.icon

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isChosen}
              // The group is one tab stop; within it the arrow keys move, which
              // is what the roving index is for.
              tabIndex={isChosen ? 0 : -1}
              onClick={() => {
                onChange(option.value)
              }}
              onKeyDown={(event) => {
                const step =
                  event.key === 'ArrowRight' || event.key === 'ArrowDown'
                    ? 1
                    : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                      ? -1
                      : 0
                if (step === 0) return
                event.preventDefault()
                const index = options.findIndex((it) => it.value === value)
                const next =
                  options[(index + step + options.length) % options.length]
                if (next !== undefined) onChange(next.value)
              }}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2',
                'text-xs font-medium transition-colors',
                isChosen
                  ? 'bg-accent text-accent-ink'
                  : 'text-muted hover:bg-surface-2 hover:text-ink',
              )}
            >
              <Icon size={18} aria-hidden="true" />
              {option.label}
            </button>
          )
        })}
      </div>

      {chosen?.hint !== undefined && (
        <p className="mt-2 text-xs leading-snug text-faint">{chosen.hint}</p>
      )}
    </div>
  )
}
