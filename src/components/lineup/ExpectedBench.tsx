import { Link } from 'react-router'

import { playerPortraitUrl } from '@/api/cdn'
import {
  EXPECTED_STATUS_LABEL,
  EXPECTED_TIER,
  expectedSwaps,
  type ExpectedLineup,
  type ExpectedPlayer,
} from '@/api/models'
import { ExpectedTierBadge } from '@/components/lineup/ExpectedTierBadge'
import {
  chance,
  expectedPlayerLabel,
  expectedStatusCode,
} from '@/components/lineup/expectedLineup'
import { SwapMark } from '@/components/player/statGlyphs'
import { PlayerStatusBadge } from '@/components/squad/PlayerStatusBadge'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'

/**
 * **The bench, read as the substitutions it would produce.**
 *
 * The file gives every bench player a `replaces`: the expected starter at his
 * position with the lowest `pStart` — the man he is nearest to displacing. So
 * the column is not a list of names left over from the eleven, it is a list of
 * *changes*, each one a sentence: **Díaz → für Saibari**, and beside it the
 * chance the run gives him of starting after all.
 *
 * That is the half of a predicted lineup worth more than the eleven itself. An
 * eleven is one guess; the bench says where that guess is soft, and a
 * coin-flip substitute at 63 % against a starter at 65 % is the pair a reader
 * should be looking at before he sets his own lineup.
 *
 * **The ones with no counterpart still get a row**, under the swaps and
 * without an arrow: a third-choice keeper displaces nobody in particular, and
 * dropping him would quietly turn "the expected squad" into "the players the
 * model could pair up".
 *
 * **Those not expected in the squad at all** are named in one line at the
 * bottom rather than given rows of their own. Nine or ten names, every one of
 * them a fact the reader already has on the squad page with a reason attached
 * — here they matter only as the answer to "where is he, then".
 */
export function ExpectedBench({
  lineup,
  leagueId,
  /** The crest for the heading — a column beside a second club needs it. */
  crest,
  teamName,
  className,
  /**
   * Drawn as a touchline beside a [full-screen](../ui/FullscreenPane.tsx)
   * landscape pitch rather than as a block under one. Fixed width, and the
   * rows scroll inside it so a long bench cannot squeeze the grass.
   */
  isBeside = false,
}: {
  lineup: ExpectedLineup
  leagueId: string
  crest?: string
  teamName?: string
  className?: string
  isBeside?: boolean
}) {
  const swaps = expectedSwaps(lineup)
  const swapIds = new Set(swaps.map((swap) => swap.on.id))
  const rest = lineup.bench.filter((player) => !swapIds.has(player.id))

  return (
    <section className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <h3 className="flex min-w-0 shrink-0 items-center gap-1.5 px-0.5 text-[0.625rem] font-semibold tracking-wider text-faint uppercase">
        {crest !== undefined && (
          <Avatar
            src={crest}
            name={teamName ?? ''}
            size={14}
            square
            className="bg-transparent"
          />
        )}
        <span className="truncate">
          {swaps.length > 0 ? 'Mögliche Wechsel' : 'Bank'}
        </span>
      </h3>

      {lineup.bench.length === 0 ? (
        <p className="rounded-card border border-line bg-surface px-2 py-3 text-center text-[0.6875rem] text-muted">
          Keine Bank prognostiziert
        </p>
      ) : (
        <ul
          className={cn(
            'flex flex-col gap-1',
            isBeside && 'min-h-0 flex-1 overflow-y-auto pr-0.5',
          )}
        >
          {swaps.map((swap) => (
            <BenchRow
              key={swap.on.id}
              player={swap.on}
              forName={swap.off.name}
              leagueId={leagueId}
            />
          ))}
          {rest.map((player) => (
            <BenchRow key={player.id} player={player} leagueId={leagueId} />
          ))}
        </ul>
      )}

      {lineup.out.length > 0 && (
        <p className="px-0.5 text-[0.625rem] leading-relaxed text-faint">
          <span className="font-semibold">Nicht im Kader erwartet: </span>
          {lineup.out.map((player) => player.name).join(', ')}
        </p>
      )}
    </section>
  )
}

/**
 * One substitute, as a row — and a **link**, like the portraits on the grass.
 *
 * Two lines where there is something to say on the second: the name and his
 * chance of starting on the first, the man he would come in for on the second,
 * behind the app's own green arrow. One line where there is not.
 */
function BenchRow({
  player,
  forName,
  leagueId,
}: {
  player: ExpectedPlayer
  /** The starter he is nearest to displacing, when the file names one. */
  forName?: string
  leagueId: string
}) {
  const label = expectedPlayerLabel(player)

  return (
    <li>
      <Link
        to={`/leagues/${leagueId}/players/${player.id}`}
        title={label}
        aria-label={label}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-lg border border-line bg-surface px-1.5 py-1 text-left',
          'transition-colors hover:bg-surface-2',
          'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        )}
      >
        <span className="relative shrink-0">
          <Avatar
            src={playerPortraitUrl(player.id)}
            name={player.name}
            size={24}
            className="ring-1 ring-white/20"
          />
          <PlayerStatusBadge
            status={expectedStatusCode(player.status)}
            reason={
              player.status === undefined
                ? undefined
                : EXPECTED_STATUS_LABEL[player.status]
            }
            size={11}
            onImage
            className="absolute -top-0.5 -left-0.5"
          />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.6875rem] font-medium text-ink">
            {player.name}
          </span>
          {forName === undefined ? (
            <span className="block truncate text-[0.625rem] text-faint">
              {EXPECTED_TIER[player.tier].label}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[0.625rem] text-muted">
              <SwapMark direction="in" size={10} />
              <span className="truncate">für {forName}</span>
            </span>
          )}
        </span>

        <ExpectedTierBadge tier={player.tier} size={13} />

        <span className="nums shrink-0 text-[0.6875rem] font-semibold text-muted">
          {chance(player.startChance)}
        </span>
      </Link>
    </li>
  )
}
