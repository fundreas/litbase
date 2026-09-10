import { ListOrdered, SquareSplitVertical } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { rankDuelPlayers } from '@/api/hooks/useDuelRosters'
import {
  byMatchdayPoints,
  type DuelPlayer,
  type DuelRoster,
} from '@/api/models'
import { DuelPlayerRow } from '@/components/duels/DuelPlayerRow'
import { useExpectedPointsView } from '@/components/squad/useExpectedPointsView'
import { Avatar } from '@/components/ui/Avatar'
import { PairToggle } from '@/components/ui/PairToggle'
import type { ExpectedPointsView } from '@/lib/expectedPoints'
import { points } from '@/lib/format'
import { readString, writeString } from '@/lib/storage'

/** One list across both squads, or one list per manager. */
type RankingView = 'combined' | 'perManager'

/**
 * **Every player of the duel, best first** — benches included, in either of two
 * readings.
 *
 * The counterpart of the [match ranking](../matchday/MatchRankingTab.tsx), and
 * the same two readings for the same reason:
 *
 *  - ***Gemeinsam*** interleaves the two squads, which is the default and the
 *    more interesting of the two. Whose players occupy the top of a combined
 *    table says more about how a duel is going than two separate lists can, and
 *    it is the one arrangement that makes the comparison itself visible. Each
 *    row carries the owning manager's avatar next to the score — the only thing
 *    distinguishing otherwise identical rows.
 *  - ***Nach Manager*** splits it, first manager above second, **each numbered
 *    from 1**. That is the reading for "who carried my team today", a question
 *    the combined list buries as soon as the other side has run away with the
 *    matchday — and the numbering restarting is the whole point of the split: a
 *    player carrying `14` because thirteen of the opponent's outscored him
 *    answers a different question.
 *
 * The control is the app's [`PairToggle`](../ui/PairToggle.tsx), the same one
 * the match ranking and the squad's list/grid use, and the choice is remembered.
 *
 * Bench players are in both readings. They scored what they scored and it did
 * not count, and a bench outscoring the eleven is the most interesting thing a
 * duel can tell you — their rows say *Bank*, so nothing is misread as having
 * counted.
 */
export function DuelRankingTab({
  rosters,
  leagueId,
  day,
}: {
  rosters: [DuelRoster, DuelRoster]
  /** For the headings, which link each manager at their own page. */
  leagueId: string
  /** Rides along on those links, so a manager opens on this matchday. */
  day: number | undefined
}) {
  const [view, setView] = useRankingView()
  const ranked = useMemo(() => rankDuelPlayers(rosters), [rosters])
  const managerById = useMemo(
    () => new Map(rosters.map((roster) => [roster.manager.id, roster.manager])),
    [rosters],
  )

  /* The same figures the [pitch](./DuelLineupTab.tsx) draws, off the same
     cached file: this list is the other reading of one duel, and the two must
     not disagree about what a player is expected to bring. */
  const expected = useExpectedPointsView(day)

  return (
    <div className="flex flex-col gap-3">
      <PairToggle
        value={view}
        onChange={setView}
        options={VIEW_OPTIONS}
        className="-mt-1"
      />

      {view === 'combined' ? (
        <RankedList
          players={ranked}
          expected={expected}
          trailing={(player) => (
            <Avatar
              // Always set on a duel roster; optional on the model only
              // because the squad page's live view has no sides to tell apart.
              src={
                player.managerId === undefined
                  ? undefined
                  : managerById.get(player.managerId)?.image
              }
              name={
                player.managerId === undefined
                  ? undefined
                  : managerById.get(player.managerId)?.name
              }
              size={20}
              className="shrink-0"
            />
          )}
        />
      ) : (
        /* First manager above second — the order the header's scoreline
           establishes, and the one the pitch stacks them in. */
        <div className="flex flex-col gap-4">
          <ManagerRanking
            roster={rosters[0]}
            leagueId={leagueId}
            day={day}
            expected={expected}
          />
          <ManagerRanking
            roster={rosters[1]}
            leagueId={leagueId}
            day={day}
            expected={expected}
          />
        </div>
      )}
    </div>
  )
}

/** The two readings, and the glyph each is drawn as. */
const VIEW_OPTIONS = [
  { value: 'combined', icon: ListOrdered, label: 'Gemeinsame Rangliste' },
  {
    value: 'perManager',
    icon: SquareSplitVertical,
    label: 'Nach Manager getrennt',
  },
] as const satisfies readonly [
  { value: RankingView; icon: typeof ListOrdered; label: string },
  { value: RankingView; icon: typeof ListOrdered; label: string },
]

const VIEW_STORAGE_KEY = 'litbase.duelRanking.view'

/**
 * Combined or per manager, remembered across duels.
 *
 * A preference, not a place — stored through the app's safe `localStorage`
 * wrapper and deliberately **not** in the URL, so a shared link to a duel opens
 * in the reader's own reading rather than the sender's. The same treatment the
 * [match ranking](../matchday/MatchRankingTab.tsx) gives the identical choice,
 * under its own key: the two views are alike but a reader's habits on one need
 * not follow to the other.
 */
function useRankingView(): [RankingView, (view: RankingView) => void] {
  const [view, setViewState] = useState<RankingView>(
    () => (readString(VIEW_STORAGE_KEY) as RankingView | null) ?? 'combined',
  )

  const setView = (next: RankingView) => {
    setViewState(next)
    writeString(VIEW_STORAGE_KEY, next)
  }

  return [view, setView]
}

/**
 * One manager's players, ranked among themselves, under their name — and **what
 * they scored on the matchday**.
 *
 * The total is `totalPoints`, Kickbase's own figure from the standings rather
 * than the sum of the rows below it. That is deliberate and it is the same
 * number the page header shows, so the two cannot disagree while the rows fill
 * in — and it is the figure the duel is actually decided on, which a sum of a
 * list that includes the bench would not be.
 *
 * **No manager avatar on the rows here.** In the combined list it is the only
 * thing telling two rows apart; under a heading that already names the manager
 * it is the same fact repeated down the whole column.
 */
function ManagerRanking({
  roster,
  leagueId,
  day,
  expected,
}: {
  roster: DuelRoster
  leagueId: string
  day: number | undefined
  /** This matchday's expected points, for the matches still to come. */
  expected: ExpectedPointsView
}) {
  const players = useMemo(
    () => [...roster.lineup, ...roster.bench].sort(byMatchdayPoints),
    [roster],
  )
  const label = `${roster.manager.name}: ${points(roster.totalPoints)} Punkte am Spieltag`

  return (
    <section className="flex flex-col gap-1.5">
      {/* The heading is **the way to the manager**, the whole row of it: it is
          the one thing here that names them, the rows beneath are the players'
          and lead to the players. See
          [the manager page](../../pages/ManagerDetailPage.tsx). */}
      <h3 className="min-w-0">
        <Link
          to={`/leagues/${leagueId}/managers/${roster.manager.id}?day=${String(day ?? '')}`}
          title={`${label} — Manager ansehen`}
          className="-mx-1 flex min-w-0 items-center gap-2 rounded-lg px-1 py-0.5 transition-colors hover:bg-surface-2"
        >
          <Avatar
            src={roster.manager.image}
            name={roster.manager.name}
            size={18}
            className="shrink-0"
          />
          <span className="truncate text-xs font-semibold tracking-wide text-muted uppercase">
            {roster.manager.name}
          </span>
          <span
            aria-hidden="true"
            className="nums ml-auto shrink-0 text-sm font-bold text-ink"
          >
            {points(roster.totalPoints)}
          </span>
          <span className="sr-only">{label}</span>
        </Link>
      </h3>

      {players.length === 0 ? (
        <p className="rounded-card border border-line bg-surface px-3 py-3 text-center text-xs text-muted">
          Keine Spieler für diesen Spieltag
        </p>
      ) : (
        <RankedList players={players} expected={expected} />
      )}
    </section>
  )
}

/** The card the two readings share: numbered rows, best first. */
function RankedList({
  players,
  trailing,
  expected,
}: {
  players: DuelPlayer[]
  /** Extra content on the right of each row — the manager, in the combined list. */
  trailing?: (player: DuelPlayer) => ReactNode
  /** This matchday's expected points, for the matches still to come. */
  expected?: ExpectedPointsView
}) {
  return (
    <ol className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      {players.map((player, index) => (
        <li key={player.id} className="flex items-center">
          <span className="nums w-8 shrink-0 pl-3 text-right text-xs font-semibold text-faint">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <DuelPlayerRow
              player={player}
              // The lineup tab already says what every player's match is
              // doing; here the one thing that changes how a row is read is
              // whether it counted, which the "Bank" tag says on its own.
              showStatus={player.status === 'bench'}
              trailing={trailing?.(player)}
              expected={expected}
            />
          </div>
        </li>
      ))}
    </ol>
  )
}
