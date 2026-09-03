import * as Dialog from '@radix-ui/react-dialog'
import { X, ZoomIn, ZoomOut } from 'lucide-react'
import { useState } from 'react'

import { cdnUrl } from '@/api/cdn'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'
import { weekdayDate } from '@/lib/format'

/**
 * Ligainsider's projected starting eleven for the player's club, full screen.
 *
 * `plpim` is a **1280×1809 poster of the whole team**, not a per-player icon —
 * an earlier attempt to use it as a corner badge on a portrait put the same
 * unreadable thumbnail on all 25 players at a club. At full size it is exactly
 * what it looks like: the projected XI with a tier badge beside every name,
 * which is where the `prob` this dialog opens from comes from in the first
 * place. So the chip is the way in, and the poster gets the whole screen.
 *
 * ## Fit, then zoom
 *
 * It opens **fit to the screen**, so the shape of the formation is the first
 * thing you see. Tapping (or the button in the bar) switches to natural width
 * inside a scroll container, which is what makes the names legible on a phone:
 * 1280 px of poster in a 390 px viewport is a third of a pixel per pixel, and
 * no amount of `object-contain` fixes that. Native pinch-zoom is left alone on
 * top of it.
 *
 * The dialog is `fixed inset-0` rather than the app's usual centred card. This
 * is one large image and nothing else — a padded panel around it would spend
 * the width that is the entire point.
 */
export function LineupPosterDialog({
  open,
  onOpenChange,
  poster,
  teamName,
  source,
  sourceLogo,
  updatedAt,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** CDN-relative `plpim`. */
  poster: string
  teamName?: string
  /** `plpt` — "Ligainsider" in practice. */
  source?: string
  /** `plpurl`, the source's logo. */
  sourceLogo?: string
  /** `ts`, when the assessment was last revised. */
  updatedAt?: string
}) {
  const [isZoomed, setIsZoomed] = useState(false)
  const src = cdnUrl(poster)

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        // Always reopen fit — a zoom left over from last time drops the reader
        // into the middle of a poster with no idea which part they are on.
        if (!next) setIsZoomed(false)
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-40 bg-black/80 backdrop-blur-[2px]',
            'data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in',
          )}
        />
        <Dialog.Content
          className={cn(
            'fixed inset-0 z-50 flex flex-col bg-canvas',
            'data-[state=open]:animate-fade-in',
          )}
        >
          <div className="pt-safe" />

          <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-sm font-semibold text-ink">
                Voraussichtliche Aufstellung
              </Dialog.Title>
              <Dialog.Description className="flex items-center gap-1.5 truncate text-xs text-muted">
                {teamName !== undefined && <span>{teamName}</span>}
                {source !== undefined && (
                  <>
                    {teamName !== undefined && (
                      <span aria-hidden="true">·</span>
                    )}
                    {sourceLogo !== undefined && (
                      <Avatar
                        src={sourceLogo}
                        name={source}
                        size={13}
                        square
                        className="bg-transparent"
                      />
                    )}
                    <span className="truncate">{source}</span>
                  </>
                )}
                {updatedAt !== undefined && (
                  <span className="truncate text-faint">
                    · {weekdayDate(updatedAt)}
                  </span>
                )}
              </Dialog.Description>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsZoomed((current) => !current)
              }}
              aria-pressed={isZoomed}
              title={isZoomed ? 'Verkleinern' : 'Vergrößern'}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <span className="sr-only">
                {isZoomed ? 'Verkleinern' : 'Vergrößern'}
              </span>
              {isZoomed ? <ZoomOut size={20} /> : <ZoomIn size={20} />}
            </button>

            <Dialog.Close
              aria-label="Schließen"
              className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <X size={20} />
            </Dialog.Close>
          </div>

          {/* `overscroll-contain` so panning a zoomed poster to its edge does
              not start scrolling the page behind the dialog. */}
          <div
            className={cn(
              'min-h-0 flex-1 overscroll-contain pb-safe',
              isZoomed ? 'overflow-auto' : 'overflow-hidden',
            )}
          >
            <button
              type="button"
              onClick={() => {
                setIsZoomed((current) => !current)
              }}
              // The image is the target, so the whole thing toggles. `block`
              // and the sizing below are on the button so the click area is
              // the poster and not a band across the dialog.
              className={cn(
                'block cursor-zoom-in',
                isZoomed ? 'w-max cursor-zoom-out' : 'h-full w-full',
              )}
            >
              <img
                src={src}
                alt={`Voraussichtliche Aufstellung${teamName === undefined ? '' : ` von ${teamName}`}`}
                className={cn(
                  isZoomed ? 'max-w-none' : 'h-full w-full object-contain',
                )}
              />
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
