import { NavContent, NavSignOutButton } from '@/components/layout/NavContent'

/**
 * Navigation as a permanent column — the wide-screen surface, from `lg` up.
 *
 * Below that breakpoint it is `hidden` and the [`NavDrawer`](./NavDrawer.tsx)
 * takes over; the header's hamburger disappears at exactly the same width, so
 * there is always exactly one way to navigate.
 *
 * It **sticks below the header** rather than scrolling with the page: offset by
 * `--header-total` (the bar plus any notch padding) and exactly that much
 * shorter than the viewport, so a long nav scrolls inside itself while the
 * page scrolls behind it.
 */
export function NavSidebar() {
  return (
    <aside
      aria-label="Navigation"
      className="sticky top-(--header-total) hidden h-[calc(100dvh-var(--header-total))] w-64 shrink-0 flex-col border-r border-line bg-canvas lg:flex"
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <NavContent />
      </div>
      <div className="shrink-0 border-t border-line px-3 pt-3 pb-safe">
        <NavSignOutButton />
      </div>
    </aside>
  )
}
