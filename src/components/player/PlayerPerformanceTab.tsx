import { ChevronDown, Footprints, Shirt, Volleyball } from 'lucide-react'
import { useState } from 'react'

import type { TeamSummary } from '@/api/hooks/useCompetition'
import { pointsScaleFor, type PlayerSeason } from '@/api/models'
import { PlayerMatchRow } from '@/components/player/PlayerMatchRow'
import { Drawer } from '@/components/ui/Drawer'
import { StepButton } from '@/components/ui/StepButton'
import { EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { points as formatPoints } from '@/lib/format'

/**
 * Every match of a season, from this player's side of it.
 *
 * The season picker is the header itself, following
 * [`MatchdayPicker`](../MatchdayPicker.tsx) — the thing you are looking
 * at is the thing you tap — with a [step](../ui/StepButton.tsx) either side of
 * it for the neighbouring season, which is what the control is mostly used
 * for. Seasons come back oldest first and are reversed by the hook, so this
 * opens on the running season.
 *
 * The rows are [`PlayerMatchRow`](./PlayerMatchRow.tsx), the same component the
 * Details tab uses for the handful of matches around the current matchday.
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
  // Across every season, so switching seasons does not rescale the bars.
  const pointsScale = pointsScaleFor(seasons)

  if (seasons.length === 0) {
    return (
      <EmptyState
        title="Keine Spieldaten"
        description="Für diesen Spieler liefert Kickbase keine Saisonhistorie."
      />
    )
  }

  // `seasons[0]` is the running season — the right default, and the fallback
  // for a selection that no longer resolves.
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
            <PlayerMatchRow
              match={match}
              teams={teams}
              pointsScale={pointsScale}
            />
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
  /** Newest first. */
  seasons: PlayerSeason[]
  selected: PlayerSeason
  onSelect: (id: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)

  /*
   * `seasons` is newest first, so the *older* season is the next index up.
   * The arrows are chronological regardless — left steps back in time, as on
   * the matchday picker — which is why these two are crossed over relative to
   * the array.
   */
  const index = seasons.findIndex((season) => season.id === selected.id)
  const older = index >= 0 ? seasons[index + 1] : undefined
  const newer = index > 0 ? seasons[index - 1] : undefined

  return (
    <>
      <div className="flex items-stretch gap-2">
        <StepButton
          direction="previous"
          label={older === undefined ? 'Keine frühere Saison' : older.label}
          disabled={older === undefined}
          onClick={() => {
            if (older !== undefined) onSelect(older.id)
          }}
        />

        <button
          type="button"
          onClick={() => {
            setIsOpen(true)
          }}
          aria-haspopup="dialog"
          className={cn(
            'flex min-w-0 flex-1 items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 text-left',
            'transition-colors hover:border-accent/40 hover:bg-surface-2',
          )}
        >
          <span className="min-w-0 flex-1">
            <span className="nums block truncate text-base font-bold text-ink">
              {selected.label}
            </span>
            <SeasonSummary season={selected} />
          </span>
          <ChevronDown size={20} className="shrink-0 text-faint" />
        </button>

        <StepButton
          direction="next"
          label={newer === undefined ? 'Keine spätere Saison' : newer.label}
          disabled={newer === undefined}
          onClick={() => {
            if (newer !== undefined) onSelect(newer.id)
          }}
        />
      </div>

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
                  <SeasonSummary season={season} />
                </button>
              </li>
            )
          })}
        </ul>
      </Drawer>
    </>
  )
}

/**
 * A season in one line: appearances, points, goals, assists.
 *
 * Marked rather than labelled, using the same glyphs the match rows below
 * carry — four words would not fit under the season label on a phone, and the
 * marks are the ones the reader has already learnt from the rows.
 */
function SeasonSummary({ season }: { season: PlayerSeason }) {
  return (
    <span className="nums mt-0.5 flex items-center gap-2.5 text-xs text-muted">
      <span className="flex items-center gap-1" title="Einsätze">
        <Shirt size={12} aria-hidden="true" className="text-faint" />
        {season.appearances}
      </span>
      <span className="flex items-center gap-1" title="Punkte">
        {formatPoints(season.totalPoints)} Pkt
      </span>
      <span className="flex items-center gap-1" title="Tore">
        <Volleyball size={12} aria-hidden="true" className="text-faint" />
        {season.goals}
      </span>
      <span className="flex items-center gap-1" title="Vorlagen">
        <Footprints size={12} aria-hidden="true" className="text-faint" />
        {season.assists}
      </span>
    </span>
  )
}
