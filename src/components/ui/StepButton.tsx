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
 *
 * **Two weights, one control.** `card` is the bordered tile that flanks a
 * picker sitting *in* a page; `ghost` is the same button with the tile taken
 * away, for a picker that *is* the page heading — there, three bordered boxes
 * across the top read as a toolbar rather than as a title. The glyph, the
 * target size and the disabled-not-absent rule are identical, which is what
 * keeps them one control rather than two.
 */
export function StepButton({
  direction,
  label,
  onClick,
  disabled = false,
  variant = 'card',
}: {
  direction: 'previous' | 'next'
  label: string
  onClick: () => void
  disabled?: boolean
  variant?: 'card' | 'ghost'
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
        // `w-11` is the 44px touch target the app holds itself to. In `card`
        // the height comes from `items-stretch` on the row, so it matches the
        // picker beside it without being hard-coded to its padding; `ghost`
        // has no tile to match and squares itself off.
        'flex w-11 shrink-0 items-center justify-center transition-colors',
        variant === 'card'
          ? cn(
              'rounded-card border',
              disabled
                ? 'border-line/60 bg-surface/40 text-line'
                : 'border-line bg-surface text-muted hover:border-accent/40 hover:bg-surface-2 hover:text-ink active:bg-line',
            )
          : cn(
              // The app header's own icon buttons, so a control standing in
              // for a page title is drawn like the chrome around it.
              'h-11 rounded-xl',
              disabled
                ? 'text-line'
                : 'text-muted hover:bg-surface-2 hover:text-ink active:bg-line',
            ),
      )}
    >
      <Icon size={20} aria-hidden="true" />
    </button>
  )
}
