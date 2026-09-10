import { Shirt, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { Link } from 'react-router'

import {
  POSITION_LABEL,
  POSITION_NAME,
  type ManagerSquadMember,
  type PositionKey,
  type StartProbability,
} from '@/api/models'
import { useCurrentMatchday } from '@/api/hooks/useMatchday'
import { useStartProbabilities } from '@/api/hooks/useStartProbabilities'
import { ExpectedPointsTarget } from '@/components/squad/ExpectedPointsBadge'
import { useExpectedPointsSheet } from '@/components/squad/ExpectedPointsSheet'
import { PlayerStatusBadge } from '@/components/squad/PlayerStatusBadge'
import { StartProbabilityBadge } from '@/components/squad/StartProbabilityBadge'
import { useExpectedPointsView } from '@/components/squad/useExpectedPointsView'
import { Avatar } from '@/components/ui/Avatar'
import { StatTile } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import {
  expectedPointsTotal,
  type ExpectedPointsEntry,
} from '@/lib/expectedPoints'
import { money, moneyDelta, points } from '@/lib/format'

const POSITION_ORDER: PositionKey[] = ['gk', 'def', 'mid', 'fwd']

/**
 * **Every player this manager owns**, grouped by position, most valuable first.
 *
 * The squad **as it stands now**, not as it stood on the matchday the
 * [Aufstellung](./ManagerLineupTab.tsx) is showing — `/managers/{uid}/squad`
 * takes no `dayNumber` and silently ignores one, so today is all it can answer.
 * That is the honest division between the two tabs and worth stating on the
 * page: the lineup is a matchday, the Kader is a squad, and a player bought
 * yesterday is in the second and not the first.
 *
 * Three tiles above it, because they are what a rival's squad is actually read
 * for: how many players, what the lot is worth, and how many are fielded. The
 * team value is **summed from these rows** rather than taken from the
 * standings' `tv` — the two agree, and the sum is the one that cannot go stale
 * against the list under it.
 *
 * **Rows are the same design as one's own squad**: the 24-hour change under
 * the market value and the lineup probability under the name, both of which
 * this tab went without until 2026-09-08 — the change on the mistaken
 * grounds that the payload lacked it, the probability because nobody fetched
 * it. What stays off is what Kickbase only tells you about your own players:
 * the offer count, and the shirt as a *control*. The rail stays as a marker —
 * whether a player is in the eleven is the first thing you want from someone
 * else's squad — and every row opens the player's own page.
 *
 * **The probability costs a detail request per player**, the same gap-filling
 * fan-out the squad page runs for its own rows: `prob` is not on this payload.
 * Fifteen requests, once per half hour, against the `playerDetail` entries
 * the player pages and the market read too — so opening a player from here
 * finds his page already cached.
 *
 * **Expected points can be entered here too.** They are the reader's own
 * guesses about the coming matchday, kept per player and per matchday on this
 * device — see [`expectedPoints`](../../lib/expectedPoints.ts) — and a rival's
 * squad is one of the places you most want to make them: what a duel comes
 * down to is your eleven against his. The
 * [target at the end of the row](../squad/ExpectedPointsBadge.tsx) is the way
 * in, because these rows carry no fixture crest to hang the sheet on.
 */
export function ManagerSquadTab({
  squad,
  leagueId,
  competitionId,
}: {
  squad: ManagerSquadMember[]
  leagueId: string
  /** For the coming matchday's fixtures, which the sheet names. */
  competitionId: string
}) {
  const startProbabilities = useStartProbabilities(leagueId, squad)
  /*
   * The same cache entry the page's own season schedule reads — one payload
   * for the season, cached for an hour — so the matchday number and the
   * fixtures behind the sheet cost this tab no request of its own.
   */
  const matchday = useCurrentMatchday(competitionId)
  const day = matchday.data?.day
  const expectedPoints = useExpectedPointsView(day)
  const expected = useExpectedPointsSheet({
    matchday: day,
    resolve: (playerId) => {
      const player = squad.find((member) => member.id === playerId)
      if (player === undefined) return undefined
      return {
        id: player.id,
        name: player.lastName,
        averagePoints: player.averagePoints,
        totalPoints: player.totalPoints,
        fixture: matchday.data?.fixtureByTeamId.get(player.teamId),
      }
    },
  })

  if (squad.length === 0) {
    return (
      <EmptyState
        icon={<Users size={22} />}
        title="Kein Kader"
        description="Für diesen Manager liefert Kickbase keine Spieler — vermutlich hat er die Liga verlassen."
      />
    )
  }

  const totalValue = squad.reduce((sum, player) => sum + player.marketValue, 0)
  const fieldedPlayers = squad.filter((player) => player.isFielded)
  const fielded = fieldedPlayers.length
  /**
   * **What his eleven is expected to bring in** — the model's reckoning where
   * the reader has not made his own.
   *
   * The point of putting a figure on a rival's players is comparing the two
   * totals, so his is summed exactly as [one's own](../squad/LineupTab.tsx) is:
   * over the fielded players only, with the count of how many of them actually
   * carry a figure, because 640 off four and 640 off eleven are different
   * claims — and with how many of those the reader stands behind himself,
   * which is the difference between a comparison and a model's opinion of one.
   */
  const guessed = expectedPointsTotal(fieldedPlayers, expectedPoints)

  const byPosition = POSITION_ORDER.map((position) => ({
    position,
    players: squad
      .filter((player) => player.position === position)
      .sort((a, b) => b.marketValue - a.marketValue),
  })).filter((group) => group.players.length > 0)

  return (
    <div className="flex flex-col gap-4">
      {/* Two columns once the fourth tile exists, rather than a ragged row of
          three and one. It comes and goes with the figures, like the chip over
          one's own pitch — a nought there would read as a prediction of
          nothing. In a Bundesliga league it is simply always there, because
          every fielded player has a prediction. */}
      <div
        className={cn(
          'grid gap-2',
          guessed.count === 0 ? 'grid-cols-3' : 'grid-cols-2',
        )}
      >
        <StatTile label="Spieler" value={points(squad.length)} />
        <StatTile label="Teamwert" value={money(totalValue)} />
        <StatTile
          label="Aufgestellt"
          value={points(fielded)}
          hint={fielded === 11 ? 'komplett' : 'von 11'}
        />
        {guessed.count > 0 && (
          <StatTile
            label="Erwartet"
            value={points(guessed.total)}
            hint={
              guessed.ownCount === 0
                ? `Prognose · ${points(guessed.count)} von ${points(fielded)}`
                : `${points(guessed.count)} von ${points(fielded)} · ${points(guessed.ownCount)} geschätzt`
            }
          />
        )}
      </div>

      {byPosition.map((group) => (
        <section key={group.position} className="flex flex-col gap-1.5">
          <h3
            className="px-0.5 text-[0.6875rem] font-semibold tracking-wider text-faint uppercase"
            title={POSITION_NAME[group.position]}
          >
            {POSITION_LABEL[group.position]}
            <span className="nums ml-1.5 font-normal">
              {group.players.length}
            </span>
          </h3>

          <ul className="flex flex-col gap-1.5">
            {group.players.map((player) => (
              <PlayerRow
                key={player.id}
                player={player}
                startProbability={startProbabilities.get(player.id)}
                to={`/leagues/${leagueId}/players/${player.id}`}
                expectedPoints={expectedPoints.entry(player.id)}
                onEditExpected={expected.open}
              />
            ))}
          </ul>
        </section>
      ))}

      {expected.sheet}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * One player: whether he is fielded, who he is, how likely he is to start,
 * what he has scored and what he is worth — and what that moved overnight.
 *
 * The points line is the one thing this row says that the squad page's own does
 * not. There it would be noise — you know your own players — while about
 * somebody else's squad "what has this cost him all season" is half the reason
 * to look, and `p`/`ap` ride along on the payload either way.
 *
 * The probability and the 24-hour change are drawn exactly as the
 * [squad page](../squad/PlayerListTab.tsx) draws them, so a player reads the
 * same in his owner's squad as in yours.
 */
function PlayerRow({
  player,
  startProbability,
  to,
  expectedPoints,
  onEditExpected,
}: {
  player: ManagerSquadMember
  startProbability: StartProbability | undefined
  to: string
  /**
   * What he is expected to score on the coming matchday — the reader's guess,
   * or the model's prediction standing in for one.
   */
  expectedPoints: ExpectedPointsEntry | undefined
  onEditExpected: (playerId: string) => void
}) {
  const changeDay = player.marketValueChangeDay
  const ChangeIcon =
    changeDay !== undefined && changeDay < 0 ? TrendingDown : TrendingUp

  return (
    /* The shell moved onto the `li` and the link became the row's *body*, so
       the target at the end can be a button: a link wrapping the whole row
       would make a tap on it navigate, and HTML has no nested interactive
       elements. Same split, same reasoning as one's own
       [squad row](../squad/PlayerListTab.tsx). */
    <li
      className={cn(
        'flex items-stretch overflow-hidden rounded-card border border-line bg-surface',
        // The accent edge was on the link's own `hover:` until the link
        // stopped being the whole row. `has-[a:hover]` puts it back on the
        // border that is now the list item's, and only for the link — the
        // target at the end lights its own ground instead.
        'has-[a:hover]:border-accent/40',
      )}
    >
      <Link
        to={to}
        className={cn(
          'flex min-w-0 flex-1 items-stretch',
          'transition-colors hover:bg-surface-2',
        )}
      >
        {/* A marker, not a control: this is not the reader's team to change.
            Same rail, same colours as the squad page's, so "in the eleven"
            looks the same wherever it is read. */}
        <span
          className={cn(
            'flex w-7 shrink-0 items-center justify-center self-stretch border-r',
            player.isFielded
              ? 'border-accent/30 bg-accent/15 text-accent'
              : 'border-line bg-surface-2/40 text-faint',
          )}
        >
          <span className="sr-only">
            {player.isFielded ? 'Aufgestellt' : 'Nicht aufgestellt'}
          </span>
          <Shirt
            size={15}
            strokeWidth={player.isFielded ? 2 : 1.5}
            className={cn(!player.isFielded && 'opacity-40')}
          />
        </span>

        {/* Flush portrait, the squad row's arrangement: the Kickbase cutouts
            are transparent PNGs, so a wash grounds the figure and the inner
            edge is masked to dissolve into the row rather than end on a
            line. */}
        <Avatar
          src={player.image}
          name={player.lastName}
          fill
          className={cn(
            'w-14 self-stretch bg-transparent',
            'bg-linear-to-t from-surface-2/60 to-transparent to-70%',
            '[mask-image:linear-gradient(to_right,#000_65%,transparent)]',
          )}
        />

        <span className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-ink">
                {player.lastName}
              </span>
              <PlayerStatusBadge status={player.status} size={13} />
            </span>
            {/* Probability first, then the points: an estimate about the
                next matchday above a fact about the season so far. Both are
                one line each, and the badge is absent — not blank — for a
                player nobody has assessed. */}
            <span className="mt-0.5 flex items-center gap-1.5">
              {startProbability !== undefined && (
                <StartProbabilityBadge tier={startProbability} size={13} />
              )}
              <span className="nums truncate text-xs text-muted">
                {points(player.totalPoints)} Pkt
                {player.averagePoints !== undefined && (
                  <> · ⌀ {points(player.averagePoints)}</>
                )}
              </span>
            </span>
          </span>

          <span className="shrink-0 text-right">
            <span className="nums block text-sm font-semibold text-ink">
              {money(player.marketValue)}
            </span>
            {/* The last 24 hours in euros, arrow and amount — `tfhmvt`, which
                is on this payload after all. A flat day is a grey `±0`, as on
                the squad page: it is a fact about a night, unlike a profit of
                zero, which would be a claim about a trade. */}
            <span
              className={cn(
                'nums flex items-center justify-end gap-0.5 text-xs',
                changeDay !== undefined && changeDay > 0 && 'text-positive',
                changeDay !== undefined && changeDay < 0 && 'text-negative',
                (changeDay === undefined || changeDay === 0) && 'text-faint',
              )}
              title="Marktwertänderung in den letzten 24 Stunden"
            >
              {changeDay !== undefined && changeDay !== 0 && (
                <ChangeIcon size={11} aria-hidden="true" className="shrink-0" />
              )}
              {moneyDelta(changeDay)}
              <span className="sr-only"> in den letzten 24 Stunden</span>
            </span>
          </span>
        </span>
      </Link>

      <ExpectedPointsTarget
        value={expectedPoints?.value}
        isForecast={expectedPoints?.isOwn === false}
        playerName={player.lastName}
        onClick={() => {
          onEditExpected(player.id)
        }}
      />
    </li>
  )
}
