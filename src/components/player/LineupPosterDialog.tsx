import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useState } from 'react'

import { cdnUrl } from '@/api/cdn'
import type { ExpectedLineup } from '@/api/models'
import { ExpectedTeamLineup } from '@/components/lineup/ExpectedTeamLineup'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'
import { weekdayDate } from '@/lib/format'

/**
 * Ligainsider's projected starting eleven for the club, full screen — **and,
 * where there is one, pointcast's own prediction beside it.**
 *
 * `plpim` is a **1280×1809 poster of the whole team**, not a per-player icon —
 * an earlier attempt to use it as a corner badge on a portrait put the same
 * unreadable thumbnail on all 25 players at a club. At full size it is exactly
 * what it looks like: the projected XI with a tier badge beside every name,
 * which is where the `prob` this dialog opens from comes from in the first
 * place. So the chip is the way in, and the poster gets the whole screen.
 *
 * ## Fit, then zoom
 *
 * It opens **fit to the screen**, so the shape of the formation is the first
 * thing you see. Tapping the poster switches to natural width inside a scroll
 * container, which is what makes the names legible on a phone: 1280 px of
 * poster in a 390 px viewport is a third of a pixel per pixel, and no amount
 * of `object-contain` fixes that. Native pinch-zoom is left alone on top.
 *
 * The image is the only control. A zoom button in the bar said the same thing
 * twice on a screen holding one tappable object — the cursor turns to a
 * magnifier on a pointer device, and on a touch screen a full-bleed photo is
 * already something people pinch and tap.
 *
 * The dialog is `fixed inset-0` rather than the app's usual centred card. This
 * is one large image and nothing else — a padded panel around it would spend
 * the width that is the entire point.
 *
 * ## The second eleven
 *
 * {@link expected} adds a second pane: the same club's expected lineup from
 * [litbase-pointcast](../../api/hooks/useExpectedLineup.ts), drawn as a pitch
 * in the app's own notation rather than as somebody's poster. Side by side
 * from `lg` up, and one at a time behind a small toggle on a phone — the only
 * screen that cannot hold both.
 *
 * The two are worth putting next to each other because they are made
 * differently: a journalist reading the week's press conferences, against a
 * model reading five seasons of minutes. Where they disagree is the most
 * useful thing on the screen.
 *
 * Either one alone is enough to open this dialog, which is why the poster is
 * optional — a club Kickbase has no `plpim` for still has a prediction.
 */
export function LineupPosterDialog({
  open,
  onOpenChange,
  poster,
  teamName,
  source,
  sourceLogo,
  updatedAt,
  expected,
  leagueId,
  crest,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * CDN-relative `plpim`.
   *
   * Optional, because {@link expected} can carry this dialog on its own: a
   * club Kickbase has no poster for still has a prediction, and a reader who
   * taps the strip should not meet an empty screen for it.
   */
  poster?: string
  teamName?: string
  /** `plpt` — "Ligainsider" in practice. */
  source?: string
  /** `plpurl`, the source's logo. */
  sourceLogo?: string
  /** `ts`, when the assessment was last revised. */
  updatedAt?: string
  /**
   * **The second opinion**: pointcast's own expected lineup for the same club
   * and the same fixture — see
   * [`useExpectedLineup`](../../api/hooks/useExpectedLineup.ts).
   *
   * Drawn beside the poster rather than instead of it. The two are made
   * differently — a journalist reading the week's press conferences against a
   * model reading five seasons of minutes — and where they agree a reader can
   * stop thinking about it, which is worth more than either on its own.
   */
  expected?: ExpectedLineup
  /** Needed only by {@link expected}, whose players link to their pages. */
  leagueId?: string
  /** The club crest, for the predicted pitch's corner. */
  crest?: string
}) {
  const [isZoomed, setIsZoomed] = useState(false)
  const src = cdnUrl(poster)

  /**
   * Which of the two is on screen **on a phone**, where they cannot both be.
   *
   * From `lg` up the question does not arise: the two panes sit side by side,
   * the toggle is hidden, and this state goes unread.
   */
  const [view, setView] = useState<'poster' | 'expected'>('poster')
  const hasExpected = expected !== undefined && leagueId !== undefined
  const hasBoth = src !== undefined && hasExpected
  const shows = (pane: 'poster' | 'expected') =>
    !hasBoth || view === pane ? '' : 'hidden lg:flex'

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        // Always reopen fit — a zoom left over from last time drops the reader
        // into the middle of a poster with no idea which part they are on.
        if (!next) setIsZoomed(false)
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-40 bg-black/80 backdrop-blur-[2px]',
            'data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in',
          )}
        />
        <Dialog.Content
          className={cn(
            'fixed inset-0 z-50 flex flex-col bg-canvas',
            'data-[state=open]:animate-fade-in',
          )}
        >
          <div className="pt-safe" />

          <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-sm font-semibold text-ink">
                Voraussichtliche Aufstellung
              </Dialog.Title>
              <Dialog.Description className="flex items-center gap-1.5 truncate text-xs text-muted">
                {teamName !== undefined && <span>{teamName}</span>}
                {source !== undefined && (
                  <>
                    {teamName !== undefined && (
                      <span aria-hidden="true">·</span>
                    )}
                    {sourceLogo !== undefined && (
                      <Avatar
                        src={sourceLogo}
                        name={source}
                        size={13}
                        square
                        className="bg-transparent"
                      />
                    )}
                    <span className="truncate">{source}</span>
                  </>
                )}
                {updatedAt !== undefined && (
                  <span className="truncate text-faint">
                    · {weekdayDate(updatedAt)}
                  </span>
                )}
              </Dialog.Description>
            </div>

            {/* Which of the two is on screen, on a screen that can only hold
                one. From `lg` up both panes are drawn and this is hidden —
                there is nothing to choose between when you can see both. */}
            {hasBoth && (
              <div className="flex shrink-0 rounded-lg border border-line bg-surface p-0.5 lg:hidden">
                {(['poster', 'expected'] as const).map((pane) => (
                  <button
                    key={pane}
                    type="button"
                    onClick={() => {
                      setView(pane)
                    }}
                    className={cn(
                      'rounded-md px-2 py-1 text-[0.6875rem] font-semibold transition-colors',
                      view === pane
                        ? 'bg-surface-2 text-ink'
                        : 'text-muted hover:text-ink',
                    )}
                  >
                    {pane === 'poster' ? (source ?? 'Poster') : 'Prognose'}
                  </button>
                ))}
              </div>
            )}

            <Dialog.Close
              aria-label="Schließen"
              className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <X size={20} />
            </Dialog.Close>
          </div>

          {/* **The two side by side where there is room for them**, and one at
              a time where there is not. Ligainsider's poster is a picture of a
              judgement; the pitch beside it is a model's, drawn in the app's
              own notation with a probability under every face. Comparing them
              is the whole reason the second one is here. */}
          <div className="flex min-h-0 flex-1 flex-col pb-safe lg:flex-row">
            {src !== undefined && (
              /* `overscroll-contain` so panning a zoomed poster to its edge
                 does not start scrolling the page behind the dialog. */
              <div
                className={cn(
                  'flex min-h-0 flex-1 overscroll-contain',
                  isZoomed ? 'overflow-auto' : 'overflow-hidden',
                  shows('poster'),
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsZoomed((current) => !current)
                  }}
                  // The image is the only control, so the whole thing toggles.
                  // `block` and the sizing below are on the button so the click
                  // area is the poster and not a band across the dialog.
                  className={cn(
                    'block cursor-zoom-in',
                    isZoomed ? 'w-max cursor-zoom-out' : 'h-full w-full',
                  )}
                >
                  <img
                    src={src}
                    alt={`Voraussichtliche Aufstellung${teamName === undefined ? '' : ` von ${teamName}`}`}
                    className={cn(
                      isZoomed ? 'max-w-none' : 'h-full w-full object-contain',
                    )}
                  />
                </button>
              </div>
            )}

            {expected !== undefined && leagueId !== undefined && (
              <div
                className={cn(
                  'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain border-line lg:border-l',
                  shows('expected'),
                )}
              >
                <ExpectedTeamLineup
                  lineup={expected}
                  leagueId={leagueId}
                  teamName={teamName}
                  crest={crest}
                  className="p-3"
                />
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
