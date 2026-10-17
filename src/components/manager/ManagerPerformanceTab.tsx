import { Swords, Trophy } from 'lucide-react'
import { Link } from 'react-router'

import type { ManagerSeasonDuels } from '@/api/hooks/useManagerDuels'
import type { ManagerHistoryQuery } from '@/api/hooks/useManagerPerformance'
import {
  duelIdOf,
  matchdayState,
  type ManagerMatchday,
  type ManagerSeasonDuel,
  type SeasonMatchday,
} from '@/api/models'
import { ManagerAvatar } from '@/components/manager/ManagerAvatar'
import { DUEL_RESULT } from '@/components/ranking/duelResult'
import { StatTile } from '@/components/ui/Card'
import { SkeletonList } from '@/components/ui/Skeleton'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { dateRange, points } from '@/lib/format'

/**
 * **A manager's season, matchday by matchday** — newest first.
 *
 * The counterpart of a club's [season of fixtures](../team/TeamMatchesTab.tsx)
 * and of a player's [season of matches](../player/PlayerPerformanceTab.tsx):
 * the one screen that reads a manager's whole season as a list rather than as
 * a total.
 *
 * ## Two lists, because a league is played one of two ways
 *
 * **In a duel league it is the season of duels** — the competition such a
 * league is actually played for. It answers the question the
 * [header's duel strip](./ManagerHeader.tsx) raises one matchday at a time —
 * *who have they beaten to get there* — and until it existed the answer was
 * nowhere in the app: the standings carry the running duel total and **this**
 * matchday's opponent, and no screen could step back through the rest. Every
 * row opens [that duel](../../pages/DuelDetailPage.tsx), both elevens and all
 * the points behind the scoreline.
 *
 * **Everywhere else it is the season of matchdays**, which is all a league
 * without duels has: the date, what the manager scored, and the matchdays they
 * won outright. Every row opens the [matchday](../../pages/MatchdayPage.tsx)
 * itself — the nine fixtures those points came out of. That is the honest
 * destination here, and it is what keeps the list from being the Details tab's
 * *Spieltage* card again: that one answers *what did he field* and stays on
 * this page, this one answers *what was the football* and leaves it.
 *
 * Both are one tap from a figure to its explanation, which is the move the
 * whole page is built out of.
 *
 * ## The row
 *
 * ```
 *   ┌──────────────────────────────────────┐
 *   │ 8. (A) Danger            410:120  ✓ │
 *   │        Gewonnen · 3 Duellpkt         │
 *   ├─────────────▌────────────────────────┤  ← the margin, as a bar
 *   └──────────────────────────────────────┘
 * ```
 *
 * **The scoreline reads from this manager's side**, as the header's strip
 * does: `410:120` under somebody's own name has to mean they are ahead, or the
 * row lies about who won.
 *
 * **The bar along the bottom edge is the duel's margin** — this manager's share
 * of the two scores — not a points total scaled against the season. The
 * treatment is [`TeamMatchesTab`](../team/TeamMatchesTab.tsx)'s, where a column
 * of filled edges reads as a bar chart on its side without anything drawing a
 * chart; what it measures is different because the question is different. A
 * club's matchday asks *how big*, a duel asks *how close*: a bar at the halfway
 * mark is a duel decided by nothing, one at the far end a rout. It is the one
 * thing a scoreline of four-digit numbers does not say at a glance.
 *
 * Which is also why the bar is **coloured by the result** rather than by the
 * [points scale](../player/pointsScale.ts): on this tab 410 points is not good
 * or bad, it is only more or less than what the other manager scored.
 *
 * ## What it does not claim
 *
 * **An unfinished duel has no result.** While the matchday runs the row is
 * accent-tinted and the mark is absent — level at `0` in the third minute is
 * not a draw, the same gate the header's strip and the standings' outcome line
 * apply.
 *
 * **A matchday that left the manager out is a row, not a gap.** An odd-sized
 * league gives somebody a bye every matchday; their points still counted
 * towards the Kickbase table, so the row shows them and says *spielfrei*
 * instead of inventing an opponent. It is not a link: there is no duel to open.
 */
export function ManagerPerformanceTab({
  season,
  history,
  matchdays,
  managerId,
  leagueId,
  isDuelMode,
}: {
  /** The season of duels. Only ever filled in a duel league. */
  season: ManagerSeasonDuels
  /**
   * The manager's matchday history — what a league **without** duels has
   * instead, and the same cache entry the Details tab reads.
   */
  history: ManagerHistoryQuery
  /** The season's matchdays, for each row's date and for the live one. */
  matchdays: SeasonMatchday[] | undefined
  managerId: string
  leagueId: string
  /** Which of the two lists this league gets. */
  isDuelMode: boolean
}) {
  if (!isDuelMode) {
    return (
      <MatchdaySeason
        history={history}
        matchdays={matchdays}
        leagueId={leagueId}
      />
    )
  }

  if (season.isPending) return <SkeletonList rows={6} />

  if (season.isError) {
    return <ErrorState error={season.error} onRetry={season.refetch} />
  }

  if (season.duels.length === 0) {
    return (
      <EmptyState
        icon={<Swords size={20} aria-hidden="true" />}
        title="Noch keine Duelle"
        description="Für diesen Manager hat Kickbase in dieser Saison noch keinen Spieltag gewertet."
      />
    )
  }

  const { won, drawn, lost } = season.record

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {/* Siege–Remis–Niederlagen, the way a league table writes a record,
            and in that order whatever the three counts are. Tinted only when
            the season actually leans one way: a 3–1–3 is neither. */}
        <StatTile
          label="Bilanz"
          value={`${String(won)} · ${String(drawn)} · ${String(lost)}`}
          hint="Siege · Remis · Niederl."
          tone={won > lost ? 'positive' : lost > won ? 'negative' : 'neutral'}
        />
        <StatTile
          label="Duellpunkte"
          value={points(season.duelPoints)}
          hint={`${String(season.duels.length)} Spieltage`}
        />
        {/* The average is the tab's one genuinely new figure: what this manager
            scores *against the managers they were drawn against*. A season of
            narrow wins and a season of routs have the same duel points and
            nothing else says so. */}
        <StatTile
          label="Ø Punkte"
          value={points(season.averagePoints)}
          hint={
            season.averageOpponentPoints === undefined
              ? undefined
              : `Gegner Ø ${points(season.averageOpponentPoints)}`
          }
        />
      </div>

      {/* The rows land one matchday at a time; the list shows what has arrived
          rather than nothing at all. Same line as the club page's fan-out. */}
      {season.pendingCount > 0 && (
        <p className="flex items-center gap-2 px-0.5 text-xs text-muted">
          <Spinner size={12} />
          <span>
            {season.pendingCount === 1
              ? 'Noch ein Spieltag wird geladen …'
              : `Noch ${String(season.pendingCount)} Spieltage werden geladen …`}
          </span>
        </p>
      )}

      <ul className="flex flex-col gap-1.5">
        {season.duels.map((duel) => (
          <li key={duel.day}>
            <DuelRow duel={duel} managerId={managerId} leagueId={leagueId} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* The season without duels                                                   */
/* -------------------------------------------------------------------------- */

/**
 * **Every matchday the manager has played**, in a league that plays no duels.
 *
 * ```
 *   ┌──────────────────────────────────────┐
 *   │ 8.  Sa., 5. Sep.            🏆  410 │  → /matchday?day=8
 *   ├───────────────────────────▌──────────┤
 *   └──────────────────────────────────────┘
 * ```
 *
 * **One request**, and usually none: the matchday history is the same cache
 * entry the [Details tab](./ManagerDetailsTab.tsx) reads. There is no fan-out
 * here and nothing to fan out over — without duels a matchday is a number, and
 * the number is already on that payload. (The duel list costs a request per
 * matchday precisely because an opponent is *not*.)
 *
 * **The date is the row's second line**, taken from the competition's schedule
 * rather than from the history, which carries none. It is what turns a column
 * of matchday numbers into a season somebody lived through — and on the one row
 * the schedule says is being played, it gives way to *Läuft*. The span rather
 * than the first kick-off, through the same `dateRange` the
 * [matchday picker](../MatchdayPicker.tsx) labels a matchday with, because a
 * Bundesliga matchday is a Friday-to-Sunday and the picker already taught the
 * reader to see one that way.
 *
 * The bar is scaled against this manager's **own best** matchday, as the
 * Details tab's is and for the same reason: the tab is a portrait of one
 * season, and the comparison against the rest of the league already exists in
 * the [Rangliste](../../pages/RankingPage.tsx). A matchday won outright carries
 * the gold trophy `tw` earns on the Details tab too; a negative matchday draws
 * no bar, an axis being worth more than one row in a season.
 */
function MatchdaySeason({
  history,
  matchdays,
  leagueId,
}: {
  history: ManagerHistoryQuery
  matchdays: SeasonMatchday[] | undefined
  leagueId: string
}) {
  if (history.isPending) return <SkeletonList rows={6} />

  if (history.isError) {
    return (
      <ErrorState
        error={history.error}
        onRetry={() => {
          void history.refetch()
        }}
      />
    )
  }

  // Played only, oldest first — the hook drops the matchdays still to come.
  const played = history.data?.current?.matchdays ?? []

  if (played.length === 0) {
    return (
      <EmptyState
        title="Noch keine Spieltage"
        description="Für diesen Manager hat Kickbase in dieser Saison noch keinen Spieltag gewertet."
      />
    )
  }

  const best = played.reduce((top, entry) =>
    entry.points > top.points ? entry : top,
  )
  const byDay = new Map((matchdays ?? []).map((entry) => [entry.day, entry]))

  return (
    <ul className="flex flex-col gap-1.5">
      {[...played].reverse().map((matchday) => (
        <li key={matchday.day}>
          <MatchdayRow
            matchday={matchday}
            best={best}
            scheduled={byDay.get(matchday.day)}
            leagueId={leagueId}
          />
        </li>
      ))}
    </ul>
  )
}

function MatchdayRow({
  matchday,
  best,
  scheduled,
  leagueId,
}: {
  matchday: ManagerMatchday
  /** The manager's own best matchday, which scales every bar. */
  best: ManagerMatchday
  /** The same matchday on the competition's schedule — its date and its clock. */
  scheduled: SeasonMatchday | undefined
  leagueId: string
}) {
  const isLive = scheduled !== undefined && matchdayState(scheduled) === 'live'
  const share =
    best.points <= 0 || matchday.points <= 0
      ? 0
      : Math.max(0.02, matchday.points / best.points)

  return (
    <Link
      to={`/leagues/${leagueId}/matchday?day=${String(matchday.day)}`}
      className={cn(
        'flex flex-col overflow-hidden rounded-card border bg-surface',
        'transition-colors hover:bg-surface-2/60',
        isLive ? 'border-accent/50' : 'border-line',
      )}
    >
      <span className="flex items-center gap-2.5 px-3 py-2.5">
        <span className="nums w-7 shrink-0 text-[0.6875rem] text-faint">
          {matchday.day}.
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-ink">
            {matchday.day}. Spieltag
          </span>
          <span className="nums block truncate text-[0.625rem]">
            {isLive ? (
              <span className="inline-flex items-center gap-1 font-semibold text-accent">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
                />
                Läuft
              </span>
            ) : (
              <span className="text-faint">
                {scheduled === undefined
                  ? ''
                  : dateRange(scheduled.start, scheduled.end)}
              </span>
            )}
          </span>
        </span>

        <span className="flex w-[4.5rem] shrink-0 items-center justify-end gap-1">
          {matchday.isMatchdayWin && (
            <Trophy
              size={12}
              aria-label="Spieltagssieg"
              className="shrink-0 text-gold"
            />
          )}
          <span
            className={cn(
              'nums text-right text-sm font-semibold',
              matchday.points < 0 ? 'text-negative' : 'text-ink',
            )}
          >
            {points(matchday.points)}
          </span>
        </span>
      </span>

      {/* Flush against the bottom edge, so a column of these reads as a bar
          chart on its side — the club page's treatment, and the duel rows'
          below. Scaled to this manager's best matchday. */}
      <span aria-hidden="true" className="block h-1 w-full bg-surface-2">
        <span
          style={{ width: `${String(share * 100)}%` }}
          className={cn(
            'block h-full rounded-r-full transition-[width]',
            matchday.day === best.day ? 'bg-accent' : 'bg-accent/45',
          )}
        />
      </span>
    </Link>
  )
}

/* -------------------------------------------------------------------------- */
/* The season of duels                                                        */
/* -------------------------------------------------------------------------- */

/**
 * This manager's share of the two scores — what the bar along the row's bottom
 * edge measures.
 *
 * `0` for a duel nobody has scored in yet (before kick-off both sides are at
 * nought, and a half-filled bar would read as a tie that has been played out),
 * and `0` for a manager in the negative, where a bar growing leftwards would
 * need an axis one row cannot earn. A lead over an opponent on nothing is the
 * full width, which is exactly what it was.
 *
 * Clamped to a sliver at the bottom so a manager who scored *something* is
 * never drawn as having scored nothing.
 */
function ownShare(duel: ManagerSeasonDuel): number {
  if (duel.points <= 0) return 0
  const total = duel.points + Math.max(duel.opponentPoints, 0)
  if (total <= 0) return 0
  return Math.max(0.02, duel.points / total)
}

function DuelRow({
  duel,
  managerId,
  leagueId,
}: {
  duel: ManagerSeasonDuel
  managerId: string
  leagueId: string
}) {
  const outcome =
    duel.result === undefined ? undefined : DUEL_RESULT[duel.result]

  const row = (
    <>
      <span className="flex items-center gap-2.5 px-3 py-2">
        <span className="nums w-7 shrink-0 text-[0.6875rem] text-faint">
          {duel.day}.
        </span>

        {duel.opponent === undefined ? (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-faint">
            <Swords size={14} aria-hidden="true" />
          </span>
        ) : (
          <ManagerAvatar manager={duel.opponent} size={28} />
        )}

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-ink">
            {duel.opponent?.name ?? 'Spielfrei'}
          </span>
          <span className="nums flex min-w-0 items-center gap-1 text-[0.625rem]">
            {duel.isLive ? (
              <span className="flex items-center gap-1 font-semibold text-accent">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
                />
                Läuft
              </span>
            ) : outcome !== undefined ? (
              <span className={cn('font-medium', outcome.className)}>
                {outcome.text}
              </span>
            ) : (
              <span className="text-faint">
                {duel.opponent === undefined ? 'kein Gegner' : 'offen'}
              </span>
            )}
            {duel.duelPoints !== undefined && duel.opponent !== undefined && (
              <>
                <span aria-hidden="true" className="text-faint">
                  ·
                </span>
                <span className="truncate text-faint">
                  {points(duel.duelPoints)} Duellpkt
                </span>
              </>
            )}
          </span>
        </span>

        {/* The scoreline from this manager's side, then the mark that says how
            it ended. Fixed widths so both line up down the whole season. */}
        <span
          className={cn(
            'nums w-[4.5rem] shrink-0 text-right text-sm font-semibold',
            duel.isLive
              ? 'text-accent'
              : duel.result === 'won'
                ? 'text-positive'
                : duel.result === 'lost'
                  ? 'text-negative'
                  : 'text-ink',
          )}
        >
          {duel.opponent === undefined
            ? points(duel.points)
            : `${points(duel.points)}:${points(duel.opponentPoints)}`}
        </span>

        <span className="flex w-4 shrink-0 justify-center">
          {outcome !== undefined && (
            <outcome.Icon
              size={14}
              aria-label={outcome.text}
              className={outcome.className}
            />
          )}
        </span>
      </span>

      {/* How close it was, flush against the bottom edge — see the component
          note. Only where there was a duel to be close. */}
      {duel.opponent !== undefined && (
        <span aria-hidden="true" className="block h-1 w-full bg-surface-2">
          <span
            style={{ width: `${String(ownShare(duel) * 100)}%` }}
            className={cn(
              'block h-full rounded-r-full transition-[width]',
              duel.isLive
                ? 'bg-accent'
                : duel.result === 'won'
                  ? 'bg-positive'
                  : duel.result === 'lost'
                    ? 'bg-negative'
                    : 'bg-muted',
            )}
          />
        </span>
      )}
    </>
  )

  const className = cn(
    'flex flex-col overflow-hidden rounded-card border bg-surface',
    duel.isLive ? 'border-accent/50' : 'border-line',
  )

  // A bye has no duel page to open, so it is not a link — the row is the whole
  // answer. Dashed, so the one matchday without an opponent looks unlike the
  // ones that had one before the word is read.
  if (duel.opponent === undefined) {
    return <div className={cn(className, 'border-dashed')}>{row}</div>
  }

  return (
    <Link
      to={`/leagues/${leagueId}/duels/${duelIdOf(managerId, duel.opponent.id)}?day=${String(duel.day)}`}
      className={cn(className, 'transition-colors hover:bg-surface-2/60')}
    >
      {row}
    </Link>
  )
}
