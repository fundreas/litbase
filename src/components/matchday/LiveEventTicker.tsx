import { Bell, BellOff } from 'lucide-react'

import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'
import { delta } from '@/lib/format'
import type { LiveEvent } from '@/components/matchday/useLiveEventTicker'

/**
 * **The strip under the bar: what just happened, as it happens.**
 *
 * One action at a time — *42' · Grimaldo · Erfolgreicher Pass · +1* — held for
 * two seconds and replaced by the next, the way a broadcast lower third works.
 * It is a *glance*, and everything about it follows from that: one line, no
 * scrolling, no history, nothing to tap. The full record is two taps away in
 * the [timeline](./MatchTimelineTab.tsx) and, per player, in his
 * [breakdown](../player/PlayerMatchEventsDialog.tsx).
 *
 * ## The strip keeps its height when it is empty
 *
 * Not a bar that appears and disappears — that is the whole reason it is drawn
 * this way. The pitch under it measures its box with a `ResizeObserver` and
 * re-runs its sizing search whenever that box changes
 * ([`usePitchBox`](../squad/pitchMetrics.ts)): a strip that came and went every
 * two seconds would have twenty-two portraits growing and shrinking under it
 * all afternoon. So the row is there for as long as the stream is on, and only
 * its contents change.
 *
 * Which leaves the empty state to say something, and it says the one thing
 * worth knowing while nothing is happening: that it is listening. A pulse and a
 * word, at the weight of a caption — the bell in the bar says the same thing,
 * and this is the half of it the reader is already looking at.
 *
 * ## Why there is no exit animation
 *
 * Each event is keyed by its own id, so React mounts a new element per action
 * and `animate-pop-in` plays on each — the row *arrives*, which is the half of
 * the motion that carries meaning. Fading the old one out first would either
 * delay the new one or overlap two lines in one strip; at two seconds a beat,
 * the cut is the honest edit. `prefers-reduced-motion` removes even that: the
 * app's [global rule](../../index.css) collapses every animation to nothing,
 * and the strip still says exactly what it said.
 */
export function LiveEventTicker({ event }: { event: LiveEvent | undefined }) {
  return (
    <div
      // `polite`, not `assertive`: a screen reader should hear about a goal
      // when it has finished the sentence it is on, not instead of it. And
      // `atomic`, because "Erfolgreicher Pass" without the name in front of it
      // is not the announcement.
      aria-live="polite"
      aria-atomic="true"
      className="flex h-9 shrink-0 items-center overflow-hidden px-3"
    >
      {event === undefined ? (
        <span className="flex items-center gap-2 text-[11px] font-medium text-faint">
          {/* The app's live mark, unchanged: the same pulsing accent dot the
              scoreline, the fixture rows and the matchday picker all use for
              "this is moving". */}
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent" />
          Live-Events
        </span>
      ) : (
        <div
          key={event.id}
          className="flex min-w-0 flex-1 animate-pop-in items-center gap-2"
        >
          <span className="nums shrink-0 text-[11px] font-semibold text-faint">
            {event.minute}′
          </span>

          <Avatar
            src={event.playerImage}
            name={event.playerName}
            size={22}
            className={cn(
              'shrink-0 ring-1',
              // The same two rings the portraits on the grass take, so a row
              // says which side it belongs to without naming the club.
              event.side === 'home' ? 'ring-white/75' : 'ring-accent/80',
            )}
          />

          <span className="shrink-0 truncate text-xs font-semibold text-ink">
            {event.playerName}
          </span>

          {/* The action gives way first: a name and a number with no room left
              still says who did something and what it was worth. */}
          <span className="min-w-0 flex-1 truncate text-xs text-muted">
            {event.name}
          </span>

          <span
            className={cn(
              'nums shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold',
              event.points > 0
                ? 'bg-positive/15 text-positive'
                : 'bg-negative/15 text-negative',
            )}
          >
            {delta(event.points)}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * **The bell: the stream's on/off, where the stream is.**
 *
 * In the full-screen bar rather than on the
 * [preferences page](../../pages/PreferencesPage.tsx), because it is a decision
 * made *while being interrupted* — the reader who has had enough of successful
 * passes wants them gone from this screen, in this half, without leaving the
 * match to find a settings list. The choice is persisted all the same
 * ([`liveEventStream`](../../preferences/preferences.ts)), so it holds for the
 * next match too.
 *
 * A single toggle rather than a pair of buttons, and the icon is the *state*,
 * not the action: a bell means the stream is running, a struck-through bell
 * means it is not. `aria-pressed` says which to a reader who cannot see the
 * glyph, and the title says what the tap will do — the two halves of a toggle
 * that the icon alone cannot carry.
 */
export function LiveEventsToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean
  onToggle: () => void
}) {
  const label = enabled
    ? 'Event-Stream ausschalten'
    : 'Event-Stream einschalten'

  return (
    <button
      type="button"
      onClick={onToggle}
      title={label}
      aria-label={label}
      aria-pressed={enabled}
      className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors',
        'hover:bg-surface-2',
        enabled ? 'text-accent hover:text-accent' : 'text-muted hover:text-ink',
      )}
    >
      {enabled ? (
        <Bell size={18} aria-hidden="true" />
      ) : (
        <BellOff size={18} aria-hidden="true" />
      )}
    </button>
  )
}
