import { AlertTriangle } from 'lucide-react'

import { useSellPlayers } from '@/api/hooks/useSellPlayers'
import { POSITION_LABEL, type SquadMember } from '@/api/models'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { HoldButton } from '@/components/ui/HoldButton'
import { money, moneyExact } from '@/lib/format'

/**
 * The last screen before players leave the squad for good.
 *
 * It repeats the selection **by name** rather than as a count. The calculator
 * is a mode you drift through, tapping rows and watching a total; the tap that
 * opened this dialog is the first one that meant anything, and "3 Spieler" is
 * not enough to catch the row you marked two minutes ago and forgot. So every
 * player is listed with the figure he brings, and the sum is underneath them
 * where a sum belongs.
 *
 * **The confirm is a two-second hold**, not a button — see
 * [`HoldButton`](../ui/HoldButton.tsx) for why. Selling cannot be undone: there
 * is no "unsell", the player goes back on the market at his value, and buying
 * him back costs whatever the market then charges.
 *
 * A partial failure is reported and the dialog **stays open** with the squad
 * behind it already refreshed, so what actually happened is visible rather than
 * asserted. The caller closes it on success, which is also when the calculator
 * mode ends — see [`SquadPage`](../../pages/SquadPage.tsx).
 */
export function SellDialog({
  players,
  budget,
  leagueId,
  onClose,
  onSold,
}: {
  /** The squad members marked for sale, in the order the list showed them. */
  players: SquadMember[]
  /** The budget as it stands, for the "after" figure. */
  budget: number
  leagueId: string
  onClose: () => void
  /** Every player sold. The page closes the dialog and leaves the mode. */
  onSold: () => void
}) {
  const sell = useSellPlayers(leagueId)

  const proceeds = players.reduce((sum, player) => sum + player.marketValue, 0)

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        // Not while the requests are in flight: they are one per player and
        // closing mid-run would hide which of them landed.
        if (!open && !sell.isPending) onClose()
      }}
      title={
        players.length === 1
          ? 'Spieler verkaufen'
          : `${String(players.length)} Spieler verkaufen`
      }
      description={
        <span className="flex flex-col gap-0.5">
          <span>
            Erlös <span className="nums">{moneyExact(proceeds)}</span>
          </span>
          <span>
            Budget danach{' '}
            <span className="nums text-positive">
              {moneyExact(budget + proceeds)}
            </span>
          </span>
        </span>
      }
      confirmLabel="Verkaufen"
      onConfirm={onClose}
      error={sell.error?.message ?? null}
      confirmSlot={
        sell.isPending ? (
          <Button fullWidth isLoading>
            Verkaufen
          </Button>
        ) : (
          <HoldButton
            label="Halten zum Verkaufen"
            onComplete={() => {
              sell.mutate(
                players.map((player) => ({
                  id: player.id,
                  name: player.lastName,
                })),
                { onSuccess: onSold },
              )
            }}
          />
        )
      }
    >
      <div className="flex flex-col gap-2">
        {/* Capped in height rather than allowed to push the actions off a
            phone: a squad of twenty can, in principle, all be marked. */}
        <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
          {players.map((player) => (
            <li
              key={player.id}
              className="flex items-center gap-2 rounded-lg border border-line bg-surface-2/60 px-2 py-1.5"
            >
              <Avatar
                src={player.image}
                name={player.lastName}
                size={26}
                className="shrink-0"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                {player.lastName}
              </span>
              <span className="shrink-0 text-[0.625rem] font-semibold text-faint uppercase">
                {POSITION_LABEL[player.position]}
              </span>
              <span className="nums shrink-0 text-sm font-semibold text-ink">
                {money(player.marketValue)}
              </span>
            </li>
          ))}
        </ul>

        <p className="flex items-start gap-1.5 text-xs leading-snug text-warning">
          <AlertTriangle
            size={14}
            aria-hidden="true"
            className="mt-px shrink-0"
          />
          <span>
            Verkauf an Kickbase zum Marktwert. Das lässt sich nicht rückgängig
            machen.
          </span>
        </p>
      </div>
    </ConfirmDialog>
  )
}
