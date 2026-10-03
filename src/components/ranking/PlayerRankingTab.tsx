import { Trophy, Users } from 'lucide-react'
import { Link } from 'react-router'

import type { RankingScope, TeamSummary } from '@/api/hooks/useCompetition'
import {
  POINTCAST_LIMIT,
  type RankingSource,
} from '@/api/hooks/usePlayerRanking'
import { useMatchdayLineups } from '@/api/hooks/useMatchdaySquad'
import { useRanking } from '@/api/hooks/useRanking'
import type {
  MatchdayTopScorers,
  MatchPlayerOwner,
  PositionKey,
} from '@/api/models'
import { POSITION_LABEL, POSITION_NAME } from '@/api/models'
import { OwnerBadge } from '@/components/matchday/OwnerBadge'
import { ClubWatermark } from '@/components/player/ClubWatermark'
import { Avatar } from '@/components/ui/Avatar'
import {
  CHIP_ROW,
  CHIP_ROW_START,
  FilterChip,
} from '@/components/ui/FilterChip'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { points } from '@/lib/format'

/**
 * The chip row, left to right. `undefined` is *Alle* — the unfiltered call —
 * and the four that follow are in the order a lineup is read in, which is the
 * order they appear in everywhere else in the app.
 */
const FILTERS: { key: PositionKey | undefined; label: string }[] = [
  { key: undefined, label: 'Alle' },
  { key: 'gk', label: POSITION_LABEL.gk },
  { key: 'def', label: POSITION_LABEL.def },
  { key: 'mid', label: POSITION_LABEL.mid },
  { key: 'fwd', label: POSITION_LABEL.fwd },
]

/**
 * Whether the list is cut by who has the player — see
 * {@link OwnershipSwitch}.
 *
 * `'all'` is the default and is **not** written to the URL: the unfiltered
 * list is what the page is, and a parameter naming the absence of a filter is
 * noise in a link somebody shares.
 */
export type OwnershipFilter = 'all' | 'owned' | 'free'

/**
 * The cycle, in the order a tap walks it.
 *
 * *Alle* leads because it is where the list starts and where a second tap
 * past *Frei* comes back to; the two cuts follow in the order they are asked
 * for — *who is taken* before *who is still going*, which is the order a
 * manager scanning a ranking for a signing reads them in.
 */
const OWNERSHIP_CYCLE = [
  // *Alle Spieler*, not *Alle*: the position chips above already have an
  // *Alle* and two controls over one list should not share a word.
  { value: 'all', label: 'Alle Spieler', caption: 'alle Spieler' },
  { value: 'owned', label: 'Vergeben', caption: 'nur vergebene Spieler' },
  { value: 'free', label: 'Frei', caption: 'nur freie Spieler' },
] as const satisfies readonly {
  value: OwnershipFilter
  label: string
  caption: string
}[]

/**
 * The competition's best players, best first — and **who in the league owns
 * them**.
 *
 * **One list, three callers.** It is the Rangliste of
 * [Spieltag](../../pages/MatchdayPage.tsx) — for the matchday being played, and
 * for any earlier one out of
 * [pointcast](../../api/hooks/usePlayerRanking.ts) — and the Rangliste of
 * [Saison](../../pages/SeasonPage.tsx). `scope` and `source` say which; nothing
 * else here branches on either, because the hook hands over one shape whichever
 * side answered. This component is deliberately not the place where the sources
 * are told apart.
 *
 * **What differs is the row count, and that is on purpose.** Kickbase caps its
 * ranking at 25 and no parameter raises it; the pointcast files are published
 * at 100 per list. Padding the live list or trimming the published one to match
 * would be inventing a consistency the data does not have — so the footnote
 * under the list says which you are reading instead.
 *
 * ## The position chips are five lists, and how they are made depends
 *
 * Live, `?position=` is a **request**: it is the only way past the 25-row cap,
 * because the cap applies per filtered list. *ABW* is then not the defenders
 * out of the overall twenty-five but the top twenty-five defenders, most of
 * whom the *Alle* list has no room for — a `.filter()` over the rows already in
 * hand would have shown four or five names and called it a ranking.
 *
 * From pointcast the five lists arrive **together, in one file**, for the same
 * reason that makes them worth having separately: each is its own top 100, and
 * the overall list does not contain them. So the chip is neither a request nor
 * a filter there — it picks the list that was already fetched.
 *
 * Live, the chips **compose with the scope**, so a season list has its own five
 * cache entries and the matchday's five are not disturbed by a trip to the
 * other page.
 *
 * **A short list is not a truncated one.** *TW* comes back with 18 rows on a
 * nine-fixture matchday from either source, because that is every keeper who
 * played — the cap is simply above the population. Nothing here pads it or
 * explains it away.
 *
 * ## The badge is the point
 *
 * The right-hand slot used to carry the player's club crest, which was already
 * redundant: the club is named on the line under his name. It now carries the
 * **owning manager's avatar**, the same [`OwnerBadge`](../matchday/OwnerBadge.tsx) the
 * match lineup uses, and that turns a list of strangers into a list about the
 * league — *these two in the top ten are somebody's, and one of them is mine.*
 * The viewer's own players take the accent ring; a manager who owned a player
 * and left him out is drawn faded, which on this screen is its own small story.
 *
 * **An unowned player gets nothing there**, not a crest fallback. Mixing two
 * kinds of thing in one column would make the column mean "either a club or a
 * manager", and then it would take a moment's reading to tell which — where an
 * empty slot reads instantly as "nobody has him". In most leagues that will be
 * most of the twenty-five, which is exactly what makes the filled ones worth
 * looking at.
 *
 * ## The ownership cut
 *
 * The badge answers *who has him* one row at a time; the switch above the list
 * asks it of the whole list — **Alle / Vergeben / Frei**. A ranking read with
 * an eye on the market is two different questions, and until now the reader had
 * to answer both by eye: *who of the best is already taken* (the league's own
 * form guide) and *who of the best is still going* (the shortlist). A hundred
 * rows is too many to scan for either.
 *
 * **It filters on exactly what the badges show**, which is what keeps the
 * control honest: *Vergeben* is the rows with a badge and *Frei* is the rows
 * without one, so a reader can always check the filter against the column
 * beside it. That also means it inherits the badge's notion of ownership — the
 * selected matchday's squads, not today's; see below.
 *
 * **It is drawn only where the caller handles it.** The
 * [matchday page](../../pages/MatchdayPage.tsx) passes no handler and gets no
 * switch: there the badge means *who fielded him that weekend*, and a control
 * labelled *Frei* would make a claim about the transfer market out of a fact
 * about one afternoon's lineups. On [Saison](../../pages/SeasonPage.tsx) the
 * badge is the latest matchday's, which is as close to *now* as the data gets.
 *
 * The cut is a `.filter()` over rows already in hand — unlike the position
 * chips, which are five separate lists. So *Frei* over the top 100 is the free
 * players **among those hundred**, not a hundred free players, and a league
 * that owns most of the top of the table will see a short list. That is the
 * true answer to the question asked, and padding it would need a ranking
 * nobody publishes.
 *
 * **Placements survive the cut.** The rank is taken before filtering, so the
 * rows read 3, 7, 12 rather than renumbering 1, 2, 3 — the figure is a position
 * in the ranking and not a count of what is on screen. It matters on a live
 * list, where the source sends no rank and the row's index is all there is.
 *
 * ## What ownership costs
 *
 * The league standings (one cached request, shared with every page that names
 * a manager) plus the [matchday-lineup fan-out](../../api/hooks/useMatchdaySquad.ts)
 * — one request per manager. That is the same fan-out the
 * [match lineup](../matchday/MatchLineupTab.tsx) pays and it shares the same cache
 * entries, so a manager already looked at this session is free.
 *
 * It is deliberately **mounted, not gated**: this component only exists while
 * the Rangliste view is open, so the fan-out is scoped by the view existing
 * rather than by a flag somebody has to remember to pass.
 *
 * **On a matchday list the badge follows that matchday, not the calendar**,
 * which is worth saying because it is the one thing on the screen that could
 * quietly have been "now" instead: the fan-out reads `teamcenter?dayNumber=`
 * for `data.day`, the lineup *as it stood*, so a row from matchday 1 shows who
 * fielded him on matchday 1 rather than who happens to own him today.
 *
 * **On the season list it is the most recent matchday's**, which is the closest
 * thing to "now" that costs no extra request. `data.day` is the *source's* own
 * notion of where the season has got to — the matchday the totals run through,
 * which is the last one with points rather than the next one to be played, and
 * so exactly the lineup worth asking about. A season row therefore says *this
 * is whose team he was in last weekend*, not *somebody had him for the goals
 * that got him up here* — and no season-long ownership history exists anywhere
 * to offer instead.
 */
export function PlayerRankingTab({
  data,
  teams,
  leagueId,
  viewerId,
  isPending,
  scope,
  source,
  position,
  onPositionChange,
  ownership = 'all',
  onOwnershipChange,
}: {
  data: MatchdayTopScorers | undefined
  teams: Map<string, TeamSummary> | undefined
  leagueId: string
  viewerId: string | undefined
  isPending: boolean
  scope: RankingScope
  source: RankingSource
  position: PositionKey | undefined
  onPositionChange: (position: PositionKey | undefined) => void
  /** Which rows the ownership switch is letting through. */
  ownership?: OwnershipFilter
  /**
   * Handles the switch — **and decides whether there is one**. A caller that
   * omits it gets the whole list and no control; see the doc above for why
   * the matchday page is one.
   */
  onOwnershipChange?: (ownership: OwnershipFilter) => void
}) {
  /*
   * Ownership is asked one manager at a time — there is no bulk source, see
   * `useMatchdayLineups`. The standings are fetched for the names and avatars
   * the badge needs anyway, so they add no request beyond the fan-out they
   * feed.
   *
   * `data?.day` rather than the season schedule's current matchday: ownership
   * has to be read for the matchday these *points* are from, and the list is
   * the only thing that knows which that is.
   */
  const standings = useRanking(leagueId)
  const managers = standings.data?.managers ?? []
  const lineups = useMatchdayLineups(
    leagueId,
    data?.day,
    managers.map((manager) => manager.id),
  )

  const managerById = new Map(managers.map((manager) => [manager.id, manager]))

  const ownerOf = (playerId: string): MatchPlayerOwner | undefined => {
    const onTheDay = lineups.byPlayerId.get(playerId)
    if (onTheDay === undefined) return undefined

    // A manager the standings do not list gets no badge rather than one
    // reading a raw id — the same rule the match lineup applies.
    const manager = managerById.get(onTheDay.managerId)
    if (manager === undefined) return undefined

    return {
      id: manager.id,
      name: manager.name,
      image: manager.image,
      isViewer: manager.id === viewerId,
      source: 'matchdayLineup',
      wasFielded: onTheDay.wasFielded,
    }
  }

  /*
   * **The fan-out has to have answered before the cut means anything.** Until
   * it does, every row looks unowned, and filtering on that would draw a
   * confident list of the wrong players; and a matchday the API has nothing
   * for at all (`isEmpty` once settled — out of range, or before the league
   * existed) can never answer it, so there the switch is not offered and the
   * list stays whole rather than claiming the whole competition is free.
   *
   * **The standings count as pending too.** With no managers yet the fan-out
   * has nothing to ask and reports itself neither pending nor filled — an
   * empty `useQueries` is not pending — so reading `lineups` alone would call
   * it *missing* for the moment before the standings land, and the switch
   * would appear a beat after the list instead of with it.
   */
  const ownershipPending = standings.isPending || lineups.isPending
  const ownershipMissing = !ownershipPending && lineups.isEmpty
  const cut: OwnershipFilter =
    onOwnershipChange === undefined || ownershipMissing ? 'all' : ownership

  /*
   * Ranked before cut, so a filtered list reads 3, 7, 12 — the placement in
   * the ranking, not a count of the rows that survived. The source's own rank
   * is preferred where there is one, because only it knows about ties: two
   * players on 254 points are both second and the row after them is fourth,
   * which counting cannot say. The live list sends none, and then the position
   * in the **unfiltered** list is the honest fallback.
   */
  const ranked = (data?.players ?? []).map((player, index) => ({
    player,
    rank: player.rank ?? index + 1,
  }))

  const rows =
    cut === 'all'
      ? ranked
      : ranked.filter(
          (row) => (ownerOf(row.player.id) !== undefined) === (cut === 'owned'),
        )

  /*
   * **The controls render above whatever the list is doing** — skeleton, empty
   * state or rows. Returning early past them would make a control disappear on
   * the tap that changes it and come back when the request lands, which reads
   * as the page having lost the filter rather than as it fetching one.
   *
   * Absent on a caller that handles no cut, and on a matchday whose lineups
   * the API cannot answer for at all — see `ownershipMissing` above.
   */
  const ownershipSwitch =
    onOwnershipChange === undefined || ownershipMissing ? undefined : (
      <OwnershipSwitch value={cut} onChange={onOwnershipChange} />
    )

  const positionChips = (
    <div
      /* Full bleed when it owns the line, left bleed only when it shares it —
         see [`CHIP_ROW_START`](../ui/FilterChip.tsx). Five short labels fit a
         phone on their own, which is why this row had never had to be swiped;
         with the switch taking the end of the line they no longer do, and the
         scroll the class list has always carried finally earns its keep. */
      className={ownershipSwitch === undefined ? CHIP_ROW : CHIP_ROW_START}
      role="group"
      aria-label="Position"
    >
      {FILTERS.map((filter) => (
        <FilterChip
          key={filter.key ?? 'all'}
          isActive={position === filter.key}
          onClick={() => {
            onPositionChange(filter.key)
          }}
        >
          {filter.label}
        </FilterChip>
      ))}
    </div>
  )

  /*
   * **The two controls share one line.** The ownership switch is a cut on the
   * same list as the chips beside it, and giving it a row of its own made the
   * head of the page three stacked bands of control over the rows they are
   * about. It sits at the end, where it is out of the chips' reading order and
   * still the first thing the eye lands on coming back up from the list.
   */
  const chips =
    ownershipSwitch === undefined ? (
      positionChips
    ) : (
      <div className="flex items-center gap-2">
        {positionChips}
        {ownershipSwitch}
      </div>
    )

  /* A cut list waits for the fan-out rather than rendering what it has: the
     rows would be filtered on an ownership map that is still filling, so the
     list would be wrong first and right a moment later. The skeleton is only
     ever seen on a reload that arrives with the filter already in the URL. */
  const list =
    isPending || (cut !== 'all' && ownershipPending) ? (
      <SkeletonList rows={10} />
    ) : data === undefined || data.players.length === 0 ? (
      <EmptyState
        icon={<Trophy size={22} />}
        title="Keine Wertung"
        description={`${scope === 'season' ? 'In dieser Saison' : 'Für diesen Spieltag'} hat noch ${position === undefined ? 'kein Spieler' : `kein ${POSITION_NAME[position]}`} gepunktet.`}
      />
    ) : rows.length === 0 ? (
      /* The list had rows and the switch took them all. Saying *keine Wertung*
       here would blame the season for what the control did one tap ago — so it
       names the filter, which is also the way back out of it. */
      <EmptyState
        icon={<Users size={22} />}
        title={cut === 'owned' ? 'Niemand vergeben' : 'Alle vergeben'}
        description={
          cut === 'owned'
            ? 'Aus dieser Wertung gehört kein Spieler einem Manager der Liga.'
            : 'Jeder Spieler aus dieser Wertung gehört bereits einem Manager der Liga.'
        }
      />
    ) : (
      <ol className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {rows.map(({ player, rank }) => {
          const team = teams?.get(player.teamId)
          const owner = ownerOf(player.id)

          return (
            <li key={player.id}>
              <Link
                to={`/leagues/${leagueId}/players/${player.id}`}
                /* The club, in words, for the one reader the crest does not
                 reach: the row no longer prints it, and a badge is not a name
                 to somebody who does not know the badge. */
                title={
                  team === undefined
                    ? player.lastName
                    : `${player.lastName} · ${team.name}`
                }
                className="flex items-stretch transition-colors hover:bg-surface-2/60"
              >
                {/* The rank is a rail, the same flush left-hand column the squad
                  row puts its shirt in — which is what lets the portrait beside
                  it butt against an edge rather than end on a cut.

                  The top three carry the accent and nothing else does. A podium
                  needs no medal glyphs to read as a podium, and three coloured
                  numbers in twenty-five stay legible where three icons would
                  just be more to look at. */}
                <span
                  className={cn(
                    'nums flex w-7 shrink-0 items-center justify-center self-stretch',
                    'border-r border-line bg-surface-2/40 text-xs font-semibold',
                    rank <= 3 ? 'text-accent' : 'text-faint',
                  )}
                >
                  {rank}
                </span>

                {/* Flush portrait, as on the squad, market and activity rows: the
                  Kickbase cutouts are transparent PNGs, so a wash grounds the
                  figure and the inner edge is masked to dissolve into the row
                  instead of ending on a line. The figure gets the row's full
                  height, which at this width is the difference between a
                  thumbnail of a face and a player standing in the list. */}
                <span className="flex w-14 shrink-0 self-stretch">
                  <Avatar
                    src={player.image}
                    name={player.lastName}
                    fill
                    className={cn(
                      'w-full self-stretch bg-transparent',
                      'bg-linear-to-t from-surface-2/60 to-transparent to-70%',
                      '[mask-image:linear-gradient(to_right,#000_65%,transparent)]',
                    )}
                  />
                </span>

                {/* `relative isolate overflow-hidden` is what the club
                  watermark needs of its host — see
                  [`ClubWatermark`](../player/ClubWatermark.tsx). */}
                <span className="relative isolate flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden py-2.5 pr-3 pl-1">
                  <ClubWatermark team={team} />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {player.lastName}
                    </span>
                    {/* The position, and **not** the club: the crest behind the
                      row says which club, at a size a name in 11px grey never
                      competed with. Spelling it out as well was the badge and
                      the caption for the same picture — and on a phone it was
                      the half of this line that truncated. It stays in the
                      row's tooltip. */}
                    <span className="block truncate text-[0.6875rem] text-faint">
                      {POSITION_LABEL[player.position]}
                    </span>
                  </span>

                  {/* Fixed width whether or not it is filled, so the scores stay
                    in a column: a badge that shifted every row it appeared on
                    would cost more than it tells. */}
                  <span className="flex w-5 shrink-0 justify-center">
                    {owner !== undefined && (
                      <OwnerBadge owner={owner} size={20} />
                    )}
                  </span>

                  <span className="nums w-12 shrink-0 text-right text-sm font-semibold text-ink">
                    {points(player.points)}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    )

  /*
   * Where the numbers came from, and therefore why the list is as long as it
   * is. Without it the 25 of a live matchday and the 100 of a published one
   * look like a bug in one of them — and the published list is pointcast's
   * arithmetic rather than Kickbase's, which a reader comparing it against the
   * app is entitled to know.
   *
   * It does **not** name the matchday. On a season list that is the picker's
   * job — *bis 4. Spieltag*, in the control that sets it — and saying it twice
   * on one screen would make the footnote look like a second, quieter claim
   * about the same thing.
   */
  const footnote =
    data === undefined || data.players.length === 0
      ? undefined
      : source === 'live'
        ? 'Kickbase liefert die besten 25 je Kategorie.'
        : `litbase-pointcast — die besten ${String(POINTCAST_LIMIT)} je Kategorie.`

  return (
    <div className="flex flex-col gap-3">
      {chips}
      {list}
      {footnote !== undefined && (
        <p className="px-0.5 text-[0.6875rem] text-faint">{footnote}</p>
      )}
    </div>
  )
}

/**
 * **The ownership cut, as one label you tap to change** — *Alle Spieler*,
 * *Vergeben*, *Frei*, and round again.
 *
 * It sits **at the end of the position chips, on their line and at their
 * height** (`h-9`), which is what makes the head of the list one band of
 * controls instead of two. The corner radius is the one thing it keeps for
 * itself: `rounded-lg` against the chips' `rounded-full`, so a control that
 * cycles three states does not read as a sixth chip that toggles.
 *
 * Three chips would have been the obvious thing and would have been wrong
 * twice over: they would have doubled the row of controls above a list that
 * already has five position chips, and they would have given a secondary cut
 * the same weight as the primary one. A cycle is one target, and the word on
 * it is the state — which is the whole reason this is a label and not an icon.
 * The reader never has to decode a glyph to know what the list is showing.
 *
 * **The glyph does not change; its colour does.** Accent while the list is
 * cut, muted while it is whole — the lesson the
 * [match-event filter](../player/PlayerMatchEventsDialog.tsx) was rebuilt
 * around: a control whose *shape* changes reads as two different buttons
 * rather than one button in three states. Here the label carries the state
 * outright anyway, so the colour is only confirming what the word says.
 *
 * **No `aria-pressed`.** It is true or false for a two-state toggle and says
 * nothing honest about a middle setting, so the state travels in the
 * accessible name instead — which also has to carry what a tap will do, since
 * nothing about a cycle announces its next step.
 */
function OwnershipSwitch({
  value,
  onChange,
}: {
  value: OwnershipFilter
  onChange: (value: OwnershipFilter) => void
}) {
  const index = OWNERSHIP_CYCLE.findIndex((entry) => entry.value === value)
  // `findIndex` answers -1 for a value outside the cycle — a hand-edited URL,
  // which falls back to the unfiltered list rather than to a blank button.
  const current =
    OWNERSHIP_CYCLE[index === -1 ? 0 : index] ?? OWNERSHIP_CYCLE[0]
  const next =
    OWNERSHIP_CYCLE[(index === -1 ? 0 : index + 1) % OWNERSHIP_CYCLE.length] ??
    OWNERSHIP_CYCLE[0]
  const label = `Zeigt ${current.caption} — tippen für ${next.caption}`
  const isCut = current.value !== 'all'

  return (
    <button
      type="button"
      onClick={() => {
        onChange(next.value)
      }}
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5',
        'text-xs font-medium transition-colors',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        isCut
          ? 'border-accent/40 bg-accent/10 text-accent'
          : 'border-line bg-surface text-muted hover:text-ink active:bg-surface-2',
      )}
    >
      <Users size={14} aria-hidden="true" />
      {current.label}
    </button>
  )
}
