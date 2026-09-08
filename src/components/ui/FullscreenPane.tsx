import * as Dialog from '@radix-ui/react-dialog'
import { Maximize2, X } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * A pitch, given the whole screen.
 *
 * Built on Radix Dialog like the [poster viewer](../player/LineupPosterDialog.tsx),
 * so focus trapping, scroll locking, Escape and `aria-modal` all come for free,
 * and `fixed inset-0` rather than the app's usual centred card for the same
 * reason: there is one object on this screen and a padded panel around it would
 * spend exactly the space that is the point of opening it.
 *
 * ## Why a dialog rather than a route
 *
 * Full-size is a way of *looking* at the thing already on screen, not a
 * different place — there is nothing here that is not on the page behind it, and
 * closing it must land you exactly where you were, mid-scroll and mid-tab. A
 * route would have to reproduce the page's whole state to come back to it; a
 * dialog leaves the page mounted underneath, untouched.
 *
 * It is addressable all the same: the pages that raise it hold `open` in the
 * URL hash — `#fullscreen`, via
 * [`useHashModal`](../../lib/useHashModal.ts) — so the back gesture closes it
 * rather than leaving the pitch, a refresh comes back into it, and Escape and
 * the ✗ do what they always did. A hash is not a route: nothing remounts and
 * no query is refetched to get back out of it.
 *
 * ## The bar replaces the app's header
 *
 * Not hides it — it covers it, which is the same thing to a reader and rather
 * fewer moving parts. The bar carries whatever the page thinks names this pitch
 * (`summary`) and one control, the ✗. A hamburger, a league switcher and an
 * account avatar are all navigation *away*, and there is exactly one thing to do
 * here: stop.
 *
 * The height chain matters as much as the width: `min-h-0 flex-1` all the way
 * down, so the pitch inside measures the screen minus the bar and sizes its
 * portraits to it. That is what makes this worth having at all — the same eleven
 * at twice the size, not a scaled screenshot.
 *
 * **The pitch is moved into here, not copied**, which is what
 * [`usePitchBox`](../squad/pitchMetrics.ts) had to be taught: React mounts a
 * fresh element for the new parent, and a `ResizeObserver` bound once to the
 * first one goes on watching a node that is no longer in the tree. It measured
 * the detached element at `0 × 0`, the sizing fell to its floor, and full screen
 * drew *smaller* portraits than the page it came from. It uses a callback ref
 * now, so the observer follows the element.
 */
export function FullscreenPane({
  open,
  onOpenChange,
  title,
  summary,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Spoken name for the dialog. Not drawn — {@link summary} is. */
  title: string
  /** What the bar shows: the two managers, or the two clubs and the score. */
  summary: ReactNode
  children: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-40 bg-black/80',
            'data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in',
          )}
        />
        <Dialog.Content
          // The bar and the pitch under it say everything there is to say; a
          // description element would only repeat the summary to a reader who
          // has just been handed it.
          aria-describedby={undefined}
          className={cn(
            'fixed inset-0 z-50 flex flex-col bg-canvas',
            'data-[state=open]:animate-fade-in',
          )}
        >
          <div className="pt-safe" />

          <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-3">
            <Dialog.Title className="sr-only">{title}</Dialog.Title>
            <div className="min-w-0 flex-1">{summary}</div>

            <Dialog.Close
              aria-label="Vollbild schließen"
              className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <X size={20} />
            </Dialog.Close>
          </div>

          {/* Padded the way the content well is, so the pitch keeps its rounded
              card edge instead of bleeding into the screen's corners — and
              `pb-safe` so the bottom band clears a home indicator. */}
          <div className="flex min-h-0 flex-1 flex-col px-2 pt-2 pb-safe">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * The way in: a small control in the **top-right corner of the pitch itself**.
 *
 * On the pitch rather than beside it, because that is what it acts on, and in
 * the corner the [side labels](../duels/DuelLineupTab.tsx) leave free — they
 * take the two left-hand ones. Drawn as the same smoked disc those labels use,
 * so it reads as furniture belonging to the pitch rather than a button floating
 * over the grass.
 *
 * The wrapping pitch must be `relative`, which
 * [`Pitch`](../squad/Pitch.tsx) already is.
 */
export function FullscreenButton({
  onClick,
  label = 'Vollbild',
}: {
  onClick: () => void
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'absolute top-1 right-1 z-10 flex h-8 w-8 items-center justify-center rounded-full',
        'bg-black/45 text-white/85 backdrop-blur-sm transition-colors',
        'hover:bg-black/65 hover:text-white',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
      )}
    >
      <Maximize2 size={15} aria-hidden="true" />
    </button>
  )
}
