import { useEffect } from 'react'
import { createPortal } from 'react-dom'

import type { CurrentMatchday } from '@/api/hooks/useMatchday'
import { FixtureBadge } from '@/components/squad/FixtureBadge'
import { UpcomingFixtures } from '@/components/squad/SquadReading'
import { cn } from '@/lib/cn'

/** How many opponents the track draws. */
export const TRACK_LENGTH = 2

/** How many a [tap](./useFixturePeek.tsx) brings up. */
export const TRACK_PEEK_LENGTH = 5

/**
 * The leading crest, in px — and with it the whole track's height.
 *
 * The fixture badge's own `lg`, unchanged from the single crest this replaced:
 * the panel is `w-14` with a pixel of padding either side, so the track has
 * exactly 48px, and `38 + 10` is all of it. Two opponents rather than three is
 * what buys that — a third would have cost the leading crest four pixels, and
 * the next opponent is still the fact the row is carrying.
 */
const CREST = 38

/** How far the crest behind sits out from the one in front of it. */
const SHIFT = 10

/** How long the dismissing tap's click stays armed to be swallowed. */
const CLICK_SWALLOW_MS = 400

/**
 * How far back each crest is, as opacity.
 *
 * The next opponent is the fact the row is carrying and the one behind it is
 * context, so the second is halved rather than nudged. Indexed by place in the
 * track.
 */
const DEPTH = [1, 0.5]

/**
 * **A club's next two opponents, one behind the other** — what a
 * [Kader row](./PlayerListTab.tsx)'s fixture panel carries in place of the one
 * crest it used to.
 *
 * The second is offset to the right and halved in opacity, so the panel reads
 * as a track running away from the reader: the match that decides this
 * weekend's points is whole and in front, and the one after it sits behind,
 * recognisable as a club without competing with it. A single crest answered
 * *who on Saturday*; the track answers *and then who*, at no cost to the row's
 * width and without a reading of its own to switch into. The rest of the month
 * is one tap away — see [the peek](./useFixturePeek.tsx).
 *
 * **Two crests, five fixtures spelled out.** The leading badge carries its own
 * matchday in its label the way it always did; the one behind it is hidden
 * from assistive tech as a picture — a second "Auswärtsspiel gegen FCB" in the
 * middle of a row is noise — and reads instead as one sentence after it,
 * covering everything the tap would bring up. The tap is a pointer's, so what
 * it opens cannot be the only place the answer lives.
 *
 * A club with a bye gets that badge's dash, the honest answer, and the track
 * keeps its shape.
 */
export function FixtureTrack({
  matchdays,
  teamId,
}: {
  /**
   * The next matchdays, in order. The first {@link TRACK_LENGTH} are drawn;
   * up to {@link TRACK_PEEK_LENGTH} are named for a screen reader.
   */
  matchdays: CurrentMatchday[]
  /** The club whose fixture to pick out of each one. */
  teamId: string
}) {
  const track = matchdays.slice(0, TRACK_LENGTH)
  const width = CREST + SHIFT * Math.max(0, track.length - 1)
  const rest = matchdays.slice(1, TRACK_PEEK_LENGTH)

  return (
    <span className="relative block shrink-0" style={{ width, height: CREST }}>
      {track.map((matchday, index) => (
        <span
          key={matchday.day}
          /* Later crests are *behind*, so the leading one keeps the top of
             the stack and its venue chip stays unobscured. Inline because
             both the offset and the fade are per-index. */
          style={{
            left: index * SHIFT,
            zIndex: track.length - index,
            opacity: DEPTH[index],
          }}
          className="absolute top-0"
          aria-hidden={index === 0 ? undefined : 'true'}
        >
          <FixtureBadge
            fixture={matchday.fixtureByTeamId.get(teamId)}
            size={CREST}
            day={matchday.day}
          />
        </span>
      ))}

      {rest.length > 0 && (
        <span className="sr-only">
          {' Danach: '}
          {rest.map((matchday) => fixtureSentence(matchday, teamId)).join(', ')}
          .
        </span>
      )}
    </span>
  )
}

/** One upcoming fixture, for a screen reader — "13. Spieltag auswärts gegen FCB". */
function fixtureSentence(matchday: CurrentMatchday, teamId: string): string {
  const fixture = matchday.fixtureByTeamId.get(teamId)
  const day = `${String(matchday.day)}. Spieltag`
  if (fixture === undefined) return `${day} kein Spiel`
  const venue = fixture.isHome ? 'zu Hause' : 'auswärts'
  return `${day} ${venue} gegen ${fixture.opponentSymbol}`
}

/**
 * The layer itself: five columns over the panel that was tapped.
 *
 * **Portalled, and `fixed`.** The rows sit in a card with `overflow-hidden` —
 * the clip is what gives a position its rounded ends — so anything positioned
 * inside the row is cut off at its edge. The layer is therefore measured off
 * the panel's box on the screen and placed against the window.
 *
 * It is pinned by its **right** edge to the panel's, because the panel is the
 * last column of the row: a centred layer would hang off the screen on a
 * phone, and clamping it would leave it pointing at nothing. Above the panel
 * where there is room for it, below where there is not — near the top of a
 * scrolled list the row may be right under the header.
 *
 * **It closes on the next thing that happens.** The next `pointerdown`
 * anywhere puts it away, as do Escape and any scroll: the layer is anchored to
 * a box that scrolling moves, and a tooltip pointing at the wrong row is worse
 * than no tooltip. The listeners go on in a `setTimeout` so the tap that
 * opened it cannot trip them on its way out.
 *
 * The layer itself takes **no pointer events**: it is a thing to read, not a
 * thing to use, and a transparent target floating over the rows would eat the
 * next tap meant for one of them. The tap that dismisses it therefore lands on
 * whatever is underneath, so the `click` that follows it is **swallowed in the
 * capture phase** — a tap meant to put the tooltip away would otherwise open
 * the player it happened to land on, or mark him for sale. The same rule the
 * [nav sheet](../layout/NavMoreMenu.tsx)'s dim follows, reached from the other
 * side; it is also what makes a second tap on the panel close the tooltip
 * rather than re-open it.
 */
export function FixturePeekLayer({
  anchor,
  matchdays,
  teamId,
  onClose,
}: {
  anchor: DOMRect
  matchdays: CurrentMatchday[]
  teamId: string
  onClose: () => void
}) {
  useEffect(() => {
    const close = () => {
      onClose()
    }

    /** The dismissing tap's own click, eaten before the page can act on it. */
    const swallowClick = (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
    }
    const closeOnPointerDown = () => {
      window.addEventListener('click', swallowClick, {
        capture: true,
        once: true,
      })
      // A press that never becomes a click — a drag, a pointer cancelled by
      // the system — would otherwise leave the swallow armed for the next one.
      window.setTimeout(() => {
        window.removeEventListener('click', swallowClick, true)
      }, CLICK_SWALLOW_MS)
      onClose()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    const id = window.setTimeout(() => {
      window.addEventListener('pointerdown', closeOnPointerDown)
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('scroll', close, true)
      window.addEventListener('resize', close)
    }, 0)

    return () => {
      window.clearTimeout(id)
      window.removeEventListener('pointerdown', closeOnPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('click', swallowClick, true)
    }
  }, [onClose])

  /** Enough room above for the layer plus its gap, or it goes below. */
  const isAbove = anchor.top > 96

  return createPortal(
    <div
      role="tooltip"
      style={{
        right: Math.max(8, window.innerWidth - anchor.right),
        ...(isAbove
          ? { bottom: window.innerHeight - anchor.top + 6 }
          : { top: anchor.bottom + 6 }),
      }}
      className={cn(
        'fixed z-50 animate-pop-in rounded-card border border-line bg-surface px-2.5 py-2 shadow-raise',
        // The hold is still down on a touch screen: the layer must not become
        // the thing the finger is now pressing.
        'pointer-events-none',
      )}
    >
      <p className="mb-1 text-[0.5625rem] font-semibold tracking-wider text-faint uppercase">
        Nächste Spiele
      </p>
      <UpcomingFixtures matchdays={matchdays} teamId={teamId} />
    </div>,
    document.body,
  )
}
