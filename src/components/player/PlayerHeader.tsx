import { ChevronRight, House, PlaneTakeoff, Timer } from 'lucide-react'
import { useState } from 'react'

import type { TeamSummary } from '@/api/hooks/useCompetition'
import {
  availabilityLabel,
  fixtureState,
  POSITION_LABEL,
  POSITION_NAME,
  START_PROBABILITY,
  type PlayerDetail,
  type PlayerFixture,
  type PlayerMatch,
  type StartProbability,
} from '@/api/models'
import { LineupPosterDialog } from '@/components/player/LineupPosterDialog'
import { MatchEventBadge } from '@/components/player/MatchEventBadge'
import { Scoreline } from '@/components/player/PlayerMatchRow'
import { MatchRoleMark } from '@/components/player/statGlyphs'
import { StartProbabilityBadge } from '@/components/squad/StartProbabilityBadge'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'
import { kickoff as formatKickoff, points as formatPoints } from '@/lib/format'

/**
 * Who this page is about — shown above all three tabs.
 *
 * Kept out of the Details tab even though it is the player's identity: it is
 * what tells you which player you are looking at, and a market chart with no
 * name above it is a chart of nothing. The Details tab carries the numbers.
 *
 * **No back link.** The page is reached by tapping a row, and the browser's
 * own back — the system gesture on a phone, the hardware button on Android —
 * already does it. An in-page chevron duplicated that and spent the first line
 * of a small screen saying so.
 *
 * The availability chip is only rendered when there is something to say. A
 * "Fit" pill on 90% of players is decoration that trains people to ignore the
 * spot where the real warning appears.
 */
export function PlayerHeader({
  player,
  currentFixture,
  currentMatch,
  teams,
  showStartProbability,
}: {
  player: PlayerDetail
  /**
   * The player's fixture on the matchday being played **right now**, or
   * `undefined` between matchdays — the page decides, see
   * [`PlayerDetailPage`](../../pages/PlayerDetailPage.tsx).
   */
  currentFixture: PlayerFixture | undefined
  /**
   * That fixture's row from the performance history, once it has loaded. The
   * fixture comes from the profile and renders without it, so the strip never
   * waits on a second request — only the points and minutes inside it do.
   */
  currentMatch: PlayerMatch | undefined
  teams: Map<string, TeamSummary> | undefined
  /**
   * Whether the lineup-probability chip belongs here. Only the Details tab
   * asks for it: the chip is a statement about the *next* matchday, and on a
   * career points history or a market-value chart — both of which are about
   * what has already happened — it reads as one more number on the page
   * instead of the thing it is. Its poster dialog is a tap away from Details,
   * which is where someone goes to ask "does he play?".
   */
  showStartProbability: boolean
}) {
  const isFit = player.status === 0
  const probability =
    !showStartProbability || player.startProbability === undefined
      ? undefined
      : START_PROBABILITY[player.startProbability]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {/* Square, like every other player portrait in the app — the round
            treatment is reserved for manager avatars, which keeps "a person
            who plays this game" and "a person in a photo" apart at a glance. */}
        <Avatar
          src={player.image}
          name={player.lastName}
          size={72}
          square
          className="bg-surface-2"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h1 className="truncate text-xl font-bold tracking-tight text-ink">
              {player.lastName}
            </h1>
            {player.shirtNumber !== undefined && (
              <span className="nums shrink-0 text-sm font-semibold text-faint">
                #{player.shirtNumber}
              </span>
            )}
          </div>

          {/* Given name and position on one quiet line. The position is the
              abbreviation — "MF", not "Mittelfeldspieler" — because it is the
              form used on every squad row and pitch tile in the app, and the
              spelled-out name was long enough to push the given name out of a
              phone-width line. The full word stays as the title, so a hover or
              a screen reader still gets it. */}
          <div className="mt-0.5 flex items-baseline gap-2">
            {player.firstName !== undefined && (
              <p className="min-w-0 truncate text-sm text-muted">
                {player.firstName}
              </p>
            )}
            <span
              title={POSITION_NAME[player.position]}
              className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted"
            >
              {POSITION_LABEL[player.position]}
            </span>
          </div>
        </div>

        {/* The club, as a crest alone at the far right — no name beside it.
            A Bundesliga crest is the most recognisable thing about a club, and
            at this size it is read faster than its name; spelling the name out
            next to it cost a line of a phone-width header to say the same
            thing twice. The name survives as the image's alt text and as the
            initials the fallback draws when the crest fails to load. */}
        <Avatar
          src={player.teamImage}
          name={player.teamName}
          size={56}
          square
          className="shrink-0 bg-transparent"
        />
      </div>

      {(!isFit || probability !== undefined) && (
        <div className="flex flex-wrap items-center gap-2">
          {!isFit && (
            <span className="rounded-full bg-negative/15 px-2.5 py-1 text-xs font-semibold text-negative">
              {availabilityLabel(player.status)}
            </span>
          )}
          {probability !== undefined &&
            player.startProbability !== undefined && (
              <ProbabilityChip
                tier={player.startProbability}
                label={probability.label}
                player={player}
              />
            )}
        </div>
      )}

      {currentFixture !== undefined && (
        <CurrentMatchday
          fixture={currentFixture}
          match={currentMatch}
          teams={teams}
        />
      )}
    </div>
  )
}

/**
 * The lineup-probability tier, and the way into the poster it comes from.
 *
 * **A button only when there is a poster.** `plpim` is absent for an account
 * without Membership, in the off-season, and for a club nobody has assessed —
 * all of them normal, none of them an error — so the chip degrades to the
 * static label it always was rather than opening an empty dialog.
 *
 * The tier badge is the affordance. It is drawn from the very same assessment
 * as the badges inside the poster, so "tap the thing that tells you he is
 * likely to start, see the eleven he is likely to start in" needs no
 * explaining once someone has tried it — which is why the chip gains only a
 * chevron and a hover state rather than a second label saying "Aufstellung
 * ansehen".
 */
function ProbabilityChip({
  tier,
  label,
  player,
}: {
  tier: StartProbability
  label: string
  player: PlayerDetail
}) {
  const [isOpen, setIsOpen] = useState(false)
  const poster = player.lineupPoster

  const content = (
    <>
      <StartProbabilityBadge tier={tier} size={13} decorative />
      {label}
    </>
  )

  const shell =
    'flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-muted'

  if (poster === undefined) {
    return <span className={shell}>{content}</span>
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true)
        }}
        aria-haspopup="dialog"
        title="Voraussichtliche Aufstellung ansehen"
        className={cn(
          shell,
          'cursor-pointer transition-colors',
          'hover:border-accent/40 hover:bg-surface-2 hover:text-ink',
          'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        )}
      >
        {content}
        <ChevronRight size={13} aria-hidden="true" className="-mr-1 shrink-0" />
      </button>

      <LineupPosterDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        poster={poster}
        teamName={player.teamName}
        source={player.probabilitySource}
        sourceLogo={player.probabilitySourceLogo}
        updatedAt={player.probabilityUpdatedAt}
      />
    </>
  )
}

/**
 * What the player is doing on the matchday being played right now.
 *
 * In the header rather than down in the Details tab, because it is the one
 * fact that goes stale between refreshes and the one people open the page for
 * on a Saturday afternoon. It answers three questions with the same strip: has
 * he played, is he playing, and if not yet — when.
 *
 * **Only rendered while the matchday is under way.** Between matchdays the
 * strip would be a permanent fixture of the header saying nothing that the
 * Spiele card does not already say, so the page hands it a fixture only when
 * the matchday has kicked off and is not yet finished. His own club may still
 * be playing later that weekend, which is why the three states below all
 * remain reachable.
 *
 * **"Läuft" is inferred from the clock, not reported.** No observed field
 * distinguishes a match in progress: fixtures carry `mdst`, and only `0`
 * (not played) and `2` (finished) have ever been seen. So kick-off having
 * passed on an unfinished fixture is what "live" means here, the same reading
 * [`fixtureState`](../../api/models.ts) uses everywhere else. There is no live
 * minute either — Kickbase serves the minutes played only once the match is
 * over — so a running match shows its points and stays quiet about the clock.
 */
function CurrentMatchday({
  fixture,
  match,
  teams,
}: {
  fixture: PlayerFixture
  match: PlayerMatch | undefined
  teams: Map<string, TeamSummary> | undefined
}) {
  const state = fixtureState(fixture)
  const opponent = teams?.get(fixture.opponentId)
  const Venue = fixture.isHome ? House : PlaneTakeoff
  const hasPlayed = match !== undefined && match.points !== undefined
  // The profile's fixture has no outcome of its own; the performance row does,
  // and falls back to comparing the goals the profile carries.
  const outcome =
    match?.outcome ??
    (fixture.isFinished
      ? fixture.goalsFor > fixture.goalsAgainst
        ? 'win'
        : fixture.goalsFor < fixture.goalsAgainst
          ? 'loss'
          : 'draw'
      : undefined)

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-card border px-3 py-2.5',
        state === 'running'
          ? 'border-accent/40 bg-accent/10'
          : 'border-line bg-surface',
      )}
    >
      <span className="flex w-5 shrink-0 justify-center">
        <Venue
          size={14}
          aria-label={fixture.isHome ? 'Heimspiel' : 'Auswärtsspiel'}
          className={fixture.isHome ? 'text-positive' : 'text-accent'}
        />
      </span>

      <Avatar
        src={fixture.opponentImage}
        name={opponent?.name ?? fixture.opponentId}
        size={26}
        square
        className="shrink-0 bg-transparent"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="min-w-0 truncate text-sm font-semibold text-ink">
            {opponent?.name ?? `${String(fixture.day)}. Spieltag`}
          </span>
          {fixture.isFinished && (
            <Scoreline
              goalsFor={fixture.goalsFor}
              goalsAgainst={fixture.goalsAgainst}
              outcome={outcome}
            />
          )}
        </div>

        <div className="mt-0.5 flex items-center gap-1.5 text-[0.6875rem]">
          {state === 'running' ? (
            <span className="flex shrink-0 items-center gap-1 font-semibold text-accent">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              Läuft
            </span>
          ) : state === 'upcoming' ? (
            <span className="shrink-0 text-muted">
              {formatKickoff(fixture.kickoff)}
            </span>
          ) : match === undefined ? (
            <span className="shrink-0 text-faint">Beendet</span>
          ) : (
            <MatchRoleMark role={match.role} />
          )}

          {match !== undefined && match.minutes > 0 && (
            <span className="nums flex shrink-0 items-center gap-0.5 text-faint">
              <Timer size={10} aria-hidden="true" />
              {match.minutes}′
            </span>
          )}

          {match !== undefined && match.events.length > 0 && (
            <span className="flex min-w-0 items-center gap-1">
              {match.events.map((event) => (
                <MatchEventBadge key={event.kind} event={event} />
              ))}
            </span>
          )}
        </div>
      </div>

      {/* Points only once there are any. Before kick-off the slot shows the
          matchday instead of a `0` that would read as a bad performance. */}
      {hasPlayed ? (
        <span className="shrink-0 text-right">
          <span
            className={cn(
              'nums block text-lg leading-none font-bold',
              (match.points ?? 0) < 0 ? 'text-negative' : 'text-ink',
            )}
          >
            {formatPoints(match.points)}
          </span>
          <span className="text-[0.625rem] text-faint">Pkt</span>
        </span>
      ) : (
        <span className="nums shrink-0 text-right text-[0.6875rem] text-faint">
          {fixture.day}. ST
        </span>
      )}
    </div>
  )
}
