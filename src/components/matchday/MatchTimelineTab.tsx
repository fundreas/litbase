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
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/States'
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
 * **One column, not two.** A centre-line timeline with home events swinging
 * left and away events right is the classic layout and it needs width this app
 * does not have: on a phone each side gets 160px, which is not enough for a
 * name and a mark. So every row reads the same way — minute, club crest, mark,
 * who — and the crest is what says whose event it was. That is one glance
 * rather than two, and it does not degrade on a narrow screen.
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
    <ol className="flex flex-col">
      {items.map((item) => (
        <TimelineRow
          key={item.id}
          item={item}
          detail={detail}
          kickoff={kickoff}
        />
      ))}
    </ol>
  )
}

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
  const team =
    side === 'home' ? detail.home : side === 'away' ? detail.away : undefined

  return (
    <li className="flex items-start gap-2.5 py-2">
      <Minute minute={item.event.minute} />

      {/* The crest is what says whose event this is — the one job the missing
          second column had. `–` keeps the gutter aligned when the feed names
          no club, which has not been observed but the shape allows. */}
      <span className="flex w-7 shrink-0 justify-center pt-0.5">
        {team === undefined ? (
          <span className="text-xs text-faint">–</span>
        ) : (
          <Avatar
            src={team.image}
            name={team.symbol}
            size={22}
            square
            className="bg-transparent"
          />
        )}
      </span>

      <EventBody event={item.event} />
    </li>
  )
}

/**
 * The mark and the words: what happened, to whom, and who else was involved.
 *
 * The second line is the folded-in `rev` player — the assist behind a goal, the
 * player coming off in a swap. It is a **name only** and never a link: that
 * nested entry carries `pi: "0"` even while naming somebody, so there is no id
 * to navigate to.
 */
function EventBody({ event }: { event: MatchTimelineEvent }) {
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
    <div className="flex min-w-0 flex-1 items-start gap-2">
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

      <div className="min-w-0 flex-1">
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

/** `67'`, in a fixed gutter so the column reads straight down. */
function Minute({ minute }: { minute: number }) {
  return (
    <span className="nums w-9 shrink-0 pt-0.5 text-right text-xs font-semibold text-faint">
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
