import { useMemo, useState } from 'react'

import {
  POSITION_LABEL,
  type SquadMember,
  type TeamFixture,
} from '@/api/models'
import { FixtureBadge } from '@/components/squad/FixtureBadge'
import { Avatar } from '@/components/ui/Avatar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/cn'
import { points } from '@/lib/format'
import { LINEUP_SIZE, removalCandidates } from '@/lib/lineup'

/**
 * Pick which fielded player makes way. Selection and confirmation are separate
 * steps: tapping a row only selects it, and the dialog's own confirm button
 * performs the swap — so a mis-tap in a scrolling list costs nothing.
 */
export function SwapDialog({
  incoming,
  lineup,
  fixtureByTeamId,
  onCancel,
  onConfirm,
}: {
  incoming: SquadMember | null
  lineup: SquadMember[]
  fixtureByTeamId: Map<string, TeamFixture> | undefined
  onCancel: () => void
  onConfirm: (outgoing: SquadMember) => void
}) {
  // Selection is scoped to the player being brought on. Comparing during
  // render (rather than resetting in an effect) means a newly opened dialog
  // never paints with the previous visit's choice still highlighted.
  const incomingId = incoming?.id ?? null
  const [selection, setSelection] = useState<{
    forPlayerId: string | null
    outgoingId: string | null
  }>({ forPlayerId: incomingId, outgoingId: null })

  if (selection.forPlayerId !== incomingId) {
    setSelection({ forPlayerId: incomingId, outgoingId: null })
  }

  const candidates = useMemo(
    () => (incoming === null ? [] : removalCandidates(lineup, incoming)),
    [incoming, lineup],
  )

  const selectedId = selection.outgoingId
  const selected = candidates.find((player) => player.id === selectedId)
  const isFull = lineup.length >= LINEUP_SIZE

  return (
    <ConfirmDialog
      open={incoming !== null}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
      title={
        incoming === null
          ? 'Kein Platz'
          : `Für ${incoming.lastName} Platz machen`
      }
      description={
        candidates.length === 0
          ? 'Keiner der aufgestellten Spieler kann getauscht werden, ohne die Formationsregeln zu brechen.'
          : isFull
            ? 'Die Aufstellung ist voll. Wähle den Spieler, der Platz macht.'
            : 'Für diese Position ist kein Platz frei. Wähle den Spieler, der Platz macht.'
      }
      confirmLabel="Tauschen"
      cancelLabel="Abbrechen"
      isConfirmDisabled={selected === undefined}
      onConfirm={() => {
        if (selected) onConfirm(selected)
      }}
    >
      {candidates.length > 0 && (
        <ul
          role="radiogroup"
          aria-label="Spieler, der Platz macht"
          className="-mx-1 flex max-h-64 flex-col gap-1 overflow-y-auto overscroll-contain px-1"
        >
          {candidates.map((player) => {
            const isSelected = player.id === selectedId
            return (
              <li key={player.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => {
                    setSelection({
                      forPlayerId: incomingId,
                      outgoingId: player.id,
                    })
                  }}
                  className={cn(
                    'flex w-full items-stretch gap-3 overflow-hidden rounded-xl text-left',
                    // Border width is always 2 so selecting cannot nudge the
                    // row's height; the extra weight comes from a ring, which
                    // is drawn outside the box and costs no layout.
                    'border-2 transition-colors',
                    isSelected
                      ? 'border-accent bg-accent/10 ring-2 ring-accent/40'
                      : 'border-line bg-canvas hover:border-accent/40 hover:bg-surface-2',
                  )}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-3 py-2 pl-3">
                    <Avatar
                      src={player.image}
                      name={player.lastName}
                      size={32}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {player.lastName}
                      </span>
                      <span className="nums block truncate text-xs text-muted">
                        {POSITION_LABEL[player.position]} ·{' '}
                        {points(player.averagePoints)} ⌀
                      </span>
                    </span>
                  </span>

                  {/* Full-height panel on the right. No check mark: the whole
                      row carries the selected state, so a second indicator
                      would be redundant — and this is the space it frees. */}
                  <span
                    className={cn(
                      'flex shrink-0 items-center self-stretch border-l px-3',
                      isSelected
                        ? 'border-accent/40 bg-accent/10'
                        : 'border-line bg-surface/60',
                    )}
                  >
                    <FixtureBadge
                      fixture={fixtureByTeamId?.get(player.teamId)}
                      size="lg"
                      layout="stacked"
                    />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </ConfirmDialog>
  )
}
