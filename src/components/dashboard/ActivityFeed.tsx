import {
  ArrowLeft,
  ArrowRight,
  Flag,
  Gift,
  MessageCircle,
  Tag,
  Trophy,
  UserMinus,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'

import { useAchievement } from '@/api/hooks/useAchievements'
import { useActivities } from '@/api/hooks/useActivities'
import { useRanking } from '@/api/hooks/useRanking'
import type { LeagueActivity, RankedManager } from '@/api/models'
import { useAuth } from '@/auth/useAuth'
import {
  AchievementDialog,
  MatchdayDialog,
  TransferDialog,
} from '@/components/dashboard/ActivityDialogs'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { nowMs } from '@/lib/clock'
import { money, moneyDelta, placement, relativeTime } from '@/lib/format'

/**
 * **The league's event log** — Kickbase's *Aktivitäten* tab, on the dashboard.
 *
 * Every entry is one thing that happened in the league: a transfer, a manager
 * arriving or leaving, a matchday scored, an achievement earned. Newest first,
 * and it goes on for as long as the league has — so the list **loads itself**
 * as it is scrolled. A sentinel at the bottom asks for the next page when it
 * comes into view, and a *Mehr laden* button stands in for it where there is
 * no `IntersectionObserver`, or when a load failed and needs a deliberate
 * retry.
 *
 * Players being **listed** on the market are not shown — they are nine entries
 * in ten and the market page is where they belong; the hook asks the API to
 * leave them out.
 *
 * Every row does one thing when tapped, and the thing depends on the kind:
 *
 *  - a **purchase** opens a sheet naming the buyer and, if the reader was
 *    bidding on the same player, what they bid;
 *  - a **sale** opens the player's page — it was a sale to Kickbase, so there
 *    is no contest to report;
 *  - an **achievement** opens a sheet with its description, reward and count;
 *  - a **matchday** goes to that matchday's duels in a duel league, and opens
 *    the matchday's manager ranking as a sheet in any other;
 *  - a manager, the bonus and the founding are read, not opened.
 *
 * Rows carry a **comment count** at the right end when Kickbase has one, left
 * of the timestamp.
 *
 * The managers on transfer rows come by **name** — the feed carries no ids or
 * avatars for them — and are matched against the standings for a face. A
 * manager who has since left the league keeps initials.
 */
export function ActivityFeed({ leagueId }: { leagueId: string }) {
  const query = useActivities(leagueId)
  const ranking = useRanking(leagueId)
  const { user } = useAuth()
  const navigate = useNavigate()
  const now = nowMs()

  const [openActivity, setOpenActivity] = useState<LeagueActivity>()

  const managersByName = useMemo(
    () =>
      new Map(
        (ranking.data?.managers ?? []).map((manager) => [
          manager.name,
          manager,
        ]),
      ),
    [ranking.data],
  )

  const activities = (query.data ?? []).filter(
    (activity) => activity.kind !== 'unknown' && activity.kind !== 'listed',
  )

  const open = (activity: LeagueActivity) => {
    if (activity.kind === 'matchday' && ranking.data?.isDuelMode === true) {
      void navigate(`/leagues/${leagueId}/duels?day=${String(activity.day)}`)
      return
    }
    setOpenActivity(activity)
  }

  return (
    <Card>
      <CardHeader title="Aktivitäten" />

      {query.isPending ? (
        <div className="flex flex-col gap-2 p-3">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : query.isError ? (
        <ErrorState
          error={query.error}
          className="py-8"
          onRetry={() => {
            void query.refetch()
          }}
        />
      ) : activities.length === 0 ? (
        <EmptyState
          className="py-8"
          title="Noch nichts passiert"
          description="Transfers, Spieltage und Erfolge erscheinen hier."
        />
      ) : (
        <>
          <ul className="divide-y divide-line">
            {activities.map((activity) => (
              <ActivityRow
                key={activity.id}
                activity={activity}
                leagueId={leagueId}
                now={now}
                managersByName={managersByName}
                onOpen={open}
              />
            ))}
          </ul>
          <LoadMore
            hasMore={query.hasNextPage}
            isLoading={query.isFetchingNextPage}
            isError={query.isFetchNextPageError}
            onLoad={() => {
              void query.fetchNextPage()
            }}
          />
        </>
      )}

      {openActivity?.kind === 'transfer' && (
        <TransferDialog
          leagueId={leagueId}
          activity={openActivity}
          manager={managersByName.get(openActivity.managerName)}
          onClose={() => {
            setOpenActivity(undefined)
          }}
        />
      )}
      {openActivity?.kind === 'achievement' && (
        <AchievementDialog
          leagueId={leagueId}
          achievementType={openActivity.achievementType}
          title={openActivity.title}
          description={openActivity.description}
          onClose={() => {
            setOpenActivity(undefined)
          }}
        />
      )}
      {openActivity?.kind === 'matchday' && (
        <MatchdayDialog
          leagueId={leagueId}
          day={openActivity.day}
          label={openActivity.label}
          viewerId={user?.id}
          onClose={() => {
            setOpenActivity(undefined)
          }}
        />
      )}
    </Card>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * The bottom of the list: a sentinel that loads the next page as it scrolls
 * into view, a spinner while it does, a button when it cannot.
 *
 * The observer fires **once per intersection**, not once per page: it is
 * re-attached whenever loading finishes, so a sentinel that is *still* on
 * screen after a short page arrives asks again. The button is always in the
 * DOM behind the sentinel for keyboard users and for the failure case — a
 * failed page must not retry itself forever from a sentinel that never left
 * the viewport.
 */
function LoadMore({
  hasMore,
  isLoading,
  isError,
  onLoad,
}: {
  hasMore: boolean
  isLoading: boolean
  isError: boolean
  onLoad: () => void
}) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (
      sentinel === null ||
      !hasMore ||
      isLoading ||
      isError ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoad()
      },
      { rootMargin: '200px 0px' },
    )
    observer.observe(sentinel)
    return () => {
      observer.disconnect()
    }
  }, [hasMore, isLoading, isError, onLoad])

  if (!hasMore) return null

  return (
    <div
      ref={sentinelRef}
      className="flex items-center justify-center border-t border-line p-3"
    >
      {isLoading ? (
        <Spinner size={18} />
      ) : (
        <Button variant="ghost" size="sm" onClick={onLoad}>
          {isError ? 'Erneut versuchen' : 'Mehr laden'}
        </Button>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function ActivityRow({
  activity,
  leagueId,
  now,
  managersByName,
  onOpen,
}: {
  activity: LeagueActivity
  leagueId: string
  now: number
  managersByName: Map<string, RankedManager>
  onOpen: (activity: LeagueActivity) => void
}) {
  /**
   * The right-hand end of every row: how many people have commented on the
   * entry, then when it happened. The count is a Kickbase feature the app does
   * not otherwise touch — there is no thread view here — so it is a marker
   * that something is being talked about, not a control, and it is absent
   * entirely at zero, which is what every entry ever probed has read.
   */
  const when = (
    <span className="flex shrink-0 items-center gap-2">
      {activity.commentCount > 0 && (
        <span
          className="flex items-center gap-0.5 text-[0.6875rem] text-faint"
          title={`${String(activity.commentCount)} Kommentare`}
        >
          <MessageCircle size={11} aria-hidden="true" />
          <span className="nums">{activity.commentCount}</span>
        </span>
      )}
      <time dateTime={activity.at} className="text-[0.6875rem] text-faint">
        {relativeTime(activity.at, now)}
      </time>
    </span>
  )

  switch (activity.kind) {
    case 'transfer':
      return (
        <TransferRow
          activity={activity}
          leagueId={leagueId}
          manager={managersByName.get(activity.managerName)}
          when={when}
          onOpen={onOpen}
        />
      )
    case 'joined':
    case 'left':
      return (
        <Row
          leading={
            activity.managerImage === undefined ? (
              <IconDisc
                icon={activity.kind === 'joined' ? UserPlus : UserMinus}
              />
            ) : (
              <Avatar
                src={activity.managerImage}
                name={activity.managerName}
                size={36}
              />
            )
          }
          title={
            <>
              <span className="font-semibold">{activity.managerName}</span>{' '}
              {activity.kind === 'joined'
                ? 'ist der Liga beigetreten'
                : 'hat die Liga verlassen'}
            </>
          }
          when={when}
        />
      )
    case 'matchday':
      return (
        <Row
          leading={<IconDisc icon={Flag} />}
          title={
            <>
              <span className="font-semibold">{activity.label}</span> ist
              beendet
            </>
          }
          detail={
            activity.placement === undefined
              ? undefined
              : `Du wurdest ${placement(activity.placement)}`
          }
          when={when}
          // A matchday the viewer sat out arrives with an empty payload and so
          // no day at all, and `?dayNumber=0` answers a ranking with every
          // per-matchday field stripped — ten managers on nought points. There
          // is nothing to open, so the row is not a button.
          onClick={
            activity.day > 0
              ? () => {
                  onOpen(activity)
                }
              : undefined
          }
        />
      )
    case 'achievement':
      return (
        <AchievementRow
          activity={activity}
          leagueId={leagueId}
          when={when}
          onOpen={onOpen}
        />
      )
    case 'bonus':
      return (
        <Row
          leading={<IconDisc icon={Gift} accent />}
          title={
            <>
              <span className="font-semibold">Auflaufprämie</span> kassiert
            </>
          }
          detail={`${money(activity.amount)} · Tag ${String(activity.day)}`}
          when={when}
        />
      )
    case 'founded':
      return (
        <Row
          leading={<IconDisc icon={Tag} />}
          title={
            <>
              Liga <span className="font-semibold">{activity.leagueName}</span>{' '}
              gegründet
            </>
          }
          when={when}
        />
      )
    case 'listed':
    case 'unknown':
      return null
  }
}

/* -------------------------------------------------------------------------- */

/**
 * A transfer, drawn like a market listing: the player's cutout flush on the
 * left, his name over the fee, and on the right the manager who dealt — with
 * an arrow that says which way the player went. **Green and rightwards** into
 * the manager's squad on a buy, **red and leftwards** out of it on a sale.
 *
 * **A purchase opens a sheet, a sale opens the player.** Only a purchase has a
 * second side worth a sheet: someone won the player, and the reader may have
 * been bidding against them — which is the one thing about a transfer that is
 * not already on the row. A sale is *to Kickbase*, there was no contest, and
 * the player's page is the useful destination.
 */
function TransferRow({
  activity,
  leagueId,
  manager,
  when,
  onOpen,
}: {
  activity: Extract<LeagueActivity, { kind: 'transfer' }>
  leagueId: string
  /** The dealing manager from the standings, when the name still resolves. */
  manager: RankedManager | undefined
  when: ReactNode
  onOpen: (activity: LeagueActivity) => void
}) {
  const isBuy = activity.direction === 'bought'
  const Arrow = isBuy ? ArrowRight : ArrowLeft

  const inner = (
    <>
      {/* Flush portrait, the market row's arrangement: the Kickbase cutouts
            are transparent PNGs, so a wash grounds the figure and the inner
            edge is masked to dissolve into the row rather than end on a
            line. */}
      <span className="flex w-14 shrink-0 self-stretch">
        <Avatar
          src={activity.playerImage}
          name={activity.playerName}
          fill
          className={cn(
            'w-full self-stretch bg-transparent',
            'bg-linear-to-t from-surface-2/60 to-transparent to-70%',
            '[mask-image:linear-gradient(to_right,#000_65%,transparent)]',
          )}
        />
      </span>

      <span className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-4 pl-1">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">
            {activity.playerName}
          </span>
          <span className="nums mt-0.5 block text-xs text-muted">
            {money(activity.price)}
          </span>
        </span>

        <span
          className="flex shrink-0 items-center gap-1"
          title={`${activity.managerName} ${isBuy ? 'kauft' : 'verkauft'}`}
        >
          <Arrow
            size={16}
            aria-hidden="true"
            className={isBuy ? 'text-positive' : 'text-negative'}
          />
          <Avatar src={manager?.image} name={activity.managerName} size={28} />
          <span className="sr-only">
            {activity.managerName} {isBuy ? 'kauft' : 'verkauft'}
          </span>
        </span>

        {when}
      </span>
    </>
  )

  const className =
    'flex w-full items-stretch text-left transition-colors hover:bg-surface-2'

  return (
    <li>
      {isBuy ? (
        <button
          type="button"
          onClick={() => {
            onOpen(activity)
          }}
          className={className}
        >
          {inner}
        </button>
      ) : (
        <Link
          to={`/leagues/${leagueId}/players/${activity.playerId}`}
          className={className}
        >
          {inner}
        </Link>
      )}
    </li>
  )
}

/**
 * An achievement: the trophy, the name, and — once the detail has answered —
 * what it paid, in green with a plus, because that is the part of an
 * achievement a manager cares about. Nothing is shown while the reward is
 * unknown or zero, rather than a placeholder.
 */
function AchievementRow({
  activity,
  leagueId,
  when,
  onOpen,
}: {
  activity: Extract<LeagueActivity, { kind: 'achievement' }>
  leagueId: string
  when: ReactNode
  onOpen: (activity: LeagueActivity) => void
}) {
  const detail = useAchievement(leagueId, activity.achievementType)
  const reward = detail.data?.reward ?? 0

  return (
    <Row
      leading={<IconDisc icon={Trophy} accent />}
      title={<span className="font-semibold">{activity.title}</span>}
      detail={reward > 0 ? moneyDelta(reward) : undefined}
      tone={reward > 0 ? 'positive' : undefined}
      when={when}
      onClick={() => {
        onOpen(activity)
      }}
    />
  )
}

/* -------------------------------------------------------------------------- */

/**
 * The plain row. With `onClick` it is a button that fills the row — a phone
 * row is a big target and every part of it means the same thing — and without
 * one it is just a row.
 */
function Row({
  leading,
  title,
  detail,
  tone,
  when,
  onClick,
}: {
  leading: ReactNode
  title: ReactNode
  detail?: ReactNode
  tone?: 'positive' | 'negative'
  when: ReactNode
  onClick?: () => void
}) {
  const body = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-snug text-ink">{title}</span>
        {detail !== undefined && (
          <span
            className={cn(
              'nums mt-0.5 block truncate text-xs text-muted',
              tone === 'positive' && 'text-positive',
              tone === 'negative' && 'text-negative',
            )}
          >
            {detail}
          </span>
        )}
      </span>
      {when}
    </>
  )

  const className = 'flex w-full items-center gap-3 px-4 py-3 text-left'

  return (
    <li>
      {onClick === undefined ? (
        <div className={className}>{body}</div>
      ) : (
        <button
          type="button"
          onClick={onClick}
          className={cn(className, 'transition-colors hover:bg-surface-2')}
        >
          {body}
        </button>
      )}
    </li>
  )
}

function IconDisc({
  icon: Icon,
  accent = false,
}: {
  icon: LucideIcon
  accent?: boolean
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
        accent ? 'bg-accent/15 text-accent' : 'bg-surface-2 text-muted',
      )}
    >
      <Icon size={16} />
    </span>
  )
}
