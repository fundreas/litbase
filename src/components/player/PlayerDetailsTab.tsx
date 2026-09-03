import { House, Info, PlaneTakeoff, Shirt, Timer } from 'lucide-react'
import type { ReactNode } from 'react'

import type { TeamSummary } from '@/api/hooks/useCompetition'
import {
  type PlayerDetail,
  type PlayerFixture,
  type PlayerMatch,
  type PlayerOwnership,
} from '@/api/models'
import { PlayerMatchRow } from '@/components/player/PlayerMatchRow'
import {
  MarketValueCard,
  PointsCard,
} from '@/components/player/PlayerStatCards'
import { EventGlyph } from '@/components/player/statGlyphs'
import { Avatar } from '@/components/ui/Avatar'
import { Card, CardHeader } from '@/components/ui/Card'
import { SkeletonList } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'
import {
  kickoff as formatKickoff,
  money,
  moneyDelta,
  points as formatPoints,
  weekdayDate,
} from '@/lib/format'

/**
 * The player at a glance: what they cost, what they score, what they have
 * done, who owns them, and when they play next.
 *
 * Ordered by how often the answer is the reason someone opened the page —
 * market value first, then form, then the season's raw counting stats.
 */
export function PlayerDetailsTab({
  player,
  ownership,
  teams,
  matchesByDay,
  appearances,
  isLoadingMatches,
}: {
  player: PlayerDetail
  /** Absent while loading, and for a player nobody owns. */
  ownership: PlayerOwnership | undefined
  /** Team id → name, for spelling out the fixtures. */
  teams: Map<string, TeamSummary> | undefined
  /** This season's matches by matchday, once the performance history lands. */
  matchesByDay: Map<number, PlayerMatch> | undefined
  /** Appearances this season — from the same request. */
  appearances: number | undefined
  isLoadingMatches: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      {player.statusText !== undefined && (
        <StatusNotice text={player.statusText} />
      )}

      <div className="grid grid-cols-2 gap-2">
        <MarketValueCard
          marketValue={player.marketValue}
          changeDay={player.marketValueChangeDay}
        />
        <PointsCard
          totalPoints={player.totalPoints}
          averagePoints={player.averagePoints}
        />
      </div>

      {ownership !== undefined && <OwnerCard ownership={ownership} />}

      <Card>
        <CardHeader
          title="Saisonstatistik"
          action={
            appearances === undefined ? undefined : (
              <span className="nums flex items-center gap-1 text-xs text-muted">
                <Shirt size={12} aria-hidden="true" className="text-faint" />
                {appearances} Einsätze
              </span>
            )
          }
        />
        {/* Every cell carries the same mark the match rows use for the same
            thing, so a season total and the games that make it up are
            visibly the same statistic. */}
        <dl className="grid grid-cols-3 divide-x divide-y divide-line [&>*]:border-line">
          <Stat
            label="Minuten"
            value={formatPoints(player.minutesPlayed)}
            icon={<Timer size={13} aria-hidden="true" />}
          />
          <Stat
            label="Tore"
            value={formatPoints(player.goals)}
            icon={<EventGlyph kind="goal" size={13} />}
          />
          <Stat
            label="Vorlagen"
            value={formatPoints(player.assists)}
            icon={<EventGlyph kind="assist" size={13} />}
          />
          <Stat
            label="Gelb"
            value={formatPoints(player.yellowCards)}
            icon={<EventGlyph kind="yellowCard" size={13} />}
          />
          <Stat
            label="Rot"
            value={formatPoints(player.redCards)}
            icon={<EventGlyph kind="redCard" size={13} />}
          />
          <Stat
            label="Zu null"
            value={formatPoints(player.cleanSheets)}
            icon={<EventGlyph kind="cleanSheet" size={13} />}
          />
        </dl>
      </Card>

      {/* The same rows as the Leistung tab, cut to the fixtures the profile
          calls "around now" — the one just played and the next two. They are
          matched to the season's performance by matchday, which is what puts
          points and minutes on the played ones; until that request lands the
          card is a skeleton rather than a list that grows numbers a second
          later. */}
      {player.fixtures.length > 0 && (
        <Card>
          <CardHeader title="Spiele" />
          {isLoadingMatches ? (
            <div className="p-3">
              <SkeletonList rows={3} />
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5 p-2">
              {player.fixtures.map((fixture) => {
                const match = matchesByDay?.get(fixture.day)
                return (
                  <li key={fixture.day}>
                    {match === undefined ? (
                      <FixtureRow fixture={fixture} teams={teams} />
                    ) : (
                      <PlayerMatchRow match={match} teams={teams} />
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      )}

      {player.probabilitySource !== undefined && (
        <p className="px-1 text-[0.6875rem] text-faint">
          Startelf-Einschätzung von {player.probabilitySource}
          {player.probabilityUpdatedAt !== undefined &&
            ` · Stand ${weekdayDate(player.probabilityUpdatedAt)}`}
        </p>
      )}
    </div>
  )
}

/**
 * The reason a player is unavailable, in the API's own words.
 *
 * Kickbase localises `stxt` from the `Accept-Language` header the client
 * sends, so this is German prose written by Kickbase rather than a code the
 * app has to translate — which is why it is rendered verbatim.
 */
function StatusNotice({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 rounded-card border border-negative/30 bg-negative/10 px-3 py-2.5 text-xs text-ink">
      <Info size={14} className="mt-px shrink-0 text-negative" />
      <span>{text}</span>
    </p>
  )
}

/**
 * One counting stat: its mark, its name, its number.
 *
 * The mark sits on the label line rather than beside the figure, so the six
 * cells scan as a grid of numbers with the icons acting as the index down the
 * left of each — putting a glyph next to each value made the numbers
 * themselves hard to compare across the row.
 */
function Stat({
  label,
  value,
  icon,
}: {
  label: string
  value: ReactNode
  icon: ReactNode
}) {
  return (
    <div className="-mt-px -ml-px px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-[0.6875rem] tracking-wide text-faint uppercase">
        <span className="flex w-3.5 shrink-0 justify-center">{icon}</span>
        <span className="truncate">{label}</span>
      </dt>
      <dd className="nums mt-0.5 text-base font-semibold text-ink">{value}</dd>
    </div>
  )
}

/**
 * The owning manager, what they paid, and where that stands today.
 *
 * **One line, no breakdown.** The manager on the left, the purchase price as
 * the figure on the right, and the running profit or loss under it. The
 * arithmetic behind that — what the player was worth on the day, and so
 * whether the manager over- or underpaid — belongs on the
 * [Markt tab](./PlayerMarketTab.tsx), which is the tab about money and has the
 * room to lay all three side by side. Repeating it here turned a summary into
 * a second copy of that panel.
 *
 * A player dealt out when the manager joined has no price: Kickbase books the
 * basis at that day's market value and no money changed hands, so the figure
 * reads "Startkader" rather than quoting a fictional bargain.
 */
function OwnerCard({ ownership }: { ownership: PlayerOwnership }) {
  return (
    <Card>
      <CardHeader title="Manager" />
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar
          src={ownership.managerImage}
          name={ownership.managerName}
          size={36}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">
            {ownership.managerName ?? 'Unbekannt'}
            {ownership.isViewer && (
              <span className="ml-1.5 text-xs font-medium text-accent">du</span>
            )}
          </p>
          <p className="truncate text-xs text-muted">
            {ownership.since === undefined
              ? 'Im Kader'
              : `Seit ${weekdayDate(ownership.since)}`}
          </p>
        </div>

        <span className="shrink-0 text-right">
          <span className="nums block text-sm font-semibold text-ink">
            {ownership.wasGranted
              ? 'Startkader'
              : money(ownership.purchasePrice)}
          </span>
          <span
            className={cn(
              'nums block text-xs',
              ownership.profitLoss > 0 && 'text-positive',
              ownership.profitLoss < 0 && 'text-negative',
              ownership.profitLoss === 0 && 'text-faint',
            )}
          >
            {moneyDelta(ownership.profitLoss)}
          </span>
        </span>
      </div>
    </Card>
  )
}

/**
 * A fixture the season's performance list has no entry for.
 *
 * The fallback, not the normal row. It happens when the profile's `mdsum`
 * names a matchday the performance response does not — a competition the two
 * endpoints disagree about, or a player between clubs. Shaped like
 * [`PlayerMatchRow`](./PlayerMatchRow.tsx) so it does not read as a different
 * kind of row, but with no points, minutes or events to show.
 */
function FixtureRow({
  fixture,
  teams,
}: {
  fixture: PlayerFixture
  teams: Map<string, TeamSummary> | undefined
}) {
  const opponent = teams?.get(fixture.opponentId)
  const Venue = fixture.isHome ? House : PlaneTakeoff

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-card border border-line bg-surface px-3 py-2',
        !fixture.isFinished && 'opacity-60',
      )}
    >
      <span className="nums w-6 shrink-0 text-xs text-faint">
        {fixture.day}.
      </span>
      <span className="flex w-5 shrink-0 justify-center">
        <Venue
          size={13}
          aria-label={fixture.isHome ? 'Heimspiel' : 'Auswärtsspiel'}
          className={fixture.isHome ? 'text-positive' : 'text-accent'}
        />
      </span>
      <Avatar
        src={fixture.opponentImage}
        name={opponent?.name ?? fixture.opponentId}
        size={22}
        square
        className="shrink-0 bg-transparent"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="min-w-0 truncate text-sm font-medium text-ink">
            {opponent?.name ?? '–'}
          </span>
          {fixture.isFinished && (
            <span className="nums shrink-0 text-xs text-muted">
              {fixture.goalsFor}:{fixture.goalsAgainst}
            </span>
          )}
        </div>
        <span className="mt-0.5 block text-[0.6875rem] text-faint">
          {fixture.isFinished
            ? weekdayDate(fixture.kickoff)
            : formatKickoff(fixture.kickoff)}
        </span>
      </div>
      <span className="nums shrink-0 text-sm font-bold text-faint">–</span>
    </div>
  )
}
