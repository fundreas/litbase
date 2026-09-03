import { House, Info, PlaneTakeoff } from 'lucide-react'
import type { ReactNode } from 'react'

import type { TeamSummary } from '@/api/hooks/useCompetition'
import {
  purchasePremium,
  type PlayerDetail,
  type PlayerFixture,
  type PlayerOwnership,
} from '@/api/models'
import {
  MarketValueCard,
  PointsCard,
} from '@/components/player/PlayerStatCards'
import { Avatar } from '@/components/ui/Avatar'
import { Card, CardHeader } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import {
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
}: {
  player: PlayerDetail
  /** Absent while loading, and for a player nobody owns. */
  ownership: PlayerOwnership | undefined
  /** Team id → name, for spelling out the fixtures. */
  teams: Map<string, TeamSummary> | undefined
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

      {ownership !== undefined && (
        <OwnerCard ownership={ownership} marketValue={player.marketValue} />
      )}

      <Card>
        <CardHeader title="Saisonstatistik" />
        <dl className="grid grid-cols-3 divide-x divide-y divide-line [&>*]:border-line">
          <Stat label="Minuten" value={formatPoints(player.minutesPlayed)} />
          <Stat label="Tore" value={formatPoints(player.goals)} />
          <Stat label="Vorlagen" value={formatPoints(player.assists)} />
          <Stat label="Gelb" value={formatPoints(player.yellowCards)} />
          <Stat label="Rot" value={formatPoints(player.redCards)} />
          <Stat label="Zu null" value={formatPoints(player.cleanSheets)} />
        </dl>
      </Card>

      {player.fixtures.length > 0 && (
        <Card>
          <CardHeader title="Spiele" />
          <ul className="divide-y divide-line">
            {player.fixtures.map((fixture) => (
              <li key={fixture.day}>
                <FixtureRow fixture={fixture} teams={teams} />
              </li>
            ))}
          </ul>
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

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="-mt-px -ml-px px-3 py-2.5">
      <dt className="truncate text-[0.6875rem] tracking-wide text-faint uppercase">
        {label}
      </dt>
      <dd className="nums mt-0.5 text-base font-semibold text-ink">{value}</dd>
    </div>
  )
}

/**
 * The owning manager, and what the player has been worth to them.
 *
 * The over/underpay line only appears when both halves are real: a purchase
 * price somebody actually paid, and a market value from the same day. A player
 * dealt out when the manager joined has neither — Kickbase books a basis equal
 * to that day's market value and no money changed hands — so the card says
 * "Startkader" instead of quoting a fictional bargain.
 */
function OwnerCard({
  ownership,
  marketValue,
}: {
  ownership: PlayerOwnership
  marketValue: number
}) {
  const premium = purchasePremium(ownership)

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
        <span
          className={cn(
            'nums shrink-0 text-right text-sm font-semibold',
            ownership.profitLoss > 0 && 'text-positive',
            ownership.profitLoss < 0 && 'text-negative',
            ownership.profitLoss === 0 && 'text-faint',
          )}
        >
          {moneyDelta(ownership.profitLoss)}
          <span className="block text-[0.6875rem] font-normal text-faint">
            Gewinn/Verlust
          </span>
        </span>
      </div>

      <dl className="grid grid-cols-2 border-t border-line">
        <div className="border-r border-line px-4 py-2.5">
          <dt className="text-[0.6875rem] tracking-wide text-faint uppercase">
            Kaufpreis
          </dt>
          <dd className="nums mt-0.5 text-sm font-semibold text-ink">
            {ownership.wasGranted
              ? 'Startkader'
              : money(ownership.purchasePrice)}
          </dd>
        </div>
        <div className="px-4 py-2.5">
          <dt className="text-[0.6875rem] tracking-wide text-faint uppercase">
            {ownership.wasGranted ? 'Aktueller Wert' : 'Marktwert beim Kauf'}
          </dt>
          <dd className="nums mt-0.5 text-sm font-semibold text-ink">
            {ownership.wasGranted
              ? money(marketValue)
              : ownership.marketValueAtPurchase === undefined
                ? '–'
                : money(ownership.marketValueAtPurchase)}
          </dd>
        </div>
      </dl>

      {premium !== undefined && premium !== 0 && (
        <p className="border-t border-line px-4 py-2.5 text-xs text-muted">
          {premium > 0
            ? 'Über Marktwert gekauft: '
            : 'Unter Marktwert gekauft: '}
          <strong
            className={cn(
              'nums font-semibold',
              premium > 0 ? 'text-negative' : 'text-positive',
            )}
          >
            {moneyDelta(premium)}
          </strong>
        </p>
      )}

      {!ownership.wasGranted &&
        ownership.marketValueAtPurchase === undefined && (
          <p className="border-t border-line px-4 py-2.5 text-xs text-faint">
            Der Kauf liegt vor dem Zeitraum, für den Kickbase Marktwerte liefert
            — Über- oder Unterzahlung lässt sich nicht berechnen.
          </p>
        )}
    </Card>
  )
}

/** One of the club's fixtures: who, when, and the result if there is one. */
function FixtureRow({
  fixture,
  teams,
}: {
  fixture: PlayerFixture
  teams: Map<string, TeamSummary> | undefined
}) {
  const opponent = teams?.get(fixture.opponentId)
  const Icon = fixture.isHome ? House : PlaneTakeoff

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="nums w-8 shrink-0 text-xs text-faint">
        {fixture.day}.
      </span>
      <Icon
        size={14}
        aria-label={fixture.isHome ? 'Heimspiel' : 'Auswärtsspiel'}
        className={cn(
          'shrink-0',
          fixture.isHome ? 'text-positive' : 'text-accent',
        )}
      />
      <Avatar
        src={fixture.opponentImage}
        name={opponent?.name ?? fixture.opponentId}
        size={20}
        square
        className="shrink-0 bg-transparent"
      />
      <span className="min-w-0 flex-1 truncate text-sm text-ink">
        {opponent?.name ?? '–'}
      </span>
      {fixture.isFinished ? (
        <span className="nums shrink-0 text-sm font-semibold text-ink">
          {fixture.goalsFor}:{fixture.goalsAgainst}
        </span>
      ) : (
        <span className="shrink-0 text-xs text-faint">
          {weekdayDate(fixture.kickoff)}
        </span>
      )}
    </div>
  )
}
