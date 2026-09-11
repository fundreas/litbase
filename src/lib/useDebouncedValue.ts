import { useEffect, useState } from 'react'

/**
 * A value that lags behind, settling `delay` ms after the last change.
 *
 * For the gap between *typing* and *asking*: an input's value belongs to the
 * keystroke and must update on every one of them, while whatever the value
 * costs — a request, a filter over thousands of rows — should happen once the
 * typing stops. Hold the live value in state, feed it through here, and key
 * the expensive thing off the result.
 *
 * The delay is reset by each change, so a fast typist pays for one round trip
 * rather than one per letter. Clearing the box is **not** special-cased: an
 * empty term settles like any other, and the caller decides what an empty term
 * means.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSettled(value)
    }, delay)
    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return settled
}
