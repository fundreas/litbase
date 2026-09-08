import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  SendHorizontal,
  Trophy,
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Link } from 'react-router'

import { useAchievement } from '@/api/hooks/useAchievements'
import {
  useActivityComments,
  usePostActivityComment,
} from '@/api/hooks/useActivityComments'
import { useMatchdayStandings } from '@/api/hooks/useDuels'
import { usePlayerMarketValue, usePlayerTransfers } from '@/api/hooks/usePlayer'
import { usePlayerOffers } from '@/api/hooks/usePlayerOffers'
import {
  marketValueAt,
  saleLedger,
  type LeagueActivity,
  type MarketValueDay,
  type RankedManager,
  type SaleLedger,
} from '@/api/models'
import { ManagerRankingTab } from '@/components/ranking/ManagerRankingTab'
import { Avatar } from '@/components/ui/Avatar'
import { InfoDialog } from '@/components/ui/InfoDialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import {
  date,
  money,
  moneyDelta,
  relativeTime,
  weekdayDate,
} from '@/lib/format'

/**
 * What a **purchase** opens: who bought whom for how much, **what he was worth
 * that day** — and, the reason the sheet exists rather than a jump to the
 * player, **what you bid**, if you were in on it.
 *
 * Two extra requests, both made only when the sheet opens, because both are one
 * per player and a feed of transfers would otherwise fan out over all of them:
 *
 *  - the **bid**, which is the one figure here the feed entry does not carry at
 *    all;
 *  - the **market-value history**, read for the single day of the transfer. It
 *    shares its query key with the player page's market tab, so a reader who
 *    goes on to open the player pays for it once.
 *
 * Whether Kickbase keeps a *losing* bid once the listing settles is not
 * established — see [`playerOffers`](../../api/endpoints.ts). So the line is
 * rendered when the answer has one and silently absent when it does not,
 * rather than the sheet claiming you did not bid.
 */
export function TransferDialog({
  leagueId,
  activity,
  manager,
  onClose,
}: {
  leagueId: string
  activity: Extract<LeagueActivity, { kind: 'transfer' }>
  /** The buyer from the standings, when the name still resolves to a member. */
  manager: RankedManager | undefined
  onClose: () => void
}) {
  const offers = usePlayerOffers(leagueId, activity.playerId)
  const ownOffer = offers.data?.ownOffer

  const history = usePlayerMarketValue(leagueId, activity.playerId)
  const standing = marketValueAt(history.data, activity.at)

  return (
    <InfoDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Transfer"
    >
      <PlayerLink
        leagueId={leagueId}
        playerId={activity.playerId}
        name={activity.playerName}
        image={activity.playerImage}
        detail={money(activity.price)}
      />

      <DealerRow
        name={activity.managerName}
        image={manager?.image}
        direction="bought"
      />

      {/* What he was worth on the day, and what the fee was next to it — the
          thing that turns a price into a judgement. Today's market value would
          not do: it has moved since, and by the time an old transfer is read
          back it says nothing about the deal.

          Silent on an error, because a missing panel costs the sheet nothing
          while the rest of it — the bid, the thread — still answers. */}
      {history.isPending ? (
        <Skeleton className="h-[4.5rem]" />
      ) : standing !== undefined ? (
        <DealFigures fee={activity.price} standing={standing} side="buyer" />
      ) : history.isSuccess ? (
        <p className="text-xs text-muted">
          Für den Tag des Transfers liefert Kickbase keinen Marktwert – die
          Historie reicht ein Jahr zurück.
        </p>
      ) : null}

      {/* Your own bid, when there was one. A skeleton while it loads, nothing
          at all when the answer is that there is none — an explicit "du hast
          nicht geboten" would be a claim the API cannot support for a
          settled transfer. */}
      {offers.isPending ? (
        <Skeleton className="h-12" />
      ) : ownOffer !== undefined ? (
        <div
          className={cn(
            'flex items-center justify-between gap-3 rounded-card px-3 py-2.5',
            'border border-accent/40 bg-accent/5',
          )}
        >
          <span className="text-sm text-muted">Dein Gebot</span>
          <span className="nums text-sm font-semibold text-accent">
            {money(ownOffer)}
          </span>
        </div>
      ) : null}

      <ActivityCommentThread
        leagueId={leagueId}
        activityId={activity.id}
        commentCount={activity.commentCount}
      />
    </InfoDialog>
  )
}

/**
 * What a **sale** opens: the same sheet a purchase gets, plus the half of the
 * deal the feed does not carry — **what the player had cost the seller, and
 * what the sale therefore made or lost him**.
 *
 * A sale is to Kickbase, so there is no rival bid to report and no *Dein
 * Gebot* line. What there is instead is a history: the seller bought him at
 * some point, at some price, and the whole judgement of a sale sits in the
 * difference. The row used to jump straight to the player's page for that,
 * which meant leaving the feed and then finding the pair of rows on his
 * transfer tab that happened to be this manager's spell.
 *
 * The purchase is dug out of the league's transfer history — one request,
 * shared with the player page's Transfers tab — by
 * [`saleLedger`](../../api/models.ts), which is also what pairs the right
 * purchase with the right sale for a player who has been traded more than
 * once.
 */
export function SaleDialog({
  leagueId,
  activity,
  manager,
  onClose,
}: {
  leagueId: string
  activity: Extract<LeagueActivity, { kind: 'transfer' }>
  /** The seller from the standings, when the name still resolves to a member. */
  manager: RankedManager | undefined
  onClose: () => void
}) {
  const history = usePlayerMarketValue(leagueId, activity.playerId)
  const standing = marketValueAt(history.data, activity.at)
  // Oldest first, so the last day is where the player stands now.
  const today = history.data?.days.at(-1)

  // Unfiltered by season on purpose: the spell this sale ends can have opened
  // before the summer, and a cut list would hide the purchase that is the
  // whole point of the sheet.
  const transfers = usePlayerTransfers(leagueId, activity.playerId)
  const ledger = saleLedger(
    transfers.data,
    history.data,
    { id: manager?.id, name: activity.managerName },
    activity.at,
    activity.price,
  )

  return (
    <InfoDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Verkauf"
    >
      <PlayerLink
        leagueId={leagueId}
        playerId={activity.playerId}
        name={activity.playerName}
        image={activity.playerImage}
        // His value **now**, not the fee: the fee is stated and labelled in
        // the panel below, and what a reader wants beside a face is what the
        // player is worth today — which is what his page opens on too.
        detail={
          today === undefined ? undefined : `Marktwert ${money(today.value)}`
        }
      />

      <DealerRow
        name={activity.managerName}
        image={manager?.image}
        direction="sold"
      />

      {/* The sale itself, and — once the year of values has landed — what he
          was worth the day it went through. The fee is labelled here rather
          than left under his name, because the head of this sheet carries his
          value *today* and two bare figures would not say which was which. */}
      <DealFigures
        feeLabel="Verkauft für"
        fee={activity.price}
        standing={standing}
        side="seller"
      />

      {history.isSuccess && standing === undefined && (
        <p className="text-xs text-muted">
          Für den Tag des Verkaufs liefert Kickbase keinen Marktwert – die
          Historie reicht ein Jahr zurück.
        </p>
      )}

      {/* The ledger. Quiet on an error and quiet on a purchase that cannot be
          found — the sheet still has the sale itself and the thread. */}
      {transfers.isPending ? (
        <Skeleton className="h-24" />
      ) : ledger !== undefined ? (
        <SaleLedgerPanel ledger={ledger} />
      ) : transfers.isSuccess ? (
        <p className="text-xs text-muted">
          Zu diesem Verkauf steht in der Transferhistorie kein Kauf durch{' '}
          {activity.managerName}.
        </p>
      ) : null}

      <ActivityCommentThread
        leagueId={leagueId}
        activityId={activity.id}
        commentCount={activity.commentCount}
      />
    </InfoDialog>
  )
}

/**
 * The other end of the spell: **what he had cost the seller, when, and what
 * the sale therefore settled.**
 *
 * The difference is the line the sheet exists for, so it sits below the rule
 * and a size larger than the figure above it — green on a profit, red on a
 * loss, from the seller's side.
 *
 * **A squad player has no purchase price.** Kickbase deals a starting eleven
 * out for nothing and books the market value of that day as the basis; that is
 * what the profit is measured against here, and the label says *Marktwert bei
 * Zuteilung* rather than pretending to a fee. Where that day predates the year
 * of values the API serves there is no basis at all — the row says so, and the
 * profit line is dropped rather than measured against a zero that would read
 * as the whole fee being profit.
 */
function SaleLedgerPanel({ ledger }: { ledger: SaleLedger }) {
  const { acquisition, basis, cost, profit, heldDays } = ledger

  return (
    <dl className="rounded-card border border-line bg-surface-2/40 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="min-w-0">
          <span className="block truncate text-sm text-muted">
            {basis === 'granted' ? 'Marktwert bei Zuteilung' : 'Gekauft für'}
          </span>
          <span className="block truncate text-xs text-faint">
            {date(acquisition.date)} · {heldDays}{' '}
            {heldDays === 1 ? 'Tag' : 'Tage'} im Kader
          </span>
        </dt>
        <dd
          className={cn(
            'nums shrink-0 text-sm font-semibold',
            cost === undefined ? 'text-faint' : 'text-ink',
          )}
        >
          {cost === undefined ? '–' : money(cost)}
        </dd>
      </div>

      {profit === undefined ? (
        <p className="mt-2 border-t border-line pt-2 text-xs text-muted">
          Für den Tag der Zuteilung liefert Kickbase keinen Marktwert, also auch
          keinen Gewinn.
        </p>
      ) : (
        <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-2">
          <dt className="min-w-0 truncate text-sm text-muted">
            {profit > 0 ? 'Gewinn' : profit < 0 ? 'Verlust' : 'Null auf null'}
          </dt>
          <dd
            className={cn(
              'nums shrink-0 text-base font-semibold',
              profit > 0 && 'text-positive',
              profit < 0 && 'text-negative',
              profit === 0 && 'text-faint',
            )}
          >
            {moneyDelta(profit)}
          </dd>
        </div>
      )}
    </dl>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * The player at the head of a transfer sheet, at the size the market draws him
 * — the sheet is about one player and there is room for his face.
 *
 * **The face and the name are the link to his page.** A *Zum Spieler* row at
 * the foot of the sheet used to carry it, which put the way out as far as
 * possible from the thing it was about and spent a line saying what a tap on a
 * portrait says for free. Everywhere else in the app a player's picture is how
 * you get to a player, so it is here too.
 *
 * Nothing here closes the sheet: it *is* the hash on this page's URL, so
 * navigating away closes it by construction. `replace` spends its entry on the
 * player, so the way back from him is the feed rather than the sheet he was
 * opened from.
 */
function PlayerLink({
  leagueId,
  playerId,
  name,
  image,
  detail,
}: {
  leagueId: string
  playerId: string
  name: string
  image?: string
  /** The line under the name — a fee, a market value, or nothing yet. */
  detail?: ReactNode
}) {
  return (
    <Link
      to={`/leagues/${leagueId}/players/${playerId}`}
      replace
      title={`${name} – Spielerseite öffnen`}
      className={cn(
        '-m-1 flex items-center gap-3 rounded-card p-1',
        'transition-colors hover:bg-surface-2/60',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
      )}
    >
      <Avatar src={image} name={name} size={56} className="bg-surface-2" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-ink">{name}</p>
        {detail !== undefined && (
          <p className="nums truncate text-sm text-muted">{detail}</p>
        )}
      </div>
      <ChevronRight
        size={18}
        aria-hidden="true"
        className="shrink-0 text-faint"
      />
    </Link>
  )
}

/**
 * Who dealt, and which way the player went — the feed row's arrow, at sheet
 * size: green and rightwards into the squad on a purchase, red and leftwards
 * out of it on a sale.
 */
function DealerRow({
  name,
  image,
  direction,
}: {
  name: string
  image?: string
  direction: 'bought' | 'sold'
}) {
  const isBuy = direction === 'bought'
  const Arrow = isBuy ? ArrowRight : ArrowLeft

  return (
    <div className="flex items-center gap-2 rounded-card border border-line bg-surface-2/40 px-3 py-2.5">
      <Arrow
        size={16}
        aria-hidden="true"
        className={isBuy ? 'text-positive' : 'text-negative'}
      />
      <Avatar src={image} name={name} size={28} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
        {name}
      </span>
      <span className="shrink-0 text-xs text-faint">
        {isBuy ? 'gekauft' : 'verkauft'}
      </span>
    </div>
  )
}

/**
 * The money on a transfer: the fee, the market value of the day it went
 * through, and the distance between them.
 *
 * **The day is named on the label**, not left implicit — the snapshot is a
 * daily one and Kickbase moves values overnight, so a transfer late in the
 * evening can sit within a day of the figure quoted here; see
 * [`marketValueAt`](../../api/models.ts). A dated label is honest about that in
 * a way a bare *Marktwert* would not be.
 *
 * **Colour reads from the dealing manager's side, so it flips with the
 * direction.** Paying over the market value is an instant paper loss on the
 * squad it lands in, so an *Aufpreis* on a purchase is red and a bargain green;
 * being paid over it is a win, so the same sign on a sale is green. The same
 * reading the [player's transfer tab](../player/PlayerTransfersTab.tsx) uses,
 * and the direction the app's profit and loss run everywhere else.
 *
 * The **fee row** is opt-in through `feeLabel`, because the purchase sheet
 * already carries the fee under the player's name and the sale sheet does not
 * — its head is the player's value today.
 */
function DealFigures({
  feeLabel,
  fee,
  standing,
  side,
}: {
  /** Names the fee row and turns it on — omitted where the head carries it. */
  feeLabel?: string
  fee: number
  /** The valuation of the transfer day; absent outside the year served. */
  standing: MarketValueDay | undefined
  side: 'buyer' | 'seller'
}) {
  if (feeLabel === undefined && standing === undefined) return null

  const premium = standing === undefined ? undefined : fee - standing.value
  const favourable =
    premium !== undefined && (side === 'seller' ? premium > 0 : premium < 0)

  return (
    <dl className="rounded-card border border-line bg-surface-2/40 px-3 py-2.5">
      {feeLabel !== undefined && (
        <div className="flex items-baseline justify-between gap-3">
          <dt className="min-w-0 truncate text-sm text-muted">{feeLabel}</dt>
          <dd className="nums shrink-0 text-sm font-semibold text-ink">
            {money(fee)}
          </dd>
        </div>
      )}

      {standing !== undefined && premium !== undefined && (
        <>
          <div
            className={cn(
              'flex items-baseline justify-between gap-3',
              feeLabel !== undefined && 'mt-2 border-t border-line pt-2',
            )}
          >
            <dt className="min-w-0 truncate text-sm text-muted">
              Marktwert am {weekdayDate(standing.date)}
            </dt>
            <dd className="nums shrink-0 text-sm font-semibold text-ink">
              {money(standing.value)}
            </dd>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-2">
            <dt className="min-w-0 truncate text-sm text-muted">
              {premium === 0
                ? 'Zum Marktwert'
                : side === 'seller'
                  ? premium > 0
                    ? 'Über Marktwert'
                    : 'Unter Marktwert'
                  : premium > 0
                    ? 'Aufpreis'
                    : 'Abschlag'}
            </dt>
            <dd
              className={cn(
                'nums shrink-0 text-sm font-semibold',
                premium === 0 && 'text-faint',
                premium !== 0 &&
                  (favourable ? 'text-positive' : 'text-negative'),
              )}
            >
              {moneyDelta(premium)}
            </dd>
          </div>
        </>
      )}
    </dl>
  )
}

/**
 * **The chat thread on a feed entry**, and the box to add to it.
 *
 * Kickbase's feed carries comments and the app has never shown one. The count
 * is on every entry; this is what is behind it.
 *
 * **The thread is only fetched when the entry says it has one.** `coc` is `0`
 * on every entry of both probed leagues, so opening a sheet would otherwise be
 * a request to be told "none" every single time. Writing one flips it on,
 * because by then there is something to read.
 *
 * ## The honest caveat
 *
 * Nobody has ever commented in either league, and Kickbase's own spec leaves
 * the comment's shape undescribed — so the field names
 * [the mapper](../../api/hooks/useActivityComments.ts) reads are educated
 * guesses at this API's own vocabulary. A guess that misses costs a missing
 * line, not a broken sheet, and the note below says so when it happens rather
 * than leaving a row mysteriously blank. The first real comment settles it.
 */
function ActivityCommentThread({
  leagueId,
  activityId,
  commentCount,
}: {
  leagueId: string
  activityId: string
  commentCount: number
}) {
  const [draft, setDraft] = useState('')
  // Written one this session? Then there is a thread to read even if the entry
  // arrived saying there was none.
  const [hasPosted, setHasPosted] = useState(false)

  const comments = useActivityComments(leagueId, activityId, {
    enabled: commentCount > 0 || hasPosted,
  })
  const postComment = usePostActivityComment(leagueId, activityId)

  const rows = comments.data ?? []
  /* Rows arrived but none of them had text under any name this knows: the
     guess missed, and saying so is more use than a column of empty lines. */
  const isUnreadable =
    rows.length > 0 && rows.every((r) => r.text === undefined)

  const submit = () => {
    const text = draft.trim()
    if (text === '' || postComment.isPending) return
    postComment.mutate(text, {
      onSuccess: () => {
        setDraft('')
        setHasPosted(true)
      },
    })
  }

  return (
    <section className="flex flex-col gap-2 border-t border-line pt-3">
      {comments.isPending && (commentCount > 0 || hasPosted) ? (
        <Skeleton className="h-10" />
      ) : isUnreadable ? (
        <p className="text-xs text-muted">
          Kickbase liefert {rows.length}{' '}
          {rows.length === 1 ? 'Kommentar' : 'Kommentare'} in einem Format, das
          die App noch nicht lesen kann.
        </p>
      ) : (
        rows.map((comment) => (
          <div key={comment.id} className="flex items-start gap-2">
            <Avatar
              src={comment.authorImage}
              name={comment.authorName ?? '?'}
              size={24}
              className="mt-0.5 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline gap-1.5">
                {comment.authorName !== undefined && (
                  <span className="truncate text-xs font-semibold text-ink">
                    {comment.authorName}
                  </span>
                )}
                {comment.at !== undefined && (
                  <span className="shrink-0 text-[0.6875rem] text-faint">
                    {relativeTime(comment.at)}
                  </span>
                )}
              </p>
              <p className="text-sm break-words text-muted">{comment.text}</p>
            </div>
          </div>
        ))
      )}

      {/* A form, so Enter submits without a key handler having to say so — and
          so the phone keyboard offers a send key rather than a newline. */}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        className="flex items-center gap-2"
      >
        <input
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
          }}
          placeholder="Kommentieren …"
          aria-label="Kommentar schreiben"
          disabled={postComment.isPending}
          /* 16px so iOS Safari does not zoom the sheet on focus, the same
             floor the app's `Input` sets for the reason. */
          className={cn(
            'h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-base text-ink',
            'placeholder:text-faint focus:border-accent focus:outline-none',
            'disabled:opacity-60',
          )}
        />
        <button
          type="submit"
          disabled={draft.trim() === '' || postComment.isPending}
          aria-label="Kommentar senden"
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            'bg-accent text-accent-ink transition-opacity',
            'disabled:pointer-events-none disabled:opacity-40',
          )}
        >
          {postComment.isPending ? (
            <Spinner size={16} />
          ) : (
            <SendHorizontal size={17} aria-hidden="true" />
          )}
        </button>
      </form>

      {postComment.isError && (
        <p role="alert" className="text-xs text-negative">
          {postComment.error.message}
        </p>
      )}
    </section>
  )
}

/**
 * What an achievement row opens: the description Kickbase gives it, what it
 * paid, and how often the viewer has earned it.
 *
 * The name and the description are already on the feed entry; the reward and
 * the count are not, so the sheet reads the same per-type detail the row used
 * for its subtitle — one cache entry between them, no second request.
 */
export function AchievementDialog({
  leagueId,
  achievementType,
  title,
  description,
  onClose,
}: {
  leagueId: string
  achievementType: number
  title: string
  description: string
  onClose: () => void
}) {
  const query = useAchievement(leagueId, achievementType)
  const achievement = query.data

  return (
    <InfoDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={
        <span className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Trophy size={16} aria-hidden="true" />
          </span>
          {title}
        </span>
      }
      description={description}
    >
      {query.isPending ? (
        <Skeleton className="h-14" />
      ) : query.isError ? (
        <ErrorState error={query.error} className="py-4" />
      ) : (
        <dl className="grid grid-cols-2 gap-2">
          <Fact
            label="Prämie"
            value={
              achievement !== undefined && achievement.reward > 0
                ? moneyDelta(achievement.reward)
                : 'keine'
            }
            tone={
              achievement !== undefined && achievement.reward > 0
                ? 'positive'
                : undefined
            }
          />
          <Fact
            label="Erreicht"
            value={`${String(achievement?.timesEarned ?? 0)}×`}
          />
        </dl>
      )}
    </InfoDialog>
  )
}

function Fact({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'positive'
}) {
  return (
    <div className="rounded-card border border-line bg-surface-2/40 px-3 py-2">
      <dt className="text-[0.6875rem] tracking-wide text-faint uppercase">
        {label}
      </dt>
      <dd
        className={`nums mt-0.5 text-base font-semibold ${tone === 'positive' ? 'text-positive' : 'text-ink'}`}
      >
        {value}
      </dd>
    </div>
  )
}

/**
 * What a matchday row opens — **in every league**: the matchday's manager
 * ranking, the same rows the duels page's Rangliste draws.
 *
 * Reads `/ranking?dayNumber=` rather than the feed entry's own detail — that
 * one has placements and points but no avatars, and the standings entry is
 * one the duels and matchday pages may already have filled.
 *
 * ## The way out is in the head, not in the row
 *
 * A duel league used to have the row *navigate* to that matchday's duels, so
 * the one league mode where a settled matchday raises the most questions was
 * the one that never got the answer in place — the feed was left behind for a
 * page, and the ranking took a second tap to find. The sheet now opens for
 * everybody, and the link that was the row's whole behaviour sits beside the
 * title instead:
 *
 *  - **Duelle** in a duel league, at that matchday — the pairings for the day
 *    the sheet is about, which is what the rows here are each half of;
 *  - **Rangliste** anywhere else — the season table, the only league-wide
 *    ranking a normal league has. It is not day-scoped, and it is the right
 *    place to land from a matchday that has just moved it.
 *
 * ## In a duel league every row says how the duel went
 *
 * Won, drawn or lost, as an icon *and* the word — `ManagerRankingTab` draws
 * that line itself, from the opponent each manager names in `hhoui` on this
 * very response. `hhoui` is per-`dayNumber`, so it is the pairing of **the
 * matchday the sheet is about**, not of the current one.
 *
 * It is the `isFinished` below that turns those outcomes on, and it is hard
 * `true` here on purpose: the row that opens this sheet is a *Spieltag ist
 * beendet* entry, so the matchday is over by the time the feed mentions it at
 * all. That gate exists because level at `0` in the third minute is not a
 * draw — a state this sheet cannot be in.
 */
export function MatchdayDialog({
  leagueId,
  day,
  label,
  viewerId,
  isDuelMode,
  onClose,
}: {
  leagueId: string
  day: number
  label: string
  viewerId: string | undefined
  /** Played as duels? Decides where the head link goes — see above. */
  isDuelMode: boolean
  onClose: () => void
}) {
  const query = useMatchdayStandings(leagueId, day)

  return (
    <InfoDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={
        <span className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate">{label}</span>
          {/* Closed on the way out: the sheet is a view of the page being
              opened, and leaving it stacked behind the destination would put
              an overlay over the answer. Nothing here has to close it — the
              sheet is this page's hash and the link leaves the page — and
              `replace` spends its history entry on the destination, so back
              from the duels lands on the feed rather than back inside here. */}
          <Link
            replace
            to={
              isDuelMode
                ? `/leagues/${leagueId}/duels?day=${String(day)}`
                : `/leagues/${leagueId}/ranking`
            }
            className={cn(
              '-mr-1 flex shrink-0 items-center gap-0.5 rounded-card px-1.5 py-1',
              'text-xs font-medium text-accent transition-colors hover:bg-surface-2/60',
              'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
            )}
          >
            {isDuelMode ? 'Duelle' : 'Rangliste'}
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </span>
      }
    >
      {query.isError ? (
        <ErrorState error={query.error} className="py-4" />
      ) : (
        <ManagerRankingTab
          standings={query.data}
          leagueId={leagueId}
          viewerId={viewerId}
          // The feed only ever names a matchday that is over — and this is
          // what puts *Gewonnen* / *Remis* / *Verloren* on every row of a
          // duel league. See above before loosening it.
          isFinished
          isPending={query.isPending}
        />
      )}
    </InfoDialog>
  )
}
