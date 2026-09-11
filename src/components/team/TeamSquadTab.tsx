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
import { ExpectedPointsBadge } from '@/components/squad/ExpectedPointsBadge'
import { PlayerStatusBadge } from '@/components/squad/PlayerStatusBadge'
import { StartProbabilityBadge } from '@/components/squad/StartProbabilityBadge'
import { useExpectedPointsView } from '@/components/squad/useExpectedPointsView'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import type { ExpectedPointsEntry } from '@/lib/expectedPoints'
import { money, moneyDelta } from '@/lib/format'

/**
 * Sort weight per position — the order a team sheet is always written in.
 *
 * Both an order and the sections themselves: the list is grouped under one
 * heading per position, exactly as one's own [Kader](../squad/PlayerListTab.tsx)
 * and a [rival's](../manager/ManagerSquadTab.tsx) are, and the heading is what
 * a label on every row used to say thirty times over.
 */
const POSITION_ORDER: PositionKey[] = ['gk', 'def', 'mid', 'fwd']

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
 * **Expected points are shown but not entered here.** The figure beside each
 * probability badge is the reader's own guess where he made one and the
 * model's prediction otherwise, exactly as on a Kader — but a club's roster is
 * a scouting list, not a lineup, and the sheet that enters a guess now lives
 * where a player's whole run of fixtures does: his
 * [own page](../../pages/PlayerDetailPage.tsx), on the Leistung tab, where a
 * tap on an upcoming match opens it against that matchday.
 *
 * There is **no crest on the rows** either, the way one's own
 * [squad list](../squad/PlayerListTab.tsx) has: thirty copies of one crest
 * would say nothing, since every player here faces the same opponent. The
 * fixture is in the [header's strip](./TeamHeader.tsx), once.
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
   * Only the matchday number is wanted: the figures are filed under it, and
   * the fixture itself is the header's, said once for a club that has one
   * match a matchday.
   */
  const matchday = useCurrentMatchday(competitionId)
  const day = matchday.data?.day
  const expectedPoints = useExpectedPointsView(day)
  /*
   * Not memoised: `select` rebuilds the profile whenever the standings resolve
   * behind it, so a memo keyed on the array would miss on exactly the render
   * that matters — and thirty comparisons is not a cost worth a surrogate key.
   *
   * `localeCompare` rather than `<`, because the names are German and a plain
   * comparison sorts every umlaut after Z: Özcan would land under Zirkzee.
   */
  const players = [...profile.players].sort((a, b) =>
    a.name.localeCompare(b.name, 'de'),
  )

  /* One section per position, empty ones dropped: a club with no listed
     keeper should show three headings, not four with a gap under one. */
  const byPosition = POSITION_ORDER.map((position) => ({
    position,
    players: players.filter((player) => player.position === position),
  })).filter((group) => group.players.length > 0)

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
          {byPosition.map((group) => (
            <section key={group.position} className="flex flex-col gap-1.5">
              {/* The same heading a rival's Kader carries, down to the count
                  beside it — three lists of players in this app now read the
                  same way, and the position each row used to repeat is said
                  once here instead. */}
              <h3
                className="px-0.5 text-[0.6875rem] font-semibold tracking-wider text-faint uppercase"
                title={POSITION_NAME[group.position]}
              >
                {POSITION_LABEL[group.position]}
                <span className="nums ml-1.5 font-normal">
                  {group.players.length}
                </span>
              </h3>

              <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
                {group.players.map((player) => (
                  <li key={player.id} className="flex items-stretch">
                    <PlayerRow
                      player={player}
                      leagueId={leagueId}
                      expectedPoints={expectedPoints.entry(player.id)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
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
}: {
  player: TeamSquadPlayer
  leagueId: string
  /**
   * What he is expected to score on the coming matchday — the reader's guess,
   * or the model's prediction standing in for one. Read-only here: this list
   * **shows** the figure and no longer enters it, which is the
   * [player's own page](../../pages/PlayerDetailPage.tsx)'s job now.
   */
  expectedPoints: ExpectedPointsEntry | undefined
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

          {/* The position is gone from the row — the section heading above
              says it once for the whole group — and what stands in its place
              is the pair that decides a purchase: **will he play, and what
              will he bring**. Both are about the coming matchday, both are
              estimates, and neither means much without the other. */}
          {(player.startProbability !== undefined ||
            expectedPoints !== undefined) && (
            <span className="mt-0.5 flex items-center gap-1.5">
              {player.startProbability !== undefined && (
                <StartProbabilityBadge
                  tier={player.startProbability}
                  size={13}
                />
              )}
              {expectedPoints !== undefined && (
                <ExpectedPointsBadge
                  value={expectedPoints.value}
                  isForecast={!expectedPoints.isOwn}
                />
              )}
            </span>
          )}
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
    </>
  )
}
