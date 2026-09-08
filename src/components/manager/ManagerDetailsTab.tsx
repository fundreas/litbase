import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import type { RankedManager } from '@/api/models'
import { Card, CardHeader, StatTile } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { money, placement, points } from '@/lib/format'

/**
 * **The manager in numbers** — the standings row, unpacked, plus every matchday
 * they have played.
 *
 * Everything here is one payload: `/leagues/{id}/ranking` carries a manager's
 * placement, both point totals, the team value and `lp`, the per-matchday
 * scores. The tab costs **no request of its own** — the page already holds the
 * standings to know whose page this is.
 *
 * ## The matchday list is the point of the tab
 *
 * The tiles restate what the [header](./ManagerHeader.tsx) and the
 * [Rangliste](../../pages/RankingPage.tsx) say. `lp` says something neither
 * does: the *shape* of a season — the manager who is third on two big weekends
 * and nothing else, the one grinding out sixties. And each row **opens that
 * matchday's lineup**, which is the question the row raises: 291 points, from
 * whom?
 *
 * A `null` in `lp` is a matchday the manager did not play — they joined later,
 * or fielded nobody. Drawn as a dash with no bar rather than as a zero, because
 * zero is a thing that can happen to a team that played.
 */
export function ManagerDetailsTab({
  manager,
  isDuelMode,
  isViewer,
  leagueId,
  matchdayBase,
  matchday,
}: {
  manager: RankedManager
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
  const played = manager.pointsPerMatchday.filter(
    (entry): entry is number => entry !== null,
  )
  const average =
    played.length === 0
      ? undefined
      : Math.round(
          played.reduce((sum, entry) => sum + entry, 0) / played.length,
        )
  const best = played.length === 0 ? undefined : Math.max(...played)

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
        <StatTile
          label="Ø pro Spieltag"
          value={points(average)}
          hint={
            played.length === 0
              ? 'nichts gespielt'
              : `${points(played.length)} Spieltage`
          }
        />
        <StatTile
          label="Bester Spieltag"
          value={points(best)}
          hint={
            best === undefined
              ? undefined
              : `${placement(manager.pointsPerMatchday.indexOf(best) + 1)} Spieltag`
          }
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

      <MatchdayPoints
        history={manager.pointsPerMatchday}
        best={best}
        matchdayBase={matchdayBase}
      />

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
 * Every matchday of the season, as a bar per row.
 *
 * **Newest first**, which is the opposite of the array: `lp` is oldest first,
 * and the matchday a reader arrives asking about is the one just played. The
 * index is therefore the matchday number and has to be kept while reversing —
 * getting that backwards would link every row at the wrong matchday, and it
 * would look right for exactly the middle of the season.
 *
 * The bar is scaled against the manager's **own best** matchday rather than a
 * league-wide maximum. This is a portrait of one season, not a comparison — and
 * the comparison already exists, one tap away, in the matchday's own
 * [Rangliste](../ranking/ManagerRankingTab.tsx).
 *
 * A negative matchday is possible (a bench full of red cards) and is drawn
 * without a bar: a bar growing leftwards from a baseline the rest of the list
 * does not have would need an axis to be read, and one row in a season does not
 * earn one.
 */
function MatchdayPoints({
  history,
  best,
  matchdayBase,
}: {
  history: Array<number | null>
  /** The manager's own best matchday, which scales every bar. */
  best: number | undefined
  matchdayBase: string
}) {
  if (history.length === 0) {
    return (
      <Card>
        <CardHeader title="Spieltage" />
        <p className="px-4 py-6 text-center text-xs text-muted">
          Für diesen Manager liefert Kickbase noch keine Spieltagspunkte.
        </p>
      </Card>
    )
  }

  const rows = history
    .map((value, index) => ({ day: index + 1, value }))
    .reverse()

  return (
    <Card>
      <CardHeader title="Spieltage" />
      <ul className="divide-y divide-line">
        {rows.map((row) => {
          const share =
            row.value === null ||
            best === undefined ||
            best <= 0 ||
            row.value <= 0
              ? 0
              : Math.max(2, Math.round((row.value / best) * 100))

          return (
            <li key={row.day}>
              <Link
                to={`${matchdayBase}?day=${String(row.day)}`}
                title={
                  row.value === null
                    ? `${String(row.day)}. Spieltag — nicht gespielt`
                    : `${String(row.day)}. Spieltag — ${points(row.value)} Punkte`
                }
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
                      row.value !== null && row.value === best
                        ? 'bg-accent'
                        : 'bg-accent/45',
                    )}
                  />
                </span>

                {/* A dash for a matchday the manager did not play, with the
                    row's tooltip spelling it out. The words themselves would
                    need three times this column's width, and widening it for
                    the rare row would narrow every bar. */}
                <span
                  className={cn(
                    'nums w-14 shrink-0 text-right text-sm font-semibold',
                    row.value === null
                      ? 'text-faint'
                      : row.value < 0
                        ? 'text-negative'
                        : 'text-ink',
                  )}
                >
                  {row.value === null ? '–' : points(row.value)}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
