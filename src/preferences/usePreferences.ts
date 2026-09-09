import { useContext } from 'react'

import {
  PreferencesContext,
  type PreferencesContextValue,
} from '@/preferences/preferencesContext'

/**
 * The reader's settings. Throws outside
 * [`PreferencesProvider`](./PreferencesProvider.tsx), which wraps the whole
 * app — so in practice it is available everywhere, the login screen included.
 */
export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext)
  if (context === null) {
    throw new Error('usePreferences must be used inside <PreferencesProvider>.')
  }
  return context
}
