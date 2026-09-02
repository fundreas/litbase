import { Menu } from 'lucide-react'

import { LeagueSwitcher } from '@/components/layout/LeagueSwitcher'
import { UserMenu } from '@/components/layout/UserMenu'

/**
 * The app bar: hamburger on the left, league context in the middle, account
 * avatar on the right. Sticky, and padded for notched phones.
 */
export function Header({ onOpenNav }: { onOpenNav: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
      <div className="pt-safe" />
      <div className="mx-auto flex h-(--header-h) max-w-3xl items-center gap-1 px-2">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Menü öffnen"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-ink active:bg-line"
        >
          <Menu size={22} />
        </button>

        <div className="min-w-0 flex-1">
          <LeagueSwitcher />
        </div>

        <UserMenu />
      </div>
    </header>
  )
}
