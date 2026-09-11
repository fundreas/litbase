import { TrendingDown, TrendingUp } from 'lucide-react'
import { Link } from 'react-router'

import type { TeamSummary } from '@/api/hooks/useCompetition'
import {
  POSITION_LABEL,
  type MarketListing,
  type StartProbability,
  type TeamFixture,
} from '@/api/models'
import { ExpectedPointsBadge } from '@/components/squad/ExpectedPointsBadge'
import { FixtureBadge } from '@/components/squad/FixtureBadge'
import { StartProbabilityBadge } from '@/components/squad/StartProbabilityBadge'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'
import type { ExpectedPointsEntry } from '@/lib/expectedPoints'
import {
  duration,
  money,
  moneyDelta,
  moneyDeltaExact,
  time,
} from '@/lib/format'

/**
 * One listing.
 *
 * **Two targets, and the split is the portrait.** Tapping the player's picture
 * opens his page — the reference move, the one you make to check a scoring
 * history before deciding. Tapping anywhere else opens the bid dialog, because
 * that is what the market is *for*, and it deserves the large target rather
 * than the small one.
 *
 * ## Three lines, and each one is a question and its answer
 *
 * ```
 * ┌──────┬──────────────────────────┬─────┬───────┐
 * │      │ Guerreiro           [BVB]│     │       │
 * │  👤  │ ABW           7,8 Mio. € │ FCB │ 9 Std.│
 * │      │ ✓ ⌖231     ↘ −390 Tsd. € │ 🏠  │ 22:48 │
 * └──────┴──────────────────────────┴─────┴───────┘
 *   who      him / what he costs     gegen   when
 * ```
 *
 * Left of each line is **him**, right of it is **what he costs**, and the two
 * columns stay in their lanes all the way down: name over position over the
 * two marks about the coming matchday; club crest over price over the move.
 * The panels beyond carry *who he plays*, and *when this settles* — or, on a
 * manager's listing, whose it is.
 *
 * **The third line is the matchday line.** The lineup-probability tier and the
 * expected points sit together because they are one thought — *will he play,
 * and what will it be worth* — and neither is worth reading without the other.
 * They are the marks a buyer on a market page was missing, and they are the
 * same two the [Kader](../squad/PlayerListTab.tsx) draws, in the same colours:
 * a player met on the market and the same player met in the squad must not
 * need two vocabularies.
 *
 * **The crest on the name's line is his own club**, not the fixture — the
 * fixture is the panel's, with its home-or-away chip to say so. Small, and at
 * the end of the line, because it qualifies the name rather than competing
 * with it: on a market list nothing says *which* Müller faster.
 *
 * ## What the height bought
 *
 * Three lines and the marks are pure addition to a row that was already full,
 * so the row grew from 52px to 76px — and the **portrait** took the same
 * increase, because it is what identifies a player fastest. The **name** has a
 * line to itself: four columns and a two-line money block used to leave it
 * about fifty pixels, so nearly every name on the page arrived truncated, on
 * the one page whose first question is *who is on the market*.
 *
 * `now` is passed in rather than read here so every row on the page counts down
 * against the same instant — twenty rows each holding their own interval would
 * drift apart visibly and re-render the list twenty times a second.
 */
export function MarketRow({
  listing,
  leagueId,
  fixture,
  team,
  marketValueChange,
  startProbability,
  expectedPoints,
  now,
  onOffer,
}: {
  listing: MarketListing
  leagueId: string
  /** The player's club's next fixture, if the matchday is known. */
  fixture: TeamFixture | undefined
  /**
   * His own club, for the crest at the end of the name's line.
   *
   * `undefined` until the directory lands, and for good on a club the current
   * season's table does not hold — the crest is simply absent then, the way
   * every other consumer of the directory treats it.
   */
  team: TeamSummary | undefined
  /**
   * Move over the last 24 hours; `undefined` until the lookup lands, and not
   * passed at all on a manager's listing — see the subtitle below, which
   * spends that line on the premium instead.
   */
  marketValueChange?: number
  /**
   * His lineup-probability tier. `undefined` is the normal case — no
   * Membership, off-season, nobody has assessed him — and draws nothing.
   */
  startProbability: StartProbability | undefined
  /**
   * What he is expected to score on the coming matchday: the reader's own
   * guess, or the model's prediction standing in for one. `undefined` when
   * neither exists, and then no chip at all.
   *
   * **Read-only here.** One's own Kader lets the figure be overruled by
   * tapping the panel it sits in; this row has already spent that panel, and
   * every other part of it, on the bid — the guess is entered from the
   * player's own page. A row with three targets would make every tap a
   * question about which one was meant.
   */
  expectedPoints: ExpectedPointsEntry | undefined
  /**
   * The page's shared clock, in epoch millis. Only read by the countdown, so a
   * list of manager listings — which have none — can pass anything.
   */
  now: number
  onOffer: () => void
}) {
  const { ownOffer, seller, price, marketValue } = listing

  /* Flush portrait, matching the squad row: the Kickbase cutouts are
     transparent PNGs, so a wash grounds the figure and the inner edge is
     masked to dissolve into the row rather than ending on a line.

     `w-18` against the old `w-14`, on a row half again as tall. The sources
     are 1100×800 landscape and this box cover-crops them, so every pixel of
     both dimensions is a pixel of face: the figure is now read at a glance
     rather than squinted at. */
  const portrait = (
    <Link
      to={`/leagues/${leagueId}/players/${listing.id}`}
      aria-label={`${listing.lastName} öffnen`}
      className={cn(
        'flex w-18 shrink-0 self-stretch',
        'transition-opacity hover:opacity-80',
      )}
    >
      <Avatar
        src={listing.image}
        name={listing.lastName}
        fill
        className={cn(
          'w-full self-stretch bg-transparent',
          'bg-linear-to-t from-surface-2/60 to-transparent to-70%',
          '[mask-image:linear-gradient(to_right,#000_65%,transparent)]',
        )}
      />
    </Link>
  )

  return (
    <li
      className={cn(
        // `min-h-19` — 76px against the 52 this row used to be, and a **floor**
        // rather than a fixed height. The tallest column is the matchday
        // panel, whose chip comes and goes with the model, so an intrinsic row
        // would jitter by a dozen pixels from one listing to the next; a list
        // that jitters is harder to scan than one that is slightly taller. The
        // floor is what the three-line name block needs anyway, so nothing is
        // padding.
        'flex min-h-19 items-stretch overflow-hidden rounded-card border bg-surface',
        // A standing bid marks the **whole row**, the same outline the squad
        // page uses for a player marked for sale. A label under the price said
        // the same thing in a place you had to look for it; an outline is seen
        // while scanning the list, which is when it matters.
        ownOffer === undefined
          ? 'border-line'
          : 'border-accent bg-accent/5 ring-1 ring-accent',
      )}
    >
      {portrait}

      <button
        type="button"
        onClick={onOffer}
        aria-label={`Für ${listing.lastName} bieten`}
        className="flex min-w-0 flex-1 items-stretch text-left transition-colors hover:bg-surface-2"
      >
        {/* **Two lanes, three lines.** Left of every line is him, right of it
            is what he costs, and neither column ever crosses into the other:
            the eye reads straight down one of them rather than hunting a
            figure that moved. The lines are ordered by how a buying decision
            is actually made — who, then what he costs, then what he is likely
            to do with the matchday. */}
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-2.5 py-2">
          <span className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
              {listing.lastName}
            </span>
            {/* His club, small and at the end of the line it qualifies —
                *which* Müller, answered by the thing a reader recognises
                fastest. Not a link, though the club has a page: this sits
                inside the bid button, and an anchor nested in a button is
                neither valid nor reliably clickable. The name rides along for
                a screen reader and on hover. */}
            {team !== undefined && (
              <span title={team.name} className="flex shrink-0">
                <Avatar
                  src={team.image}
                  name={team.name}
                  size={16}
                  square
                  className="bg-transparent"
                />
              </span>
            )}
          </span>

          <span className="flex items-baseline justify-between gap-2">
            {/* The position, and nothing else on this line. Who you would be
                buying *from* is a **face**, in the panel at the end of the row
                — see {@link SellerPanel}. A name spelled out here was the
                widest thing on the line and said less than the picture does at
                a glance; the picture is also the one you already know from the
                standings. */}
            <span className="min-w-0 truncate text-xs tracking-wide text-muted uppercase">
              {POSITION_LABEL[listing.position]}
            </span>

            {/* **One figure, the one that answers the question.** Your own
                offer if you have made one, else what a manager is asking, else
                the market value — which is what a computer listing charges
                anyway. Printing all three stacked them into a column the eye
                had to reconcile, and two of them are usually the same number.
                The row's outline says when the figure is your own bid. */}
            <span
              className={cn(
                'nums shrink-0 text-sm leading-tight font-semibold',
                ownOffer === undefined ? 'text-ink' : 'text-accent',
              )}
            >
              {money(ownOffer ?? (seller === undefined ? marketValue : price))}
            </span>
          </span>

          <span className="flex items-center justify-between gap-2">
            {/* **The matchday line.** Will he play, and what will it be worth
                — one thought, and neither half is worth reading without the
                other, so they share a line and sit together at its head.

                The tier is a glyph and no label, exactly as on the squad list:
                five names repeated down a list is a lot of text for something
                the reader learns to recognise in seconds, and the badge keeps
                its tooltip. Both are absent rather than blank when there is
                nothing to say — no assessment, no Membership, a competition
                the model does not cover. */}
            <span className="flex shrink-0 items-center gap-1.5">
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

            {/* The subtitle says the one thing about the figure above that the
                figure above does not. On a computer listing that is where the
                market value has been going, since the price *is* the market
                value. On a manager's it is how far his own number sits from it
                — see {@link Premium}. */}
            {seller === undefined ? (
              <Change value={marketValueChange} />
            ) : (
              <Premium price={price} marketValue={marketValue} />
            )}
          </span>
        </span>

        {/* **Who he plays**, in a column of its own — the one fact on the row
            that is about neither the player nor the price but the fixture he
            is being bought for. The crest carries its own home-or-away chip,
            which is what keeps it from being read as the club crest on the
            name's line. */}
        <span className={FIXTURE_PANEL}>
          <FixtureBadge fixture={fixture} size="md" />
        </span>

        {/* The last panel answers the question the listing's kind leaves
            open. Kickbase's: *when does this settle?* A manager's never
            settles by itself — he decides — so it answers the other one you
            ask before bidding: *whose is it?* See {@link SellerPanel}. */}
        {seller === undefined ? (
          <Countdown expiresAt={listing.expiresAt} now={now} />
        ) : (
          <SellerPanel seller={seller} />
        )}
      </button>
    </li>
  )
}

/**
 * The opponent's crest, and only that.
 *
 * As narrow as a 30px crest will go, because every pixel of it comes straight
 * out of the three lines to its left — where the row's two tightest lines, the
 * name and the matchday marks against the overnight move, are already spending
 * what there is on a 360px phone.
 */
const FIXTURE_PANEL =
  'flex w-11 shrink-0 items-center justify-center self-stretch border-l border-line bg-canvas/40 px-1'

/**
 * The last column of the row, whatever ends up in it. Fixed width so the
 * figures beside it stop in the same place on every row, expiring or not.
 */
const PANEL =
  'flex w-14 shrink-0 flex-col items-center justify-center gap-0.5 self-stretch border-l border-line bg-canvas/40 px-1 text-center'

/**
 * **The overnight move**, under a computer listing's price.
 *
 * Only there: Kickbase charges the market value flat, so the price above is
 * the market value and where it has been going is the whole of what is not
 * already printed. A manager's listing spends this line on {@link Premium}
 * instead.
 */
function Change({ value }: { value: number | undefined }) {
  const Icon = value !== undefined && value < 0 ? TrendingDown : TrendingUp

  return (
    <span
      className={cn(
        // 11px, the size the countdown panel gives its own second line: this
        // is a subtitle under the figure it qualifies, and at `text-xs` the
        // widest of them (`↘ −390 Tsd. €`) was the thing squeezing the name
        // column on a narrow phone.
        'nums flex items-center justify-end gap-0.5 text-[0.6875rem] whitespace-nowrap',
        value !== undefined && value > 0 && 'text-positive',
        value !== undefined && value < 0 && 'text-negative',
        (value === undefined || value === 0) && 'text-faint',
      )}
      title="Marktwertänderung in den letzten 24 Stunden"
    >
      {value !== undefined && value !== 0 && (
        <Icon size={11} aria-hidden="true" className="shrink-0" />
      )}
      {moneyDelta(value)}
      <span className="sr-only"> in den letzten 24 Stunden</span>
    </span>
  )
}

/**
 * **What the manager is asking over the market value**, as a percentage,
 * directly under his price.
 *
 * He names his own number, and how far it sits from what the player is worth
 * is the whole of what there is to judge about it — his listing has no clock,
 * so nothing else about it is changing. It is also what the [Manager
 * tab](./ManagerListingsTab.tsx) sorts on, and an ordering the reader cannot
 * see is a mystery. So it sits against the figure it qualifies, in the line
 * a computer listing spends on the overnight move; the end of the row now
 * carries the seller's face instead.
 *
 * A percentage rather than a sum: it is comparable between a five-hundred
 * thousand and a fifteen-million player, which the sort depends on. Rounded to
 * whole percent — a listing 0.4 % over is at the market value for every
 * purpose — and the **screen reader is told the direction in words**, because
 * a green/amber pair alone is unreadable to about one man in twelve.
 *
 * Amber for a premium rather than red: asking above the market value is what
 * buying from a manager normally costs, not an error — the same reading the
 * page's header gives amber, "allowed, and it costs you". Red is kept for what
 * Kickbase would refuse. Below the market value is green, the colour the app
 * spends on a figure in your favour, and *at* the market value stays quiet.
 *
 * A market value of zero has never been seen on the wire; it would divide by
 * it, and prints nothing rather than a `NaN`.
 */
function Premium({
  price,
  marketValue,
}: {
  price: number
  marketValue: number
}) {
  const premium =
    marketValue > 0 ? Math.round((price / marketValue - 1) * 100) : undefined

  if (premium === undefined) return null

  return (
    <span
      className={cn(
        // The same 11px as {@link Change}, whose line this one takes.
        'nums block text-[0.6875rem] font-medium whitespace-nowrap',
        premium > 0 && 'text-warning',
        premium < 0 && 'text-positive',
        premium === 0 && 'text-faint',
      )}
      title={`Preis gegen den Marktwert (${moneyDeltaExact(price - marketValue)})`}
    >
      {percentDelta(premium)}
      <span className="sr-only">
        {premium === 0
          ? ' — zum Marktwert'
          : premium > 0
            ? ' über dem Marktwert'
            : ' unter dem Marktwert'}
      </span>
    </span>
  )
}

/**
 * **Whose listing this is**, at the end of a manager's row — a face, and only
 * a face.
 *
 * It reads faster than the name it replaced on the row's second line: the
 * portraits are the ones the standings and the duels already wear, so the
 * league is recognised rather than read. The name stays for a screen reader
 * and on hover, which is where a face you do not recognise sends you anyway.
 *
 * Not a link, though a manager has a page: this whole panel sits inside the
 * bid button, and an anchor nested in a button is neither valid nor reliably
 * clickable. The row keeps its two targets — the portrait to the player, the
 * rest to the offer.
 */
function SellerPanel({
  seller,
}: {
  seller: NonNullable<MarketListing['seller']>
}) {
  return (
    <span className={PANEL} title={`Angeboten von ${seller.name}`}>
      <Avatar src={seller.image} name={seller.name} size={36} />
      <span className="sr-only">Angeboten von {seller.name}</span>
    </span>
  )
}

/** `+8 %`, `−4 %`, `0 %` — German spacing, and the app's minus sign. */
function percentDelta(value: number): string {
  if (value === 0) return '0 %'
  return `${value > 0 ? '+' : '−'}${String(Math.abs(value))} %`
}

/**
 * How long the listing has left, and when that is.
 *
 * Both, because they answer different questions: "3 Std." is what you plan
 * around, "22:48" is what you set an alarm for.
 *
 * Only Kickbase's listings get here — a manager's shows
 * {@link SellerPanel} — but the wire is the wire: an expiry that fails to
 * arrive on a listing with no seller falls back to a "runs until it sells"
 * wording rather than a dash that would read as a load still in flight.
 */
function Countdown({
  expiresAt,
  now,
}: {
  expiresAt: number | undefined
  now: number
}) {
  if (expiresAt === undefined) {
    return (
      <span className={PANEL}>
        <span className="text-[0.6875rem] leading-tight text-muted">offen</span>
        <span className="text-[0.625rem] leading-tight text-faint">
          bis Verkauf
        </span>
      </span>
    )
  }

  const secondsLeft = Math.round((expiresAt - now) / 1000)
  // Under an hour the listing is about to settle, and that is the one moment
  // the countdown is worth reading twice — so it takes the accent.
  const isUrgent = secondsLeft > 0 && secondsLeft < 3600

  return (
    <span className={PANEL}>
      <span
        className={cn(
          // `truncate`: this line is usually four characters of figure, but
          // for the second between expiry and the next poll it is the word
          // `abgelaufen`, which is wider than the panel.
          'nums w-full truncate text-[0.6875rem] leading-tight font-semibold',
          isUrgent ? 'text-accent' : 'text-ink',
        )}
      >
        {duration(secondsLeft)}
      </span>
      <span className="nums text-[0.625rem] leading-tight text-faint">
        {time(new Date(expiresAt).toISOString())}
      </span>
    </span>
  )
}
