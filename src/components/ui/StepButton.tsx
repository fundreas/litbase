import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/cn'

/**
 * One step to the neighbouring item, flanking a picker.
 *
 * The pickers in this app are a tap-the-label-to-open-a-drawer pattern, which
 * is right for *jumping* somewhere — and wrong for the thing they are actually
 * used for most of the time, which is moving one step. That was three taps and
 * a scroll through 34 rows to see last week.
 *
 * **Disabled, never absent.** At either end of the range the arrow greys out
 * and keeps its place, so the label beside it does not shift sideways as you
 * walk the range — a control that vanishes takes the layout with it.
 *
 * **Left is always earlier.** Whatever order the underlying list happens to be
 * in — matchdays run oldest first, seasons newest first — the left arrow steps
 * back in time. The caller resolves its own neighbours; this only draws them.
 *
 * `label` should name the **destination** ("3. Spieltag", "2024/2025") rather
 * than the direction: it is the tooltip and the accessible name, and "zurück"
 * says less than the place you land.
 */
export function StepButton({
  direction,
  label,
  onClick,
  disabled = false,
}: {
  direction: 'previous' | 'next'
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  const Icon = direction === 'previous' ? ChevronLeft : ChevronRight

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        // `w-11` is the 44px touch target the app holds itself to; the height
        // comes from `items-stretch` on the row, so it matches the picker
        // beside it without being hard-coded to its padding.
        'flex w-11 shrink-0 items-center justify-center rounded-card border transition-colors',
        disabled
          ? 'border-line/60 bg-surface/40 text-line'
          : 'border-line bg-surface text-muted hover:border-accent/40 hover:bg-surface-2 hover:text-ink active:bg-line',
      )}
    >
      <Icon size={20} aria-hidden="true" />
    </button>
  )
}
