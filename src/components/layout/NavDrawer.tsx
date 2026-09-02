import { NavContent, NavSignOutButton } from '@/components/layout/NavContent'
import { Drawer } from '@/components/ui/Drawer'

/**
 * Navigation as an off-canvas drawer — the narrow-screen surface.
 *
 * From `lg` up the same [`NavContent`](./NavContent.tsx) is on screen
 * permanently as the [`NavSidebar`](./NavSidebar.tsx) and the header's
 * hamburger is gone, so this is never opened there.
 */
export function NavDrawer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Navigation"
      side="left"
      footer={<NavSignOutButton />}
    >
      <NavContent
        onNavigate={() => {
          onOpenChange(false)
        }}
      />
    </Drawer>
  )
}
