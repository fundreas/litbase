import {
  ArrowLeftRight,
  Award,
  Compass,
  Crown,
  Flame,
  Hand,
  Shield,
  ShieldCheck,
  Target,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router'

import { useLeagueDetails } from '@/api/hooks/useLeague'
import {
  GAME_MODE_LABEL,
  type LeagueBattle,
  type LeagueDetails,
} from '@/api/models'
import { useAuth } from '@/auth/useAuth'
import { Avatar } from '@/components/ui/Avatar'
import { Card, CardHeader, StatTile } from '@/components/ui/Card'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useActiveLeague } from '@/league/useActiveLeague'
import { cn } from '@/lib/cn'
import { date, money } from '@/lib/format'

/**
 * **The league itself** — what it is called, when it started, the rules it
 * plays by, who is in it, and the seven side competitions running inside it.
 *
 *   /leagues/:leagueId/league
 *
 * Reached by tapping the **league card at the top of the drawer and the
 * sidebar** — the one thing on every screen that names the league and, until
 * now, went nowhere. That card used to print the budget underneath the name,
 * which was the wrong figure in the wrong place: it is the *manager's* money,
 * it is already on [Transfermarkt](./MarketPage.tsx) where it is spent, and it
 * made the league's own identity look like an account balance.
 *
 * ## Everything here is one request
 *
 * [`useLeagueDetails`](../api/hooks/useLeague.ts) →
 * `/leagues/{id}/overview?includeManagersAndBattles=true`, a ten-minute cache
 * entry the [market](./MarketPage.tsx) already holds for `upe` alone. So this
 * page usually costs **nothing**, and the parameter that carries the members'
 * names and the battles costs nothing either — the bare call would have made
 * the same round trip.
 *
 * The **crest and the name come from the league context**, not from the
 * response: the URL already resolved to a league, so the page has its identity
 * before the request lands and never flashes a nameless header.
 *
 * ## Wettkämpfe: seven faces, and that is the data
 *
 * `btls` names, for each battle, **only the manager currently leading it** —
 * no standings, no runner-up, and not even the figure that decided it. Checked
 * against a live league (2026-09-09), which is why this section is a list of
 * captioned faces rather than seven rankings: there is no second row to draw.
 *
 * Each battle's wording is **the API's own**, in German off the
 * `Accept-Language` the [client](../api/client.ts) sends, so *Transferkönig*
 * reads the way it reads in the app rather than the way this codebase would
 * have chosen to word it. Only the icon is ours, mapped from the type code —
 * with a fallback, because the codes are the published spec's and one of them
 * (`3`) has never been seen.
 *
 * A battle **nobody leads yet** keeps its row and says so. Dropping it would
 * make a league four matchdays in look as though it had fewer competitions
 * than it has.
 *
 * ## Manager: faces, not a table
 *
 * The [Rangliste](./RankingPage.tsx) is the table — placements, points, the
 * duel column. Repeating it here with the numbers stripped off would be a
 * worse copy of a page one tap away, so the members are a wrap of faces: who
 * is in this league, at a glance, each one a way into
 * [their page](./ManagerDetailPage.tsx).
 */
export function LeaguePage() {
  const { league, leagueId } = useActiveLeague()
  const { user } = useAuth()
  const { data, isPending, isError, error, refetch } =
    useLeagueDetails(leagueId)

  const header = (
    <div className="flex items-center gap-3">
      <Avatar
        src={data?.image ?? league.image}
        name={league.name}
        size={56}
        square
        className="bg-transparent"
      />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold tracking-tight text-ink">
          {data?.name ?? league.name}
        </h1>
        <p className="truncate text-xs text-muted">
          {[
            data?.competitionName,
            data?.gameMode === undefined
              ? undefined
              : GAME_MODE_LABEL[data.gameMode],
            data === undefined ? undefined : `seit ${date(data.createdAt)}`,
          ]
            .filter((part) => part !== undefined)
            .join(' · ') || 'Liga'}
        </p>
      </div>
      {data?.isAdmin === true && (
        <span className="shrink-0 rounded-full border border-accent/50 bg-accent/15 px-2 py-0.5 text-[0.6875rem] font-medium text-accent">
          Admin
        </span>
      )}
    </div>
  )

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <SkeletonList rows={6} />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ErrorState
          error={error}
          onRetry={() => {
            void refetch()
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {header}

      {/* The admin's blurb, when there is one. Their words, so it is quoted
          rather than dressed up as a subtitle of ours. */}
      {data.description !== undefined && (
        <p className="rounded-card border border-line bg-surface px-3 py-2.5 text-sm text-muted">
          {data.description}
        </p>
      )}

      <Rules details={data} />

      <Card>
        <CardHeader
          title="Wettkämpfe"
          action={
            data.battles.length === 0 ? undefined : (
              <span className="text-[0.6875rem] text-faint">
                wer gerade führt
              </span>
            )
          }
        />
        {data.battles.length === 0 ? (
          <div className="px-4 py-6">
            <EmptyState
              icon={<Award size={22} />}
              title="Keine Wettkämpfe"
              description="Diese Liga führt keine Nebenwertungen."
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {data.battles.map((battle) => (
              <li key={battle.type}>
                <BattleRow
                  battle={battle}
                  leagueId={leagueId}
                  viewerId={user?.id}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Manager" />
        {/* A league always has at least the viewer in it, so this is
            defensive rather than expected — but an empty card with nothing
            in it would read as a broken list rather than an empty one. */}
        {data.members.length === 0 && (
          <p className="px-4 py-3 text-xs text-faint">
            Keine Manager gemeldet.
          </p>
        )}
        <ul className="flex flex-wrap gap-2 p-3">
          {data.members.map((member) => (
            <li key={member.id}>
              <Link
                to={`/leagues/${leagueId}/managers/${member.id}`}
                className={cn(
                  'flex items-center gap-2 rounded-full border py-1 pr-3 pl-1',
                  'text-xs font-medium transition-colors hover:bg-surface-2',
                  member.id === user?.id
                    ? 'border-accent/50 text-accent'
                    : 'border-line text-ink',
                )}
              >
                <Avatar src={member.image} name={member.name} size={24} />
                <span className="max-w-32 truncate">{member.name ?? '—'}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * The rules, as tiles.
 *
 * `0` means *no limit* in both squad fields, which is a number that must never
 * be printed: a league advertising "0 Spieler" reads as one nobody may play
 * in. `upe` gets its exact consequence as the hint, because "erlaubt" alone
 * does not say that the floor merely moves to 90 % — see
 * [`offerRules.ts`](../lib/offerRules.ts).
 */
function Rules({ details }: { details: LeagueDetails }) {
  const limit = (value: number | undefined) =>
    value === undefined ? '–' : value === 0 ? 'ohne Limit' : String(value)

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {/* How full the league is — the one fact the Rangliste does not carry.
          A league with no cap says how many are in it and leaves it there. */}
      <StatTile
        label="Manager"
        value={String(details.memberCount)}
        hint={
          details.managerLimit === undefined || details.managerLimit === 0
            ? 'ohne Limit'
            : `von ${String(details.managerLimit)}`
        }
      />
      <StatTile
        label="Startbudget"
        value={money(details.startingBudget)}
        hint="pro Manager"
      />
      <StatTile
        label="Kader"
        value={limit(details.maxPlayers)}
        hint={details.maxPlayers === 0 ? 'Spieler' : 'Spieler max.'}
      />
      <StatTile
        label="Pro Klub"
        value={limit(details.maxPlayersPerClub)}
        hint={details.maxPlayersPerClub === 0 ? 'Spieler' : 'Spieler max.'}
      />
      <StatTile
        label="Unterbieten"
        value={details.allowsUnderpay ? 'Erlaubt' : 'Gesperrt'}
        hint={
          details.allowsUnderpay
            ? 'bis 90 % des Marktwerts'
            : 'kein Gebot unter Marktwert'
        }
      />
      <StatTile
        label="Spielmodus"
        value={
          details.gameMode === undefined
            ? '–'
            : (GAME_MODE_LABEL[details.gameMode] ??
              `Modus ${String(details.gameMode)}`)
        }
        hint={details.competitionName}
      />
    </div>
  )
}

/**
 * Battle icons by type code.
 *
 * The four position battles borrow the glyphs the rest of the app already uses
 * for a keeper, a defence, a midfield and an attack, so the row is recognisable
 * before its caption is read. An unknown code gets a medal rather than nothing:
 * `3` is missing from every payload observed, so this map is known to be
 * incomplete — see `BATTLE_LABEL` in [models](../api/models.ts).
 */
const BATTLE_ICON: Record<number, LucideIcon> = {
  1: Crown,
  2: ArrowLeftRight,
  4: Hand,
  5: Shield,
  6: Compass,
  7: Target,
  8: Flame,
}

/**
 * One battle: what it rewards, and the face of whoever is winning it.
 *
 * The row is a **link to the leader's page** when there is a leader — the name
 * is the only thing on the line that leads anywhere, and the whole row is the
 * target a thumb aims at. With nobody ahead yet it is a plain row: a link to
 * nowhere would be worse than no link.
 */
function BattleRow({
  battle,
  leagueId,
  viewerId,
}: {
  battle: LeagueBattle
  leagueId: string
  viewerId: string | undefined
}) {
  const Icon = BATTLE_ICON[battle.type] ?? ShieldCheck
  const { leader } = battle
  const isViewer = leader !== undefined && leader.id === viewerId

  const body = (
    <>
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-xl',
          leader === undefined
            ? 'bg-surface-2 text-faint'
            : 'bg-accent/15 text-accent',
        )}
      >
        <Icon size={18} aria-hidden="true" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">
          {battle.title}
        </span>
        {battle.description !== undefined && (
          <span className="block truncate text-[0.6875rem] text-faint">
            {battle.description}
          </span>
        )}
      </span>

      {leader === undefined ? (
        <span className="shrink-0 text-xs text-faint">noch offen</span>
      ) : (
        <span className="flex min-w-0 shrink-0 items-center gap-2">
          <span
            className={cn(
              'max-w-28 truncate text-xs font-medium',
              isViewer ? 'text-accent' : 'text-muted',
            )}
          >
            {leader.name}
            {isViewer && <span className="ml-1 text-accent">du</span>}
          </span>
          <Avatar src={leader.image} name={leader.name} size={32} />
        </span>
      )}
    </>
  )

  if (leader === undefined) {
    return <div className="flex items-center gap-3 px-3 py-2.5">{body}</div>
  }

  return (
    <Link
      to={`/leagues/${leagueId}/managers/${leader.id}`}
      className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-2/60"
    >
      {body}
    </Link>
  )
}
