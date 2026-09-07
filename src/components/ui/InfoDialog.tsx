import * as Dialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * A sheet that shows something and asks nothing — the read-only counterpart of
 * [`ConfirmDialog`](./ConfirmDialog.tsx), with the same chrome: bottom sheet in
 * thumb reach on a phone, centred from `sm` up.
 *
 * **No close button.** It had a full-width *Schließen* at the foot, and a sheet
 * that asks nothing has nothing to dismiss: tapping outside closes it, so does
 * Escape, and so does the back gesture on a phone. The button was a row of
 * height spent restating what the overlay already offers — which matters most
 * on the one sheet here that is long enough to scroll, where it pushed the
 * content up for no answer of its own. `ConfirmDialog` keeps its two buttons
 * because there a tap outside and a tap on *Abbrechen* are the same decision
 * and the other button is a different one.
 *
 * The body is capped and scrolls, so a long list (a matchday's ranking) stays
 * inside the sheet rather than growing it past the screen.
 */
export function InfoDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
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
            'fixed z-50 flex flex-col gap-3 border border-line bg-surface shadow-raise',
            'inset-x-0 bottom-0 rounded-t-2xl p-4 pb-safe',
            'sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[min(26rem,92vw)]',
            'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:pb-4',
            'data-[state=open]:animate-pop-in',
          )}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
          }}
          // Without a description Radix warns about a missing
          // `aria-describedby`; an explicit `undefined` says there is none.
          {...(description === undefined
            ? { 'aria-describedby': undefined }
            : {})}
        >
          <Dialog.Title className="text-base font-semibold text-ink">
            {title}
          </Dialog.Title>

          {description !== undefined && (
            <Dialog.Description asChild>
              <div className="text-sm leading-snug text-muted">
                {description}
              </div>
            </Dialog.Description>
          )}

          {children !== undefined && (
            <div className="-mx-1 flex max-h-[60vh] flex-col gap-3 overflow-y-auto overscroll-contain px-1 py-0.5">
              {children}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
