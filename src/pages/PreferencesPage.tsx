import {
  ArrowLeftToLine,
  ArrowRightToLine,
  EyeOff,
  Monitor,
  Moon,
  Sun,
} from 'lucide-react'

import { PageHeading } from '@/components/PageHeading'
import {
  PreferenceChoice,
  type PreferenceOption,
} from '@/components/preferences/PreferenceChoice'
import { Card, CardHeader } from '@/components/ui/Card'
import { storageAvailable } from '@/lib/storage'
import type {
  MenuShortcutPosition,
  ThemeChoice,
} from '@/preferences/preferences'
import { usePreferences } from '@/preferences/usePreferences'

/**
 * **Einstellungen** — how the app looks and where its shortcut sits.
 *
 *   /leagues/:leagueId/preferences
 *
 * Reached from the **avatar in the header**, which is the one control on
 * every screen that is about the reader rather than about the league. It is
 * deliberately not in the drawer or in the dots sheet: those are lists of
 * *pages of the league*, and a settings row among them would be one more
 * thing between a thumb and Mannschaft — the reach the dots exist to shorten.
 *
 * ## Why it is under `/leagues/:leagueId` anyway
 *
 * Nothing on this page is league-scoped, and the URL says otherwise. The
 * alternative was a route beside `/join`, outside
 * [`LeagueProvider`](../league/LeagueProvider.tsx) — which would mean a page
 * with no header, no drawer and no way back except the browser's, because
 * every one of those surfaces is built from a league. The
 * [Liga page](./LeaguePage.tsx) sits in the same place for the same reason:
 * the shell is the app, and the shell needs a league.
 *
 * The cost is a settings URL that carries a league id it ignores, which
 * nobody ever types and which resolves correctly from any league. The cost of
 * the other choice is a page that looks like it fell out of the app.
 *
 * ## What a setting does, and when
 *
 * **Immediately, and permanently.** There is no save button and no undo: each
 * of these changes the app under the reader's finger — the theme repaints,
 * the dots move — and that *is* the confirmation. A page of preferences with
 * an *Übernehmen* at the bottom would be asking for a second tap to tell them
 * what they can already see.
 *
 * Nothing here reaches the network. Kickbase knows nothing about a litbase
 * preference, so these live in this browser: a second device starts on the
 * defaults, which the footnote says plainly rather than leaving it to be
 * discovered on the second device.
 *
 * The list is short on purpose and will grow. Adding one is a field in
 * [`Preferences`](../preferences/preferences.ts) with a default, and a
 * [`PreferenceChoice`](../components/preferences/PreferenceChoice.tsx) below —
 * nothing else to wire up.
 */
export function PreferencesPage() {
  const { preferences, resolvedTheme, setPreference } = usePreferences()

  const shortcutOptions: readonly PreferenceOption<MenuShortcutPosition>[] = [
    {
      value: 'left',
      label: 'Links',
      icon: ArrowLeftToLine,
      hint: 'Unten links — für den linken Daumen.',
    },
    {
      value: 'right',
      label: 'Rechts',
      icon: ArrowRightToLine,
      hint: 'Unten rechts, wo die meisten Daumen ohnehin liegen.',
    },
    {
      value: 'hide',
      label: 'Aus',
      icon: EyeOff,
      // Hiding a navigation shortcut has to say where navigation went, or it
      // reads as a way out being taken away.
      hint: 'Kein Kürzel. Alle Seiten bleiben über das Menü oben links erreichbar.',
    },
  ]

  const themeOptions: readonly PreferenceOption<ThemeChoice>[] = [
    { value: 'light', label: 'Hell', icon: Sun },
    { value: 'dark', label: 'Dunkel', icon: Moon },
    {
      value: 'system',
      label: 'System',
      icon: Monitor,
      // The one option whose result is not on the button. Naming what the OS
      // is currently asking for turns "System" from a promise into a state.
      hint: `Folgt den Einstellungen deines Geräts — zurzeit ${
        resolvedTheme === 'dark' ? 'dunkel' : 'hell'
      }.`,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Einstellungen"
        subtitle="Gelten für dieses Gerät, in jeder Liga."
      />

      {!storageAvailable && (
        <p
          role="alert"
          className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs text-warning"
        >
          Dein Browser blockiert die lokale Speicherung. Änderungen wirken
          sofort, sind aber nach einem Neuladen wieder weg.
        </p>
      )}

      <Card>
        <CardHeader title="Navigation" />
        <PreferenceChoice
          label="Menü-Kürzel"
          description="Die drei Punkte, die die Seiten der App unter den Daumen holen — in der Leiste einer Seite, sonst als schwebender Knopf."
          value={preferences.menuShortcut}
          options={shortcutOptions}
          onChange={(value) => {
            setPreference('menuShortcut', value)
          }}
        />
      </Card>

      <Card>
        <CardHeader title="Darstellung" />
        <PreferenceChoice
          label="Erscheinungsbild"
          description="Hell, dunkel, oder was das Gerät gerade vorgibt."
          value={preferences.theme}
          options={themeOptions}
          onChange={(value) => {
            setPreference('theme', value)
          }}
        />
      </Card>

      <p className="px-1 text-xs leading-relaxed text-faint">
        Einstellungen liegen nur in diesem Browser. Ein anderes Gerät startet
        mit den Standardwerten.
      </p>
    </div>
  )
}
