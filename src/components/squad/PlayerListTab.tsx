import { LayoutGrid, List, Shirt } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import {
  POSITION_LABEL,
  type PositionKey,
  type SquadMember,
  type StartProbability,
  type TeamFixture,
} from '@/api/models'
import { FixtureBadge } from '@/components/squad/FixtureBadge'
import { PlayerStatusBadge } from '@/components/squad/PlayerStatusBadge'
import { StartProbabilityBadge } from '@/components/squad/StartProbabilityBadge'
import type { LineupEditor } from '@/components/squad/useLineupEditor'
import { Avatar } from '@/components/ui/Avatar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/cn'
import { money, moneyDelta } from '@/lib/format'
import { readString, writeString } from '@/lib/storage'

const POSITION_ORDER: PositionKey[] = ['gk', 'def', 'mid', 'fwd']

/** How the squad is laid out. */
type SquadView = 'list' | 'grid'

const VIEW_STORAGE_KEY = 'litbase.squad.view'

/**
 * The full squad as a grouped list, and a second place to edit the lineup.
 *
 * The shirt rail on each row is a control: tap it to field a benched player or
 * to take a fielded one off. Membership comes from the shared editor rather
 * than from the server's `lo`, so a change made here is on the pitch the moment
 * you switch tabs — `lo` lags by a save round trip and used to show stale rows
 * for about a second after every edit.
 *
 * **Adding is immediate; removing asks first.** The asymmetry is deliberate.
 * The rail is small, sits at the very edge of the row, and the rows scroll
 * under a thumb — a mis-tap on a fielded player would quietly drop him and cost
 * 100 points, and nothing on this screen would show what had happened. A
 * mis-tap that *adds* someone is visible and free to undo, so it needs no
 * dialog. On the pitch a player's portrait is a large, deliberate target and
 * the removal shows itself, so that path stays immediate.
 */
export function PlayerListTab({
  squad,
  editor,
  leagueId,
  fixtureByTeamId,
  startProbabilities,
  statusReasons,
}: {
  squad: SquadMember[]
  editor: LineupEditor
  /** For linking each row to the player's detail page. */
  leagueId: string
  fixtureByTeamId: Map<string, TeamFixture> | undefined
  startProbabilities: Map<string, StartProbability>
  /** `stxt` per unavailable player; empty until the lookups land. */
  statusReasons: Map<string, string>
}) {
  // The player awaiting a removal confirmation, if any.
  const [pendingRemoval, setPendingRemoval] = useState<SquadMember | null>(null)
  const [view, setView] = useSquadView()

  const handleToggle = (player: SquadMember) => {
    if (editor.isFielded(player.id)) {
      setPendingRemoval(player)
      return
    }
    // Adding, or opening the swap dialog when the position is full — both are
    // the editor's job.
    editor.toggle(player)
  }

  const byPosition = POSITION_ORDER.map((position) => ({
    position,
    players: squad
      .filter((player) => player.position === position)
      .sort((a, b) => b.marketValue - a.marketValue),
  })).filter((group) => group.players.length > 0)

  return (
    <div className="flex flex-col gap-4">
      <ViewToggle view={view} onChange={setView} />

      {/* The grid is **one flat run**, not four grouped ones. Position
          headings buy little once each tile names its own position, and four
          of them across a three-column grid leave ragged part-rows and turn
          twenty players into a page you scroll. The order is still keeper →
          defence → midfield → attack, most valuable first inside each, so the
          squad reads the way it always did — the headings are simply gone.

          The list keeps its groups: a row carries no position of its own, and
          rows stack in one column where a heading costs nothing. */}
      {view === 'grid' ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {byPosition
            .flatMap((group) => group.players)
            .map((player) => (
              <PlayerTile
                key={player.id}
                player={player}
                startProbability={startProbabilities.get(player.id)}
                statusReason={statusReasons.get(player.id)}
                to={`/leagues/${leagueId}/players/${player.id}`}
              />
            ))}
        </ul>
      ) : (
        byPosition.map(({ position, players }) => (
          <section key={position} className="flex flex-col gap-2">
            <h2 className="px-1 text-[0.6875rem] font-semibold tracking-wider text-faint uppercase">
              {POSITION_LABEL[position]} · {players.length}
            </h2>

            <ul className="flex flex-col gap-2">
              {players.map((player) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  isFielded={editor.isFielded(player.id)}
                  fixture={fixtureByTeamId?.get(player.teamId)}
                  startProbability={startProbabilities.get(player.id)}
                  statusReason={statusReasons.get(player.id)}
                  to={`/leagues/${leagueId}/players/${player.id}`}
                  onToggle={handleToggle}
                />
              ))}
            </ul>
          </section>
        ))
      )}

      <ConfirmDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemoval(null)
        }}
        title="Spieler aus der Aufstellung nehmen?"
        description={
          pendingRemoval === null ? undefined : (
            <>
              <strong className="font-semibold text-ink">
                {/* `firstName` is optional in the API — filtered rather than
                    interpolated, so a missing one leaves no stray space. */}
                {[pendingRemoval.firstName, pendingRemoval.lastName]
                  .filter(Boolean)
                  .join(' ')}
              </strong>{' '}
              wird auf die Bank gesetzt. Bleibt der Platz leer, kostet dich das
              100 Punkte.
            </>
          )
        }
        confirmLabel="Auf die Bank"
        onConfirm={() => {
          if (pendingRemoval !== null) editor.remove(pendingRemoval.id)
          setPendingRemoval(null)
        }}
      />
    </div>
  )
}

/**
 * Which way the squad is laid out, remembered across visits.
 *
 * A view preference is not something anyone wants to re-pick every time they
 * open the page, and it is exactly the kind of value that may not be writable
 * — private mode, blocked storage — so it goes through the app's safe
 * localStorage wrapper and silently stays in memory when that fails.
 *
 * Not in the URL: it is a preference, not a place. A shared link should open
 * the reader's own layout, not the sender's.
 */
function useSquadView(): [SquadView, (view: SquadView) => void] {
  const [view, setViewState] = useState<SquadView>(
    () => (readString(VIEW_STORAGE_KEY) as SquadView | null) ?? 'list',
  )

  const setView = (next: SquadView) => {
    setViewState(next)
    writeString(VIEW_STORAGE_KEY, next)
  }

  return [view, setView]
}

/**
 * List or grid, as **one button showing both symbols**.
 *
 * Two buttons said the same thing with twice the target area and an
 * `aria-pressed` state each, for a choice with exactly two outcomes and no
 * cost to getting it wrong. One button that swaps is the smaller, faster
 * control — and keeping *both* glyphs on it is what makes it legible: a lone
 * icon has to answer "is this the current view or the one I would switch to?",
 * which a single glyph cannot. Here the lit one is where you are and the faint
 * one is where a tap takes you.
 *
 * Right-aligned and icon-only: it is a preference set once, not a primary
 * action, and it should not pull the eye away from the squad.
 */
function ViewToggle({
  view,
  onChange,
}: {
  view: SquadView
  onChange: (view: SquadView) => void
}) {
  const next: SquadView = view === 'list' ? 'grid' : 'list'
  const label = next === 'grid' ? 'Zur Kachelansicht' : 'Zur Listenansicht'

  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={() => {
          onChange(next)
        }}
        title={label}
        aria-label={label}
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2',
          'transition-colors hover:border-accent/40 hover:bg-surface-2',
          'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        )}
      >
        <List
          size={15}
          aria-hidden="true"
          className={view === 'list' ? 'text-accent' : 'text-faint'}
        />
        <span aria-hidden="true" className="h-4 w-px bg-line" />
        <LayoutGrid
          size={15}
          aria-hidden="true"
          className={view === 'grid' ? 'text-accent' : 'text-faint'}
        />
      </button>
    </div>
  )
}

/**
 * A player as a tile: portrait, name, position, and the two marks that say
 * whether you can count on him this week.
 *
 * **No lineup control and no money.** The grid is for taking in a whole squad
 * at once — who is fit, who is likely to start — and a third-of-a-screen tile
 * cannot hold a market value, a profit and a shirt rail without becoming a
 * worse version of the row. Tapping opens the player; the list view is where
 * the lineup gets edited.
 *
 * The badges sit in opposite corners of the portrait, availability left and
 * probability right, as on the pitch. They are **inset rather than straddling
 * the edge**: the pitch's `StartProbabilityCorner` hangs a little outside its
 * circle, which works on a portrait floating over grass and does not here —
 * the tile clips its overflow to keep the rounded corners, so half the badge
 * was being cut off by the frame.
 */
function PlayerTile({
  player,
  startProbability,
  statusReason,
  to,
}: {
  player: SquadMember
  startProbability: StartProbability | undefined
  statusReason: string | undefined
  to: string
}) {
  return (
    <li>
      <Link
        to={to}
        className={cn(
          'flex flex-col overflow-hidden rounded-card border border-line bg-surface',
          'transition-colors hover:border-accent/40 hover:bg-surface-2',
        )}
      >
        {/* Taller than wide: the Kickbase cutouts are standing figures, and a
            square crops them at the chest. */}
        <span className="relative block aspect-4/5 bg-surface-2/60">
          <Avatar
            src={player.image}
            name={player.lastName}
            fill
            className="h-full w-full bg-transparent"
          />
          <PlayerStatusBadge
            status={player.status}
            reason={statusReason}
            size={14}
            onImage
            className="absolute top-1 left-1"
          />
          {startProbability !== undefined && (
            <StartProbabilityBadge
              tier={startProbability}
              size={15}
              onImage
              className="absolute top-1 right-1"
            />
          )}
        </span>

        <span className="block px-1.5 py-1.5 text-center">
          <span className="block truncate text-xs font-semibold text-ink">
            {player.lastName}
          </span>
          {/* The position, which the grid no longer says with a heading. */}
          <span className="block text-[0.625rem] tracking-wide text-faint uppercase">
            {POSITION_LABEL[player.position]}
          </span>
        </span>
      </Link>
    </li>
  )
}

function PlayerRow({
  player,
  isFielded,
  fixture,
  startProbability,
  statusReason,
  to,
  onToggle,
}: {
  player: SquadMember
  isFielded: boolean
  fixture: TeamFixture | undefined
  /** Absent until it loads, and absent for good without Membership. */
  startProbability: StartProbability | undefined
  /** Absent for a fit player, and for a status Kickbase does not explain. */
  statusReason: string | undefined
  /** The player's detail page. */
  to: string
  onToggle: (player: SquadMember) => void
}) {
  return (
    <li className="flex items-stretch overflow-hidden rounded-card border border-line bg-surface">
      {/* Full-height rail, and the row's lineup control. Always rendered,
          tinted only when fielded, so rows stay aligned either way. The
          outline shirt reads as an empty slot inviting a tap, rather than as
          a disabled version of the filled one. */}
      <button
        type="button"
        onClick={() => {
          onToggle(player)
        }}
        aria-pressed={isFielded}
        title={
          isFielded ? 'Aus der Aufstellung nehmen' : 'In die Aufstellung setzen'
        }
        className={cn(
          'flex w-7 shrink-0 items-center justify-center self-stretch border-r transition-colors',
          'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus-visible:ring-inset',
          isFielded
            ? 'border-accent/30 bg-accent/15 text-accent hover:bg-accent/25'
            : 'border-line bg-surface-2/40 text-faint hover:bg-surface-2',
        )}
      >
        <span className="sr-only">
          {isFielded ? 'Aufgestellt' : 'Nicht aufgestellt'}
        </span>
        <Shirt
          size={15}
          strokeWidth={isFielded ? 2 : 1.5}
          className={cn(!isFielded && 'opacity-40')}
        />
      </button>

      {/* Flush portrait: no padding on any side, so it fills the row's height
          and butts straight against the rail.

          The Kickbase player images are transparent PNG cutouts, so the opaque
          tile the avatar used to sit on was the only thing drawing a rectangle
          here — without it the figure simply stands in the row. What is left
          is grounded by a wash that fades out before it reaches the top, and
          the inner edge is masked so the wash and the clipped shoulder
          dissolve into the row instead of ending on a line. The other three
          edges are the card's own borders and stay crisp. The fade starts past
          the head: the source has the figure centred, and cover-cropping a
          landscape image into this box leaves the face clear of 65%. */}
      <Avatar
        src={player.image}
        name={player.lastName}
        fill
        className={cn(
          'w-14 self-stretch bg-transparent',
          'bg-linear-to-t from-surface-2/60 to-transparent to-70%',
          '[mask-image:linear-gradient(to_right,#000_65%,transparent)]',
        )}
      />

      {/* Everything but the rail and the fixture panel opens the player.
          The rail stays a button: it is the lineup control, and wrapping the
          row in a link would make a mis-tap on it navigate instead of field
          the player. Splitting the row this way keeps both targets large and
          keeps the link's hit area the part that reads as "this player". */}
      <Link
        to={to}
        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-2/60"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-ink">
              {player.lastName}
            </span>
            <PlayerStatusBadge
              status={player.status}
              reason={statusReason}
              size={13}
            />
          </span>
          {/* The probability sits under the name rather than beside it. Next
              to the name it would collide with the availability mark, and the
              two mean different things — "unfit" is a fact, "unlikely to
              start" is someone's estimate.

              It used to lead a line of points and average. Those are gone:
              this page is about who is fit, who starts and what they are
              worth, and season scoring is a player's own page — where it now
              has a whole tab. The row is quieter for it.

              Glyph only, no label: five tier names repeated down a list is a
              lot of text for something the reader learns to recognise in
              seconds. The legend in the page header explains the scale, and
              each badge keeps its tooltip. */}
          {startProbability !== undefined && (
            <span className="mt-0.5 flex items-center">
              <StartProbabilityBadge tier={startProbability} size={13} />
            </span>
          )}
        </span>

        <span className="shrink-0 text-right">
          <span className="nums block text-sm font-semibold text-ink">
            {money(player.marketValue)}
          </span>
          {/* Profit/loss only. The `mvt` trend arrow used to sit in front of
              it and read as if it belonged to this figure, when the two are
              different signals — a player can be up overall while trending
              down. The signed, coloured amount carries this one on its own. */}
          <span
            className={cn(
              'nums block text-xs',
              player.profitLoss > 0 && 'text-positive',
              player.profitLoss < 0 && 'text-negative',
              player.profitLoss === 0 && 'text-faint',
            )}
          >
            {moneyDelta(player.profitLoss)}
          </span>
        </span>
      </Link>

      {/* Full-height fixture panel, matching the swap dialog's treatment. */}
      <span className="flex shrink-0 items-center self-stretch border-l border-line bg-canvas/40 px-2.5">
        <FixtureBadge fixture={fixture} size="lg" layout="stacked" />
      </span>
    </li>
  )
}
