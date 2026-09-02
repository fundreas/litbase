import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * Off-canvas panel built on Radix Dialog, so focus trapping, scroll locking,
 * Escape handling and `aria-modal` all come for free.
 *
 * Radix animates via `data-state`, which Tailwind targets with the
 * `data-[state=open]:` modifier — no animation library needed.
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  side = 'left',
  children,
  footer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  side?: 'left' | 'right'
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]',
            'data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in',
          )}
        />
        <Dialog.Content
          className={cn(
            'fixed inset-y-0 z-50 flex w-[min(20rem,85vw)] flex-col',
            'border-line bg-canvas shadow-raise',
            side === 'left'
              ? 'left-0 border-r data-[state=closed]:animate-slide-out-left data-[state=open]:animate-slide-in-left'
              : 'right-0 border-l data-[state=closed]:animate-slide-out-right data-[state=open]:animate-slide-in-right',
          )}
        >
          <div className="pt-safe" />
          <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line px-4">
            <Dialog.Title className="text-sm font-semibold text-ink">
              {title}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Menü schließen"
              className="-mr-2 flex h-11 w-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <X size={20} />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
            {children}
          </div>

          {footer !== undefined && (
            <div className="shrink-0 border-t border-line px-3 pt-3 pb-safe">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
