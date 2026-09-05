import { useMemo } from 'react'
import { Link } from 'react-router'

import { useMatchDetails } from '@/api/hooks/useMatchDetails'
import { useMatchdayFixtures, useSeasonMatch } from '@/api/hooks/useMatchday'
import { useMatchLineup } from '@/api/hooks/useMatchLineup'
import {
  fixtureState,
  timelineEventLabel,
  type MatchLineup,
  type MatchPlayer,
  type MatchTimelineEvent,
  type PositionKey,
} from '@/api/models'
import { matchPlayerFigure } from '@/components/matchday/matchPlayerFigure'
import { OwnerBadge } from '@/components/matchday/OwnerBadge'
import { ownerLabel } from '@/components/matchday/ownerLabel'
import {
  figureDescription,
  figureLabel,
  isScore,
} from '@/components/player/playerFigure'
import {
  EventGlyph,
  MatchRoleMark,
  SwapMark,
} from '@/components/player/statGlyphs'
import { Pitch } from '@/components/squad/Pitch'
import {
  cornerBadgeSize,
  fitPitchMetrics,
  ROW_ORDER,
  usePitchBox,
  type PlayerMetrics,
} from '@/components/squad/pitchMetrics'
import { Avatar } from '@/components/ui/Avatar'
import { Card, CardHeader } from '@/components/ui/Card'
import { SkeletonList } from '@/components/ui/Skeleton'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { minute as minuteLabel, points } from '@/lib/format'

/**
 * The club's running match, from **your league's** point of view.
 *
 * Only mounted while one of the club's fixtures is actually being played — the
 * [page](../../pages/TeamDetailPage.tsx) redirects to the Übersicht otherwise,
 * the same arrangement the squad page's Live tab uses, so everything here can
 * assume there is a match to show.
 *
 * The full match — both sides, the timeline, the ranking — already has a page
 * of its own at [`/matchday/:matchId`](../../pages/MatchDetailPage.tsx), and
 * this tab deliberately does **not** reproduce it. What it adds is the half
 * that page cannot emphasise, because it belongs to two clubs at once:
 *
 *  1. **Where this club's points are going.** Every player on the pitch is
 *     somebody's in your league, or nobody's, and the card at the top adds the
 *     eleven up per manager. *Bayern are producing 214 points right now, and 89
 *     of them are Andreas's* is not a fact any football app can state, and it
 *     is the single most interesting thing on a Saturday afternoon.
 *  2. **This club's eleven alone**, at the size a whole screen allows. The
 *     match page has to fit twenty-two portraits into eight bands; here there
 *     are four, so the portraits are twice the size and the owner badges are
 *     legible rather than implied.
 *  3. **This club's events**, unmixed with the opponent's.
 *
 * ## What it costs
 *
 * The same fan-out the match page's lineup tab pays — roughly 36 per-player
 * requests plus one per manager, polling at
 * [the live rate](../../api/polling.ts) while the match runs — and it is the
 * same cache entries, so a reader who has come from the match page pays
 * nothing. It goes through [`useMatchLineup`](../../api/hooks/useMatchLineup.ts)
 * rather than assembling its own, which is what guarantees the points, the
 * ownership and the substitutions cannot disagree between the two screens.
 */
export function TeamLiveTab({
  matchId,
  teamId,
  teamName,
  leagueId,
  competitionId,
  viewerId,
}: {
  matchId: string
  teamId: string
  teamName: string | undefined
  leagueId: string
  competitionId: string
  viewerId: string | undefined
}) {
  const match = useSeasonMatch(competitionId, matchId)
  const detail = useMatchDetails(match.data)
  const fixtures = useMatchdayFixtures(competitionId, match.data?.day)

  const state = match.data === undefined ? 'upcoming' : fixtureState(match.data)
  const lineup = useMatchLineup(
    leagueId,
    match.data?.day,
    detail.data,
    state,
    fixtures.data,
    viewerId,
  )

  if (match.isError || detail.isError) {
    return (
      <ErrorState
        error={match.error ?? detail.error}
        onRetry={() => {
          void match.refetch()
          void detail.refetch()
        }}
      />
    )
  }

  if (lineup === undefined || detail.data === undefined) {
    return <SkeletonList rows={6} />
  }

  /*
   * Which half of the fixture is this club's. The match payload is
   * home-and-away and knows nothing about whose page it is on, so the side is
   * resolved by id — never by `isHome` on some fixture, which would be a second
   * source of the same fact and free to disagree with this one.
   */
  const isHome = detail.data.home.id === teamId
  const side: MatchLineup = isHome ? lineup.home : lineup.away
  const opponent = isHome ? detail.data.away : detail.data.home

  const events = detail.data.events.filter((event) => event.teamId === teamId)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <LeagueYield
        lineup={side}
        isPending={lineup.isPending}
        teamName={teamName ?? side.team.symbol}
      />

      <SidePitch lineup={side} leagueId={leagueId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Bench lineup={side} leagueId={leagueId} />
        <EventList
          events={events}
          teamName={teamName ?? side.team.symbol}
          opponentName={opponent.name ?? opponent.symbol}
          matchId={matchId}
          leagueId={leagueId}
        />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Where the points are going                                                 */
/* -------------------------------------------------------------------------- */

/** One manager's take from this club's players in this match. */
interface ManagerYield {
  managerId: string
  name: string
  image?: string
  isViewer: boolean
  points: number
  players: number
}

/**
 * **Who in your league is collecting this club's points**, best first.
 *
 * The card the tab exists for. A live Bundesliga match is a public fact; which
 * of your rivals is quietly banking 200 points off it is not, and no screen in
 * the official app answers it either.
 *
 * Three rules make the arithmetic honest:
 *
 *  - **Substitutes count.** A player who came on and scored did so for whoever
 *    owns him, and leaving the bench out would understate exactly the manager
 *    who got lucky with a substitution.
 *  - **An unowned player is not a row.** The free agents' points are real but
 *    they are nobody's, so they sit in the club total and out of the list —
 *    which is what makes the difference between the two figures meaningful.
 *  - **A player with no figure yet contributes nothing**, rather than a zero.
 *    The fan-out lands one player at a time, so every total here is climbing;
 *    the spinner says so rather than the numbers pretending to be final.
 */
function LeagueYield({
  lineup,
  isPending,
  teamName,
}: {
  lineup: MatchLineup
  isPending: boolean
  teamName: string
}) {
  /*
   * Rebuilt every render, deliberately — the lineup behind it is reassembled
   * by `useMatchLineup` as each player's points land, so a memo keyed on it
   * would never hit and one keyed on anything smaller would be a dependency
   * list that lies. The same trade-off the match ranking and the duel rosters
   * document, over twenty-odd additions on a view that re-renders once every
   * ten seconds.
   */
  const byManager = new Map<string, ManagerYield>()
  let total = 0

  for (const player of [...lineup.starters, ...lineup.substitutes]) {
    if (player.points === undefined) continue
    total += player.points

    const owner = player.owner
    if (owner === undefined) continue

    const entry = byManager.get(owner.id) ?? {
      managerId: owner.id,
      name: owner.name,
      image: owner.image,
      isViewer: owner.isViewer,
      points: 0,
      players: 0,
    }
    entry.points += player.points
    entry.players += 1
    byManager.set(owner.id, entry)
  }

  const yields = [...byManager.values()].sort(
    (a, b) => b.points - a.points || a.name.localeCompare(b.name),
  )

  return (
    <Card>
      <CardHeader
        title="Punkte an deine Liga"
        action={
          <span className="nums flex items-center gap-2 text-xs text-muted">
            {isPending && <Spinner size={12} />}
            <span title={`${teamName} insgesamt`}>{points(total)} gesamt</span>
          </span>
        }
      />

      {yields.length === 0 ? (
        <p className="px-4 py-4 text-center text-sm text-muted">
          {isPending
            ? 'Punkte werden geladen …'
            : `Kein Spieler von ${teamName} gehört jemandem in deiner Liga.`}
        </p>
      ) : (
        <ol className="divide-y divide-line">
          {yields.map((entry) => (
            <li
              key={entry.managerId}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2',
                entry.isViewer && 'bg-accent/5',
              )}
            >
              <Avatar src={entry.image} name={entry.name} size={28} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {entry.name}
                  {entry.isViewer && (
                    <span className="ml-1.5 text-xs text-accent">du</span>
                  )}
                </p>
                <p className="nums truncate text-[0.625rem] text-faint">
                  {entry.players === 1
                    ? '1 Spieler'
                    : `${String(entry.players)} Spieler`}
                </p>
              </div>
              <span
                className={cn(
                  'nums shrink-0 text-sm font-semibold',
                  entry.isViewer ? 'text-accent' : 'text-ink',
                )}
              >
                {points(entry.points)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/* The eleven                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * This club's eleven, on a pitch of its own.
 *
 * **Four bands, not eight** — the difference from the
 * [match lineup](../matchday/MatchLineupTab.tsx), and the reason this view is
 * worth having alongside it. One eleven on a phone screen gets portraits at
 * roughly twice the size two elevens do, which is what turns the owner badge
 * from a 12px suggestion into something a reader can identify without hovering.
 *
 * The arrangement is [`useMatchLineup`](../../api/hooks/useMatchLineup.ts)'s,
 * so the pitch follows the substitutions while the match runs exactly as the
 * match page's does — one place decides who is on the grass, and the two
 * screens cannot disagree about it.
 */
function SidePitch({
  lineup,
  leagueId,
}: {
  lineup: MatchLineup
  leagueId: string
}) {
  const { ref, box } = usePitchBox()

  const metrics = useMemo(
    () =>
      fitPitchMetrics(
        box,
        Math.max(
          1,
          ...ROW_ORDER.map((position) => countAt(lineup.starters, position)),
        ),
        { plate: 'points' },
      ),
    [box, lineup.starters],
  )

  const unplaced = lineup.starters.filter(
    (player) => player.position === undefined,
  ).length

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <Pitch className="min-h-[22rem] flex-1">
        <div ref={ref} className="grid min-h-0 flex-1 grid-rows-4 px-2 py-3">
          {lineup.starters.length === 0 ? (
            /* Kickbase publishes the team sheets around an hour before
               kick-off; until then the payload's arrays are simply empty. */
            <p className="row-span-4 flex items-center justify-center px-6 text-center text-sm font-medium text-white/80">
              Die Aufstellung ist noch nicht veröffentlicht.
            </p>
          ) : (
            ROW_ORDER.map((position) => (
              <PitchBand
                key={position}
                players={lineup.starters.filter(
                  (player) => player.position === position,
                )}
                metrics={metrics}
                leagueId={leagueId}
              />
            ))
          )}
        </div>
      </Pitch>

      {unplaced > 0 && (
        <p className="px-0.5 text-xs text-muted">
          {unplaced === 1
            ? '1 Spieler ohne Position wird nicht auf dem Feld gezeigt'
            : `${String(unplaced)} Spieler ohne Position werden nicht auf dem Feld gezeigt`}
        </p>
      )}
    </div>
  )
}

function countAt(players: MatchPlayer[], position: PositionKey): number {
  return players.filter((player) => player.position === position).length
}

function PitchBand({
  players,
  metrics,
  leagueId,
}: {
  players: MatchPlayer[]
  metrics: PlayerMetrics
  leagueId: string
}) {
  return (
    /* `flex-nowrap` + `overflow-hidden`, as on every other pitch in the app:
       wrapping turns width pressure into height, which feeds back into the
       sizing and oscillates. The fit already guarantees the busiest band fits. */
    <div className="flex min-h-0 flex-nowrap items-center justify-center gap-1 overflow-hidden">
      {players.map((player) => (
        <PitchPlayer
          key={player.id}
          player={player}
          metrics={metrics}
          leagueId={leagueId}
        />
      ))}
    </div>
  )
}

/**
 * A portrait, its points plate, and who owns him.
 *
 * The same three-part card the match lineup draws, with the same corner
 * assignments — owner top-left, swap arrow top-right — so a reader who has
 * learned one pitch has learned this one. The whole sentence rides as the
 * tooltip and the accessible name, which is the one place the width is free.
 */
function PitchPlayer({
  player,
  metrics,
  leagueId,
}: {
  player: MatchPlayer
  metrics: PlayerMetrics
  leagueId: string
}) {
  const figure = matchPlayerFigure(player)
  const label = playerLabel(player)
  const swap =
    player.role === undefined
      ? undefined
      : player.role === 'substitutedIn'
        ? ('in' as const)
        : ('out' as const)

  return (
    <Link
      to={`/leagues/${leagueId}/players/${player.id}`}
      title={label}
      aria-label={label}
      style={{ width: metrics.width }}
      className="flex shrink-0 flex-col items-center rounded-lg p-1 transition-colors hover:bg-black/20"
    >
      <span className="relative">
        <Avatar
          src={player.image}
          name={player.name}
          size={metrics.avatar}
          className="ring-2 ring-white/75"
        />
        {player.owner !== undefined && (
          <OwnerBadge
            owner={player.owner}
            size={cornerBadgeSize(metrics.avatar)}
            onImage
            className="absolute -top-0.5 -left-0.5"
          />
        )}
        {swap !== undefined && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full bg-black/75 p-0.5"
          >
            <SwapMark
              direction={swap}
              size={Math.round(cornerBadgeSize(metrics.avatar) * 0.7)}
            />
          </span>
        )}
      </span>

      {/* Name **and** points, where the match page's plate carries only the
          number: four bands leave the height for a second line, and the name
          is what makes a club's own eleven readable rather than a grid of
          faces. */}
      <span
        aria-hidden="true"
        style={{
          width: metrics.plateWidth,
          marginTop: -metrics.plateOverlap,
          fontSize: metrics.nameFontSize,
        }}
        className="relative flex flex-col items-center rounded bg-black/70 px-1 py-0.5 leading-tight"
      >
        <span className="max-w-full truncate font-semibold text-white">
          {player.name}
        </span>
        <span
          className={cn(
            'nums max-w-full truncate font-bold',
            isScore(figure) ? 'text-accent' : 'text-white/55',
          )}
        >
          {figureLabel(figure)}
        </span>
      </span>
    </Link>
  )
}

/**
 * The full sentence a portrait cannot draw.
 *
 * A plate is a name and a number; the owner is a 20px photograph and the state
 * of the score is a colour. So the tooltip and the accessible name carry the
 * lot, worded by [`ownerLabel`](../matchday/ownerLabel.ts) so the badge and the
 * sentence describing it cannot say different things.
 */
function playerLabel(player: MatchPlayer): string {
  const parts = [
    `${player.name}: ${figureDescription(matchPlayerFigure(player))}`,
  ]
  if (player.owner !== undefined) parts.push(ownerLabel(player.owner))
  return parts.join(' · ')
}

/* -------------------------------------------------------------------------- */
/* Bench and events                                                           */
/* -------------------------------------------------------------------------- */

/** The club's substitutes, each with its owner and its figure. */
function Bench({
  lineup,
  leagueId,
}: {
  lineup: MatchLineup
  leagueId: string
}) {
  return (
    <Card>
      <CardHeader title="Bank" />

      {lineup.substitutes.length === 0 ? (
        <p className="px-4 py-4 text-center text-sm text-muted">
          Keine Ersatzspieler gemeldet.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {lineup.substitutes.map((player) => {
            const figure = matchPlayerFigure(player)
            return (
              <li key={player.id}>
                <Link
                  to={`/leagues/${leagueId}/players/${player.id}`}
                  title={playerLabel(player)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 transition-colors hover:bg-surface-2/60',
                    // Dimmed as a set, but never a player who actually came on.
                    player.role === undefined && 'opacity-75',
                  )}
                >
                  <Avatar src={player.image} name={player.name} size={24} />
                  <span className="min-w-0 flex-1 truncate text-xs text-ink">
                    {player.name}
                  </span>
                  {player.owner !== undefined && (
                    <OwnerBadge owner={player.owner} size={16} />
                  )}
                  {player.role !== undefined && (
                    <MatchRoleMark role={player.role} />
                  )}
                  <span
                    className={cn(
                      'nums shrink-0 text-xs font-semibold',
                      isScore(figure) ? 'text-ink' : 'text-faint',
                    )}
                  >
                    {figureLabel(figure)}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

/**
 * What **this club** has done, newest first.
 *
 * A single column rather than the match page's two-sided spine, because here
 * there is only one side: the opponent's goals are the other half of a
 * scoreline the header already carries, and mixing them in would make the list
 * answer a question this tab is not asking. The card names the fixture and
 * links through for the full timeline.
 */
function EventList({
  events,
  teamName,
  opponentName,
  matchId,
  leagueId,
}: {
  events: MatchTimelineEvent[]
  teamName: string
  opponentName: string
  matchId: string
  leagueId: string
}) {
  return (
    <Card>
      <CardHeader
        title="Ereignisse"
        action={
          <Link
            to={`/leagues/${leagueId}/matchday/${matchId}`}
            className="text-xs font-medium text-accent hover:underline"
          >
            Ganzes Spiel
          </Link>
        }
      />

      {events.length === 0 ? (
        <EmptyState
          title={`Noch nichts von ${teamName}`}
          description={`Gegen ${opponentName} ist für diesen Klub bisher nichts passiert.`}
          className="py-8"
        />
      ) : (
        <ol className="divide-y divide-line">
          {events.map((event, index) => (
            <li
              key={`${String(event.minute)}-${event.playerId ?? String(index)}-${event.kind}`}
              className="flex items-center gap-2.5 px-3 py-2"
            >
              <span className="nums w-8 shrink-0 text-right text-xs font-semibold text-muted">
                {minuteLabel(event.minute)}
              </span>
              <span className="flex w-4 shrink-0 justify-center">
                {event.kind === 'substitution' ? (
                  /* The feed spells a departure `off` and the mark spells it
                     `out` — the same translation the match timeline makes. */
                  <SwapMark
                    direction={event.swap === 'off' ? 'out' : 'in'}
                    size={13}
                  />
                ) : (
                  <EventGlyph kind={event.kind} size={14} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">
                  {event.playerName ?? '—'}
                </p>
                <p className="truncate text-[0.625rem] text-faint">
                  {timelineEventLabel(event.kind)}
                  {event.relatedName !== undefined && ` · ${event.relatedName}`}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
