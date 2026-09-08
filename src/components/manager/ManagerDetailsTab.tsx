import { ArrowRight, Trophy } from 'lucide-react'
import { Link } from 'react-router'

import type {
  ManagerHistory,
  ManagerMatchday,
  RankedManager,
} from '@/api/models'
import { Card, CardHeader, StatTile } from '@/components/ui/Card'
import { SkeletonList } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { money, placement, points } from '@/lib/format'

/**
 * **The manager in numbers** — the standings row, unpacked, plus every matchday
 * of the current season they have played.
 *
 * Two payloads. The tiles on the standings row come from
 * `/leagues/{id}/ranking`, which the page already holds to know whose page
 * this is. The matchday list is
 * [`useManagerPerformance`](../../api/hooks/useManagerPerformance.ts) →
 * `/managers/{id}/performance`, one request gated to this tab — because the
 * standings **do not carry a points history**. Their `lp` is the fielded
 * eleven's player ids, and until 2026-09-08 this tab drew it as eleven
 * "matchdays", most of them in the future.
 *
 * ## The matchday list is the point of the tab
 *
 * The tiles restate what the [header](./ManagerHeader.tsx) and the
 * [Rangliste](../../pages/RankingPage.tsx) say. The list says something
 * neither does: the *shape* of a season — the manager who is third on two big
 * weekends and nothing else, the one grinding out sixties. And each row
 * **opens that matchday's lineup**, which is the question the row raises: 291
 * points, from whom?
 *
 * **Only played matchdays, only this season.** The endpoint lists the running
 * season to its last matchday and every earlier season in full; the hook keeps
 * the current season and drops the matchdays without a score. A matchday the
 * manager sat out is `0` and is drawn as one — zero is a thing that can happen
 * to a team that played, and the tooltip says so.
 */
export function ManagerDetailsTab({
  manager,
  history,
  isDuelMode,
  isViewer,
  leagueId,
  matchdayBase,
  matchday,
}: {
  manager: RankedManager
  /** The matchday history, `undefined` while it loads or if it failed. */
  history: {
    data: ManagerHistory | undefined
    isPending: boolean
    isError: boolean
    error: unknown
    refetch: () => unknown
  }
  isDuelMode: boolean
  isViewer: boolean
  leagueId: string
  /**
   * Where a matchday row goes — the page's own lineup tab, which takes the
   * matchday in `?day=`. Passed in rather than rebuilt here so the page keeps
   * one notion of its own URL.
   */
  matchdayBase: string
  /**
   * The matchday the page is looking at, and what the manager scored on it.
   *
   * The page's own `?day=`, so this tile agrees with the header's duel strip
   * and with the Aufstellung tab. The season standings' `mdp` could not do
   * that: it is always the **current** matchday's, whichever one the reader has
   * stepped to.
   */
  matchday: { day: number; points: number; placement: number } | undefined
}) {
  const season = history.data?.current
  const played = season?.matchdays ?? []
  const best =
    played.length === 0
      ? undefined
      : played.reduce((top, entry) => (entry.points > top.points ? entry : top))

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatTile
          label="Kickbase-Punkte"
          value={points(manager.seasonPoints)}
          hint={`${placement(manager.seasonPlacement)} Platz`}
        />
        {isDuelMode && (
          <StatTile
            label="Duellpunkte"
            value={points(manager.duelPoints)}
            hint={`${placement(manager.duelPlacement)} Platz`}
          />
        )}
        <StatTile label="Teamwert" value={money(manager.teamValue)} />
        {/* The season figures wait for the history rather than being faked
            from the standings: the standings know the total, not the count
            of matchdays it took. */}
        <StatTile
          label="Ø pro Spieltag"
          value={season === undefined ? '…' : points(season.averagePoints)}
          hint={
            season === undefined
              ? undefined
              : played.length === 0
                ? 'nichts gespielt'
                : `${points(played.length)} Spieltage`
          }
        />
        <StatTile
          label="Bester Spieltag"
          value={season === undefined ? '…' : points(best?.points)}
          hint={
            best === undefined ? undefined : `${placement(best.day)} Spieltag`
          }
        />
        <StatTile
          label="Spieltagssiege"
          value={season === undefined ? '…' : points(season.matchdayWins)}
        />
        {matchday !== undefined && (
          <StatTile
            label={`${String(matchday.day)}. Spieltag`}
            value={points(matchday.points)}
            hint={
              matchday.placement > 0
                ? `${placement(matchday.placement)} Platz`
                : 'noch nicht gewertet'
            }
          />
        )}
      </div>

      {history.isPending ? (
        <SkeletonList rows={4} />
      ) : history.isError ? (
        <ErrorState
          error={history.error}
          onRetry={() => {
            void history.refetch()
          }}
        />
      ) : (
        <MatchdayPoints
          matchdays={played}
          best={best}
          matchdayBase={matchdayBase}
        />
      )}

      {/* The one thing a manager's own page cannot do, and the page it belongs
          on. Only for the viewer: everybody else's squad is read-only by
          construction, and offering the link would be offering to edit
          somebody else's team. */}
      {isViewer && (
        <Link
          to={`/leagues/${leagueId}/squad/lineup`}
          className={cn(
            'flex items-center gap-2 rounded-card border border-line bg-surface px-3 py-2.5',
            'text-sm font-medium text-accent transition-colors hover:bg-surface-2',
          )}
        >
          <ArrowRight size={15} aria-hidden="true" />
          Eigene Aufstellung bearbeiten
        </Link>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * Every played matchday of the season, as a bar per row.
 *
 * **Newest first**, which is the opposite of the payload: the matchday a reader
 * arrives asking about is the one just played. Each row carries its own
 * matchday number, so nothing depends on the array's index — the list starts
 * where the manager joined, not at matchday 1.
 *
 * The bar is scaled against the manager's **own best** matchday rather than a
 * league-wide maximum. This is a portrait of one season, not a comparison — and
 * the comparison already exists, one tap away, in the matchday's own
 * [Rangliste](../ranking/ManagerRankingTab.tsx). A matchday the manager won
 * outright carries a small trophy: `tw` is on the payload, and "won the
 * weekend" is the one comparison worth folding into the portrait.
 *
 * A negative matchday is possible (a bench full of red cards) and is drawn
 * without a bar: a bar growing leftwards from a baseline the rest of the list
 * does not have would need an axis to be read, and one row in a season does not
 * earn one.
 */
function MatchdayPoints({
  matchdays,
  best,
  matchdayBase,
}: {
  /** Oldest first, played only. */
  matchdays: ManagerMatchday[]
  /** The manager's own best matchday, which scales every bar. */
  best: ManagerMatchday | undefined
  matchdayBase: string
}) {
  if (matchdays.length === 0) {
    return (
      <Card>
        <CardHeader title="Spieltage" />
        <p className="px-4 py-6 text-center text-xs text-muted">
          Für diesen Manager liefert Kickbase noch keine Spieltagspunkte.
        </p>
      </Card>
    )
  }

  const rows = [...matchdays].reverse()

  return (
    <Card>
      <CardHeader title="Spieltage" />
      <ul className="divide-y divide-line">
        {rows.map((row) => {
          const share =
            best === undefined || best.points <= 0 || row.points <= 0
              ? 0
              : Math.max(2, Math.round((row.points / best.points) * 100))

          return (
            <li key={row.day}>
              <Link
                to={`${matchdayBase}?day=${String(row.day)}`}
                title={`${String(row.day)}. Spieltag — ${points(row.points)} Punkte${row.isMatchdayWin ? ', Spieltagssieg' : ''}`}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/60"
              >
                <span className="nums w-6 shrink-0 text-xs font-semibold text-faint">
                  {row.day}.
                </span>

                {/* The bar and the figure are one object: the track fills the
                    row's width so the bars line up down the list, and the
                    number sits at the end where the eye already is. */}
                <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span
                    style={{ width: `${String(share)}%` }}
                    className={cn(
                      'block h-full rounded-full',
                      row.day === best?.day ? 'bg-accent' : 'bg-accent/45',
                    )}
                  />
                </span>

                <span className="flex w-16 shrink-0 items-center justify-end gap-1">
                  {row.isMatchdayWin && (
                    <Trophy
                      size={12}
                      aria-label="Spieltagssieg"
                      className="shrink-0 text-gold"
                    />
                  )}
                  <span
                    className={cn(
                      'nums text-right text-sm font-semibold',
                      row.points < 0 ? 'text-negative' : 'text-ink',
                    )}
                  >
                    {points(row.points)}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
