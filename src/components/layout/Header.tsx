import { Menu } from 'lucide-react'

import { LeagueSwitcher } from '@/components/layout/LeagueSwitcher'
import { UserMenu } from '@/components/layout/UserMenu'
import { SimulationBadge } from '@/dev/SimulationBadge'

/**
 * The app bar: hamburger on the left, league context in the middle, account
 * avatar on the right. Sticky, and padded for notched phones.
 *
 * It spans the **full window width** and sits above both navigation surfaces,
 * so the [sidebar](./NavSidebar.tsx) starts underneath it rather than beside
 * it. The bar's contents are no longer capped to the content column's
 * `max-w-3xl`: with a sidebar taking the left of the screen, a centred bar left
 * the avatar floating in the middle of a wide window instead of in its corner.
 *
 * The hamburger is `lg:hidden` — the width at which the sidebar becomes
 * permanent — so exactly one navigation surface is ever available.
 */
export function Header({ onOpenNav }: { onOpenNav: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
      <div className="pt-safe" />
      <div className="flex h-(--header-h) w-full items-center gap-1 px-2 lg:px-4">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Menü öffnen"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-ink active:bg-line lg:hidden"
        >
          <Menu size={22} />
        </button>

        <div className="min-w-0 flex-1">
          <LeagueSwitcher />
        </div>

        {/* Dev only. A page showing a simulated matchday as if it were live
            has to say so somewhere that does not scroll away — and the
            `import.meta.env.DEV` literal (rather than `env.isDev`) is what
            lets the bundler drop the badge out of a production build rather
            than ship it rendering `null`. */}
        {import.meta.env.DEV && <SimulationBadge />}

        <UserMenu />
      </div>
    </header>
  )
}
