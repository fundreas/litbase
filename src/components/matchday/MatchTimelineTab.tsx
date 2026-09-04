import { ArrowLeftRight, Flag, PauseCircle, Play } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import {
  eventSide,
  matchTimeline,
  TIMELINE_MARKER_LABEL,
  timelineEventLabel,
  type FixtureState,
  type MatchDetail,
  type MatchTimelineEvent,
  type MatchTimelineItem,
  type TimelineMarker,
} from '@/api/models'
import { EventGlyph } from '@/components/player/statGlyphs'
import { EmptyState } from '@/components/ui/States'
import { cn } from '@/lib/cn'
import { time } from '@/lib/format'

const MARKER_ICON: Record<TimelineMarker, LucideIcon> = {
  kickoff: Play,
  halfTime: PauseCircle,
  fullTime: Flag,
}

/**
 * Everything that happened in the match, newest first.
 *
 * **Newest first** because the case that matters is the live one: what just
 * happened belongs where the eye lands, not at the bottom of a list that has
 * been growing for two hours. So the final whistle heads the list once it has
 * blown, half-time sits between the halves, and the kick-off closes it —
 * [`matchTimeline()`](../../api/models.ts) weaves those three in.
 *
 * **Two sides around a spine.** The home club's events swing left and the away
 * club's right, mirrored — the glyph nearest the centre line, the names running
 * outward — with the minute on the spine between them. It is the layout every
 * match report uses, and the reason it is worth the width is that **the side
 * replaces the crest**: which club an event belongs to is answered by where the
 * row sits, in the same left/right arrangement the header above it already
 * established, so nothing has to be read to know whose goal it was.
 *
 * The narrow-screen cost is real and paid deliberately. Each side gets a little
 * under half of ~350px, so a long name truncates where a single full-width
 * column would have fitted it. Two lines per event keep that manageable: the
 * player on the first, what he did on the second.
 *
 * An event the feed attributes to **no club** — not observed, but the payload
 * allows it — spans the whole width rather than being guessed onto a side.
 *
 * The marks are the app's shared [`EventGlyph`](../player/statGlyphs.tsx)s, so
 * a ball here means the same thing as a ball on a player's match row and in his
 * season grid. Substitutions get an arrow pair of their own: they are excluded
 * from the glyph scale on purpose, because on a *player* a swap says where he
 * was rather than what he did — but on a match timeline it is one of the events
 * the reader came for.
 */
export function MatchTimelineTab({
  detail,
  state,
  kickoff,
}: {
  detail: MatchDetail
  /** Where the match stands, from the fixture list — see `matchTimeline()`. */
  state: FixtureState
  /** Kick-off, ISO 8601, for the marker at the foot of the list. */
  kickoff: string
}) {
  const items = matchTimeline(detail, state)

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Play size={22} />}
        title="Noch kein Spielverlauf"
        description={`Das Spiel wird um ${time(kickoff)} angepfiffen.`}
      />
    )
  }

  return (
    /* The spine, drawn once behind the rows rather than per row: a segment per
       row would break at every gap and at the markers, and it has to line up
       with the minute column in all of them. `left-1/2` is exact because the
       grid below is `1fr auto 1fr` — the centre column is centred by
       construction, whatever the minutes are. */
    <div className="relative">
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line"
      />
      <ol className="relative flex flex-col">
        {items.map((item) => (
          <TimelineRow
            key={item.id}
            item={item}
            detail={detail}
            kickoff={kickoff}
          />
        ))}
      </ol>
    </div>
  )
}

/** The three columns every row shares: one side, the spine, the other side. */
const ROW_GRID = 'grid grid-cols-[1fr_auto_1fr] items-start gap-1'

function TimelineRow({
  item,
  detail,
  kickoff,
}: {
  item: MatchTimelineItem
  detail: MatchDetail
  kickoff: string
}) {
  if (item.kind === 'marker') {
    return <MarkerRow marker={item.marker} kickoff={kickoff} />
  }

  const side = eventSide(item.event, detail)

  // No club named. Not observed, and not guessable either way — so the row
  // spans both sides with the minute beside it rather than picking one.
  if (side === undefined) {
    return (
      <li className="flex items-start gap-2.5 py-2">
        <Minute minute={item.event.minute} />
        <EventBody event={item.event} align="left" />
      </li>
    )
  }

  const isAway = side === 'away'

  return (
    <li className={cn(ROW_GRID, 'py-2')}>
      {isAway ? <span /> : <EventBody event={item.event} align="right" />}
      <Minute minute={item.event.minute} />
      {isAway ? <EventBody event={item.event} align="left" /> : <span />}
    </li>
  )
}

/**
 * The mark and the words: what happened, to whom, and who else was involved.
 *
 * **Mirrored by side.** `align="right"` is the home half — the text hugs the
 * spine's left edge and the glyph sits innermost, next to the minute;
 * `align="left"` is the away half, the same row read the other way. That is
 * what makes the two columns face each other rather than look like one list
 * indented twice.
 *
 * The second line is the folded-in `rev` player — the assist behind a goal, the
 * player coming off in a swap. It is a **name only** and never a link: that
 * nested entry carries `pi: "0"` even while naming somebody, so there is no id
 * to navigate to.
 */
function EventBody({
  event,
  align,
}: {
  event: MatchTimelineEvent
  /** `right` for the home half, `left` for the away half. */
  align: 'left' | 'right'
}) {
  const isSubstitution = event.kind === 'substitution'
  const label = timelineEventLabel(event.kind)

  /*
   * The player is the headline where the feed names one, and the kind falls
   * back into that slot where it does not — a row reading *Wechsel* over
   * *Wechsel* is worse than one reading *Wechsel* alone.
   */
  const secondLine = [
    event.playerName === undefined ? undefined : label,
    event.relatedName === undefined
      ? undefined
      : isSubstitution
        ? `für ${event.relatedName}`
        : event.relatedName,
  ]
    .filter((part) => part !== undefined)
    .join(' · ')

  return (
    /* `flex-row-reverse` on the home half is what mirrors the row: the glyph
       ends up innermost, against the spine, and the text reads outward from
       it. One declaration rather than two orderings of the same markup. */
    <div
      className={cn(
        'flex min-w-0 items-start gap-2',
        align === 'right' && 'flex-row-reverse',
      )}
    >
      <span className="flex h-5 w-4 shrink-0 items-center justify-center">
        {event.kind === 'substitution' ? (
          <ArrowLeftRight
            size={13}
            aria-hidden="true"
            className="text-warning"
          />
        ) : (
          <EventGlyph kind={event.kind} size={14} />
        )}
      </span>

      <div className={cn('min-w-0 flex-1', align === 'right' && 'text-right')}>
        <p className="truncate text-sm font-medium text-ink">
          {event.playerName ?? label}
        </p>
        {secondLine !== '' && (
          <p className="truncate text-xs text-muted">{secondLine}</p>
        )}
      </div>
    </div>
  )
}

/**
 * `67'`, on the spine.
 *
 * `bg-canvas` is load-bearing: the vertical rule runs the full height of the
 * list behind the rows, and without an opaque chip it would draw straight
 * through the digits. The fixed width is what keeps the two sides symmetrical
 * whether the minute is one character or three.
 */
function Minute({ minute }: { minute: number }) {
  return (
    <span className="nums w-9 shrink-0 bg-canvas py-0.5 text-center text-xs font-semibold text-faint">
      {minute}&#39;
    </span>
  )
}

/**
 * Anpfiff, Halbzeit, Abpfiff — drawn as a **divider**, not as an event.
 *
 * They are derived from the match's state rather than read from the feed (the
 * reasoning is on [`TimelineMarker`](../../api/models.ts)), and a full-width
 * rule with the word on it is the honest shape for that: it separates the
 * halves without pretending to be one more thing a player did.
 */
function MarkerRow({
  marker,
  kickoff,
}: {
  marker: TimelineMarker
  kickoff: string
}) {
  const Icon = MARKER_ICON[marker]

  return (
    <li className="flex items-center gap-2 py-2">
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
      <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-0.5">
        <Icon size={12} aria-hidden="true" className="text-faint" />
        <span className="text-[0.6875rem] font-semibold tracking-wide text-muted uppercase">
          {TIMELINE_MARKER_LABEL[marker]}
        </span>
        {marker === 'kickoff' && (
          <span className="nums text-[0.6875rem] text-faint">
            {time(kickoff)}
          </span>
        )}
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
    </li>
  )
}
