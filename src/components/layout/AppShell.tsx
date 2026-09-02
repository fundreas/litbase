import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router'

import { Header } from '@/components/layout/Header'
import { NavDrawer } from '@/components/layout/NavDrawer'
import { NavSidebar } from '@/components/layout/NavSidebar'
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary'
import { LoadingState } from '@/components/ui/States'

/**
 * The width at which navigation stops being a drawer and becomes a column.
 *
 * **Must stay in step with the `lg:` classes** in `NavSidebar` and `Header` —
 * `lg` is Tailwind's 64rem. Those classes do the showing and hiding; this query
 * exists only to close an already-open drawer when the viewport crosses the
 * breakpoint (rotating a tablet), which CSS cannot do.
 */
const SIDEBAR_QUERY = '(min-width: 64rem)'

/**
 * Chrome shared by every league page: header, navigation and the content well.
 *
 * Pages render into the `<Outlet />` and only have to worry about their own
 * content — the shell owns spacing, safe areas and scroll restoration.
 *
 * ## Two navigation surfaces, one at a time
 *
 * Narrow screens get the [`NavDrawer`](./NavDrawer.tsx) behind the header's
 * hamburger. From `lg` up the [`NavSidebar`](./NavSidebar.tsx) is simply
 * on screen and the hamburger is hidden, so the drawer has no way to be
 * opened. Both render the same `NavContent`, so there is one list of pages,
 * not two.
 *
 * The switch is CSS, not JavaScript: no flash on first paint, and no layout
 * that depends on a resize handler having fired.
 */
export function AppShell() {
  const location = useLocation()
  const [nav, setNav] = useState({ isOpen: false, path: location.pathname })

  // Any navigation closes the drawer — including the browser back button.
  // Adjusted during render rather than in an effect so the drawer never paints
  // for a frame on top of the new page.
  if (nav.path !== location.pathname) {
    setNav({ isOpen: false, path: location.pathname })
  }

  const setIsNavOpen = (isOpen: boolean) => {
    setNav((current) => ({ ...current, isOpen }))
  }

  // A drawer left open while the window grows would sit on top of the sidebar
  // that just appeared, with no visible way back — the hamburger is gone by
  // then. Closing it is the only thing JavaScript has to know about the
  // breakpoint.
  useEffect(() => {
    const query = window.matchMedia(SIDEBAR_QUERY)
    const closeWhenWide = () => {
      if (query.matches) setNav((current) => ({ ...current, isOpen: false }))
    }
    closeWhenWide()
    query.addEventListener('change', closeWhenWide)
    return () => {
      query.removeEventListener('change', closeWhenWide)
    }
  }, [])

  // Each page starts at the top rather than inheriting the previous scroll.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <Header
        onOpenNav={() => {
          setIsNavOpen(true)
        }}
      />
      <NavDrawer open={nav.isOpen} onOpenChange={setIsNavOpen} />

      {/* The row under the full-width header: sidebar, then the content well.
          `min-h-0` keeps the height chain intact for pages that fill it. */}
      <div className="flex min-h-0 flex-1">
        <NavSidebar />

        {/* `flex flex-col` so a page can claim the leftover height with
            `flex-1` (the lineup does). Pages that don't simply stack, since
            flex children default to not growing. `mx-auto` centres the column
            in whatever the sidebar leaves. */}
        <main className="mx-auto flex w-full max-w-3xl min-w-0 flex-1 flex-col px-3 pt-4 pb-safe">
          <RouteErrorBoundary>
            <Suspense fallback={<LoadingState />}>
              <Outlet />
            </Suspense>
          </RouteErrorBoundary>
        </main>
      </div>
    </div>
  )
}
