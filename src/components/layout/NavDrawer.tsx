import { useAuth } from '@/auth/useAuth'
import { NavContent, NavSignOutButton } from '@/components/layout/NavContent'
import { Avatar } from '@/components/ui/Avatar'
import { Drawer } from '@/components/ui/Drawer'

/**
 * Navigation as an off-canvas drawer — the narrow-screen surface.
 *
 * From `lg` up the same [`NavContent`](./NavContent.tsx) is on screen
 * permanently as the [`NavSidebar`](./NavSidebar.tsx) and the header's
 * hamburger is gone, so this is never opened there.
 *
 * The header names the reader rather than the panel: on a phone the
 * [`UserMenu`](./UserMenu.tsx) is a 32px face in the corner, so this is the
 * one place the signed-in account is spelled out. "Navigation" only said what
 * was already obvious from the list below it.
 */
export function NavDrawer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user } = useAuth()
  const name = user?.name ?? 'Konto'

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={name}
      header={
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar src={user?.avatar} name={user?.name} size={32} />
          <div className="min-w-0">
            <p className="truncate text-sm leading-tight font-semibold text-ink">
              {name}
            </p>
            {user?.email !== undefined && user.email !== '' && (
              <p className="truncate text-xs leading-tight text-muted">
                {user.email}
              </p>
            )}
          </div>
        </div>
      }
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
