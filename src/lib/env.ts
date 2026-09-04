/** Typed, validated access to the Vite env. Import this, not `import.meta.env`. */

const DEFAULT_API_BASE_URL = 'https://api.kickbase.com'
const DEFAULT_CDN_BASE_URL = 'https://kickbase.b-cdn.net'

/** Vite mode of the live-simulation profile — `npm run dev:live`. */
const LIVE_MODE = 'live'

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

/**
 * The development profile's knobs, or `undefined` in a production build.
 *
 * Raw strings, deliberately: this module's job is to *read* the env, and what
 * `+36h` or a matchday number means belongs to [`clock`](./clock.ts) and
 * [`simulation`](../dev/simulation.ts) respectively. Everything is optional —
 * `npm run dev` sets none of it and behaves exactly as it always has.
 *
 * The gate is `import.meta.env.DEV`, so none of this can be switched on in a
 * deployed build no matter what variables the environment carries.
 */
function readDevProfile() {
  if (!import.meta.env.DEV) return undefined

  return {
    /**
     * Started with `npm run dev:live`, which is nothing but `--mode live`.
     *
     * On its own it turns the [simulation](../dev/simulation.ts) on with its
     * defaults, so the profile needs no env file to work — and none is
     * committed, since `.gitignore` (rightly) treats every `.env*` as a
     * secret. Override any of the three below to tune it.
     */
    isLiveProfile: import.meta.env.MODE === LIVE_MODE,
    /** `VITE_SIMULATE_MATCHDAY` — which matchday to replay as if it were live. */
    matchday: import.meta.env.VITE_SIMULATE_MATCHDAY,
    /** `VITE_SIMULATE_MINUTE` — how far into that matchday to start. */
    minute: import.meta.env.VITE_SIMULATE_MINUTE,
    /**
     * `VITE_NOW` — move the clock and change nothing else.
     *
     * Either an absolute instant (`2026-08-29T15:45:00Z`) or an offset from
     * the real one (`+36h`, `-90m`, `+2d`). Useful without the rest of the
     * simulation when the question is only "what does this look like at
     * kick-off?"; see [`clock`](./clock.ts).
     */
    now: import.meta.env.VITE_NOW,
  }
}

export const env = {
  apiBaseUrl: trimTrailingSlash(
    import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL,
  ),
  cdnBaseUrl: trimTrailingSlash(
    import.meta.env.VITE_CDN_BASE_URL || DEFAULT_CDN_BASE_URL,
  ),
  isDev: import.meta.env.DEV,
  devProfile: readDevProfile(),
} as const
