import { NavMoreMenu } from '@/components/layout/NavMoreMenu'
import { cn } from '@/lib/cn'

/**
 * The [dots menu](./NavMoreMenu.tsx) as the last tab of a page's own
 * [bottom bar](../ui/BottomTabBar.tsx).
 *
 * It is **navigation rather than a view of the page** — the one entry in the
 * row that leaves — and it is kept *thin*: the tabs it sits beside are what
 * the page is for, and this must not look like one of them or take room from
 * them. A left border separates the two kinds. Pages with no bar float the
 * same dots in the same corner instead, see
 * [`NavMoreFab`](./NavMoreFab.tsx).
 *
 * The `<li>` is the positioned box the sheet anchors to, which is why it
 * carries `relative`: the sheet grows out of *this cell*, so it is
 * right-aligned with the dots at any bar width.
 */
export function NavMoreTab({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean
  /** Lives in [`BottomTabBar`](../ui/BottomTabBar.tsx): the bar has to lift
      itself above the dimmed page while the sheet is out. */
  onOpenChange: (open: boolean) => void
}) {
  return (
    <li className="relative ml-1 shrink-0 border-l border-line pl-1 lg:hidden">
      <NavMoreMenu
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        triggerClassName={cn(
          // Thin: two thirds of a tab's width. It is still 32px of target
          // against a 48px-tall row, and it sits in the one corner of the
          // screen a thumb cannot miss.
          'h-12 w-8 rounded-xl',
          isOpen ? 'bg-accent/15 text-accent' : 'text-faint hover:text-ink',
        )}
      />
    </li>
  )
}
