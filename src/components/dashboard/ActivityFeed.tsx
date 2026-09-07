import {
  Flag,
  Gift,
  Tag,
  Trophy,
  UserMinus,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router'

import { useActivities } from '@/api/hooks/useActivities'
import type { LeagueActivity } from '@/api/models'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { nowMs } from '@/lib/clock'
import { money, placement, relativeTime } from '@/lib/format'

/**
 * **The league's event log** — Kickbase's *Aktivitäten* tab, on the dashboard.
 *
 * Every entry is one thing that happened in the league: a player put up for
 * sale, a transfer, a manager arriving or leaving, a matchday scored, an
 * achievement earned. Newest first, and it goes on for as long as the league
 * has — so the list **loads itself** as it is scrolled. A sentinel at the
 * bottom asks for the next page when it comes into view, and a *Mehr laden*
 * button stands in for it where there is no `IntersectionObserver`, or when
 * a load failed and needs a deliberate retry.
 *
 * The rows are read, not acted on: the one tappable thing is a player, who
 * opens his page, because "who is this Bischof who just went up for 18 Mio."
 * is the question a listing raises. Managers, matchdays and achievements have
 * no page of their own to go to.
 *
 * Entries the app cannot decode are dropped rather than rendered as a code —
 * see `LeagueActivity`.
 */
export function ActivityFeed({ leagueId }: { leagueId: string }) {
  const query = useActivities(leagueId)
  const now = nowMs()

  const activities = (query.data ?? []).filter(
    (activity) => activity.kind !== 'unknown',
  )

  return (
    <Card>
      <CardHeader title="Aktivitäten" />

      {query.isPending ? (
        <div className="flex flex-col gap-2 p-3">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
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
}: {
  activity: LeagueActivity
  leagueId: string
  now: number
}) {
  const when = (
    <time
      dateTime={activity.at}
      className="shrink-0 pt-0.5 text-[0.6875rem] text-faint"
    >
      {relativeTime(activity.at, now)}
    </time>
  )

  switch (activity.kind) {
    case 'listed':
      return (
        <Row
          leading={
            <PlayerPortrait
              leagueId={leagueId}
              playerId={activity.playerId}
              name={activity.playerName}
              image={activity.playerImage}
            />
          }
          title={
            <>
              <PlayerLink
                leagueId={leagueId}
                playerId={activity.playerId}
                name={activity.playerName}
              />{' '}
              steht zum Verkauf
            </>
          }
          detail={money(activity.marketValue)}
          when={when}
        />
      )
    case 'transfer':
      return (
        <Row
          leading={
            <PlayerPortrait
              leagueId={leagueId}
              playerId={activity.playerId}
              name={activity.playerName}
              image={activity.playerImage}
            />
          }
          title={
            <>
              <span className="font-semibold">{activity.managerName}</span>{' '}
              {activity.direction === 'bought' ? 'kauft' : 'verkauft'}{' '}
              <PlayerLink
                leagueId={leagueId}
                playerId={activity.playerId}
                name={activity.playerName}
              />
            </>
          }
          detail={money(activity.price)}
          tone={activity.direction === 'bought' ? 'positive' : 'negative'}
          when={when}
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
        />
      )
    case 'achievement':
      return (
        <Row
          leading={<IconDisc icon={Trophy} accent />}
          title={
            <>
              Erfolg: <span className="font-semibold">{activity.title}</span>
            </>
          }
          detail={activity.description}
          when={when}
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
    case 'unknown':
      return null
  }
}

/* -------------------------------------------------------------------------- */

function Row({
  leading,
  title,
  detail,
  tone,
  when,
}: {
  leading: ReactNode
  title: ReactNode
  detail?: ReactNode
  tone?: 'positive' | 'negative'
  when: ReactNode
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      {leading}
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-ink">{title}</p>
        {detail !== undefined && (
          <p
            className={cn(
              'nums mt-0.5 truncate text-xs text-muted',
              tone === 'positive' && 'text-positive',
              tone === 'negative' && 'text-negative',
            )}
          >
            {detail}
          </p>
        )}
      </div>
      {when}
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

/**
 * The portrait, opening the player's page. The transfer-market icon is not
 * used here — the Kickbase cutout says "a player" better than a tag does, and
 * shows *which* one.
 */
function PlayerPortrait({
  leagueId,
  playerId,
  name,
  image,
}: {
  leagueId: string
  playerId: string
  name: string
  image: string | undefined
}) {
  return (
    <Link
      to={`/leagues/${leagueId}/players/${playerId}`}
      aria-label={`${name} öffnen`}
      tabIndex={-1}
      className="shrink-0 transition-opacity hover:opacity-80"
    >
      <Avatar src={image} name={name} size={36} className="bg-surface-2" />
    </Link>
  )
}

function PlayerLink({
  leagueId,
  playerId,
  name,
}: {
  leagueId: string
  playerId: string
  name: string
}) {
  return (
    <Link
      to={`/leagues/${leagueId}/players/${playerId}`}
      className="font-semibold hover:underline"
    >
      {name}
    </Link>
  )
}
