import * as Dialog from '@radix-ui/react-dialog'

import { START_PROBABILITY, START_PROBABILITY_TIERS } from '@/api/models'
import { StartProbabilityBadge } from '@/components/squad/StartProbabilityBadge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

/**
 * What the five probability badges mean.
 *
 * The badges themselves carry no text — on a squad row a label would double the
 * height of the line, and on a portrait there is no room at all — so the scale
 * has to be explained somewhere, once. This is that somewhere.
 *
 * Rendered at the same size the squad rows use, not enlarged for the legend: a
 * legend showing a 24px icon teaches you to recognise a 24px icon, and every
 * badge you then have to find is 13px.
 */
export function StartProbabilityDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
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
        {/* Same chrome as FormationsDialog: a bottom sheet in thumb reach on a
            phone, centred from `sm` up, one dismissal and nothing to confirm. */}
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
        >
          <Dialog.Title className="text-base font-semibold text-ink">
            Startelf-Wahrscheinlichkeit
          </Dialog.Title>
          <Dialog.Description className="text-xs leading-snug text-muted">
            Die Einschätzung stammt von Ligainsider und wird bis kurz vor
            Anpfiff mehrmals überarbeitet.
          </Dialog.Description>

          <ul className="flex flex-col gap-2.5">
            {START_PROBABILITY_TIERS.map((tier) => (
              <li key={tier} className="flex items-start gap-2.5">
                <StartProbabilityBadge
                  tier={tier}
                  size={16}
                  decorative
                  className="mt-px"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">
                    {START_PROBABILITY[tier].label}
                  </span>
                  <span className="block text-xs leading-snug text-muted">
                    {START_PROBABILITY[tier].description}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          {/* Absence is the normal case, not a failure — and it is the one
              thing about this feature that generates "why is it missing?"
              questions, so it is answered here rather than left to be guessed
              at. See docs/pages/squad.md. */}
          <p className="text-xs leading-snug text-faint">
            Ohne Badge liegt keine Einschätzung vor — etwa in der Sommerpause,
            bei einem neu verpflichteten Spieler oder ohne Kickbase-Membership.
          </p>

          <Dialog.Close asChild>
            <Button variant="secondary" fullWidth className="mt-1">
              Schließen
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
