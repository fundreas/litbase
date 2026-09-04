import { LayoutGrid, List, Shirt, TrendingDown, TrendingUp } from 'lucide-react'
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
 * How a player marked for sale is drawn.
 *
 * Border and a ring, not a fill or a tick. The row and the tile are already
 * dense — a portrait, marks, money — and tinting the whole surface would fight
 * every one of them; a checkbox would add a second target to a card that is
 * itself the target. An accent outline says "this one" and changes nothing
 * else, which is what a reversible, consequence-free selection deserves.
 */
const SELECTED_CLASS = 'border-accent ring-1 ring-accent bg-accent/5'

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
  forSale,
  onToggleForSale,
}: {
  squad: SquadMember[]
  editor: LineupEditor
  /** For linking each row to the player's detail page. */
  leagueId: string
  fixtureByTeamId: Map<string, TeamFixture> | undefined
  startProbabilities: Map<string, StartProbability>
  /** `stxt` per unavailable player; empty until the lookups land. */
  statusReasons: Map<string, string>
  /**
   * Ids marked for sale, or `null` when the calculator is off.
   *
   * Non-null puts the list in **calculator mode**: a row looks exactly as it
   * always does, rail included, but a tap anywhere on it marks the player for
   * sale rather than opening him or changing the lineup. One target, one
   * meaning — a row that kept two live controls would make every tap a
   * question about which one you meant.
   */
  forSale: ReadonlySet<string> | null
  onToggleForSale: (playerId: string) => void
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
                isForSale={forSale?.has(player.id)}
                onToggleForSale={onToggleForSale}
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
                  isForSale={forSale?.has(player.id)}
                  onToggleForSale={onToggleForSale}
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
 * cannot hold a market value, its change and a shirt rail without becoming a
 * worse version of the row. Tapping opens the player — or marks him for sale
 * while the calculator is on; the list view is where the lineup gets edited.
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
  isForSale,
  onToggleForSale,
}: {
  player: SquadMember
  startProbability: StartProbability | undefined
  statusReason: string | undefined
  to: string
  /** `undefined` when the calculator is off; a boolean when it is on. */
  isForSale: boolean | undefined
  onToggleForSale: (playerId: string) => void
}) {
  const body = (
    <>
      {/* Square, which is both shorter *and* better framed than the 4:5 box
            this used to be. The source images are **1100×800 landscape**
            (checked across three players), so a portrait box has to scale them
            by height and throw away the sides: 4:5 discarded ~42% of the
            width, a square discards ~27%. Shortening the tile therefore costs
            no crop at all — it buys some back, and saves about 30px a row on a
            phone. */}
      <span className="relative block aspect-square bg-surface-2/60">
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

      <span className="block px-1.5 py-1 text-center">
        <span className="block truncate text-xs leading-tight font-semibold text-ink">
          {player.lastName}
        </span>
        {/* The position, which the grid no longer says with a heading. */}
        <span className="block text-[0.625rem] leading-tight tracking-wide text-faint uppercase">
          {POSITION_LABEL[player.position]}
        </span>
      </span>
    </>
  )

  const shell = cn(
    'flex w-full flex-col overflow-hidden rounded-card border bg-surface transition-colors',
    isForSale === true
      ? SELECTED_CLASS
      : 'border-line hover:border-accent/40 hover:bg-surface-2',
  )

  return (
    <li>
      {isForSale === undefined ? (
        <Link to={to} className={shell}>
          {body}
        </Link>
      ) : (
        <button
          type="button"
          aria-pressed={isForSale}
          onClick={() => {
            onToggleForSale(player.id)
          }}
          className={shell}
        >
          {body}
        </button>
      )}
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
  isForSale,
  onToggleForSale,
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
  /** `undefined` when the calculator is off; a boolean when it is on. */
  isForSale: boolean | undefined
  onToggleForSale: (playerId: string) => void
  onToggle: (player: SquadMember) => void
}) {
  const isCalculating = isForSale !== undefined

  /* The rail is the row's lineup control, and stays **visible in calculator
     mode** — whether a player is in your eleven is exactly what you weigh up
     while deciding to sell him, so hiding it took away the fact the mode is
     for. What changes is only that it stops being a control: in calculator
     mode it renders as a plain `<span>` with the same classes, because the
     whole row is one big button then and HTML has no nested buttons. */
  const railClass = cn(
    'flex w-7 shrink-0 items-center justify-center self-stretch border-r transition-colors',
    isFielded
      ? 'border-accent/30 bg-accent/15 text-accent'
      : 'border-line bg-surface-2/40 text-faint',
    !isCalculating && (isFielded ? 'hover:bg-accent/25' : 'hover:bg-surface-2'),
  )

  const rail = (
    <>
      <span className="sr-only">
        {isFielded ? 'Aufgestellt' : 'Nicht aufgestellt'}
      </span>
      <Shirt
        size={15}
        strokeWidth={isFielded ? 2 : 1.5}
        className={cn(!isFielded && 'opacity-40')}
      />
    </>
  )

  /* Flush portrait: no padding on any side, so it fills the row's height and
     butts straight against the rail.

     The Kickbase player images are transparent PNG cutouts, so the opaque tile
     the avatar used to sit on was the only thing drawing a rectangle here —
     without it the figure simply stands in the row. What is left is grounded
     by a wash that fades out before it reaches the top, and the inner edge is
     masked so the wash and the clipped shoulder dissolve into the row instead
     of ending on a line. The other three edges are the card's own borders and
     stay crisp. The fade starts past the head: the source has the figure
     centred, and cover-cropping a landscape image into this box leaves the
     face clear of 65%. */
  const portrait = (
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
  )

  const bodyClass = 'flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5'

  const changeDay = player.marketValueChangeDay
  const ChangeIcon =
    changeDay !== undefined && changeDay < 0 ? TrendingDown : TrendingUp

  const details = (
    <>
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
        {/* The **last 24 hours**, not profit against the purchase price.
              Profit is a fact about a trade made months ago and it never
              changes on its own; what a squad page is read for is what moved
              overnight — who is climbing, who is bleeding value and should go
              on the market. `profitLoss` still lives on the model and on the
              player's own page, where the purchase price is next to it and
              the figure means something.

              The arrow belongs here in a way it did not in front of the
              profit figure: it is the *same* signal as the amount, its
              direction, so the two cannot contradict each other. */}
        <span
          className={cn(
            'nums flex items-center justify-end gap-0.5 text-xs',
            changeDay !== undefined && changeDay > 0 && 'text-positive',
            changeDay !== undefined && changeDay < 0 && 'text-negative',
            (changeDay === undefined || changeDay === 0) && 'text-faint',
          )}
          title="Marktwertänderung in den letzten 24 Stunden"
        >
          {changeDay !== undefined && changeDay !== 0 && (
            <ChangeIcon size={11} aria-hidden="true" className="shrink-0" />
          )}
          {moneyDelta(changeDay)}
          <span className="sr-only"> in den letzten 24 Stunden</span>
        </span>
      </span>
    </>
  )

  /** Full-height fixture panel, matching the swap dialog's treatment. */
  const fixturePanel = (
    <span className="flex shrink-0 items-center self-stretch border-l border-line bg-canvas/40 px-2.5">
      <FixtureBadge fixture={fixture} size="lg" layout="stacked" />
    </span>
  )

  const shell = cn(
    'flex items-stretch overflow-hidden rounded-card border bg-surface',
    isForSale === true ? SELECTED_CLASS : 'border-line',
  )

  /* Calculator mode: **one target over the whole row**, rail and fixture panel
     included. Everything looks the way it always does — the point of the mode
     is judging players on the same information you judge them on normally —
     but nothing navigates and nothing changes the lineup. A row that kept two
     live controls would make every tap a question about which one you meant,
     and a row that hid them would hide the answer. */
  if (isCalculating) {
    return (
      <li className={shell}>
        <button
          type="button"
          aria-pressed={isForSale}
          onClick={() => {
            onToggleForSale(player.id)
          }}
          className={cn(
            'flex flex-1 items-stretch text-left transition-colors',
            'hover:bg-surface-2/40',
            'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus-visible:ring-inset',
          )}
        >
          <span className={railClass}>{rail}</span>
          {portrait}
          <span className={bodyClass}>{details}</span>
          {fixturePanel}
        </button>
      </li>
    )
  }

  return (
    <li className={shell}>
      {/* The rail is a button of its own here: wrapping the row in a link
          would make a mis-tap on it navigate instead of field the player.
          Splitting the row keeps both targets large and keeps the link's hit
          area the part that reads as "this player". */}
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
          railClass,
          'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus-visible:ring-inset',
        )}
      >
        {rail}
      </button>

      {portrait}

      <Link
        to={to}
        className={cn(bodyClass, 'transition-colors hover:bg-surface-2/60')}
      >
        {details}
      </Link>

      {fixturePanel}
    </li>
  )
}
