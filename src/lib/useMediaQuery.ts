import { useCallback, useSyncExternalStore } from 'react'

/**
 * Whether a CSS media query currently matches, as a re-rendering value.
 *
 * For the handful of things CSS cannot express on its own — the
 * [pitch's orientation](../components/squad/pitchMetrics.ts), which is not a
 * class on an element but a different arrangement of components and a
 * different sizing budget. Anything that *is* only a class belongs in a
 * `lg:` prefix, not here: a breakpoint resolved in JavaScript costs a render
 * and can be wrong for one frame, and CSS is never wrong.
 *
 * `useSyncExternalStore` rather than an effect and a `useState`, so the first
 * render already has the right answer instead of painting the narrow layout
 * and correcting it — which on a pitch would size every card twice.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => {
        list.removeEventListener('change', onChange)
      }
    },
    [query],
  )

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    // The app is a browser SPA; this is the hydration-safe fallback React asks
    // for and is never reached in practice.
    () => false,
  )
}
