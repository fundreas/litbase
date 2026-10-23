import { Check, Lock } from 'lucide-react'
import { useState } from 'react'

import {
  POSITION_LABEL,
  POSITION_NAME,
  type PositionKey,
  type SquadMember,
} from '@/api/models'
import { Avatar } from '@/components/ui/Avatar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/cn'
import { money, moneyDelta } from '@/lib/format'

const POSITION_ORDER: PositionKey[] = ['gk', 'def', 'mid', 'fwd']

/**
 * **"…but not him."** — the question the optimiser has to be asked before it
 * is allowed to answer.
 *
 * The [optimiser](../../lib/optimizeScenario.ts) reads expected points and
 * money, and there is a third thing it cannot read: the manager's reasons. A
 * player bought yesterday, one whose price is about to turn, one being saved
 * for a rival's injury — none of that is in any payload, and an optimiser that
 * sold him anyway would be a button pressed once and never again. So the
 * answer is not a cleverer objective but a question, asked up front: *who is
 * off the table?*
 *
 * A **modal rather than a mode on the Kader**, even though the Kader is
 * already a list of exactly these players with exactly one toggle per row.
 * That toggle means *sell him*, and a second one meaning *never sell him*
 * would make every tap on that list a question about which of the two was
 * meant. Here the list means one thing, it is open for as long as the question
 * takes, and it closes.
 *
 * ## Protection is not the same as benching
 *
 * A protected player is still **fielded** if he is worth fielding — the lock
 * takes him out of the money, not out of the eleven. That matters to the
 * arithmetic as much as to the reading of it: his value leaves the pool the
 * gap is measured against, so protecting half a squad can make a bid
 * unfundable, and the optimiser says so afterwards rather than quietly selling
 * him anyway.
 *
 * ## The two shortcuts
 *
 * **Aufstellung** locks whoever is on the pitch right now, which is the answer
 * most of the time — *keep my eleven, fund it from the bench* — and the one
 * nobody wants to tap eleven times. **Keine** clears the lot, which is the way
 * back to the optimiser's own judgement after an experiment.
 *
 * They are chips rather than buttons, and they **report as well as set**:
 * *Aufstellung* lights up whenever the locked set is exactly the eleven on the
 * pitch, however it came to be, so the row says what the list below it is
 * currently saying.
 *
 * The draft is local and only leaves on *Optimieren*, so a dialog closed by
 * `Escape`, the overlay or *Abbrechen* changes nothing — the same contract
 * every other dialog in the app keeps.
 */
export function OptimiseDialog({
  open,
  onOpenChange,
  squad,
  fieldedIds,
  kept,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The players the scenario could sell — its own, and only its own. */
  squad: SquadMember[]
  /** Who is on the pitch as things stand, for the *Aufstellung* shortcut. */
  fieldedIds: ReadonlySet<string>
  /** What was locked last time, so the question is not re-answered from scratch. */
  kept: ReadonlySet<string>
  /** Run the optimiser with these players held back. */
  onConfirm: (kept: ReadonlySet<string>) => void
}) {
  /* Seeded from the prop on every open rather than in an effect, the way
     [`SwapDialog`](./SwapDialog.tsx) scopes its own selection: a dialog that
     reset after its first paint would flash the previous visit's answer. */
  const [draft, setDraft] = useState<{
    isOpen: boolean
    kept: ReadonlySet<string>
  }>({ isOpen: open, kept })

  if (draft.isOpen !== open) setDraft({ isOpen: open, kept })

  const locked = draft.kept
  const setLocked = (next: ReadonlySet<string>) => {
    setDraft({ isOpen: open, kept: next })
  }

  const toggle = (playerId: string) => {
    const next = new Set(locked)
    if (!next.delete(playerId)) next.add(playerId)
    setLocked(next)
  }

  /* The pitch, as this list can see it: a fielded player the scenario cannot
     sell — a bid's target — is not in `squad` and must not count towards the
     chip's reading, or it would never light up. */
  const fielded = squad.filter((member) => fieldedIds.has(member.id))
  const isLineup =
    locked.size === fielded.length &&
    fielded.every((member) => locked.has(member.id))

  /** What protecting them takes off the table. */
  const held = squad.reduce(
    (sum, member) => (locked.has(member.id) ? sum + member.marketValue : sum),
    0,
  )

  const byPosition = POSITION_ORDER.map((position) => ({
    position,
    players: squad
      .filter((member) => member.position === position)
      .sort((a, b) => b.marketValue - a.marketValue),
  })).filter((group) => group.players.length > 0)

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Wen auf keinen Fall verkaufen?"
      description={
        squad.length === 0
          ? 'In diesem Szenario gibt es nichts zu verkaufen.'
          : 'Markierte Spieler bleiben im Kader. Alle anderen darf der Optimierer zu Geld machen — aufgestellt werden kann jeder.'
      }
      confirmLabel="Optimieren"
      onConfirm={() => {
        onConfirm(locked)
      }}
    >
      {squad.length > 0 && (
        <>
          {/* The two shortcuts and what they have left on the table, on one
              line: the count is the only figure that says whether the answer
              below is still one the optimiser can work with. */}
          <div className="flex items-center gap-2">
            <ShortcutChip
              isActive={isLineup}
              onClick={() => {
                setLocked(new Set(fielded.map((member) => member.id)))
              }}
            >
              Aufstellung
            </ShortcutChip>
            <ShortcutChip
              isActive={locked.size === 0}
              onClick={() => {
                setLocked(new Set())
              }}
            >
              Keine
            </ShortcutChip>

            <span className="nums ml-auto shrink-0 text-xs text-muted">
              {locked.size === 0 ? (
                'nichts geschützt'
              ) : (
                <>
                  <span className="font-semibold text-ink">{locked.size}</span>{' '}
                  geschützt · {money(held)}
                </>
              )}
            </span>
          </div>

          <ul
            aria-label="Spieler, die nicht verkauft werden"
            className="-mx-1 flex max-h-[min(22rem,50vh)] flex-col gap-2 overflow-y-auto overscroll-contain px-1"
          >
            {byPosition.map(({ position, players }) => (
              <li key={position}>
                <h3 className="px-1 pb-1 text-[0.6875rem] font-semibold tracking-wider text-faint uppercase">
                  {POSITION_NAME[position]}
                </h3>

                <ul className="flex flex-col gap-1">
                  {players.map((player) => (
                    <li key={player.id}>
                      <KeepRow
                        player={player}
                        isLocked={locked.has(player.id)}
                        isFielded={fieldedIds.has(player.id)}
                        onToggle={() => {
                          toggle(player.id)
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </ConfirmDialog>
  )
}

/** One of the two quick answers — the chip shape, at the dialog's size. */
function ShortcutChip({
  isActive,
  onClick,
  children,
}: {
  isActive: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={cn(
        'inline-flex h-8 shrink-0 items-center rounded-full border px-3',
        'text-xs font-semibold whitespace-nowrap transition-colors',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        isActive
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-line bg-surface text-muted hover:text-ink active:bg-surface-2',
      )}
    >
      {children}
    </button>
  )
}

/**
 * One player, and whether he is off the table.
 *
 * A **checkbox**, not the radio the swap dialog uses: this question has as
 * many answers as there are players, and the row has to say which of two
 * states it is in rather than which one of a set is chosen. The mark is drawn
 * on the left where a list of checkboxes is read, and the row carries the
 * accent with it so the state survives a glance down a scrolling list.
 *
 * The line under the name is **the money the lock is about** — his value and
 * where it moved overnight — because that is what makes a player worth holding
 * on to, and it is the figure the optimiser would otherwise have spent. A
 * player already on the pitch says so too: locking the eleven is the common
 * case, and the chip above does it in one tap, but a reader going row by row
 * should not have to remember who was on it.
 */
function KeepRow({
  player,
  isLocked,
  isFielded,
  onToggle,
}: {
  player: SquadMember
  isLocked: boolean
  isFielded: boolean
  onToggle: () => void
}) {
  const change = player.marketValueChangeDay

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isLocked}
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-xl border px-2 py-1.5 text-left',
        'transition-colors',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        isLocked
          ? 'border-accent bg-accent/10'
          : 'border-line bg-canvas hover:border-accent/40 hover:bg-surface-2',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
          isLocked
            ? 'border-accent bg-accent text-accent-ink'
            : 'border-line bg-surface',
        )}
      >
        {isLocked && <Check size={13} strokeWidth={3} />}
      </span>

      <Avatar src={player.image} name={player.lastName} size={28} />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="min-w-0 truncate text-sm font-medium text-ink">
            {player.lastName}
          </span>
          {/* Who is on the pitch as things stand — the fact the shortcut
              above acts on, spelled out for anyone not using it. */}
          {isFielded && (
            <span
              title="Steht aktuell in der Aufstellung"
              className="shrink-0 rounded border border-accent/40 bg-accent/10 px-1 text-[0.5625rem] font-semibold tracking-wide text-accent uppercase"
            >
              Elf
            </span>
          )}
        </span>
        <span className="nums block truncate text-xs text-muted">
          {POSITION_LABEL[player.position]} · {money(player.marketValue)}
          {change !== undefined && change !== 0 && (
            <span
              className={change > 0 ? 'text-positive' : 'text-negative'}
            >{` ${moneyDelta(change)}`}</span>
          )}
        </span>
      </span>

      {isLocked && (
        <Lock size={13} aria-hidden="true" className="shrink-0 text-accent" />
      )}
    </button>
  )
}
