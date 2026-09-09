import { NavMoreMenu } from '@/components/layout/NavMoreMenu'
import { cn } from '@/lib/cn'

/**
 * The [dots menu](./NavMoreMenu.tsx) as the outermost tab of a page's own
 * [bottom bar](../ui/BottomTabBar.tsx).
 *
 * It is **navigation rather than a view of the page** — the one entry in the
 * row that leaves — and it is kept *thin*: the tabs it sits beside are what
 * the page is for, and this must not look like one of them or take room from
 * them. A border separates the two kinds. Pages with no bar float the same
 * dots in the same corner instead, see [`NavMoreFab`](./NavMoreFab.tsx).
 *
 * Which end of the bar it takes is the reader's
 * [`menuShortcut`](../../preferences/preferences.ts), and the whole cell
 * mirrors with it: the divider moves to the inner side, so the dots stay
 * against the edge of the screen where the thumb is. The bar decides the
 * order of its children — see [`BottomTabBar`](../ui/BottomTabBar.tsx) — and
 * tells this what it did.
 *
 * The `<li>` is the positioned box the sheet anchors to, which is why it
 * carries `relative`: the sheet grows out of *this cell*, so it lines up with
 * the dots at any bar width.
 */
export function NavMoreTab({
  isOpen,
  onOpenChange,
  align,
}: {
  isOpen: boolean
  /** Lives in [`BottomTabBar`](../ui/BottomTabBar.tsx): the bar has to lift
      itself above the dimmed page while the sheet is out. */
  onOpenChange: (open: boolean) => void
  /** Which end of the bar this cell is. */
  align: 'left' | 'right'
}) {
  return (
    <li
      className={cn(
        'relative shrink-0 border-line lg:hidden',
        align === 'left' ? 'mr-1 border-r pr-1' : 'ml-1 border-l pl-1',
      )}
    >
      <NavMoreMenu
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        align={align}
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
