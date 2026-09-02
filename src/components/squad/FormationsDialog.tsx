import * as Dialog from '@radix-ui/react-dialog'

import { POSITION_NAME, type PositionKey } from '@/api/models'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import {
  FORMATIONS,
  formationLabel,
  GOALKEEPER_COUNT,
  type Formation,
} from '@/lib/lineup'

/** Rows top-to-bottom in the diagram, mirroring the pitch: attack first. */
const DIAGRAM_ROWS: PositionKey[] = ['fwd', 'mid', 'def', 'gk']

/** How many dots a formation puts in each diagram row. */
function rowCounts(formation: Formation): Record<PositionKey, number> {
  return {
    fwd: formation.fwd,
    mid: formation.mid,
    def: formation.def,
    gk: GOALKEEPER_COUNT,
  }
}

/**
 * The ten legal formations, for reference only.
 *
 * Deliberately inert: no formation is picked here. Kickbase derives the shape
 * from *who* is on the pitch, so a formation is a consequence of the eleven,
 * not a setting — offering it as a choice would promise something the lineup
 * cannot deliver. This answers "what am I allowed to build?" and nothing else.
 *
 * The cards carry their own explanation, so there is no prose above them. The
 * list comes from `lib/lineup`, so it cannot drift from the rules the editor
 * enforces.
 */
export function FormationsDialog({
  open,
  onOpenChange,
  current,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The shape on the pitch right now — may be partial, e.g. `2-1-0`. */
  current: Formation
}) {
  const currentLabel = formationLabel(current)
  const isComplete = FORMATIONS.some(
    (formation) => formationLabel(formation) === currentLabel,
  )

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]',
            'data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in',
          )}
        />
        {/* Same chrome as ConfirmDialog — a bottom sheet within thumb reach on
            a phone, centred from `sm` up — but with a single dismissal, since
            there is nothing here to confirm. */}
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
          // No description element: the cards *are* the explanation, and Radix
          // otherwise warns about a missing `aria-describedby`.
          aria-describedby={undefined}
        >
          <Dialog.Title className="text-base font-semibold text-ink">
            Formationen
          </Dialog.Title>

          {/* Capped and scrollable: ten cards do not fit a phone screen, and
              the sheet must not grow past it. */}
          <ul className="-mx-1 grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto overscroll-contain px-1 py-0.5 sm:grid-cols-3">
            {FORMATIONS.map((formation) => (
              <FormationCard
                key={formationLabel(formation)}
                formation={formation}
                isCurrent={formationLabel(formation) === currentLabel}
              />
            ))}
          </ul>

          {/* Only when it needs saying. A complete lineup has its formation
              marked "aktuell" in the grid, so a line repeating it would be
              noise; an incomplete one shows a shape that is in no card at all,
              and leaving that unexplained sends the manager hunting for it. */}
          {!isComplete && (
            <p className="nums text-xs leading-snug text-faint">
              Deine Aufstellung ist noch unvollständig und steht gerade{' '}
              {currentLabel}. Die Formation ergibt sich, sobald elf Spieler
              stehen.
            </p>
          )}

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

function FormationCard({
  formation,
  isCurrent,
}: {
  formation: Formation
  isCurrent: boolean
}) {
  const counts = rowCounts(formation)
  const label = formationLabel(formation)

  // The diagram is decorative; this is what assistive tech reads instead.
  // Spoken back-to-front — keeper first — which is how a formation is named.
  // The position names happen to be identical in the plural, so no inflection
  // is needed: ein Verteidiger, vier Verteidiger.
  const spoken = DIAGRAM_ROWS.slice()
    .reverse()
    .map((position) => `${String(counts[position])} ${POSITION_NAME[position]}`)
    .join(', ')

  return (
    <li
      className={cn(
        'relative rounded-xl border p-1.5',
        isCurrent
          ? 'border-accent bg-accent/10 ring-2 ring-accent/30'
          : 'border-line bg-canvas',
      )}
    >
      <span className="sr-only">
        {label}: {spoken}.{isCurrent && ' Deine aktuelle Formation.'}
      </span>

      {/* A row of dots per band, on a scrap of turf — the same reading as the
          pitch above it, at a size where ten of them fit on one screen. */}
      <span
        aria-hidden="true"
        className="flex h-16 flex-col justify-around rounded-lg bg-[oklch(0.4_0.08_148)] px-1.5 py-1.5"
      >
        {DIAGRAM_ROWS.map((position) => (
          <span key={position} className="flex justify-center gap-1">
            {Array.from({ length: counts[position] }, (_, index) => (
              <span
                key={index}
                className="h-1.5 w-1.5 rounded-full bg-white/85"
              />
            ))}
          </span>
        ))}
      </span>

      <span
        aria-hidden="true"
        className={cn(
          'nums mt-1 block text-center text-sm font-semibold',
          isCurrent ? 'text-accent' : 'text-ink',
        )}
      >
        {label}
      </span>

      {isCurrent && (
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 rounded-full bg-accent px-1.5 py-px text-[0.5625rem] font-semibold text-accent-ink"
        >
          aktuell
        </span>
      )}
    </li>
  )
}
