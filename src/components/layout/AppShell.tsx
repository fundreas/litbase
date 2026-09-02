import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router'

import { BottomNav } from '@/components/layout/BottomNav'
import { Header } from '@/components/layout/Header'
import { NavDrawer } from '@/components/layout/NavDrawer'
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary'
import { LoadingState } from '@/components/ui/States'

/**
 * Chrome shared by every league page: header, drawer, bottom tab bar.
 *
 * Pages render into the `<Outlet />` and only have to worry about their own
 * content — the shell owns spacing, safe areas and scroll restoration.
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

      {/* `flex flex-col` so a page can claim the leftover height with
          `flex-1` (the lineup does). Pages that don't simply stack as before,
          since flex children default to not growing. */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-3 pt-4 pb-24 md:pb-8">
        <RouteErrorBoundary>
          <Suspense fallback={<LoadingState />}>
            <Outlet />
          </Suspense>
        </RouteErrorBoundary>
      </main>

      <BottomNav />
    </div>
  )
}
