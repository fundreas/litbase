import { ArrowRight, ChevronRight, SendHorizontal, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { useAchievement } from '@/api/hooks/useAchievements'
import {
  useActivityComments,
  usePostActivityComment,
} from '@/api/hooks/useActivityComments'
import { useMatchdayStandings } from '@/api/hooks/useDuels'
import { usePlayerMarketValue } from '@/api/hooks/usePlayer'
import { usePlayerOffers } from '@/api/hooks/usePlayerOffers'
import {
  marketValueAt,
  type LeagueActivity,
  type MarketValueDay,
  type RankedManager,
} from '@/api/models'
import { ManagerRankingTab } from '@/components/ranking/ManagerRankingTab'
import { Avatar } from '@/components/ui/Avatar'
import { InfoDialog } from '@/components/ui/InfoDialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { money, moneyDelta, relativeTime, weekdayDate } from '@/lib/format'

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
      {/* The player, at the size the market draws him — this sheet is about
          one player and there is room for his face.

          **The face and the name are the link to his page.** A *Zum Spieler*
          row at the foot of the sheet used to carry it, which put the way out
          as far as possible from the thing it was about and spent a line saying
          what a tap on a portrait says for free. Everywhere else in the app a
          player's picture is how you get to a player, so it is here too.

          Nothing here closes the sheet: it *is* the hash on this page's URL,
          so navigating away closes it by construction. `replace` spends its
          entry on the player, so the way back from him is the feed rather than
          the sheet he was opened from. */}
      <Link
        to={`/leagues/${leagueId}/players/${activity.playerId}`}
        replace
        title={`${activity.playerName} – Spielerseite öffnen`}
        className={cn(
          '-m-1 flex items-center gap-3 rounded-card p-1',
          'transition-colors hover:bg-surface-2/60',
          'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        )}
      >
        <Avatar
          src={activity.playerImage}
          name={activity.playerName}
          size={56}
          className="bg-surface-2"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-ink">
            {activity.playerName}
          </p>
          <p className="nums text-sm text-muted">{money(activity.price)}</p>
        </div>
        <ChevronRight
          size={18}
          aria-hidden="true"
          className="shrink-0 text-faint"
        />
      </Link>

      <div className="flex items-center gap-2 rounded-card border border-line bg-surface-2/40 px-3 py-2.5">
        <ArrowRight size={16} aria-hidden="true" className="text-positive" />
        <Avatar src={manager?.image} name={activity.managerName} size={28} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
          {activity.managerName}
        </span>
        <span className="shrink-0 text-xs text-faint">gekauft</span>
      </div>

      {/* What he was worth on the day, and what the fee was next to it — the
          thing that turns a price into a judgement. Today's market value would
          not do: it has moved since, and by the time an old transfer is read
          back it says nothing about the deal.

          Silent on an error, because a missing panel costs the sheet nothing
          while the rest of it — the bid, the thread — still answers. */}
      {history.isPending ? (
        <Skeleton className="h-[4.5rem]" />
      ) : standing !== undefined ? (
        <TransferPremium paid={activity.price} standing={standing} />
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
 * The fee against the market value of the transfer day: what the player was
 * worth, then what the buyer paid over or under it.
 *
 * **The day is named on the label**, not left implicit — the snapshot is a
 * daily one and Kickbase moves values overnight, so a transfer late in the
 * evening can sit within a day of the figure quoted here; see
 * [`marketValueAt`](../../api/models.ts). A dated label is honest about that in
 * a way a bare *Marktwert* would not be.
 *
 * **Colour is the buyer's side of it.** Paying over the market value is an
 * instant paper loss on the squad it lands in, so an *Aufpreis* is red and a
 * bargain green — the same direction the app's profit and loss run everywhere
 * else, read from the perspective of the manager who dealt.
 */
function TransferPremium({
  paid,
  standing,
}: {
  paid: number
  standing: MarketValueDay
}) {
  const premium = paid - standing.value

  return (
    <dl className="rounded-card border border-line bg-surface-2/40 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="min-w-0 truncate text-sm text-muted">
          Marktwert am {weekdayDate(standing.date)}
        </dt>
        <dd className="nums shrink-0 text-sm font-semibold text-ink">
          {money(standing.value)}
        </dd>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-2">
        <dt className="min-w-0 truncate text-sm text-muted">
          {premium > 0
            ? 'Aufpreis'
            : premium < 0
              ? 'Abschlag'
              : 'Zum Marktwert'}
        </dt>
        <dd
          className={cn(
            'nums shrink-0 text-sm font-semibold',
            premium > 0 && 'text-negative',
            premium < 0 && 'text-positive',
            premium === 0 && 'text-faint',
          )}
        >
          {moneyDelta(premium)}
        </dd>
      </div>
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
