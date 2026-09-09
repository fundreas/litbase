import { useState } from 'react'
import { useLocation } from 'react-router'

import { NavMoreMenu } from '@/components/layout/NavMoreMenu'
import { cn } from '@/lib/cn'

/**
 * The [dots menu](./NavMoreMenu.tsx) as a small floating button, for the pages
 * that dock no [bottom bar](../ui/BottomTabBar.tsx) of their own —
 * [Aktivitäten](../../../docs/pages/events.md), the
 * [Rangliste](../../../docs/pages/ranking.md), the
 * [Liga](../../../docs/pages/league.md) page, a market with nothing to switch
 * between, a page still loading its first screen.
 *
 * Same corner, same dots, same gesture: which page the reader is on must not
 * change where the app's pages are or how they are reached, and half the
 * screens having the shortcut would be worse than none of them having it. All
 * that differs is that it has no row to sit in, so it brings its own — round,
 * raised off the page, and floated clear of the bottom edge by `pb-safe`, the
 * same distance a bar's tabs sit at.
 *
 * **The shell decides whether it is drawn**, in CSS: it is hidden on any page
 * whose tree contains a docked bar, which is where the dots already are. See
 * [`AppShell`](./AppShell.tsx) — doing it there means a bar that comes and
 * goes with its data (the market's does) takes the floating button with it,
 * with nothing to keep in step.
 *
 * It **floats**, and no page reserves it room: a strip of padding for it would
 * be taken out of the pages that claim the window's leftover height for a
 * pitch, where height is worth most and this corner is grass. What it costs
 * instead is the right-hand end of a list's last row, at the very bottom of a
 * long scroll — which is what a floating button costs everywhere, and why this
 * one is kept small and translucent.
 *
 * Its own `fixed` box is the positioned ancestor the sheet anchors to, and it
 * lifts to `z-50` while the sheet is out so both stay above the dim.
 */
export function NavMoreFab({ className }: { className?: string }) {
  const { pathname } = useLocation()

  // Any navigation puts the sheet away, the back button included — compared
  // during render rather than in an effect, so it never paints for a frame
  // over a page it was not opened on. The same thing `BottomTabBar` does for
  // the tab, and `AppShell` for the drawer.
  const [more, setMore] = useState({ isOpen: false, path: pathname })
  if (more.path !== pathname) setMore({ isOpen: false, path: pathname })

  return (
    <div
      className={cn(
        'fixed right-3 bottom-0 pb-safe lg:hidden',
        more.isOpen ? 'z-50' : 'z-30',
        className,
      )}
    >
      <NavMoreMenu
        isOpen={more.isOpen}
        onOpenChange={(isOpen) => {
          setMore((current) => ({ ...current, isOpen }))
        }}
        triggerClassName={cn(
          // Small, round and unmistakably *over* the page rather than part of
          // it — it has no bar to belong to, so the border and the shadow are
          // what say it is chrome, and the translucency says what it is over.
          // 40px: it floats above a page that reserves it no room, so it is
          // kept to the smallest square still worth aiming a thumb at.
          'h-10 w-10 rounded-full border shadow-raise backdrop-blur',
          more.isOpen
            ? 'border-accent/40 bg-accent/15 text-accent'
            : 'border-line bg-surface/90 text-muted',
        )}
      />
    </div>
  )
}
