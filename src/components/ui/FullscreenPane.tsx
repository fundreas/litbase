import * as Dialog from '@radix-ui/react-dialog'
import { Maximize2, X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * The two spellings of the Fullscreen API that are still in the field.
 *
 * Safari carried the prefixed names alone until 16.4, which is recent enough
 * on iPad — where this *does* work, unlike the iPhone — to be worth the four
 * extra properties. Declared rather than cast at each call site so that a
 * `undefined` check is what the compiler sees, not an `any`.
 */
interface PrefixedElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void
}
interface PrefixedDocument extends Document {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}

function fullscreenElement(): Element | null {
  const owner = document as PrefixedDocument
  return owner.fullscreenElement ?? owner.webkitFullscreenElement ?? null
}

function exitFullscreen(): void {
  const owner = document as PrefixedDocument
  const exit = owner.exitFullscreen ?? owner.webkitExitFullscreen
  // Rejects if something else already left full screen between the check and
  // the call. Nothing to recover: the goal state is the one we are in.
  if (exit !== undefined) void Promise.resolve(exit.call(owner)).catch(() => {})
}

/**
 * **The browser's own full screen, for as long as the pane is open.**
 *
 * The pane was `fixed inset-0` and nothing more until 2026-09-20, which fills
 * the *viewport* — and on a phone the viewport is what is left once the URL
 * bar, the tab strip and the system chrome have taken their bands. That is the
 * difference between a big pitch and a screen with nothing on it but the
 * pitch, and this is the one screen in the app whose entire purpose is the
 * second.
 *
 * ## It is the document that goes full screen, not the dialog
 *
 * Fullscreening `Dialog.Content` is the obvious reading and it quietly breaks
 * the screen. A fullscreen element is the *only* subtree the browser paints,
 * and everything Radix portals — the player breakdown the big pitch opens as
 * `#fullscreen/player:4711`, every select and tooltip — is portalled to
 * `body`, a **sibling** of the pane rather than a child. Those would render
 * into a subtree nobody is looking at: a sheet that opens, traps focus, and is
 * invisible. `documentElement` contains all of it by construction, and the
 * pane is still `fixed inset-0` inside it, so nothing about the layout changes
 * — only how much screen the viewport is.
 *
 * ## Failure is the old behaviour, not an error
 *
 * `requestFullscreen` is absent on iPhone Safari altogether (which grants full
 * screen to `<video>` and nothing else), and rejects inside a frame without
 * `allow="fullscreen"` and whenever the browser judges the gesture too stale.
 * In every one of those the pane is still a `fixed inset-0` overlay over the
 * page — exactly what it was before this existed. So the rejection is
 * swallowed rather than surfaced: there is nothing the reader could do about
 * it and nothing they have lost.
 *
 * ## Escape has to keep meaning one thing
 *
 * In full screen the browser eats the first Escape to leave it, so the keydown
 * never reaches the dialog and the reader is left looking at the pane again,
 * having pressed the key that closes it. So the *exit* is listened for
 * instead: leaving full screen by any route — Escape, F11, the browser's own
 * notification — closes the pane with it. One press, one meaning.
 *
 * Only an exit from full screen **this pane took** closes it. A reader who was
 * already in full screen before opening the pitch keeps it when they close the
 * pitch, and does not have the pane shut under them by an exit they never
 * made.
 */
function useBrowserFullscreen(open: boolean, onExit: () => void): void {
  // The close callback is read at event time, not captured: it is a fresh
  // closure on every render of the pane, and listing it as a dependency below
  // would exit and re-enter full screen — a full-screen flash of the whole
  // display — on each one. Kept current from an effect of its own rather than
  // written during render, which is the same latest-ref pattern minus the
  // render-phase side effect.
  const exitHandler = useRef(onExit)
  useEffect(() => {
    exitHandler.current = onExit
  })

  useEffect(() => {
    if (!open) return

    const root = document.documentElement as PrefixedElement
    const request = root.requestFullscreen ?? root.webkitRequestFullscreen
    if (request === undefined) return

    /** Did *this* pane take full screen? Only then may it give it back. */
    let ours = false
    /** Closed while the request was still in flight. */
    let released = false

    const giveBack = () => {
      if (!ours) return
      // Cleared before exiting, so the `fullscreenchange` our own exit fires
      // is not mistaken for the reader leaving.
      ours = false
      if (fullscreenElement() !== null) exitFullscreen()
    }

    void Promise.resolve(request.call(root)).then(
      () => {
        ours = true
        if (released) giveBack()
      },
      () => {
        // iPad Safari before the permission, a sandboxed frame, a stale
        // gesture. The pane covers the viewport either way.
      },
    )

    const onChange = () => {
      if (!ours || fullscreenElement() !== null) return
      ours = false
      exitHandler.current()
    }

    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)

    return () => {
      released = true
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
      giveBack()
    }
  }, [open])
}

/**
 * A pitch, given the whole screen.
 *
 * Built on Radix Dialog like the [poster viewer](../player/LineupPosterDialog.tsx),
 * so focus trapping, scroll locking, Escape and `aria-modal` all come for free,
 * and `fixed inset-0` rather than the app's usual centred card for the same
 * reason: there is one object on this screen and a padded panel around it would
 * spend exactly the space that is the point of opening it.
 *
 * **And the browser's full screen underneath it** — see
 * {@link useBrowserFullscreen}. `fixed inset-0` only ever claimed the viewport,
 * which on a phone is the screen minus the URL bar and the system chrome; the
 * Fullscreen API claims the rest. Where it is refused, which is every iPhone,
 * the pane is exactly what it was before.
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
 * `actions` is the one opening in that rule, and it is a narrow one: a control
 * that acts on **this screen** rather than leaving it — the match pitch's
 * [event-stream bell](../matchday/LiveEventTicker.tsx). It sits left of the ✗,
 * so *close* stays in the corner every one of these panes has put it in.
 *
 * `banner` is a strip **under** the bar and above the content, for something
 * that changes while the reader watches. It takes its own height out of the
 * pitch's, which is why it is a slot rather than something drawn over the
 * grass: the pitch sizes its portraits to the box it is given, and a strip
 * floating over it would be covering the top band of players. Pass it only
 * while it has a reason to be there — a pitch whose box keeps changing re-runs
 * its sizing search each time.
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
  actions,
  banner,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Spoken name for the dialog. Not drawn — {@link summary} is. */
  title: string
  /** What the bar shows: the two managers, or the two clubs and the score. */
  summary: ReactNode
  /** A control acting on this screen, drawn left of the ✗. */
  actions?: ReactNode
  /** A strip between the bar and the content, mounted only when passed. */
  banner?: ReactNode
  children: ReactNode
}) {
  // Not just the page's full screen — the browser's. See the hook.
  useBrowserFullscreen(open, () => {
    onOpenChange(false)
  })

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

            {actions}

            <Dialog.Close
              aria-label="Vollbild schließen"
              className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <X size={20} />
            </Dialog.Close>
          </div>

          {banner}

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
 * the one corner the [side labels](../duels/DuelLineupTab.tsx) never take —
 * they keep to the left on a portrait pitch and to the bottom on a landscape
 * one, so this corner is free in both. Drawn as the same smoked disc those
 * labels use, so it reads as furniture belonging to the pitch rather than a
 * button floating over the grass.
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
