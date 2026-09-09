import type { ThemeChoice } from '@/preferences/preferences'

/**
 * Turning a {@link ThemeChoice} into the two things the document needs: an
 * attribute for the stylesheet, and a colour for the browser's own chrome.
 *
 * ## The attribute, not a media query
 *
 * The light palette in [`index.css`](../index.css) hangs off
 * `html[data-theme='light']` and nothing else. `system` is resolved **here**,
 * in script, and written into that same attribute — so there is exactly one
 * mechanism deciding which palette is on, whether the reader chose it or the
 * OS did. The alternative (a `prefers-color-scheme` block in CSS *and* an
 * attribute that overrides it) is two sources for one answer, and every rule
 * would have to be written twice to keep them from disagreeing.
 *
 * ## Why `index.html` has a copy of this
 *
 * A stylesheet in the `<head>` paints the page before any module runs, so a
 * reader on the light theme would get a frame of the dark one on every cold
 * load — the flash this app would be judged on, since it happens on the phone
 * where the app is actually used. The only cure is to set the attribute in a
 * blocking inline script, before the CSS is applied, which means
 * `index.html` holds a hand-written copy of {@link resolveTheme} and of the
 * storage key.
 *
 * That duplication is deliberate and it is *small*: read a key, pick one of
 * three words, resolve `system` against a media query. It is also
 * self-correcting — the provider applies the real thing on mount, so the worst
 * a drifted copy can do is show the wrong palette for one frame. Keep the two
 * in step anyway; the comment in `index.html` points back here.
 */

/** What is actually painted. `system` never reaches the DOM. */
export type ResolvedTheme = 'light' | 'dark'

export const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)'

/** What the OS is asking for right now. */
export function systemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_SCHEME_QUERY).matches ? 'dark' : 'light'
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  return choice === 'system' ? systemTheme() : choice
}

/**
 * `--color-canvas` of each palette, as hex.
 *
 * The browser paints its own surfaces with this — Android's status bar, the
 * strip Safari leaves above and below the page as it scrolls — and it cannot
 * read a CSS custom property to find out, so the value is repeated here.
 * **Keep it equal to `--color-canvas`**: it is the one colour that shows up
 * flush against the app's own background, and a near-miss reads as a seam.
 */
const THEME_COLOR: Record<ResolvedTheme, string> = {
  dark: '#1b1d24',
  light: '#f3f5f9',
}

function setMeta(name: string, content: string): void {
  const meta = document.head.querySelector(`meta[name="${name}"]`)
  if (meta !== null) meta.setAttribute('content', content)
}

/** Put a resolved theme on the document. Idempotent. */
export function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset.theme = theme
  // Form controls, scrollbars and the like follow the CSS `color-scheme` in
  // `index.css`; the meta is what a browser reads before the stylesheet is
  // there, and leaving it saying `dark` under a light page is what makes a
  // scrollbar come up black for the first frame after a reload.
  setMeta('color-scheme', theme)
  setMeta('theme-color', THEME_COLOR[theme])
}
