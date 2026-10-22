import { FlaskConical, Shirt } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import {
  POSITION_LABEL,
  type PositionKey,
  type SquadMember,
  type StartProbability,
  type TeamFixture,
} from '@/api/models'
import { ExpectedPointsBadge } from '@/components/squad/ExpectedPointsBadge'
import { FixtureBadge } from '@/components/squad/FixtureBadge'
import { FixtureTrack, TRACK_LENGTH } from '@/components/squad/FixtureTrack'
import { useFixtureHold } from '@/components/squad/useFixtureHold'
import { PlayerStatusBadge } from '@/components/squad/PlayerStatusBadge'
import { StartProbabilityBadge } from '@/components/squad/StartProbabilityBadge'
import type { CurrentMatchday } from '@/api/hooks/useMatchday'
import type { TeamSummary } from '@/api/hooks/useCompetition'
import { ClubWatermark } from '@/components/player/ClubWatermark'
import type { LineupEditor } from '@/components/squad/useLineupEditor'
import { useExpectedPointsView } from '@/components/squad/useExpectedPointsView'
import {
  SquadReadingButton,
  UpcomingFixtures,
} from '@/components/squad/SquadReading'
import { useSquadReading } from '@/components/squad/useSquadReading'
import { ValueDelta, ValueModeButton } from '@/components/squad/ValueMode'
import { useValueMode, type ValueMode } from '@/components/squad/useValueMode'
import { Avatar } from '@/components/ui/Avatar'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ForecastChip } from '@/components/ui/ForecastChip'
import { cn } from '@/lib/cn'
import type { ExpectedPointsEntry } from '@/lib/expectedPoints'
import { money, moneyDelta } from '@/lib/format'

const POSITION_ORDER: PositionKey[] = ['gk', 'def', 'mid', 'fwd']

/**
 * How many matchdays the Spielplan reading spreads across a row.
 *
 * The page fetches more than this — the fixture panel's hold reveals five
 * — but the strip stops at four: a fifth column is about 28px, and every one
 * of them comes out of the name beside it.
 */
const FIXTURE_STRIP = 4

/**
 * How a player marked for sale is drawn **on a row**.
 *
 * Rows sit flush inside one card per position, so the mark is a tinted ground
 * and an accent edge down the left — the notation the
 * [market's rows](../market/MarketRow.tsx) use for a standing bid. The edge is
 * 2px on **every** row, transparent where nothing is marked, so a marked row
 * does not shift its contents against its neighbours.
 */
const SELECTED_ROW_CLASS = 'border-l-accent bg-accent/5'

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
  nextMatchdays,
  teams,
  matchday,
  startProbabilities,
  statusReasons,
  forSale,
  onToggleForSale,
  saleValues,
  onEditExpected,
  scenarioTo,
}: {
  squad: SquadMember[]
  editor: LineupEditor
  /** For linking each row to the player's detail page. */
  leagueId: string
  fixtureByTeamId: Map<string, TeamFixture> | undefined
  /**
   * The next few matchdays, for the list's
   * [Spielplan reading](./SquadReading.tsx) — the first of them is the one
   * `fixtureByTeamId` comes from.
   *
   * Left out where that reading would answer nothing: the
   * [scenario](../../pages/WhatIfPage.tsx)'s Kader is about what a squad
   * fetches on a day the reader picks, and the button is simply absent there.
   */
  nextMatchdays?: CurrentMatchday[]
  /** The season's clubs, for the watermark behind each row. */
  teams: Map<string, TeamSummary> | undefined
  /** The matchday the fixtures belong to, and the guesses are filed under. */
  matchday: number | undefined
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
  /**
   * **What each player would fetch on a day that has not come yet**, by id —
   * the [scenario](../../pages/WhatIfPage.tsx)'s target day, and nothing else
   * passes it.
   *
   * Where an id is in here the row prints this figure instead of today's
   * market value, marked as a prediction, with its distance from today under
   * it in place of the toolbar's delta. That is the whole of it: the row is
   * otherwise the row, because a scenario that sold at tomorrow's prices while
   * showing today's would be two answers on one screen.
   *
   * A player the forecast does not reach is simply absent and keeps his real
   * value — which is what the total does with him too.
   */
  saleValues?: ReadonlyMap<string, number>
  /**
   * Open the [expected-points sheet](./ExpectedPointsDialog.tsx) for a player.
   *
   * The page owns the sheet, not this tab: it is addressed by the URL hash,
   * and the pitch has to be able to close it too.
   *
   * Optional, because one caller has no sheet to open — the
   * [what-if page](../../pages/WhatIfPage.tsx) runs this list permanently in
   * calculator mode, where a row has one meaning and it is not this one. The
   * guesses already made still show there; they simply cannot be edited from
   * a scenario.
   */
  onEditExpected?: (player: SquadMember) => void
  /**
   * Where the [what-if scenario](../../pages/WhatIfPage.tsx) lives, if this
   * list offers a way into one.
   *
   * Absent on the scenario's own Kader tab: that page *is* the mode, and a
   * button back into it would be a door in the room it opens onto.
   */
  scenarioTo?: string
}) {
  // The player awaiting a removal confirmation, if any.
  const [pendingRemoval, setPendingRemoval] = useState<SquadMember | null>(null)
  const [valueMode, setValueMode] = useValueMode()
  const [reading, setReading] = useSquadReading()
  /* No schedule, no choice: past the last matchday of the season there are no
     opponents to come, and a button that switched the rows to four dashes
     would be offering an answer nobody can use. */
  const canShowFixtures = (nextMatchdays?.length ?? 0) > 0
  const showsFixtures = canShowFixtures && reading === 'fixtures'
  /* The money's own switch has nothing to offer in the fixture reading — there
     is no price on the row for it to put a second line under — and nothing to
     offer a scenario either, where that line is already the distance from
     today's value. */
  const canSwitchValue = !showsFixtures && (saleValues?.size ?? 0) === 0
  /* The row of controls is drawn only when it holds one. With the layout
     toggle gone there is no longer a control that is always there, and an
     empty flex row still costs the well's `gap-4` — which is exactly what the
     [scenario](../../pages/WhatIfPage.tsx)'s own Kader would have paid, having
     neither button nor link. */
  const hasToolbar =
    scenarioTo !== undefined || canSwitchValue || canShowFixtures
  const expected = useExpectedPointsView(matchday)

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
      {/* The list's own toolbar, read from the two ends: where the squad can
          be *taken* on the left, what the rows are *saying* on the right. The
          two are different kinds of thing — one leaves the page, one changes
          what is printed on it — and a gap between them says so better than a
          gap-2 would.

          The buttons keep the right edge whether or not the link is there: it
          is the row's `justify-end` that holds them, and the link pushes
          itself to the other side with `mr-auto` rather than the row switching
          to `justify-between`, which would drag a lone button left with it. */}
      {hasToolbar && (
        <div className="flex items-center justify-end gap-2">
          {scenarioTo !== undefined && <ScenarioLink to={scenarioTo} />}
          {/* Only while the rows are showing today's money. With a sale day
              picked, the line under every price is that price's distance from
              today, which is the only comparison a future value has — neither
              of this button's two answers is in the rows for it to switch
              between. */}
          {canSwitchValue && (
            <ValueModeButton value={valueMode} onChange={setValueMode} />
          )}
          {/* **Money or the fixture list**, for the same reason the button to
              its left exists and in the same shell: the row's right-hand end
              has room for one of them, and which one depends on whether the
              question is *sell him before the morning* or *has this squad drawn
              a kind month*. In the fixture reading the rows carry no price at
              all, so the delta button above has nothing left to switch and goes
              with it. */}
          {canShowFixtures && (
            <SquadReadingButton value={reading} onChange={setReading} />
          )}
        </div>
      )}

      {/* **One card per position, rows flush inside it** — a row carries no
          position of its own, and rows stack in one column where a heading
          costs nothing. */}
      {byPosition.map(({ position, players }) => (
        /* The heading stays outside the card, on the page, so each position
           is an independent block with its own opened *and closed* edges
           rather than a section of one endless list — the same shape the
           [market](../../pages/MarketPage.tsx) groups its listings in.

           `overflow-hidden` on the card, not the rows: the first and last
           rows are clipped to its corners, which is what lets a row bleed
           its portrait to its own edge and carry no rounding. */
        <section key={position} className="flex flex-col gap-2">
          <h2 className="px-1 text-[0.6875rem] font-semibold tracking-wider text-faint uppercase">
            {POSITION_LABEL[position]} · {players.length}
          </h2>

          <Card className="overflow-hidden">
            <ul className="divide-y divide-line">
              {players.map((player) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  team={teams?.get(player.teamId)}
                  isFielded={editor.isFielded(player.id)}
                  fixture={fixtureByTeamId?.get(player.teamId)}
                  startProbability={startProbabilities.get(player.id)}
                  statusReason={statusReasons.get(player.id)}
                  to={`/leagues/${leagueId}/players/${player.id}`}
                  isForSale={forSale?.has(player.id)}
                  onToggleForSale={onToggleForSale}
                  onToggle={handleToggle}
                  valueMode={valueMode}
                  nextMatchdays={nextMatchdays ?? []}
                  showsFixtures={showsFixtures}
                  saleValue={saleValues?.get(player.id)}
                  expectedPoints={expected.entry(player.id)}
                  onEditExpected={onEditExpected}
                />
              ))}
            </ul>
          </Card>
        </section>
      ))}

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
 * The way into **"Was wäre wenn"** — the squad as it would be after a round of
 * sales, pitch included.
 *
 * A link, not a mode. The [sale calculator](../../pages/SquadPage.tsx) on the
 * budget chip already answers *how much would I have*, in place and without
 * leaving the page, which is the right shape for a question about one number.
 * *What would I be fielding afterwards* is a different size of question — it
 * needs the pitch, a squad the sales have been taken out of, and a lineup
 * editor that writes nothing back. That is a page, so this is a link to one,
 * and a back press is the way out.
 *
 * A **flask**, not another calculator: the wallet chip and the calculator bar
 * are already the arithmetic on this page, and a third calculator glyph beside
 * them would say "one of these three does sums" and nothing more. This one is
 * an experiment — nothing inside it is real.
 *
 * **Named, unlike the buttons across the row.** *Szenario* is a destination,
 * and a lone glyph that takes you somewhere has to be guessed at; the two
 * switches beside it change what the page you are already on is printing, and
 * each names the state it is in, so neither needs a word for where it goes.
 * Otherwise it is the same control — same height, same border, same rounding —
 * so the row reads as one toolbar rather than as unrelated things.
 *
 * It takes the **left** end of that row, by `mr-auto` rather than by the row
 * being `justify-between`: the switches' place is the right edge, and they
 * have to keep it on the [what-if page](../../pages/WhatIfPage.tsx)'s own
 * Kader tab, where there is no link to push away from.
 */
function ScenarioLink({ to }: { to: string }) {
  return (
    <Link
      to={to}
      title="Was wäre wenn: Verkäufe durchrechnen"
      className={cn(
        'mr-auto flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-2',
        'text-xs font-semibold text-muted transition-colors',
        'hover:border-accent/40 hover:bg-surface-2 hover:text-accent',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
      )}
    >
      <FlaskConical size={15} aria-hidden="true" className="shrink-0" />
      Szenario
    </Link>
  )
}

function PlayerRow({
  player,
  team,
  isFielded,
  fixture,
  startProbability,
  statusReason,
  to,
  isForSale,
  onToggleForSale,
  onToggle,
  valueMode,
  nextMatchdays,
  showsFixtures,
  saleValue,
  expectedPoints,
  onEditExpected,
}: {
  player: SquadMember
  /** His club, for the watermark behind the row. */
  team: TeamSummary | undefined
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
  /** Which figure goes under the market value — the toolbar's choice. */
  valueMode: ValueMode
  /**
   * The next few matchdays, in order — empty where the page has no schedule
   * to offer, as the [scenario](../../pages/WhatIfPage.tsx) does not.
   *
   * Read twice over: the row's fixture panel draws the first three as a
   * [track](./FixtureTrack.tsx) and reveals five on a hold, and the
   * [Spielplan reading](./SquadReading.tsx) spreads the first four across the
   * right-hand end of the row.
   */
  nextMatchdays: CurrentMatchday[]
  /**
   * Whether the row is in its Spielplan reading — the fixture strip in place
   * of the money, and with it no fixture panel, since the strip's first crest
   * is the panel's.
   */
  showsFixtures: boolean
  /**
   * What he would fetch on the scenario's target day, where one is chosen and
   * the forecast reaches it. It replaces both figures on the right — see the
   * tab's `saleValues`.
   */
  saleValue?: number
  /**
   * What he is expected to score — the manager's own guess, or the model's
   * prediction standing in for one. `undefined` when neither exists.
   */
  expectedPoints: ExpectedPointsEntry | undefined
  /** Absent where the row cannot open the sheet — see the tab's own prop. */
  onEditExpected?: (player: SquadMember) => void
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

  /* `relative isolate overflow-hidden` is what the club watermark needs of its
     host — see [`ClubWatermark`](../player/ClubWatermark.tsx). */
  const bodyClass =
    'relative isolate flex min-w-0 flex-1 items-center gap-3 overflow-hidden px-3 py-2.5'

  const details = (
    <>
      <ClubWatermark team={team} />

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
              each badge keeps its tooltip.

              **The expected figure sits beside it**, because the two are the
              same kind of statement about the same match — *will he play* and
              *what will he bring* — and reading them together is what a lineup
              decision actually needs. It used to live under the crest at the
              end of the row; the crest kept the tap that enters it. */}
        {(startProbability !== undefined || expectedPoints !== undefined) && (
          <span className="mt-0.5 flex items-center gap-1.5">
            {startProbability !== undefined && (
              <StartProbabilityBadge tier={startProbability} size={13} />
            )}
            {expectedPoints !== undefined && (
              <ExpectedPointsBadge
                value={expectedPoints.value}
                isForecast={!expectedPoints.isOwn}
              />
            )}
          </span>
        )}
      </span>

      {/* **The four crests in place of the money**, where the list is being
          read for the fixtures. The whole right-hand end swaps rather than
          the strip being squeezed in beside the price: on a phone those four
          crests want about the width the price and its delta take, and a row
          that tried to carry both would end up carrying neither legibly.

          The fixture panel at the end of the row goes with it, since the first
          crests of the strip *are* its track — and with it the tap that enters
          an expected figure, which belongs to the reading that is about this
          weekend. One tap on the toolbar brings both back.

          **Four here, three on the panel, five under a hold.** The strip is
          the only one of the three with a whole row's width to spend, and it
          still stops at four: a fifth column costs about 28px, all of it taken
          from the name. */}
      {showsFixtures ? (
        <UpcomingFixtures
          matchdays={nextMatchdays.slice(0, FIXTURE_STRIP)}
          teamId={player.teamId}
        />
      ) : (
        <span className="shrink-0 text-right">
          {/* **The target day's price, where the scenario has picked one.** The
              figure keeps the column, the weight and the place it always had —
              a predicted value is still the value this row is being judged on,
              and moving it would make the two kinds of row impossible to
              compare down a list. What marks it is the chip beside it and the
              line underneath, which swaps the toolbar's delta for the one
              question a future price raises: *how far is that from today?* */}
          {saleValue === undefined ? (
            <span className="nums block text-sm font-semibold text-ink">
              {money(player.marketValue)}
            </span>
          ) : (
            <span className="flex items-center justify-end gap-1">
              <ForecastChip />
              <span className="nums text-sm font-semibold text-ink">
                {money(saleValue)}
              </span>
            </span>
          )}
          {/* **One line, two questions, and the toolbar picks which.** The
              default is the last 24 hours, because that is what a squad page
              is read for between matchdays — who is climbing, who is bleeding
              value and should go on the market before the morning. The other
              is the profit since purchase, which the row used to leave to the
              player's own page: it is a fact about a trade made months ago
              and it does not move on its own, but it is the figure you want
              the moment you are deciding *whether to sell*, which is the
              other half of what this list is for.

              Both cannot sit here at once — a second signed amount in the
              same place would make the pair a puzzle — so they take turns.
              See [`ValueDelta`](./ValueMode.tsx), which draws whichever is
              showing identically in a rival's Kader. */}
          {saleValue === undefined ? (
            <ValueDelta
              mode={valueMode}
              changeDay={player.marketValueChangeDay}
              profitLoss={player.profitLoss}
            />
          ) : (
            <span
              title="Gegenüber dem aktuellen Marktwert"
              className={cn(
                'nums block text-xs',
                saleValue > player.marketValue && 'text-positive',
                saleValue < player.marketValue && 'text-negative',
                saleValue === player.marketValue && 'text-faint',
              )}
            >
              {moneyDelta(saleValue - player.marketValue)}
              <span className="sr-only"> gegenüber jetzt</span>
            </span>
          )}
        </span>
      )}
    </>
  )

  /* Full-height fixture panel, matching the swap dialog's treatment — and the
     row's second control.

     **The crest is where the guess is entered.** It is already the only part
     of the row that is about the coming matchday rather than about the season
     or the market, so "what will he score on Saturday?" belongs on it rather
     than behind a button of its own; a row this dense has no room for one.
     The figure it enters now reads beside the probability badge up in the
     row — the crest kept the tap and gave up the number, so this panel says
     one thing (*who, and where next*) and says it at full size. */
  const panelClass =
    /* `w-14`, near enough the 58px the crest plus its old padding took, so
       the row's other columns keep the width they had — and exactly what the
       [track](./FixtureTrack.tsx) is sized to fill. `select-none`, because a
       hold on a phone otherwise starts selecting the row's text under it. */
    'flex w-14 shrink-0 select-none flex-col items-center justify-center self-stretch border-l border-line bg-canvas/40 px-1'

  /* The next three where the page knows them, the one next fixture where it
     does not — the [scenario](../../pages/WhatIfPage.tsx) has no schedule, and
     a track of one is just the badge it always was. */
  const panelBody =
    nextMatchdays.length > 0 ? (
      <FixtureTrack matchdays={nextMatchdays} teamId={player.teamId} />
    ) : (
      <FixtureBadge fixture={fixture} size="lg" />
    )

  /* The hold, on every rendering of the panel below — including the inert one
     in calculator mode, where the row is one big button and the handlers' job
     is also to keep the hold's own click from reaching it. */
  const hold = useFixtureHold({
    matchdays: nextMatchdays,
    teamId: player.teamId,
    onTap:
      onEditExpected === undefined
        ? undefined
        : () => {
            onEditExpected(player)
          },
  })

  /* The hold has to be discoverable, and a tooltip on the thing it works on
     is the only room this row has to say so. Absent where there is nothing
     past the three on the track to reveal. */
  const canHold = nextMatchdays.length > TRACK_LENGTH
  const holdHint = 'gedrückt halten für die nächsten fünf Spiele'

  /* In calculator mode it is not a control: the whole row is one button then,
     HTML has no nested buttons, and a tap anywhere on the row means "mark him
     for sale" — including here. The hold still works, because *which three
     clubs does he still have to play* is exactly what is being weighed up.
     Drawn in neither mode while the row is showing the fixture strip: its
     first crests are this panel's. */
  const fixturePanel = (
    <span
      className={panelClass}
      title={canHold ? `Nächste Spiele · ${holdHint}` : undefined}
      {...hold.handlers}
    >
      {panelBody}
    </span>
  )

  const shell = cn(
    // **No card of its own.** The rows sit flush in a divided list inside one
    // card per position — the shape the [market](../market/MarketRow.tsx) and
    // the [feed](../events/ActivityFeed.tsx) have: a hairline between
    // neighbours rather than 8px of page, and the card's rounded ends are what
    // make a position read as a set.
    'flex items-stretch overflow-hidden bg-surface',
    'border-l-2',
    isForSale === true ? SELECTED_ROW_CLASS : 'border-l-transparent',
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
          {!showsFixtures && fixturePanel}
        </button>
        {hold.layer}
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

      {showsFixtures ? null : onEditExpected === undefined ? (
        fixturePanel
      ) : (
        <button
          type="button"
          {...hold.handlers}
          title={
            canHold
              ? `Erwartete Punkte eintragen · ${holdHint}`
              : 'Erwartete Punkte eintragen'
          }
          aria-label={`Erwartete Punkte für ${player.lastName} eintragen`}
          className={cn(
            panelClass,
            'cursor-pointer transition-colors hover:bg-surface-2',
            'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus-visible:ring-inset',
          )}
        >
          {panelBody}
        </button>
      )}

      {hold.layer}
    </li>
  )
}
