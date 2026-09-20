import * as Dialog from '@radix-ui/react-dialog'
import { Maximize2, Minimize2, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

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
 * Take the browser's own full screen, or give it back.
 *
 * Called **straight out of a click**, which is the whole point — see
 * {@link BrowserFullscreenToggle}.
 */
function requestFullscreen(): Promise<void> | undefined {
  const root = document.documentElement as PrefixedElement
  const request = root.requestFullscreen ?? root.webkitRequestFullscreen
  if (request === undefined) return undefined
  return Promise.resolve(request.call(root))
}

function canGoFullscreen(): boolean {
  const root = document.documentElement as PrefixedElement
  return (
    root.requestFullscreen !== undefined ||
    root.webkitRequestFullscreen !== undefined
  )
}

/**
 * **The browser's own full screen, as a control rather than a side effect.**
 *
 * The pane is `fixed inset-0`, which fills the *viewport* — and on a phone the
 * viewport is what is left once the URL bar, the tab strip and the system
 * chrome have taken their bands. The Fullscreen API claims the rest. That is
 * the difference between a big pitch and a screen with nothing on it but the
 * pitch.
 *
 * ## Why it is a button and not something the pane just does
 *
 * It *was* something the pane just did, for about an hour on 2026-09-20:
 * `requestFullscreen()` from an effect when `open` turned true. That does not
 * work, and the reason is not a bug to be fixed. **Full screen requires
 * transient user activation** — a gesture the browser is still counting as
 * live. An effect runs after the dialog has mounted and painted, by which
 * point Safari and Firefox have both stopped counting; the promise rejects,
 * and it rejects *silently*, so the feature looks like it works on the one
 * browser that is lenient about it and does nothing at all on the others.
 *
 * A click handler is a gesture by definition. So the capability became a
 * control, and three other things fell out of that which are worth more than
 * the tap it costs:
 *
 *  - **It is reversible.** The reader can drop back to the page's chrome
 *    without closing the pitch — leaving full screen and leaving the match were
 *    the same act before, which is one act too few.
 *  - **It says which state it is in.** An implicit request that may or may not
 *    have been granted is not something a button can report; this is.
 *  - **Escape goes back to meaning one thing.** In full screen the browser eats
 *    the first Escape to leave it. When entering was automatic, that keypress
 *    left the reader looking at the pane again, having pressed the key that
 *    closes it — so the exit had to be listened for and the pane closed along
 *    with it, which then made *every* route out of full screen close the match.
 *    Two levels, two presses, no special case.
 *
 * ## It is the document that goes full screen, not the dialog
 *
 * Fullscreening `Dialog.Content` is the obvious reading and it quietly breaks
 * the screen. A fullscreen element is the *only* subtree the browser paints,
 * and everything Radix portals — the player breakdown the big pitch opens as
 * `#fullscreen/player:4711`, every select and tooltip — is portalled to `body`,
 * a **sibling** of the pane rather than a child. Those would render into a
 * subtree nobody is looking at: a sheet that opens, traps focus, and is
 * invisible. `documentElement` contains all of it by construction, and the pane
 * is still `fixed inset-0` inside it, so nothing about the layout changes —
 * only how much screen the viewport is.
 *
 * ## Where it is not offered
 *
 * `requestFullscreen` is absent on iPhone Safari altogether, which grants full
 * screen to `<video>` and nothing else. The control is then **not drawn**,
 * rather than drawn and refused: a button that cannot do its job is worse than
 * a bar with one fewer thing on it. iPad has had it since 16.4, under the
 * prefixed spelling on older versions.
 */
function useBrowserFullscreen(open: boolean): {
  isSupported: boolean
  isActive: boolean
  toggle: () => void
} {
  // Read once. Neither answer changes for the life of the document, and both
  // touch `document`, which is not something to do on every render.
  const [isSupported] = useState(canGoFullscreen)
  const [isActive, setActive] = useState(() => fullscreenElement() !== null)

  /**
   * Did *this* pane take full screen? Only then does closing give it back.
   *
   * A reader who was already in full screen — F11, or another pane — keeps it
   * when they close the pitch, and does not have it taken away by a component
   * that never asked for it.
   */
  const ours = useRef(false)

  useEffect(() => {
    const onChange = () => {
      const active = fullscreenElement() !== null
      setActive(active)
      // Left by a route that is not this button: Escape, F11, the browser's
      // own notification. The claim goes with it.
      if (!active) ours.current = false
    }
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [])

  /*
   * Closing the pitch gives the screen back — on **both** routes out, which is
   * why this is two effects rather than one.
   *
   * `open` turning false is the declared way, and it has to be acted on in the
   * effect body: doing it from the cleanup of an `[open]` effect defers it by
   * one change, so the screen is handed back not when the pane closes but the
   * next time it opens. Unmounting while `open` is still true is the other
   * way, and it is the one the pages actually take — they render the pane
   * conditionally and pass a hardcoded `open`, so the prop never flips at all.
   */
  useEffect(() => {
    if (open) return
    if (!ours.current) return
    ours.current = false
    exitFullscreen()
  }, [open])

  useEffect(() => {
    return () => {
      if (!ours.current) return
      ours.current = false
      exitFullscreen()
    }
  }, [])

  const toggle = () => {
    if (fullscreenElement() !== null) {
      ours.current = false
      exitFullscreen()
      return
    }
    // Fired synchronously inside the click, so the activation is still live.
    // A rejection here is the browser declining outright — nothing to report
    // and nothing to retry.
    void requestFullscreen()?.then(
      () => {
        ours.current = true
      },
      () => {},
    )
  }

  return { isSupported, isActive, toggle }
}

/**
 * **The bar's full-screen control**, beside the
 * [event-stream bell](../matchday/LiveEventTicker.tsx).
 *
 * Same shape and same weight as the bell, because it is the same kind of thing:
 * a switch that acts on **this screen** rather than a way of leaving it, which
 * is the one opening in {@link FullscreenPane}'s rule that the bar carries
 * nothing but *close*.
 *
 * The icon is the **state's exit**, not the state — `Minimize2` while full
 * screen, `Maximize2` while not — because that is the half a reader needs from
 * an icon they are about to tap. `aria-pressed` carries the state itself, and
 * the title says what the tap will do; between them the two halves are covered
 * for someone who cannot see the glyph.
 */
function BrowserFullscreenToggle({
  isActive,
  onToggle,
}: {
  isActive: boolean
  onToggle: () => void
}) {
  const label = isActive ? 'Ganzen Bildschirm verlassen' : 'Ganzer Bildschirm'

  return (
    <button
      type="button"
      onClick={onToggle}
      title={label}
      aria-label={label}
      aria-pressed={isActive}
      className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors',
        'hover:bg-surface-2',
        isActive
          ? 'text-accent hover:text-accent'
          : 'text-muted hover:text-ink',
      )}
    >
      {isActive ? (
        <Minimize2 size={18} aria-hidden="true" />
      ) : (
        <Maximize2 size={18} aria-hidden="true" />
      )}
    </button>
  )
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
 * **And the browser's full screen on request** — a control in the bar, beside
 * whatever the page put there. `fixed inset-0` only ever claimed the viewport,
 * which on a phone is the screen minus the URL bar and the system chrome; the
 * Fullscreen API claims the rest, and a tap is what asks for it. See
 * {@link useBrowserFullscreen} for why it is a tap and not something this
 * component simply does on open. Where the API is absent, which is every
 * iPhone, the control is not drawn and the pane is what it always was.
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
  // Not just the page's full screen — the browser's, on request. See the hook.
  const browser = useBrowserFullscreen(open)

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

            {/* Left of `actions`, so the page's own control — the match
                pitch's event-stream bell — keeps the place beside the ✗ it has
                always had, and the ✗ keeps the corner. */}
            {browser.isSupported && (
              <BrowserFullscreenToggle
                isActive={browser.isActive}
                onToggle={browser.toggle}
              />
            )}

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
