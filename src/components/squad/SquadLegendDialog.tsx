import * as Dialog from '@radix-ui/react-dialog'
import { House, PlaneTakeoff, Shirt } from 'lucide-react'
import type { ReactNode } from 'react'

import { START_PROBABILITY, START_PROBABILITY_TIERS } from '@/api/models'
import { StartProbabilityBadge } from '@/components/squad/StartProbabilityBadge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

/**
 * What the symbols on this page mean.
 *
 * Everything the squad and lineup tabs draw is wordless — a glyph badge, a
 * shirt rail, a house or an aeroplane — because none of it has room for a
 * label beside it on a phone row. That trade is only honest if the reader can
 * look the symbols up somewhere, and this is that somewhere.
 *
 * Every symbol is rendered at the size it appears on the page, not enlarged
 * for the legend: a legend showing a 24px icon teaches you to recognise a 24px
 * icon, and the badge you then have to find in a list is 13px.
 */
export function SquadLegendDialog({
  open,
  onOpenChange,
  /**
   * The shirt rail exists only on the squad list. On the lineup tab the
   * section is dropped rather than explaining a control that is not on screen.
   */
  showShirtRail,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  showShirtRail: boolean
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
          // No description element: the rows *are* the explanation, and Radix
          // otherwise warns about a missing `aria-describedby`.
          aria-describedby={undefined}
        >
          <Dialog.Title className="text-base font-semibold text-ink">
            Legende
          </Dialog.Title>

          {/* Capped and scrollable: three sections do not fit a phone screen,
              and the sheet must not grow past it. */}
          <div className="-mx-1 flex max-h-[60vh] flex-col gap-4 overflow-y-auto overscroll-contain px-1 py-0.5">
            <LegendSection title="Startelf-Wahrscheinlichkeit">
              {START_PROBABILITY_TIERS.map((tier) => (
                <LegendRow
                  key={tier}
                  symbol={
                    <StartProbabilityBadge tier={tier} size={16} decorative />
                  }
                  label={START_PROBABILITY[tier].label}
                  description={START_PROBABILITY[tier].description}
                />
              ))}
            </LegendSection>

            {showShirtRail && (
              <LegendSection title="Aufstellung">
                {/* Mirrors the rail on the left edge of each squad row,
                    including its tint — the shape alone is not the signal
                    there, the fill is. */}
                <LegendRow
                  symbol={
                    <span className="flex h-6 w-5 items-center justify-center rounded border border-accent/30 bg-accent/15 text-accent">
                      <Shirt size={13} strokeWidth={2} aria-hidden="true" />
                    </span>
                  }
                  label="Aufgestellt"
                  description="Der Spieler steht in deiner Aufstellung. Tippen nimmt ihn heraus."
                />
                <LegendRow
                  symbol={
                    <span className="flex h-6 w-5 items-center justify-center rounded border border-line bg-surface-2/40 text-faint">
                      <Shirt
                        size={13}
                        strokeWidth={1.5}
                        className="opacity-40"
                        aria-hidden="true"
                      />
                    </span>
                  }
                  label="Auf der Bank"
                  description="Nicht aufgestellt. Tippen setzt ihn in die Aufstellung."
                />
              </LegendSection>
            )}

            <LegendSection title="Nächstes Spiel">
              <LegendRow
                symbol={
                  <House size={16} className="text-positive" aria-hidden />
                }
                label="Heimspiel"
                description="Das Team spielt zu Hause, das Wappen daneben ist der Gegner."
              />
              <LegendRow
                symbol={
                  <PlaneTakeoff size={16} className="text-accent" aria-hidden />
                }
                label="Auswärtsspiel"
                description="Das Team spielt auswärts beim Gegner daneben."
              />
              <LegendRow
                symbol={
                  <span
                    aria-hidden="true"
                    className="text-[0.6875rem] text-faint"
                  >
                    –
                  </span>
                }
                label="Kein Spiel"
                description="An diesem Spieltag spielfrei — der Spieler holt keine Punkte."
              />
            </LegendSection>
          </div>

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

function LegendSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-[0.6875rem] font-semibold tracking-wider text-faint uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

function LegendRow({
  symbol,
  label,
  description,
}: {
  symbol: ReactNode
  label: string
  description: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      {/* Fixed-width symbol column, so labels line up down the sheet however
          wide each individual glyph happens to be. */}
      <span className="mt-px flex w-5 shrink-0 justify-center">{symbol}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="block text-xs leading-snug text-muted">
          {description}
        </span>
      </span>
    </div>
  )
}
