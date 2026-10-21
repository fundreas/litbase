import { Binoculars } from 'lucide-react'

import {
  useScoutPlayer,
  useScoutedPlayers,
} from '@/api/hooks/useScoutedPlayers'
import { cn } from '@/lib/cn'

/**
 * **Put this player on the scout list, or take him off it** — the one control
 * in the header, at the end of the chip line.
 *
 * ## Why it is a toggle and not a dialog
 *
 * Every other Kickbase write the app makes moves money and asks first. This
 * one marks a player on a list only you can see, costs nothing, and is undone
 * by tapping the same chip again — so it is the single write that earns a bare
 * tap. See [`useScoutPlayer`](../../api/hooks/useScoutedPlayers.ts).
 *
 * ## Why it says its state in words
 *
 * The chip could have been a bare glyph — the [row mark](./ScoutMark.tsx) is —
 * but a glyph is only unambiguous once you have been told what it means, and
 * this is where it is learned: *Gescoutet* with the binoculars filled in is
 * what teaches the mark the market rows wear. It is also a control, and a
 * control that changes state on tap should say which state it is in rather
 * than leaving the reader to infer it from a tint.
 *
 * `aria-pressed` carries the same thing to a screen reader, which is what
 * makes one chip do the work of two buttons.
 *
 * **It waits for the list before it claims he is not on it.** Until the scout
 * list lands, "nicht gescoutet" would be a guess, and a guess that is acted on
 * sends the wrong verb — so the chip is disabled while the query is in flight.
 * A list that fails to load leaves it usable: adding is what the control is
 * for, and `POST` on a player already marked is at worst a no-op.
 */
export function ScoutToggle({
  leagueId,
  playerId,
  playerName,
}: {
  leagueId: string
  playerId: string
  /** For the spoken label — "Lewandowski scouten" rather than "scouten". */
  playerName: string
}) {
  const scouted = useScoutedPlayers(leagueId)
  const scout = useScoutPlayer(leagueId)

  const isScouted = scouted.data?.includes(playerId) === true
  const label = isScouted ? 'Gescoutet' : 'Scouten'
  const action = isScouted
    ? `${playerName} von der Scoutliste entfernen`
    : `${playerName} zur Scoutliste hinzufügen`

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          scout.mutate({ playerId, scouted: !isScouted })
        }}
        // The list has to have landed before the verb can be chosen; a write
        // already in flight owns the chip until it settles.
        disabled={scouted.isPending || scout.isPending}
        aria-pressed={isScouted}
        aria-label={action}
        title={action}
        className={cn(
          'flex items-center gap-1.5 rounded-full border px-2.5 py-1.5',
          'text-xs font-medium transition-colors',
          'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
          'disabled:pointer-events-none disabled:opacity-50',
          isScouted
            ? 'border-gold/40 bg-gold/10 text-gold hover:bg-gold/20'
            : 'border-line bg-surface text-muted hover:border-gold/40 hover:text-ink',
        )}
      >
        <Binoculars
          size={13}
          aria-hidden="true"
          className={cn('shrink-0', isScouted && 'fill-gold/25')}
        />
        {label}
      </button>

      {/* The header has no other place to say a write came back refused, and
          silently rolling the chip back would read as a tap that missed. One
          line, in the app's colour for *Kickbase said no*. */}
      {scout.isError && (
        <span role="status" className="text-xs text-negative">
          {scout.error.message}
        </span>
      )}
    </span>
  )
}
