import { Award } from 'lucide-react'
import { Link } from 'react-router'

import { useBattleRanking } from '@/api/hooks/useBattleRanking'
import { useLeagueDetails } from '@/api/hooks/useLeague'
import {
  BATTLE_UNIT,
  type BattleRankedManager,
  type LeagueBattle,
} from '@/api/models'
import { BATTLE_FALLBACK_ICON, BATTLE_ICON } from '@/components/league/battles'
import { ManagerAvatar } from '@/components/manager/ManagerAvatar'
import { FilterChip } from '@/components/ui/FilterChip'
import { Skeleton, SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { placement, points } from '@/lib/format'

/**
 * Which battle `?battle=` names — **the first one when it names nothing the
 * league runs.**
 *
 * The parameter carries the type code as text, and a code the league has no
 * battle for is treated exactly like an absent one. A URL is a thing people
 * edit, share and keep, so the failure has to be a view rather than an error:
 * an unknown battle shows the first battle, not an empty page explaining that
 * `?battle=99` is not a thing.
 */
function selectedBattle(
  battles: LeagueBattle[],
  raw: string | null,
): LeagueBattle | undefined {
  return battles.find((battle) => String(battle.type) === raw) ?? battles[0]
}

/**
 * **Every manager of the league, ranked by one of its side competitions.**
 *
 * The second view of [Rangliste](../../pages/RankingPage.tsx), and the other
 * half of the [Liga page](../../pages/LeaguePage.tsx)'s *Wettkämpfe* card:
 * that one names whoever is **leading** each battle, this one is the table
 * behind it, which is where every battle row on that page now leads.
 *
 * ## The chips are the battles, and they cost nothing to draw
 *
 * One chip per battle, labelled with the API's own wording and carrying the
 * type's [icon](../league/battles.ts) — the same glyph the Liga row it was
 * opened from used, so the tap lands somewhere recognisable. The list of
 * battles comes from [`useLeagueDetails`](../../api/hooks/useLeague.ts), the
 * ten-minute overview entry the Liga page and the market already hold, so the
 * row of chips is there on first paint and only the standings under it are
 * fetched.
 *
 * **The standings are one request per battle opened.** There is no call that
 * answers for all seven, so only the active chip's table is asked for — see
 * [`useBattleRanking`](../../api/hooks/useBattleRanking.ts). Each is its own
 * cache entry, which makes flicking back to one already seen instant.
 *
 * The chips render **above whatever the list is doing**. Returning early past
 * them would make the control vanish on the tap that changes it and come back
 * when the request lands, which reads as the page having lost the filter
 * rather than as it fetching one — the same rule
 * [`PlayerRankingTab`](./PlayerRankingTab.tsx) follows.
 *
 * ## Every manager is in it, including the ones on nothing
 *
 * The endpoint returns the whole league re-sorted, not the managers who have
 * scored — so a battle four matchdays in is a full table with a run of zeroes
 * at the bottom, and a battle **nobody leads yet** still has a ranking. That
 * is why the Liga page's *noch offen* rows are links too.
 *
 * Ties are **not shared**: Kickbase placed four managers on `0` as 2, 3, 4, 5,
 * and the tiebreak looks like user-id order. The place printed is its own, not
 * a number counted here, so the table says what the app says even where that
 * is arbitrary.
 *
 * ## The unit is ours; the wording is not
 *
 * `v` is a bare figure and the response says nothing about what it counts, so
 * the row's second line comes from `BATTLE_UNIT` — *Transfers*, *Siege*,
 * *Pkt*. The battle's name and its one-line description are printed exactly
 * as the API worded them, in German off the `Accept-Language` the
 * [client](../../api/client.ts) sends, which is the same rule the Liga page
 * follows and the reason both screens read like the Kickbase app rather than
 * like this codebase.
 */
export function BattleRankingTab({
  leagueId,
  viewerId,
  battle,
  onBattleChange,
  titlesById,
}: {
  leagueId: string
  viewerId: string | undefined
  /** The raw `?battle=` value — resolved by {@link selectedBattle}. */
  battle: string | null
  onBattleChange: (type: number) => void
  /**
   * League titles per manager id, for the stars on the avatars. The battle
   * payload has no `swc` of its own, so the count comes from the standings
   * the sibling tab fetches anyway — and a face here carries the same stars
   * it carries one tap away. Missing while that query is in flight, which
   * draws no star rather than one it would take back.
   */
  titlesById: Map<string, number>
}) {
  const details = useLeagueDetails(leagueId)
  const battles = details.data?.battles ?? []
  const selected = selectedBattle(battles, battle)
  const ranking = useBattleRanking(leagueId, selected?.type)

  if (details.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <ChipSkeleton />
        <SkeletonList rows={6} />
      </div>
    )
  }

  if (details.isError) {
    return (
      <ErrorState
        error={details.error}
        onRetry={() => {
          void details.refetch()
        }}
      />
    )
  }

  if (selected === undefined) {
    return (
      <EmptyState
        icon={<Award size={22} />}
        title="Keine Wettkämpfe"
        description="Diese Liga führt keine Nebenwertungen."
      />
    )
  }

  const unit = BATTLE_UNIT[selected.type]

  return (
    <div className="flex flex-col gap-3">
      <div
        className="-mx-3 no-scrollbar flex gap-2 overflow-x-auto px-3"
        role="group"
        aria-label="Wettkampf"
      >
        {battles.map((option) => {
          const Icon = BATTLE_ICON[option.type] ?? BATTLE_FALLBACK_ICON
          return (
            <FilterChip
              key={option.type}
              isActive={option.type === selected.type}
              leading={<Icon size={14} aria-hidden="true" />}
              onClick={() => {
                onBattleChange(option.type)
              }}
            >
              {option.title}
            </FilterChip>
          )
        })}
      </div>

      {/* What the battle rewards, in the API's own words — the caption for the
          column of figures under it. The chip above already names the battle,
          so repeating the name here would be a heading for a heading. */}
      {selected.description !== undefined && (
        <p className="px-0.5 text-xs text-muted">{selected.description}</p>
      )}

      {ranking.isPending ? (
        <SkeletonList rows={6} />
      ) : ranking.isError ? (
        <ErrorState
          error={ranking.error}
          onRetry={() => {
            void ranking.refetch()
          }}
        />
      ) : ranking.data.title === undefined ||
        ranking.data.managers.length === 0 ? (
        /* `title` missing means Kickbase does not know this battle at all —
           the endpoint answers 200 for any code and only leaves the name out.
           Reachable from a stale `?battle=` naming a battle the league has
           since dropped, which the chips no longer offer. */
        <EmptyState
          icon={<Award size={22} />}
          title="Keine Wertung"
          description={`Für ${selected.title} liefert Kickbase keine Rangliste.`}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {ranking.data.managers.map((manager) => (
            <ManagerRow
              key={manager.id}
              manager={manager}
              titles={titlesById.get(manager.id) ?? 0}
              unit={unit}
              leagueId={leagueId}
              isMe={manager.id === viewerId}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/** The chip row's own placeholder, so the control does not pop in. */
function ChipSkeleton() {
  return (
    <div aria-hidden="true" className="flex gap-2 overflow-hidden">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-9 w-28 shrink-0 rounded-full" />
      ))}
    </div>
  )
}

/**
 * One manager's place in the battle — **and a link to their page.**
 *
 * The [season table](../../pages/RankingPage.tsx)'s row, one figure lighter:
 * the same tight placement-and-face group, the same `du` tag, the same accent
 * outline on the viewer's own row, and the whole row as the link, because
 * every part of it is about the one manager and a list row on a phone is the
 * biggest target the page can offer. Switching tabs should feel like sorting
 * the same table by something else, not like arriving on another page.
 */
function ManagerRow({
  manager,
  titles,
  unit,
  leagueId,
  isMe,
}: {
  manager: BattleRankedManager
  titles: number
  /** Absent for a type code with no unit of ours — the figure stands alone. */
  unit: string | undefined
  leagueId: string
  isMe: boolean
}) {
  return (
    <li>
      <Link
        to={`/leagues/${leagueId}/managers/${manager.id}`}
        className={cn(
          'flex items-center gap-3 rounded-card border bg-surface px-3 py-2.5',
          'transition-colors hover:border-accent/40 hover:bg-surface-2',
          isMe ? 'border-accent/50' : 'border-line',
        )}
      >
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="nums w-6 text-center text-base font-bold text-faint">
            {placement(manager.placement)}
          </span>
          <ManagerAvatar
            manager={{ name: manager.name, image: manager.image, titles }}
            size={48}
          />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">
            {manager.name}
            {isMe && <span className="ml-1.5 text-xs text-accent">du</span>}
          </span>
        </span>

        {/* The figure, and under it what it counts — the response says only
            the number, so the unit is the one piece of copy the app supplies. */}
        <span className="shrink-0 text-right">
          <span className="nums block text-sm font-semibold text-ink">
            {points(manager.value)}
          </span>
          {unit !== undefined && (
            <span className="block text-xs text-muted">{unit}</span>
          )}
        </span>
      </Link>
    </li>
  )
}
