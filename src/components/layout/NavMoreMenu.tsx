import { EllipsisVertical } from 'lucide-react'
import { useEffect, useId, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router'

import { useRanking } from '@/api/hooks/useRanking'
import { isNavItemActive, NAV_ITEMS } from '@/components/layout/navigation'
import { useActiveLeague } from '@/league/useActiveLeague'
import { cn } from '@/lib/cn'

/**
 * Marks a row as a target of the drag and carries where it goes.
 *
 * The gesture cannot use React's own hover events: the finger is captured by
 * the trigger for the whole press (see below), so no row ever receives a
 * pointer event. What is under the thumb is asked of the document instead —
 * `elementFromPoint` — and this attribute is how the answer is turned back
 * into a destination.
 */
const ITEM_ATTR = 'data-nav-more-to'

/** How long the phone buzzes as the thumb crosses onto a row. */
const TICK_MS = 6

/** Where does this point land — a row's path, or nothing? */
function itemAt(x: number, y: number): string | null {
  const row = document.elementFromPoint(x, y)?.closest(`[${ITEM_ATTR}]`)
  return row?.getAttribute(ITEM_ATTR) ?? null
}

/**
 * A blind gesture needs an answer that is not visual: the thumb is over the
 * row it is choosing, so it is also over the only feedback the screen could
 * give about it. Not supported on iOS, hence the guard rather than a feature
 * anything depends on.
 */
function tick(): void {
  if ('vibrate' in navigator) navigator.vibrate(TICK_MS)
}

/**
 * The app's pages, in the bottom corner of the screen: three dots, a sheet of
 * pages above them, and one thumb-press that does both.
 *
 * Bottom **right** by default, because that is where a right thumb rests. A
 * left-hander moves it to the other corner, or takes it away altogether, in
 * [Einstellungen](../../pages/PreferencesPage.tsx) — the wrappers below read
 * that preference and this component is told the answer as `align`.
 *
 * ## Why it exists
 *
 * Navigating between pages on a phone was: reach across the screen to the
 * hamburger in the *top left* — the far corner from a right thumb — then pick
 * from a drawer that slides in over everything. Two deliberate moves, the
 * first of them a stretch, to do the thing done most often. Meanwhile the
 * thumb is already resting in the opposite corner.
 *
 * `lg:hidden` on both wrappers, because from `lg` up the
 * [sidebar](./NavSidebar.tsx) is on screen permanently and there is nothing to
 * reach for.
 *
 * ## Two triggers, one menu
 *
 * [`NavMoreTab`](./NavMoreTab.tsx) docks the dots at the end of a page's own
 * [bottom bar](../ui/BottomTabBar.tsx); on the pages that have no bar,
 * [`NavMoreFab`](./NavMoreFab.tsx) floats them in the same corner instead.
 * Both wrappers are a handful of lines, because everything that *behaves* —
 * the gesture, the sheet, the dim — is here: the corner has to work
 * identically whichever page the reader is on, and two copies of a gesture
 * this fiddly would not stay identical for long.
 *
 * What the wrapper owns is **where the dots sit**, which is the only real
 * difference between them. So this renders a fragment — dim, trigger, sheet —
 * and the sheet is `absolute`, anchoring to whatever positioned box the
 * wrapper provides: a cell of the bar, or a fixed corner of the window.
 *
 * It is **controlled**. The tab's state cannot live down here anyway (the bar
 * has to raise itself over the dim, and an element cannot raise its own
 * parent), so both wrappers pass it in rather than one of them keeping a
 * second copy of it.
 *
 * ## The gesture
 *
 * **The press opens it.** Not the release — by the time a finger lifts, the
 * thumb could already have been on its way to the destination. `pointerdown`
 * puts the sheet on screen, and from that moment the same unbroken press can
 * finish the navigation:
 *
 * ```
 *   ┌──────────────┐
 *   │ Aktivitäten  │
 *   │ Mannschaft   │   ← thumb slides up; the row under it fills
 *   │ Transfermarkt│
 *   │ Rangliste    │
 *   └──────────────┘
 *      ▲                lift here → navigate
 *   ⋮  ┘                lift on the dots → the sheet stays open
 * ```
 *
 * - **slide up** — the row under the thumb fills, and the phone ticks as it
 *   crosses onto it;
 * - **lift over a row** — that page opens;
 * - **slide off the sheet** — nothing is highlighted any more, but the sheet
 *   *stays*: sliding out is how a choice is withdrawn, and a menu that closed
 *   would punish an imprecise thumb by making it start again;
 * - **lift outside** — closed, nothing chosen;
 * - **lift on the dots without moving** — a plain tap. The sheet is left open
 *   and behaves like an ordinary menu: the rows are real links, so the second
 *   tap navigates, a tap anywhere else dismisses it, and a tap back on the
 *   dots puts it away. A press from *that* state is a gesture again — the
 *   reader who tapped it open can still swipe.
 *
 * The last two are the same event landing in different places, which is why
 * the release has to test the trigger's own rectangle: a tap would otherwise
 * open the sheet on the way down and close it again on the way up.
 *
 * **The press is captured.** `setPointerCapture` keeps every `pointermove` and
 * the `pointerup` coming to the trigger even once the thumb is far away over
 * the sheet. That is what makes the gesture one press rather than a press that
 * hands over to whatever it slides onto — and it also means the sheet cannot
 * scroll under the thumb mid-drag, since it never sees the touch. (It scrolls
 * normally once the sheet is latched open, for the rare screen too short to
 * show every page.)
 *
 * ## What is in it
 *
 * The pages, in the same order as the drawer and with the same active-entry
 * rules — one list, [`navigation.ts`](./navigation.ts), *Duelle* included only
 * where the league plays them. Deliberately **not** everything the drawer has:
 * the league card, *Liga beitreten* and *Abmelden* are not what a thumb
 * reaches for mid-game, and every row added pushes the top ones out of reach.
 * The drawer remains the complete surface.
 */
export function NavMoreMenu({
  isOpen,
  onOpenChange,
  align,
  triggerClassName,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Which edge the dots are against, so the sheet grows *inwards* from it
   * rather than off the side of the screen. The wrapper knows, because
   * putting the dots there is what the wrapper is for — see
   * [`menuShortcut`](../../preferences/preferences.ts) for the choice behind
   * it.
   */
  align: 'left' | 'right'
  /**
   * Shape and colour of the dots — a thin cell of a bar, or a round floating
   * button. How they *behave* is not the wrapper's business.
   */
  triggerClassName: string
}) {
  const { leagueId } = useActiveLeague()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // Both wrappers are mounted at once on a page that docks a bar — the
  // floating one is only hidden — so the sheet cannot carry a fixed id.
  const sheetId = useId()

  // Same query the drawer runs, from the same cache — the drawer is mounted on
  // every league page, so this costs no request. See `NavContent`.
  const { data: ranking } = useRanking(leagueId)
  const items = NAV_ITEMS.filter(
    (item) => item.requiresDuelMode !== true || ranking?.isDuelMode === true,
  )

  /** The row the thumb is over, as a path. `null` while it is over neither. */
  const [highlighted, setHighlighted] = useState<string | null>(null)
  /**
   * The press being tracked, if any — a second finger is ignored. `wasOpen`
   * is what a release on the dots means: put an already-open sheet away, or
   * leave a freshly-opened one out.
   */
  const drag = useRef<{ pointerId: number; wasOpen: boolean } | null>(null)

  const close = () => {
    drag.current = null
    setHighlighted(null)
    onOpenChange(false)
  }

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, onOpenChange])

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    // Every press starts a gesture, an already-open sheet included: a reader
    // who tapped it open a moment ago can still swipe from the same dots, and
    // only the release decides whether that press was a swipe or a toggle.
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointerId: event.pointerId, wasOpen: isOpen }
    setHighlighted(null)
    onOpenChange(true)
  }

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return
    const to = itemAt(event.clientX, event.clientY)
    if (to === highlighted) return
    setHighlighted(to)
    if (to !== null) tick()
  }

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return
    const { wasOpen } = drag.current
    drag.current = null
    setHighlighted(null)

    const to = itemAt(event.clientX, event.clientY)
    if (to !== null) {
      onOpenChange(false)
      void navigate(to)
      return
    }

    // Not on a row. Lifting somewhere else on the screen dismisses the sheet;
    // lifting on the dots themselves was a tap, which leaves a freshly-opened
    // sheet out to be used by ordinary taps — and puts away one that was
    // already out, which is what a second tap on a menu button means.
    const dots = event.currentTarget.getBoundingClientRect()
    const isOnDots =
      event.clientX >= dots.left &&
      event.clientX <= dots.right &&
      event.clientY >= dots.top &&
      event.clientY <= dots.bottom
    if (!isOnDots || wasOpen) onOpenChange(false)
  }

  return (
    <>
      {/*
        The dim over the page, as a portal on `body`. It cannot be rendered in
        place: a bar carries `backdrop-blur`, and a `backdrop-filter` makes its
        element the containing block for `position: fixed` descendants — so a
        `fixed inset-0` child here would stretch to the bar's own box rather
        than to the window.

        `z-40` puts it over the page and under the trigger's wrapper, which
        raises itself to `z-50` while the sheet is out. The dots and the bar
        they may sit in therefore stay lit with the sheet growing out of them,
        and the page behind recedes.
      */}
      {isOpen &&
        createPortal(
          <div
            aria-hidden="true"
            // On the **release**, and not on the press.
            //
            // The dim already swallows the press — the row, the crest, the bid
            // button under it never see a `pointerdown`. What they would still
            // see is the *click*: a tap is a press and a release resolved into
            // one, and a dim that unmounts in between leaves the release to be
            // hit-tested against whatever is underneath by then. So a tap
            // meant to dismiss the sheet would open a player.
            //
            // Closing on `click` keeps the dim in the DOM for the whole tap.
            // It is the tap's target, the page gets nothing at all, and the
            // sheet goes away on the lift — which is the same rule the
            // gesture already follows: nothing is decided until the finger
            // comes off.
            onClick={close}
            className={cn(
              'fixed inset-0 z-40 animate-fade-in bg-black/50 lg:hidden',
              // No scrolling the page behind an open sheet either — the same
              // press would otherwise both dismiss it and move the page it
              // was dismissed over.
              'touch-none',
            )}
          />,
          document.body,
        )}

      <button
        type="button"
        aria-label="Andere Seite öffnen"
        aria-expanded={isOpen}
        aria-controls={sheetId}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        // A cancelled press — a system gesture taking over the touch — must not
        // navigate, and must not lose the sheet either: it is left open, which
        // is the state a tap would have produced.
        onPointerCancel={() => {
          drag.current = null
          setHighlighted(null)
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          if (isOpen) close()
          else onOpenChange(true)
        }}
        className={cn(
          'flex items-center justify-center transition-colors',
          // It is a drag, not a tap: the press must not scroll the page, and a
          // long one must not raise a callout on the way to a choice.
          'touch-none',
          triggerClassName,
        )}
      >
        <EllipsisVertical size={18} aria-hidden="true" />
      </button>

      {isOpen && (
        <nav
          id={sheetId}
          aria-label="Seiten"
          className={cn(
            // Anchored to the dots and growing up, and inwards from whichever
            // edge they are against. `bottom-full` is the wrapper's top edge,
            // so the first row lands just above the thumb whatever padding the
            // wrapper carries.
            'absolute bottom-full z-10 mb-2 w-[min(15rem,72vw)]',
            'animate-pop-in rounded-card border border-line',
            align === 'left'
              ? 'left-0 origin-bottom-left'
              : 'right-0 origin-bottom-right',
            'bg-surface p-1.5 shadow-raise',
            // Only for a screen too short for every page; the drag never
            // scrolls it, being captured elsewhere.
            'max-h-[calc(100dvh-var(--header-total)-7rem)] overflow-y-auto',
            'overscroll-contain',
          )}
        >
          {items.map((item) => {
            const { to, label, icon: Icon } = item
            const path = `/leagues/${leagueId}/${to}`
            const isActive = isNavItemActive(item, pathname, leagueId)
            const isHighlighted = highlighted === path

            return (
              <Link
                key={to}
                to={path}
                onClick={close}
                aria-current={isActive ? 'page' : undefined}
                // The drag's hit target — the attribute has to stay `ITEM_ATTR`,
                // which is what the hit test looks for.
                data-nav-more-to={path}
                className={cn(
                  'flex h-11 items-center gap-3 rounded-xl px-3',
                  'text-sm font-medium transition-colors duration-100',
                  // The thumb's row is filled rather than tinted: this is the
                  // one piece of state a gesture cannot be corrected about
                  // halfway through, so it has to be readable at a glance,
                  // past the finger covering it — and it has to beat the
                  // *active* page's own tint, which is the same colour.
                  isHighlighted
                    ? 'bg-accent text-accent-ink'
                    : isActive
                      ? 'bg-accent/10 text-accent'
                      : 'text-muted',
                )}
              >
                <Icon
                  size={20}
                  aria-hidden="true"
                  className={isHighlighted || isActive ? '' : 'text-faint'}
                />
                {label}
              </Link>
            )
          })}
        </nav>
      )}
    </>
  )
}
