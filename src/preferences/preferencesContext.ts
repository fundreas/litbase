import { createContext } from 'react'

import type { Preferences } from '@/preferences/preferences'
import type { ResolvedTheme } from '@/preferences/theme'

export interface PreferencesContextValue {
  /** Every setting, always complete — missing fields read as their default. */
  preferences: Preferences
  /**
   * The theme actually being painted, with `system` already resolved against
   * the OS. What a control should show as "on"; `preferences.theme` is what
   * the reader *chose*, and the two differ for exactly that one choice.
   */
  resolvedTheme: ResolvedTheme
  /**
   * Change one setting and persist the lot.
   *
   * One setter for every field rather than one per setting: the page is a list
   * of choices and they are going to keep coming, so the alternative is a
   * context that grows a method each time. Typed so the value has to belong to
   * the key.
   */
  setPreference: <K extends keyof Preferences>(
    key: K,
    value: Preferences[K],
  ) => void
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(
  null,
)
