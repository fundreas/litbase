import { Crown, Swords } from 'lucide-react'
import { Link } from 'react-router'

import { duelIdOf, type DuelResult, type RankedManager } from '@/api/models'
import { DuelOutcomeLine } from '@/components/ranking/DuelOutcomeLine'
import { Avatar } from '@/components/ui/Avatar'
import { PlacementChange } from '@/components/ui/PlacementChange'
import { cn } from '@/lib/cn'
import { money, placement, points } from '@/lib/format'

/**
 * Who this manager is and where they stand — above all four tabs.
 *
 * Kept out of the Details tab for the reason the
 * [club](../team/TeamHeader.tsx) and [player](../player/PlayerHeader.tsx)
 * headers are kept out of theirs: it is the page's identity, and a pitch or a
 * squad list with no name over it is a list of nothing. It also means switching
 * tabs never moves it.
 *
 * **The figures here are the season's**, whatever matchday the tabs below are
 * showing: the placement the league is ranked by, the points behind it, and the
 * team value. What the manager did on *one* matchday is the strip underneath and
 * the [lineup tab](./ManagerLineupTab.tsx) — the two readings are deliberately
 * not mixed, because a placement that changed when you stepped a matchday would
 * look like the table itself had moved.
 *
 * **No back link.** The page is reached by tapping a name, and the browser's own
 * back — a system gesture on a phone — already does it.
 */
export function ManagerHeader({
  manager,
  isViewer,
  isDuelMode,
  duel,
  leagueId,
}: {
  manager: RankedManager
  isViewer: boolean
  /** Duel league? Decides whether the duel figures mean anything. */
  isDuelMode: boolean
  /** The duel of the matchday in view, when the league plays them. */
  duel: ManagerDuel | undefined
  leagueId: string
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar src={manager.image} name={manager.name} size={64} />

        <div className="min-w-0 flex-1">
          <h1 className="flex min-w-0 items-center gap-1.5 text-xl font-bold tracking-tight text-ink">
            <span className="truncate">{manager.name}</span>
            {isViewer && (
              <span className="shrink-0 text-sm font-medium text-accent">
                du
              </span>
            )}
            {/* The league's admin, marked the way the feed marks a matchday
                winner. Wordless, so it costs the name no width — the title
                carries the claim. */}
            {manager.isAdmin && (
              <span
                role="img"
                aria-label="Administrator der Liga"
                title="Administrator der Liga"
                className="flex shrink-0 text-warning"
              >
                <Crown size={14} aria-hidden="true" />
              </span>
            )}
          </h1>

          {/* Two quiet lines rather than one long one: where the manager stands
              in the table that decides the league, then what the squad behind
              it is worth. In a duel league the headline placement is the duel
              table's, which is the one the season is played for — the Kickbase
              points table rides along as the second figure, exactly as the
              [Rangliste](../../pages/RankingPage.tsx) pairs them. */}
          <p className="nums mt-0.5 flex items-center gap-1.5 text-sm text-muted">
            <span className="font-semibold text-ink">
              {placement(
                isDuelMode ? manager.duelPlacement : manager.seasonPlacement,
              )}{' '}
              Platz
            </span>
            <span aria-hidden="true" className="text-faint">
              ·
            </span>
            <span>
              {isDuelMode && manager.duelPoints !== undefined
                ? `${points(manager.duelPoints)} Duellpkt`
                : `${points(manager.seasonPoints)} Pkt`}
            </span>
            <PlacementChange value={manager.placementChange} />
          </p>

          <p className="nums mt-0.5 truncate text-xs text-faint">
            {money(manager.teamValue)} Teamwert
            {isDuelMode && ` · ${points(manager.seasonPoints)} Pkt`}
          </p>
        </div>
      </div>

      {duel !== undefined && (
        <DuelStrip duel={duel} manager={manager} leagueId={leagueId} />
      )}
    </div>
  )
}

/** The duel this manager is in on the matchday being looked at. */
export interface ManagerDuel {
  day: number
  opponent: RankedManager
  /** This manager's points on that matchday. */
  ownPoints: number
  /** The opponent's, so the strip can print a scoreline rather than a total. */
  opponentPoints: number
  /**
   * How it went — `undefined` while the matchday is still being played, where
   * "won" is a claim nobody can make yet.
   */
  result: DuelResult | undefined
  /** Is the matchday under way? Tints the scoreline, as everywhere else. */
  isLive: boolean
}

/**
 * The matchday's duel, as a tappable strip.
 *
 * The counterpart of the club page's
 * [fixture strip](../team/TeamHeader.tsx) — that one carries a club's most
 * immediate *match*, this one a manager's *duel*. It is the question a duel
 * league raises about any manager, who are they playing and are they winning,
 * and the answer is one row that opens
 * [the duel](../../pages/DuelDetailPage.tsx) in full.
 *
 * **Not rendered outside duel leagues**, where there is no such question, and
 * not for a manager the matchday left without an opponent (an odd-sized
 * league): the strip would then be a row saying nothing.
 */
function DuelStrip({
  duel,
  manager,
  leagueId,
}: {
  duel: ManagerDuel
  manager: RankedManager
  leagueId: string
}) {
  const to = `/leagues/${leagueId}/duels/${duelIdOf(manager.id, duel.opponent.id)}?day=${String(duel.day)}`

  return (
    <Link
      to={to}
      className={cn(
        'flex w-full items-center gap-3 rounded-card border px-3 py-2.5 text-left transition-colors',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        duel.isLive
          ? 'border-accent/40 bg-accent/10 hover:bg-accent/15'
          : 'border-line bg-surface hover:bg-surface-2',
      )}
    >
      <span className="flex w-5 shrink-0 justify-center">
        <Swords size={14} aria-hidden="true" className="text-faint" />
      </span>

      <Avatar
        src={duel.opponent.image}
        name={duel.opponent.name}
        size={28}
        className="shrink-0"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {duel.opponent.name}
        </p>
        <p className="nums truncate text-[0.6875rem] text-muted">
          {duel.day}. Spieltag
          {duel.isLive && ' · Live'}
        </p>
      </div>

      {/* The scoreline reads from *this* manager's side — the page is theirs,
          and "291 : 250" under someone's own name has to mean they are ahead or
          the strip lies about who is winning. */}
      <span className="shrink-0 text-right">
        <span
          className={cn(
            'nums block text-lg leading-none font-bold',
            duel.isLive
              ? 'text-accent'
              : duel.result === 'won'
                ? 'text-positive'
                : duel.result === 'lost'
                  ? 'text-negative'
                  : 'text-ink',
          )}
        >
          {points(duel.ownPoints)}:{points(duel.opponentPoints)}
        </span>
        <span className="mt-0.5 flex justify-end">
          <DuelOutcomeLine result={duel.result} opponentName={undefined} />
        </span>
      </span>
    </Link>
  )
}
