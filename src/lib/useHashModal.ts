import { useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'

/**
 * **A modal's open state, held in the URL hash.**
 *
 * `useState(false)` is the obvious way to open a sheet and the wrong one on a
 * phone. Three things go missing with it:
 *
 *  - a **refresh** — or a link sent to someone else — lands on the page with
 *    the sheet shut, however deep the reader was;
 *  - the **back gesture** leaves the page instead of dismissing what is on top
 *    of it, which is what a back gesture means everywhere else on a phone;
 *  - and nothing names the thing being looked at, so "the transfer I was just
 *    reading" is unaddressable.
 *
 * So an open modal is a URL: `/leagues/1/events#activity:9f2c`. Opening one
 * pushes that hash, closing pops it, and `isOpen` is read back out of the hash
 * rather than remembered — which makes all three fall out at once. The page
 * itself does not remount on a hash change, so scroll position, the tab in
 * view and every query already in cache survive both directions.
 *
 * ## The hash is a stack
 *
 * `#fullscreen/player:4711` is the full-screen pitch with a player's breakdown
 * on top of it — two modals, outermost first, because that is the one case
 * where a sheet opens over another one. Each layer is `key` or `key:id`, and
 * every hook here matches **its own key** against the part before the colon,
 * so `player` and `playerSeason` can never be mistaken for one another.
 *
 * Opening pushes a layer, closing drops it **and anything stacked on it**: the
 * outer modal going away has to take the inner one with it.
 *
 * ## Closing gives the history entry back
 *
 * Where this hook pushed the entry the app is sitting on, {@link
 * HashModal.close} goes *back* rather than writing a hash-less URL over it.
 * Both leave the same address on screen, but only the first keeps the stack
 * honest: after a replace, the entry underneath is the same page without the
 * hash, so the next back press would spend itself repainting a screen the
 * reader is already looking at.
 *
 * Where it did **not** push it — a refresh, a shared link, a layer buried
 * under a sheet that has since pushed its own — there is nothing to go back
 * *to*, and the hash is dropped in place instead.
 *
 * ## What a modal has to be for this to fit
 *
 * **Whatever the modal shows has to be recoverable from the URL**, since a
 * refresh is going to reopen it with nothing but the id in hand: a feed entry,
 * a match, a player, a listing — anything the page can look up again, or a
 * sheet that needs no subject at all (a legend, a poster, full screen).
 *
 * The app's other modals are deliberately left on `useState`, and both kinds
 * fail this test rather than merely not needing it:
 *
 *  - the **confirmations** — a sale, a swap, taking a player out of the XI,
 *    joining a league — are asked about a selection that a refresh throws
 *    away, and re-asking a question about a selection nobody can see any more
 *    is worse than not restoring it;
 *  - the **pickers** — matchday, season — exist to change where you are, and
 *    their way out is a choice, not a dismissal. Their selection navigates,
 *    and a close racing that navigation would undo it.
 *
 * A link *inside* a hash modal needs no `onClose`: it changes the URL, the
 * hash goes with it, and the modal closes by construction. Give those links
 * `replace` so the destination swallows the modal's entry — otherwise the way
 * back out of the player's page is through the sheet it was opened from.
 */
export interface HashModal {
  /** Is this modal's layer in the hash right now. */
  isOpen: boolean
  /**
   * What it was opened for — the `id` in `#key:id`, decoded.
   *
   * `undefined` for a modal that has no subject, and for one whose subject the
   * page can no longer resolve: the id is whatever the URL carries, so a
   * lookup against it can come back empty and the modal then stays shut.
   */
  id: string | undefined
  open: (id?: string) => void
  close: () => void
  /** Radix's `onOpenChange` shape, so it can be passed straight through. */
  setOpen: (open: boolean) => void
}

/** Between the modals in the hash, outermost first. */
const LAYER = '/'
/** Between a modal's key and the id of what it shows. */
const SUBJECT = ':'

export function useHashModal(key: string): HashModal {
  const location = useLocation()
  const navigate = useNavigate()

  /**
   * The hash this hook pushed, for as long as the app is still on it.
   *
   * What separates "the reader opened this" from "the URL arrived like this",
   * which is the whole of {@link HashModal.close}'s decision. Compared against
   * the live hash rather than kept as a flag, so an inner modal pushing its
   * own entry on top silently takes the ownership away — going back from
   * *there* is the inner modal's business, not this one's.
   */
  const pushedHash = useRef<string | undefined>(undefined)

  const layers = splitHash(location.hash)
  const index = layers.findIndex((layer) => layerKey(layer) === key)
  const isOpen = index >= 0

  /** Writes `next` to the hash, leaving the path and the query alone. */
  const goTo = (next: readonly string[], replace: boolean) => {
    const hash = next.length === 0 ? '' : `#${next.join(LAYER)}`
    // Path and query spelled out: a `To` naming only a hash resolves the other
    // two to empty, which would drop the `?day=` the page is showing.
    void navigate(
      { pathname: location.pathname, search: location.search, hash },
      { replace },
    )
    return hash
  }

  const open = (id?: string) => {
    const layer =
      id === undefined ? key : `${key}${SUBJECT}${encodeURIComponent(id)}`
    // Already open, on another subject: the same layer rewritten, not a second
    // one stacked on it — one modal, one entry.
    const isOwned = pushedHash.current === location.hash
    const hash = goTo(
      isOpen ? [...layers.slice(0, index), layer] : [...layers, layer],
      isOpen,
    )
    pushedHash.current = !isOpen || isOwned ? hash : undefined
  }

  const close = () => {
    if (!isOpen) return
    const isOwned = pushedHash.current === location.hash
    pushedHash.current = undefined
    if (isOwned) {
      void navigate(-1)
      return
    }
    goTo(layers.slice(0, index), true)
  }

  return {
    isOpen,
    id: layerSubject(layers[index]),
    open,
    close,
    setOpen: (next: boolean) => {
      if (next) open()
      else close()
    },
  }
}

function splitHash(hash: string): string[] {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  return raw === '' ? [] : raw.split(LAYER)
}

function layerKey(layer: string): string {
  const at = layer.indexOf(SUBJECT)
  return at < 0 ? layer : layer.slice(0, at)
}

function layerSubject(layer: string | undefined): string | undefined {
  if (layer === undefined) return undefined
  const at = layer.indexOf(SUBJECT)
  if (at < 0) return undefined
  const id = layer.slice(at + 1)
  if (id === '') return undefined
  try {
    return decodeURIComponent(id)
  } catch {
    // A hand-edited URL can carry a half-written escape. The raw text is the
    // better guess at what was meant, and a lookup that misses only means the
    // modal stays shut.
    return id
  }
}
