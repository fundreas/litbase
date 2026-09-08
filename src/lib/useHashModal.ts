import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router'

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
 * ## A closed modal must not come back on a forward press
 *
 * Going back does not *delete* the entry the modal was open in: it is still
 * sitting ahead of the reader, so the browser's forward press — or the forward
 * swipe on iOS — would reopen a sheet they have just dismissed. The History
 * API has no way to drop it. Only a `pushState` truncates what is ahead, and
 * pushing puts a second, identical entry under the reader, which would spend
 * their next back press on repainting the screen they are already looking at.
 * That is a worse trade than the one it fixes: back is used constantly on a
 * phone and forward hardly at all.
 *
 * So the entry is remembered as **spent** instead. It stays in the stack, and
 * a forward press onto it opens nothing: the modal is declined during render —
 * no frame of it, not even a flash — and the layer is then dropped from the
 * URL in place, so the address matches the screen and a refresh there does not
 * bring the sheet back either. One press of a button nobody presses lands the
 * reader where they already were, and the modal state is gone from the URL for
 * good.
 *
 * It is a short-lived arrangement in any case: **any** ordinary navigation
 * truncates the stack ahead of the reader, so the spent entry is thrown away
 * by the next tap that goes anywhere.
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
  /** `POP` is the browser's own back or forward — see the effect below. */
  const navigationType = useNavigationType()

  /**
   * The hash this hook last wrote, and the entry it landed on. Two refs for
   * one thing, because a history entry cannot be named until it exists:
   * `navigate` hands nothing back, so the hash is what **recognises** the
   * entry on the next render and `location.key` — react-router's own id for
   * an entry, which survives a pop and comes back identical — is what
   * **identifies** it from then on.
   *
   * The key is the answer to "did the reader open this, or did the URL arrive
   * like this", which is the whole of {@link HashModal.close}'s decision. It
   * is also noted while the app is standing on the entry because the moment it
   * is needed is the moment it is out of reach: a reader who goes back out of
   * the modal leaves this hook on the entry below, with nothing else to say
   * which entry is now ahead of them.
   */
  const pushedHash = useRef<string | undefined>(undefined)
  const pushedKey = useRef<string | undefined>(undefined)

  /**
   * The entry a close handed back to the history stack, still ahead of the
   * reader — see *A closed modal must not come back on a forward press*.
   *
   * State rather than a ref, because the render is what acts on it: it is the
   * declining of the modal that keeps a spent entry from ever painting one.
   *
   * `hasLeft` separates a forward press onto the entry from the pop that spent
   * it: {@link HashModal.close} writes the key down *before* `navigate(-1)`,
   * so for as long as that pop is in flight the app is still standing on the
   * entry, and this must not be read as a reader coming back to it.
   */
  const [spent, setSpent] = useState<
    { key: string; hasLeft: boolean } | undefined
  >(undefined)

  const layers = splitHash(location.hash)
  const index = layers.findIndex((layer) => layerKey(layer) === key)
  const isSpent = index >= 0 && spent?.key === location.key
  const isOpen = index >= 0 && !isSpent

  /** Writes `next` to the hash, leaving the path and the query alone. */
  const goTo = useCallback(
    (next: readonly string[], replace: boolean) => {
      const hash = hashOf(next)
      // Path and query spelled out: a `To` naming only a hash resolves the
      // other two to empty, which would drop the `?day=` the page is showing.
      void navigate(
        { pathname: location.pathname, search: location.search, hash },
        { replace },
      )
      return hash
    },
    [navigate, location.pathname, location.search],
  )

  const open = (id?: string) => {
    const layer =
      id === undefined ? key : `${key}${SUBJECT}${encodeURIComponent(id)}`
    // A layer of this key already in the hash is **rewritten** rather than
    // stacked on — one modal, one entry, whatever subject it is opened for.
    //
    // Except on a spent entry, where the layer is there but the modal is not:
    // that one is pushed over, which is precisely what takes the spent entry
    // out of the stack.
    const isReplacing = index >= 0 && !isSpent
    const isOwned = pushedKey.current === location.key
    const hash = goTo(
      index >= 0 ? [...layers.slice(0, index), layer] : [...layers, layer],
      isReplacing,
    )
    pushedHash.current = !isReplacing || isOwned ? hash : undefined
    // Whichever entry that lands on, it is not the one noted before.
    pushedKey.current = undefined
    // A push takes everything ahead of the reader with it, spent entries
    // included, so there is nothing left to decline.
    if (!isReplacing) setSpent(undefined)
  }

  const close = () => {
    if (!isOpen) return
    // The **entry**, not the hash: a hash can be identical two entries apart
    // — an inner modal that stripped its own layer leaves one directly above
    // ours — and going back from one of those would land on the other with
    // the modal still open.
    const isOwned = pushedKey.current === location.key
    pushedHash.current = undefined
    pushedKey.current = undefined
    if (isOwned) {
      // Handing the entry back to the stack leaves it ahead of the reader,
      // where a forward press would find it. Spent, so that press opens
      // nothing.
      setSpent({ key: location.key, hasLeft: false })
      void navigate(-1)
      return
    }
    goTo(layers.slice(0, index), true)
  }

  /**
   * Everything about **which history entry is which**, in the order it has to
   * happen. Three cases, all of them about an entry this hook pushed:
   *
   *  1. the app is standing on it — note the key, while it is in reach;
   *  2. the reader went **back** out of it, so it is now ahead of them and
   *     spent, exactly as a close by ✗ or Escape would have left it. `POP` is
   *     what says *back*: a link out of the modal leaves the entry behind
   *     rather than ahead, and must not spend it — going back to a sheet you
   *     left by tapping through it should still find it open;
   *  3. the reader pressed **forward** onto a spent entry. The modal is
   *     already declined during render, so nothing of it is ever painted;
   *     what is left is the URL, and the layer comes out of it in place — the
   *     address then matches the screen, and a refresh here cannot bring back
   *     a sheet that has been dismissed.
   */
  useEffect(() => {
    const openedKey = pushedKey.current

    if (pushedHash.current === location.hash) {
      pushedKey.current = location.key
    } else if (
      index < 0 &&
      navigationType === 'POP' &&
      openedKey !== undefined
    ) {
      pushedHash.current = undefined
      pushedKey.current = undefined
      setSpent({ key: openedKey, hasLeft: true })
      return
    }

    if (spent === undefined) return
    if (spent.key !== location.key) {
      if (!spent.hasLeft) setSpent({ ...spent, hasLeft: true })
      return
    }
    if (!spent.hasLeft || index < 0) return
    setSpent(undefined)
    goTo(splitHash(location.hash).slice(0, index), true)
  }, [goTo, index, location.hash, location.key, navigationType, spent])

  return {
    isOpen,
    id: isOpen ? layerSubject(layers[index]) : undefined,
    open,
    close,
    setOpen: (next: boolean) => {
      if (next) open()
      else close()
    },
  }
}

/** The hash for a stack of layers — empty when nothing is open. */
function hashOf(layers: readonly string[]): string {
  return layers.length === 0 ? '' : `#${layers.join(LAYER)}`
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
