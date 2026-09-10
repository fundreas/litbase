import { TrendingDown, TrendingUp } from 'lucide-react'
import { Link } from 'react-router'

import {
  POSITION_LABEL,
  POSITION_NAME,
  type PositionKey,
  type TeamProfile,
  type TeamSquadPlayer,
} from '@/api/models'
import { useCurrentMatchday } from '@/api/hooks/useMatchday'
import { OwnerBadge } from '@/components/matchday/OwnerBadge'
import { ExpectedPointsTarget } from '@/components/squad/ExpectedPointsBadge'
import { useExpectedPointsSheet } from '@/components/squad/ExpectedPointsSheet'
import { PlayerStatusBadge } from '@/components/squad/PlayerStatusBadge'
import { StartProbabilityBadge } from '@/components/squad/StartProbabilityBadge'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { useExpectedPoints } from '@/lib/expectedPoints'
import { money, moneyDelta } from '@/lib/format'

/**
 * Sort weight per position — the order a team sheet is always written in.
 *
 * The list is flat rather than sectioned, so this is an index rather than a
 * set of headings: every row carries its own position, which is what a heading
 * would otherwise have said once for the group.
 */
const POSITION_ORDER: Record<PositionKey, number> = {
  gk: 0,
  def: 1,
  mid: 2,
  fwd: 3,
}

/**
 * The club's whole roster, with **what each player costs, how likely he is to
 * start, and who in your league already has him.**
 *
 * This is the tab the page is worth building for. A Bundesliga squad list is
 * available anywhere; a squad list annotated with your league's ownership is
 * the join that only a Kickbase client can make, and it turns a club page into
 * the answer to "is there anything here worth buying".
 *
 * **Every player, always, in one list.** No filters and no sections: a club has
 * twenty-five to thirty players, which is a single screenful of scrolling, and
 * a filter over a list that short mostly hides the comparison the reader came
 * to make. Sorted by position, then by name — so the shape of the squad is the
 * order of the list, and a player is found where his name puts him rather than
 * where this week's form does.
 *
 * **The whole thing is one request.** `teamprofile` carries every player with
 * his value, his weekly change, his probability, his availability and his
 * owner — see [`useTeamProfile`](../../api/hooks/useTeam.ts), which also
 * records what this replaced and why the list it used to build on was empty for
 * seventeen clubs out of eighteen.
 *
 * The market-value column is the **seven-day** change, because that is what the
 * payload serves. The 24-hour figure (`tfhmvt`) exists only per player, and one
 * column is not worth twenty-six requests — so the label says *7 Tage* rather
 * than quietly showing a week's movement under a day's heading.
 *
 * **Expected points can be entered from here**, on the target at the end of
 * each row — the reader's own guess at what the player will score on the
 * coming matchday, kept per matchday on this device (see
 * [`expectedPoints`](../../lib/expectedPoints.ts)). A club's roster is where
 * the guesses are cheapest to make: every player on it faces the same
 * opponent, so one judgement about the fixture prices thirty rows.
 *
 * That is also why there is **no crest on the rows** to open the sheet from,
 * the way one's own [squad list](../squad/PlayerListTab.tsx) does: thirty
 * copies of one crest would say nothing. The fixture is in the
 * [header's strip](./TeamHeader.tsx), and the sheet names it again.
 *
 * **Nothing sits above the list but one line of type.** The club's value and
 * its squad size used to be two `StatTile`s, and the projected eleven a third
 * card below them — three panels a reader scrolled past to reach the thing they
 * came for. The value and the count are one caption now, and the projected
 * eleven moved to the [header's fixture strip](./TeamHeader.tsx), where a
 * question about the next match already has somewhere to be asked.
 */
export function TeamSquadTab({
  profile,
  leagueId,
  competitionId,
}: {
  profile: TeamProfile
  leagueId: string
  /** For the coming matchday — one fixture, shared by every row. */
  competitionId: string
}) {
  /*
   * The same cache entry the page already reads for its fixture strip — one
   * payload for the season, cached for an hour — so this costs no request.
   * One lookup, not one per player: a club has a single fixture a matchday,
   * which is the whole reason these rows carry no crest.
   */
  const matchday = useCurrentMatchday(competitionId)
  const day = matchday.data?.day
  const fixture = matchday.data?.fixtureByTeamId.get(profile.teamId)
  const expectedPoints = useExpectedPoints(day)
  const expected = useExpectedPointsSheet({
    matchday: day,
    resolve: (playerId) => {
      const player = profile.players.find((entry) => entry.id === playerId)
      if (player === undefined) return undefined
      return {
        id: player.id,
        name: player.name,
        averagePoints: player.averagePoints,
        fixture,
      }
    },
  })
  /*
   * Not memoised: `select` rebuilds the profile whenever the standings resolve
   * behind it, so a memo keyed on the array would miss on exactly the render
   * that matters — and thirty comparisons is not a cost worth a surrogate key.
   *
   * `localeCompare` rather than `<`, because the names are German and a plain
   * comparison sorts every umlaut after Z: Özcan would land under Zirkzee.
   */
  const players = [...profile.players].sort(
    (a, b) =>
      POSITION_ORDER[a.position] - POSITION_ORDER[b.position] ||
      a.name.localeCompare(b.name, 'de'),
  )

  return (
    <div className="flex flex-col gap-3">
      {players.length === 0 ? (
        <EmptyState
          title="Kein Kader geladen"
          description="Kickbase führt für diesen Klub gerade keine Spieler."
        />
      ) : (
        <>
          {/* One line doing two jobs, which is why it is a line and not a pair
              of tiles: the club's size and worth on the left, and on the right
              the word the column below it needs. A bare signed figure under a
              market value reads as "since yesterday" — that is what it is on
              every other screen in this app — and this one is a week, so it is
              said once here rather than thirty times in the rows. */}
          <p className="flex items-baseline justify-between gap-3 px-0.5 text-[0.6875rem]">
            <span className="nums truncate text-muted">
              <span className="font-semibold text-ink">
                {money(profile.teamValue)}
              </span>{' '}
              Kaderwert · {players.length} Spieler
            </span>
            <span className="shrink-0 text-[0.625rem] tracking-wide text-faint uppercase">
              Marktwert · 7 Tage
            </span>
          </p>
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {players.map((player) => (
              <li key={player.id} className="flex items-stretch">
                <PlayerRow
                  player={player}
                  leagueId={leagueId}
                  expectedPoints={expectedPoints[player.id]}
                  onEditExpected={expected.open}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {expected.sheet}
    </div>
  )
}

/**
 * One player: portrait, name over position and probability, the owning
 * manager, and the money.
 *
 * The **probability sits on the second line beside the position**, not next to
 * the name. Beside the name it would collide with the availability mark, and
 * the two mean different things — "verletzt" is a fact, "unlikely to start" is
 * somebody's estimate — which is the same separation the
 * [squad list](../squad/PlayerListTab.tsx) makes. Glyph only, no label: five
 * tier names repeated down thirty rows is a lot of text for a mark the reader
 * learns to recognise in seconds, and each badge keeps its tooltip.
 *
 * The **availability mark stays** beside the name even though it is not one of
 * the columns this list is for. A `prob` tier does not imply it — an injured
 * player often carries no assessment at all — so dropping it would lose the one
 * signal a scouting list must not be wrong about.
 *
 * The **owner** sits between the name and the numbers, because that is what the
 * eye is scanning for: a column of manager avatars down the right-hand side
 * answers "what is still free here" in one sweep, where the same badges beside
 * the names would have to be hunted for.
 *
 * The whole row is a link to the player's own page, where the season history,
 * the market-value chart and the ownership detail live.
 */
function PlayerRow({
  player,
  leagueId,
  expectedPoints,
  onEditExpected,
}: {
  player: TeamSquadPlayer
  leagueId: string
  /** The reader's guess for the coming matchday, if there is one. */
  expectedPoints: number | undefined
  onEditExpected: (playerId: string) => void
}) {
  const change = player.marketValueChangeWeek
  const ChangeIcon =
    change !== undefined && change < 0 ? TrendingDown : TrendingUp

  return (
    /* The link is the row's *body* rather than the row, so the target at the
       end can be a button — HTML has no nested interactive elements. The two
       sit in the `li`, which is what the list's dividers separate. */
    <>
      <Link
        to={`/leagues/${leagueId}/players/${player.id}`}
        className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 transition-colors hover:bg-surface-2/60"
      >
        <Avatar
          src={player.image}
          name={player.name}
          size={36}
          square
          className="shrink-0 bg-surface-2"
        />

        <div className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 truncate text-sm font-medium text-ink">
              {player.name}
            </span>
            {/* No `stxt` on this payload, so no Kickbase-worded reason — the
              badge falls back to its code's own label, which is what that
              parameter is optional for. */}
            <PlayerStatusBadge status={player.availability} size={13} />
          </span>

          <span className="mt-0.5 flex items-center gap-1.5">
            <span
              title={POSITION_NAME[player.position]}
              className="text-[0.625rem] tracking-wide text-faint uppercase"
            >
              {POSITION_LABEL[player.position]}
            </span>
            {player.startProbability !== undefined && (
              <StartProbabilityBadge tier={player.startProbability} size={13} />
            )}
          </span>
        </div>

        {player.owner !== undefined && (
          <OwnerBadge owner={player.owner} size={22} />
        )}

        <div className="w-24 shrink-0 text-right">
          <span className="nums block text-sm font-semibold text-ink">
            {money(player.marketValue)}
          </span>

          {/* The **last seven days** — `sdmvt`, which is what this payload
            serves; `tfhmvt`'s 24 hours would cost one request per player. The
            arrow is drawn as the squad list draws it: the same signal as the
            amount, its direction, so the two cannot contradict each other, and
            omitted on a flat week rather than pointing nowhere. */}
          <span
            title={
              change === undefined
                ? 'Vor einer Woche noch ohne Marktwert — keine Veränderung berechenbar'
                : 'Marktwertänderung in den letzten 7 Tagen'
            }
            className={cn(
              'nums flex items-center justify-end gap-0.5 text-xs',
              change !== undefined && change > 0 && 'text-positive',
              change !== undefined && change < 0 && 'text-negative',
              (change === undefined || change === 0) && 'text-faint',
            )}
          >
            {change !== undefined && change !== 0 && (
              <ChangeIcon size={11} aria-hidden="true" className="shrink-0" />
            )}
            {/* A dash for a player Kickbase only started pricing this week: his
              `sdmvt` is his whole value, and printing it would read as the
              biggest riser at the club. */}
            {change === undefined ? '–' : moneyDelta(change)}
            <span className="sr-only"> in den letzten 7 Tagen</span>
          </span>
        </div>
      </Link>

      <ExpectedPointsTarget
        value={expectedPoints}
        playerName={player.name}
        onClick={() => {
          onEditExpected(player.id)
        }}
      />
    </>
  )
}
