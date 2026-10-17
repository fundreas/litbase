import { readJson, writeJson } from '@/lib/storage'

/**
 * What the reader has chosen about how the app looks and behaves.
 *
 * **One object under one key**, not a key per setting. Preferences are read as
 * a set — the whole object is loaded once at startup and handed to the tree —
 * and they are going to grow; a key per setting would mean a new storage
 * name, a new read and a new fallback each time, and a `storage` listener
 * that has to know all of them to sync a second tab.
 *
 * Nothing here is on the server. Kickbase has no notion of a litbase
 * preference, so these live in this browser only: a second device starts on
 * the defaults, which is the honest behaviour for a setting about *this*
 * screen's chrome.
 *
 * ## Reading is forgiving, by design
 *
 * The stored object is whatever an older (or newer) build of the app left
 * behind, so it is never trusted as a whole. Each field is validated on its
 * own and falls back to its default, which means a value this build does not
 * understand costs that one setting rather than all of them — and a field
 * added later simply reads as its default in a browser that has never seen
 * it. That is what makes {@link PREFERENCES_KEY}'s `v1` last: it only has to
 * change if a field's *meaning* changes, not when one is added.
 */

/** Where the [dots menu](../components/layout/NavMoreMenu.tsx) sits. */
export const MENU_SHORTCUT_POSITIONS = ['left', 'right', 'hide'] as const
export type MenuShortcutPosition = (typeof MENU_SHORTCUT_POSITIONS)[number]

/** `system` follows the OS; the other two override it. */
export const THEME_CHOICES = ['light', 'dark', 'system'] as const
export type ThemeChoice = (typeof THEME_CHOICES)[number]

/**
 * What rides **beside the opponent's crest** on the second line of a player
 * card on a [pitch](../components/squad/Pitch.tsx).
 *
 * The crest itself is not a choice: *who is he playing* is the question a
 * pitch of eleven different clubs raises on every card, and an answer that
 * has to be switched on is an answer nobody reads. What the crest shares its
 * line with is the choice, and there are two candidates:
 *
 *  - `points` — what he has scored, is scoring, or is expected to score. The
 *    figure the pitches have always drawn, and the default: a lineup is looked
 *    at to find out how it is doing.
 *  - `kickoff` — when his match starts: the time if it is today, the weekday
 *    otherwise.
 *
 * **A real score overrules `kickoff`.** Once a player has points, the
 * kick-off he has already had is the least interesting thing about him, so his
 * plate shows the points whichever way the chip is set — the setting is about
 * the matches still to come, which is the only place the two readings differ.
 *
 * See [`PITCH_SUBTITLE`](../components/squad/pitchSubtitles.ts) for the words
 * and the control.
 */
export const PITCH_SUBTITLES = ['points', 'kickoff'] as const
export type PitchSubtitle = (typeof PITCH_SUBTITLES)[number]

export interface Preferences {
  /**
   * Which corner the app's pages hang in — or `hide` for neither.
   *
   * One setting for both shapes the shortcut takes, because they are one
   * thing to the reader: the last tab of a page's
   * [bottom bar](../components/ui/BottomTabBar.tsx) where there is a bar, and
   * the [floating button](../components/layout/NavMoreFab.tsx) where there is
   * not. A preference that moved only one of them would put the dots in two
   * different corners depending on which page you were on, which is the exact
   * thing the shortcut exists to avoid.
   */
  menuShortcut: MenuShortcutPosition
  theme: ThemeChoice
  /**
   * Whether the [event stream](../components/matchday/LiveEventTicker.tsx)
   * runs on the full-screen match lineup.
   *
   * **Its control is the bell in that screen's bar, not the
   * [preferences page](../pages/PreferencesPage.tsx)** — it is a setting about
   * one screen, made while looking at that screen, and a reader who wants the
   * ticker quiet wants it quiet *now*. It lives here all the same rather than
   * in component state, because "I have seen enough passes" is a decision that
   * should still hold the next time a match is opened.
   */
  liveEventStream: boolean
  /**
   * What a player card's second line says beside the opponent's crest, on
   * every pitch that holds players from **more than one club** — the squad's
   * own two views, a duel, and a manager's matchday.
   *
   * **Its control is on the grass, not on the
   * [preferences page](../pages/PreferencesPage.tsx)**, for the reason the
   * ticker's bell is on the match screen: it is a question you ask while
   * looking at a pitch (*when does this lot play?*), and the answer is worth
   * one tap where the question occurs. It lives here all the same rather than
   * in component state, because the pitches are one reading surface —
   * switching to the kick-offs on your own lineup and finding points again on
   * a rival's would make the control feel broken — and because the choice
   * should survive the tab being left.
   */
  pitchSubtitle: PitchSubtitle
}

/**
 * What the app does before anyone has chosen anything.
 *
 * `right` is where the dots have always been, and where a right thumb rests.
 *
 * `dark` rather than `system`: this app was designed dark, shipped dark for
 * its whole life, and only now has a light palette. Defaulting to `system`
 * would have turned the lights on for every existing user on a light phone
 * without them asking for it. Light is a choice you make, not one made for
 * you — and `system` is one tap away for the readers who want it.
 */
export const DEFAULT_PREFERENCES: Preferences = {
  menuShortcut: 'right',
  theme: 'dark',
  liveEventStream: true,
  // The figure, because that is what every pitch drew before the choice
  // existed, and because points are what a lineup is read for. An unknown
  // stored value lands here too, which is how the retired `opponent` reading
  // resolves for anyone who left the chip on it.
  pitchSubtitle: 'points',
}

/**
 * Also read by the boot script in `index.html`, which sets the theme before
 * the first paint. **Both copies have to say the same thing** — see
 * [`theme.ts`](./theme.ts) for why that duplication is worth it.
 */
export const PREFERENCES_KEY = 'litbase.preferences.v1'

/** The value if it is one this build knows, the fallback otherwise. */
function oneOf<T extends string>(
  allowed: readonly T[],
  value: unknown,
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

/** The value if it is actually a boolean, the fallback otherwise. */
function boolish(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function loadPreferences(): Preferences {
  const stored = readJson<unknown>(PREFERENCES_KEY)
  if (typeof stored !== 'object' || stored === null) {
    return DEFAULT_PREFERENCES
  }
  const candidate = stored as Partial<Record<keyof Preferences, unknown>>
  return {
    menuShortcut: oneOf(
      MENU_SHORTCUT_POSITIONS,
      candidate.menuShortcut,
      DEFAULT_PREFERENCES.menuShortcut,
    ),
    theme: oneOf(THEME_CHOICES, candidate.theme, DEFAULT_PREFERENCES.theme),
    liveEventStream: boolish(
      candidate.liveEventStream,
      DEFAULT_PREFERENCES.liveEventStream,
    ),
    pitchSubtitle: oneOf(
      PITCH_SUBTITLES,
      candidate.pitchSubtitle,
      DEFAULT_PREFERENCES.pitchSubtitle,
    ),
  }
}

export function savePreferences(preferences: Preferences): void {
  writeJson(PREFERENCES_KEY, preferences)
}
