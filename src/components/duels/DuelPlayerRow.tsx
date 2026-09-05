import type { ReactNode } from 'react'

import { playerFigure, type DuelPlayer } from '@/api/models'
import { BenchMark } from '@/components/player/BenchMark'
import { MatchEventBadge } from '@/components/player/MatchEventBadge'
import { MatchStateBadge } from '@/components/player/MatchStateBadge'
import {
  figureDescription,
  figureLabel,
  isScore,
} from '@/components/player/playerFigure'
import { FixtureBadge } from '@/components/squad/FixtureBadge'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'

/**
 * One player in a duel: who they are, what their match is doing, what they
 * scored.
 *
 * The second line **used to read `MF @ ELF`** — a position abbreviation, a
 * `vs`/`@` and the opponent's three-letter symbol, plus a status word. It now
 * carries the opponent's **crest** with a house or aeroplane beside it
 * ([`FixtureBadge`](../squad/FixtureBadge.tsx)) and the match's own
 * **scoreline** ([`MatchStateBadge`](../player/MatchStateBadge.tsx)), which
 * shows the result once there is one and pulses while the match is on. Three
 * pieces of text became two marks and a number, and the row gained the thing
 * it never had: how that match is actually going.
 *
 * The position went with them. It is the least useful thing about a player in
 * a list ranked by points, and it is one tap away on his own page.
 *
 * The figure on the right is never `0` for a player who has not scored: it is
 * the points when they exist, the **kick-off time** while the match is still
 * to come, the [bench mark](../player/BenchMark.tsx) for someone who did not
 * play, and `–` only when there is nothing to say. That is [`playerFigure()`](../../api/models.ts), shared with
 * both pitches. Printing `0` would claim a player featured and failed to
 * score, which is why `points` is optional in the first place.
 */
export function DuelPlayerRow({
  player,
  showStatus = true,
  trailing,
}: {
  player: DuelPlayer
  /** Off in the ranking tab, where the "Bank" tag carries the same load. */
  showStatus?: boolean
  /** Extra content on the right, e.g. the owning manager's avatar. */
  trailing?: ReactNode
}) {
  const figure = playerFigure(player)
  /*
   * Only the **bench** still has a mark on the second line. The other four
   * states are what the scoreline beside it now says — and better, since
   * "Läuft" cannot tell you it is 2:1.
   *
   * It is dropped when the figure column already carries the armchair, which
   * `playerFigure` resolves to for a benched player with no points: two
   * armchairs across one row is just noise. One who *did* score keeps both,
   * because there the figure is a number and the mark is what says it did not
   * count.
   */
  const showStatusWord = showStatus && figure.kind !== 'bench'

  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <Avatar src={player.image} name={player.name} size={34} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{player.name}</p>
        {/* The fixture as **pictures and a scoreline**, not "MF @ ELF".
            `FixtureBadge` is the app's wordless fixture — the opponent's
            crest, recognised faster than a three-letter symbol, wearing a
            house or an aeroplane in its corner — and `MatchStateBadge` says where that
            match stands: a faint `–:–` before kick-off, a pulsing dot and the
            running score while it is on, the final score once it is over.
            Between them they answer "who against, home or away, and how is it
            going" in the width the position abbreviation used to take. */}
        <span className="mt-0.5 flex items-center gap-2">
          <FixtureBadge fixture={player.fixture} size="sm" />
          <MatchStateBadge
            fixture={player.fixture}
            live={player.live}
            teamId={player.teamId}
          />
          {/* What he actually did, from the match's own event feed — the same
              glyphs the player page draws, since the codes turned out to be
              the same scale. Goals and cards are the reason a score moved,
              and they belong on the row that shows the score. */}
          {player.events?.map((event) => (
            <MatchEventBadge key={event.kind} event={event} />
          ))}
          {showStatusWord && player.status === 'bench' && (
            <BenchMark size={12} className="text-faint" />
          )}
        </span>
      </div>

      {trailing}

      {/* The armchair takes the place of the number for a benched player who
          has no score — a mark where a figure would be, which reads as "there
          is nothing here that counts". */}
      {figure.kind === 'bench' ? (
        <BenchMark size={15} className="text-faint" />
      ) : (
        <span
          aria-label={figureDescription(figure)}
          className={cn(
            'nums shrink-0 text-sm font-semibold',
            isScore(figure) ? 'text-ink' : 'text-faint',
          )}
        >
          {figureLabel(figure)}
        </span>
      )}
    </div>
  )
}
