import * as Dialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

/**
 * Confirmation modal on Radix Dialog — focus trap, scroll lock, `Escape` and
 * `aria-modal` included.
 *
 * On phones it sits at the bottom of the screen (thumb-reachable) and centres
 * from `sm` up.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Abbrechen',
  onConfirm,
  isBusy = false,
  isConfirmDisabled = false,
  error,
  confirmSlot,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  /** Ignored when {@link confirmSlot} is given, which brings its own label. */
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  isBusy?: boolean
  /** For dialogs whose confirm needs a selection first. */
  isConfirmDisabled?: boolean
  error?: string | null
  /**
   * A confirm control of the caller's own, in place of the plain button.
   *
   * One dialog shell rather than two: the sale dialog needs a
   * [two-second hold](./HoldButton.tsx) where every other dialog needs a tap,
   * and that is the only thing it needs differently. `onConfirm` is then the
   * slot's business, not this component's.
   */
  confirmSlot?: ReactNode
  /** Extra content between the description and the actions. */
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
            'sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[min(24rem,92vw)]',
            'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:pb-4',
            'data-[state=open]:animate-pop-in',
          )}
          // Don't autofocus a button: on a phone that can raise the keyboard
          // and it puts focus on an action the user has not read yet. The
          // dialog itself still receives focus, so Escape and Tab work.
          onOpenAutoFocus={(event) => {
            event.preventDefault()
          }}
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

          {children}

          {error !== null && error !== undefined && (
            <p
              role="alert"
              className="rounded-xl border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative"
            >
              {error}
            </p>
          )}

          <div className="mt-1 flex gap-2">
            <Dialog.Close asChild>
              <Button variant="secondary" fullWidth disabled={isBusy}>
                {cancelLabel}
              </Button>
            </Dialog.Close>
            {confirmSlot ?? (
              <Button
                fullWidth
                onClick={onConfirm}
                isLoading={isBusy}
                disabled={isConfirmDisabled}
              >
                {confirmLabel}
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
