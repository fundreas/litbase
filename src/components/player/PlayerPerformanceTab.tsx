import { ChevronDown, Footprints, Shirt, Volleyball } from 'lucide-react'
import { useState } from 'react'

import type { TeamSummary } from '@/api/hooks/useCompetition'
import { breakdownFixture } from '@/api/hooks/usePlayerMatchEvents'
import {
  pointsScaleFor,
  type PlayerMatch,
  type PlayerSeason,
  type TeamFixture,
} from '@/api/models'
import { PlayerMatchEventsDialog } from '@/components/player/PlayerMatchEventsDialog'
import { PlayerMatchRow } from '@/components/player/PlayerMatchRow'
import { ExpectedPointsDialog } from '@/components/squad/ExpectedPointsDialog'
import { usePointcastPrediction } from '@/components/squad/useExpectedPointsView'
import { Drawer } from '@/components/ui/Drawer'
import { StepButton } from '@/components/ui/StepButton'
import { EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import {
  useAllExpectedPoints,
  type ExpectedPointsEntry,
} from '@/lib/expectedPoints'
import { points as formatPoints } from '@/lib/format'
import { useHashModal } from '@/lib/useHashModal'

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
 *
 * **Tapping a match he played opens its
 * [action breakdown](./PlayerMatchEventsDialog.tsx)** — every scoring action
 * Kickbase credited him with in that fixture, and what each was worth. This is
 * the tab it belongs on: a season of point totals is a list of unanswered
 * questions, and each row now has its answer one tap behind it.
 *
 * **The archive is reachable too.** The breakdown endpoint takes a `seasonId`
 * alongside the matchday, so a 2019 match answers as readily as last Saturday's
 * — the `seasonId` is passed for every season but the running one, which the
 * endpoint already defaults to. The one thing an archived season does not get
 * is the header's link to the match page, which can only resolve a fixture from
 * the current season.
 *
 * ## The other half of the tab: the matches still to come
 *
 * A season list is not only a record. The fixtures below today are the ones a
 * reader can still do something about, and they now carry
 * **[expected points](../squad/ExpectedPointsDialog.tsx)** in the column where
 * the dash was — and **tapping one enters his own figure**, against that
 * matchday, from the one screen that shows a player's whole run of fixtures at
 * once. It is the same sheet the Kader opens from a crest, filed under the same
 * `matchday → playerId → points`, so a guess made here is the guess the squad
 * page shows.
 *
 * **As far as the model reaches, and no further.** The
 * [pointcast](../../api/hooks/usePointcast.ts) publishes one matchday — the
 * coming one — so exactly one upcoming row can carry a prediction; the rest
 * carry the reader's own guesses, which the store holds for every matchday at
 * once. A row with neither keeps its dash rather than inventing a number.
 */
export function PlayerPerformanceTab({
  seasons,
  teams,
  playerId,
  playerName,
  leagueId,
}: {
  /** Newest first. */
  seasons: PlayerSeason[]
  teams: Map<string, TeamSummary> | undefined
  playerId: string
  playerName: string
  leagueId: string | undefined
}) {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  /**
   * Which match's breakdown is open — `#match:<matchId>`, so a refresh reopens
   * it and the back gesture closes it. See
   * [`useHashModal`](../../lib/useHashModal.ts).
   *
   * Looked up in the **selected** season only, which the URL does not carry: a
   * season is a preference like the Kader's layout, not a place. So a hash
   * kept from a season nobody has picked back up opens nothing, which is the
   * same answer this tab gives for any match it cannot find a row for.
   */
  const breakdown = useHashModal('match')
  /**
   * Which matchday's expected-points sheet is open — `#expected:<matchday>`,
   * a sibling of the breakdown's hash and keyed by the matchday rather than by
   * a player, because on this page the player is the page and the matchdays
   * are the rows. (The Kader's sheet is `#expected:<playerId>` for the mirror
   * reason; the two never share a screen.)
   */
  const expectedSheet = useHashModal('expected')
  // Across every season, so switching seasons does not rescale the bars.
  const pointsScale = pointsScaleFor(seasons)

  /**
   * Every matchday's guesses, for every player — indexed per row below.
   *
   * The whole store rather than one matchday's: this list spans a season, and
   * the alternative is a hook per row. It costs one subscription and an
   * object lookup.
   */
  const guesses = useAllExpectedPoints()

  // `seasons[0]` is the running season — the right default, and the fallback
  // for a selection that no longer resolves. Resolved **above** the empty
  // check, because the prediction below it is a hook and hooks cannot sit
  // behind an early return.
  const selected =
    seasons.find((season) => season.id === selectedId) ?? seasons[0]
  // The running season is the only one whose match ids the match page can
  // resolve, and so the only one whose breakdown header links — and the only
  // one a guess can belong to, since guesses are filed under a matchday alone.
  const isRunningSeason =
    selected !== undefined && selected.id === seasons[0]?.id

  /*
   * **The one matchday the model can answer for.** The pointcast publishes the
   * coming matchday and nothing beyond it, so the request is made for the
   * player's next fixture: if that *is* the published matchday a figure comes
   * back, and if his club plays later in the week it is a 404 and the row
   * keeps whatever the reader put there himself. One request either way, and
   * it is the same cache entry every squad screen reads.
   */
  const nextDay = isRunningSeason
    ? selected?.matches.find((match) => !match.isFinished)?.day
    : undefined
  const { prediction } = usePointcastPrediction(nextDay, playerId)

  if (seasons.length === 0) {
    return (
      <EmptyState
        title="Keine Spieldaten"
        description="Für diesen Spieler liefert Kickbase keine Saisonhistorie."
      />
    )
  }
  if (selected === undefined) return null

  const openMatch = selected.matches.find(
    (match) => match.matchId === breakdown.id,
  )
  /* Only a match still to come has a guess worth entering, and only in the
     running season: the store is keyed by matchday alone, so a matchday 3 in
     2019 is this season's matchday 3 as far as it is concerned. */
  const openExpected = isRunningSeason
    ? selected.matches.find(
        (match) => !match.isFinished && String(match.day) === expectedSheet.id,
      )
    : undefined

  /**
   * What stands in the points column of a fixture still to come: the reader's
   * own guess for that matchday, else the model's prediction where it reaches,
   * else nothing at all.
   *
   * The same precedence as everywhere else in the app — a guess always beats a
   * prediction — and the same `{ value, isOwn }` pair, so the chip can say
   * whose figure it is drawing.
   */
  const expectedFor = (match: PlayerMatch): ExpectedPointsEntry | undefined => {
    if (match.isFinished || !isRunningSeason) return undefined

    const own = guesses[String(match.day)]?.[playerId]
    if (own !== undefined) return { value: own, isOwn: true }
    if (prediction !== undefined && match.day === nextDay) {
      return { value: prediction.expected, isOwn: false }
    }
    return undefined
  }

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
              expected={expectedFor(match)}
              onOpen={() => {
                breakdown.open(match.matchId)
              }}
              onOpenExpected={
                isRunningSeason
                  ? () => {
                      expectedSheet.open(String(match.day))
                    }
                  : undefined
              }
            />
          </li>
        ))}
      </ul>

      {/* Keyed by the match, so opening a second one after a first mounts a
          fresh dialog rather than reusing the query state of the last. */}
      {openMatch !== undefined && (
        <PlayerMatchEventsDialog
          key={openMatch.matchId}
          fixture={breakdownFixture(openMatch, teams)}
          playerId={playerId}
          playerName={playerName}
          leagueId={leagueId}
          seasonId={isRunningSeason ? undefined : selected.id}
          to={
            isRunningSeason && leagueId !== undefined
              ? `/leagues/${leagueId}/matchday/${openMatch.matchId}`
              : undefined
          }
          onClose={breakdown.close}
        />
      )}

      {/* Keyed by the matchday, so opening a second fixture seeds its field
          from that matchday's figures rather than the last one's. */}
      {openExpected !== undefined && (
        <ExpectedPointsDialog
          key={openExpected.day}
          player={{
            id: playerId,
            name: playerName,
            averagePoints: seasonAverage(selected),
            totalPoints: selected.totalPoints,
            fixture: toFixture(openExpected, teams),
          }}
          matchday={openExpected.day}
          onClose={expectedSheet.close}
        />
      )}
    </div>
  )
}

/**
 * What he has averaged **per appearance** this season, which is what the
 * sheet calibrates a guess against.
 *
 * Per appearance, not per fixture: a player who has played four of eight
 * matchdays averages what he manages when he plays, and dividing by the
 * matchdays he sat out would answer a question nobody asked of this number.
 * `undefined` before his first appearance, where the sheet drops the line
 * rather than printing a zero.
 */
function seasonAverage(season: PlayerSeason): number | undefined {
  if (season.appearances === 0) return undefined
  return Math.round(season.totalPoints / season.appearances)
}

/**
 * A season's fixture as the sheet's header reads it.
 *
 * [`TeamFixture`](../../api/models.ts) is the shape every other caller passes,
 * and the two payloads overlap on everything but the opponent's short symbol —
 * which this one does not carry, so the club's name stands in. The header
 * spells the fixture out anyway ("Auswärts bei Bayern München"), and its link
 * needs only the id.
 */
function toFixture(
  match: PlayerMatch,
  teams: Map<string, TeamSummary> | undefined,
): TeamFixture {
  const fixture: TeamFixture = {
    matchId: match.matchId,
    kickoff: match.kickoff,
    isHome: match.isHome,
    opponentId: match.opponentId,
    opponentSymbol: teams?.get(match.opponentId)?.name ?? match.opponentId,
  }
  if (match.opponentImage !== undefined) {
    fixture.opponentImage = match.opponentImage
  }
  return fixture
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
