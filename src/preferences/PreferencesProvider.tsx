import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import {
  loadPreferences,
  PREFERENCES_KEY,
  savePreferences,
  type Preferences,
} from '@/preferences/preferences'
import {
  PreferencesContext,
  type PreferencesContextValue,
} from '@/preferences/preferencesContext'
import {
  applyTheme,
  DARK_SCHEME_QUERY,
  systemTheme,
  type ResolvedTheme,
} from '@/preferences/theme'

/**
 * Holds the reader's settings, writes them through to `localStorage`, and
 * keeps the document's theme in step with them.
 *
 * Mounted **outermost** in [`App`](../App.tsx), above the query cache and the
 * router: the theme has to be right on the login screen and on an error page
 * too, neither of which is inside a league.
 *
 * Three things happen here:
 *
 *  1. **Hydration**, synchronously in the initial state, so no page ever
 *     renders a frame with the default menu shortcut before the real one
 *     arrives. (The *theme* is already right by then — `index.html` sets the
 *     attribute before the first paint; see [`theme.ts`](./theme.ts).)
 *  2. **The theme**, applied to `<html>` whenever the choice or — on
 *     `system` — the OS changes.
 *  3. **A second tab.** `storage` fires in every *other* tab of the origin, so
 *     changing the theme on one leaves the app open in another one painted the
 *     old way until it is reloaded. Listening for it costs a line and settles
 *     both.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences)
  const [scheme, setScheme] = useState<ResolvedTheme>(systemTheme)

  // Writes go through the ref rather than a state updater: an updater has to
  // be pure (StrictMode runs it twice), and persisting is the one thing that
  // must happen exactly when the value is set. Same arrangement as the token
  // in `AuthProvider`, and every path that changes `preferences` updates it.
  const preferencesRef = useRef(preferences)

  const setPreference = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      if (preferencesRef.current[key] === value) return
      const next = { ...preferencesRef.current, [key]: value }
      preferencesRef.current = next
      savePreferences(next)
      setPreferences(next)
    },
    [],
  )

  // The OS' own setting, tracked whatever the choice is — a reader on `dark`
  // who switches to `system` should get the right palette from that tap, not
  // from the next time the OS happens to change.
  useEffect(() => {
    const query = window.matchMedia(DARK_SCHEME_QUERY)
    const sync = () => {
      setScheme(query.matches ? 'dark' : 'light')
    }
    sync()
    query.addEventListener('change', sync)
    return () => {
      query.removeEventListener('change', sync)
    }
  }, [])

  // Another tab changed something. `key === null` is a `clear()`, which takes
  // the preferences with it — re-reading covers both, and the load is
  // forgiving enough to answer with the defaults.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== PREFERENCES_KEY) return
      const next = loadPreferences()
      preferencesRef.current = next
      setPreferences(next)
    }
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const resolvedTheme =
    preferences.theme === 'system' ? scheme : preferences.theme

  // In an effect rather than during render: this writes to the DOM outside
  // React's tree, and it is idempotent, so re-applying the attribute the boot
  // script already set on a cold load costs nothing.
  useEffect(() => {
    applyTheme(resolvedTheme)
  }, [resolvedTheme])

  const value = useMemo<PreferencesContextValue>(
    () => ({ preferences, resolvedTheme, setPreference }),
    [preferences, resolvedTheme, setPreference],
  )

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  )
}
