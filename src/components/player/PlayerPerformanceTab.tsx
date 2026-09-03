import { ChevronDown, House, PlaneTakeoff } from 'lucide-react'
import { useState } from 'react'

import type { TeamSummary } from '@/api/hooks/useCompetition'
import {
  didPlay,
  MATCH_ROLE_LABEL,
  type MatchOutcome,
  type PlayerMatch,
  type PlayerMatchRole,
  type PlayerSeason,
} from '@/api/models'
import { MatchEventBadge } from '@/components/player/MatchEventBadge'
import { Avatar } from '@/components/ui/Avatar'
import { Drawer } from '@/components/ui/Drawer'
import { EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { points as formatPoints, weekdayDate } from '@/lib/format'

/** One letter per result, the way a form guide reads. */
const OUTCOME_LABEL: Record<MatchOutcome, string> = {
  win: 'S',
  draw: 'U',
  loss: 'N',
}

const OUTCOME_CLASS: Record<MatchOutcome, string> = {
  win: 'bg-positive/20 text-positive',
  draw: 'bg-surface-2 text-muted',
  loss: 'bg-negative/20 text-negative',
}

/**
 * Only the roles worth naming on a row get a colour. A start is the default
 * and says nothing; the two substitution states and the two ways of missing a
 * match are what a reader is scanning for.
 */
const ROLE_CLASS: Record<PlayerMatchRole, string> = {
  started: 'text-faint',
  substitutedOff: 'text-warning',
  substitutedIn: 'text-accent',
  substitutedInAndOff: 'text-accent',
  didNotPlay: 'text-faint',
  injured: 'text-negative',
  upcoming: 'text-faint',
}

/**
 * Every match of a season, from this player's side of it.
 *
 * The season picker is the header itself, following the
 * [matchday picker](../duels/MatchdayPicker.tsx) — the thing you are looking
 * at is the thing you tap. Only seasons the player actually appeared in are
 * offered, because the API returns one entry per season of the *competition*
 * and a career list padded with empty years is noise.
 */
export function PlayerPerformanceTab({
  seasons,
  teams,
}: {
  /** Newest first. */
  seasons: PlayerSeason[]
  teams: Map<string, TeamSummary> | undefined
}) {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)

  if (seasons.length === 0) {
    return (
      <EmptyState
        title="Keine Spieldaten"
        description="Für diesen Spieler liefert Kickbase keine Saisonhistorie."
      />
    )
  }

  // `seasons[0]` is the running season — the right default, and the fallback
  // for a `?season=` that no longer resolves.
  const selected =
    seasons.find((season) => season.id === selectedId) ?? seasons[0]
  if (selected === undefined) return null

  return (
    <div className="flex flex-col gap-3">
      <SeasonPicker
        seasons={seasons}
        selected={selected}
        onSelect={setSelectedId}
      />

      <ul className="flex flex-col gap-1.5">
        {selected.matches.map((match) => (
          <li key={match.matchId}>
            <MatchRow match={match} teams={teams} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function SeasonPicker({
  seasons,
  selected,
  onSelect,
}: {
  seasons: PlayerSeason[]
  selected: PlayerSeason
  onSelect: (id: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true)
        }}
        aria-haspopup="dialog"
        className={cn(
          'flex w-full items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 text-left',
          'transition-colors hover:border-accent/40 hover:bg-surface-2',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="nums block truncate text-base font-bold text-ink">
            {selected.label}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted">
            <SeasonSummary season={selected} />
          </span>
        </span>
        <ChevronDown size={20} className="shrink-0 text-faint" />
      </button>

      <Drawer
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Saison wählen"
        side="right"
      >
        <ul className="flex flex-col gap-1">
          {seasons.map((season) => {
            const isSelected = season.id === selected.id
            return (
              <li key={season.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(season.id)
                    setIsOpen(false)
                  }}
                  aria-current={isSelected ? 'true' : undefined}
                  className={cn(
                    'flex min-h-11 w-full flex-col justify-center rounded-xl px-3 py-2 text-left transition-colors',
                    isSelected
                      ? 'bg-accent/15 text-accent'
                      : 'text-muted hover:bg-surface-2 hover:text-ink',
                  )}
                >
                  <span className="nums text-sm font-semibold">
                    {season.label}
                  </span>
                  <span className="mt-0.5 text-xs text-faint">
                    {season.competition} · <SeasonSummary season={season} />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </Drawer>
    </>
  )
}

function SeasonSummary({ season }: { season: PlayerSeason }) {
  return (
    <>
      {season.appearances} Einsätze · {formatPoints(season.totalPoints)} Pkt ·{' '}
      {season.goals} T / {season.assists} V
    </>
  )
}

/**
 * One fixture: who against, how it ended, and what the player did in it.
 *
 * Points read `–` rather than `0` for a match the player took no part in.
 * Printing `0` would claim they were on the pitch and scored nothing, which is
 * a different — and much worse — thing to be told about your striker.
 */
function MatchRow({
  match,
  teams,
}: {
  match: PlayerMatch
  teams: Map<string, TeamSummary> | undefined
}) {
  const opponent = teams?.get(match.opponentId)
  const Icon = match.isHome ? House : PlaneTakeoff
  const played = didPlay(match.role)

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-card border border-line bg-surface px-3 py-2',
        // A fixture still to come is a placeholder, not a result.
        !match.isFinished && 'opacity-60',
      )}
    >
      <span className="nums w-6 shrink-0 text-xs text-faint">{match.day}.</span>

      <span className="flex w-5 shrink-0 justify-center">
        <Icon
          size={13}
          aria-label={match.isHome ? 'Heimspiel' : 'Auswärtsspiel'}
          className={match.isHome ? 'text-positive' : 'text-accent'}
        />
      </span>

      <Avatar
        src={match.opponentImage}
        name={opponent?.name ?? match.opponentId}
        size={22}
        square
        className="shrink-0 bg-transparent"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="min-w-0 truncate text-sm font-medium text-ink">
            {opponent?.name ?? '–'}
          </span>
          {match.outcome !== undefined && (
            <span
              className={cn(
                'shrink-0 rounded px-1 text-[0.625rem] font-bold',
                OUTCOME_CLASS[match.outcome],
              )}
              title={
                match.outcome === 'win'
                  ? 'Sieg'
                  : match.outcome === 'draw'
                    ? 'Unentschieden'
                    : 'Niederlage'
              }
            >
              {OUTCOME_LABEL[match.outcome]}
            </span>
          )}
          {match.isFinished && (
            <span className="nums shrink-0 text-xs text-muted">
              {match.goalsFor}:{match.goalsAgainst}
            </span>
          )}
        </div>

        <div className="mt-0.5 flex items-center gap-1.5 text-[0.6875rem]">
          <span className={cn('shrink-0 font-medium', ROLE_CLASS[match.role])}>
            {match.isFinished
              ? MATCH_ROLE_LABEL[match.role]
              : weekdayDate(match.kickoff)}
          </span>
          {played && (
            <span className="nums shrink-0 text-faint">{match.minutes}′</span>
          )}
          {match.events.length > 0 && (
            <span className="flex min-w-0 items-center gap-1">
              {match.events.map((event) => (
                <MatchEventBadge key={event.kind} event={event} />
              ))}
            </span>
          )}
        </div>
      </div>

      <span
        className={cn(
          'nums shrink-0 text-sm font-bold',
          match.points === undefined
            ? 'text-faint'
            : match.points < 0
              ? 'text-negative'
              : 'text-ink',
        )}
      >
        {match.points === undefined ? '–' : formatPoints(match.points)}
      </span>
    </div>
  )
}
