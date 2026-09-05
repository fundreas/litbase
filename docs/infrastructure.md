# Infrastructure

[← Back to index](README.md)

## Stack

| Concern | Choice | Why |
| ------- | ------ | --- |
| Build | Vite 8 (rolldown) | Fast dev server, native TS, `--host` for phone testing |
| UI | React 19 | — |
| Language | TypeScript 6, strict | `noUncheckedIndexedAccess` and `verbatimModuleSyntax` on |
| Routing | react-router 7 (library mode) | `createBrowserRouter`, no framework layer |
| Server state | TanStack Query 5 | Caching, retries, focus refetch — see [API layer](api-layer.md) |
| HTTP | axios | Interceptors are what the auth layer hooks into |
| Styling | Tailwind CSS v4 | CSS-first config, no `tailwind.config.js` |
| Components | Radix primitives | Drawer, dropdown and avatar behaviour that is easy to get wrong by hand |
| Icons | lucide-react | Tree-shakeable, one icon per chunk |
| Lint | oxlint | Ships with the Vite template, fast |
| Format | Prettier + `prettier-plugin-tailwindcss` | Also sorts class lists |

There is deliberately **no state management library**. Server data is
TanStack Query's job; the only client state that outlives a route is the
session and the active league, both plain contexts.

Node is pinned to 22 in [`.nvmrc`](../.nvmrc) and declared in
`package.json` `engines`.

## Project layout

```
src/
├── api/                 everything that talks to Kickbase
│   ├── client.ts        the one axios instance + interceptors
│   ├── endpoints.ts     every API path, in one place
│   ├── types.ts         raw wire DTOs, abbreviated keys documented
│   ├── models.ts        readable domain models the UI consumes
│   ├── queryKeys.ts     hierarchical key factory
│   ├── queryClient.ts   cache and retry defaults
│   ├── errors.ts        ApiError — normalised failures
│   ├── cdn.ts           image path → URL
│   └── hooks/           one useQuery hook per resource
├── auth/                session, persistence, renewal, route guard
├── league/              the active league (from the URL) on context
├── components/
│   ├── layout/          AppShell, Header, NavDrawer, LeagueSwitcher, …
│   └── ui/              Button, Input, Avatar, Drawer, DropdownMenu, …
├── pages/               one file per screen
├── routes/              route table + lazy page imports
└── lib/                 cn, formatters, env, safe localStorage
```

The dependency direction is one-way: `pages` → `components` + `api/hooks` →
`api/client` → `lib`. Nothing in `api/` imports React, which is what keeps the
axios module free of circular imports with the auth layer.

## Configuration

[`src/lib/env.ts`](../src/lib/env.ts) is the only place that reads
`import.meta.env`. It trims trailing slashes and supplies defaults, so the app
runs with no `.env` file at all.

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `VITE_API_BASE_URL` | `https://api.kickbase.com` | REST base |
| `VITE_CDN_BASE_URL` | `https://kickbase.b-cdn.net` | Image CDN |
| `VITE_USE_DEV_PROXY` | unset | Route API traffic through the Vite dev server |

**The browser calls Kickbase directly.** The API reflects
`Access-Control-Allow-Origin` for any origin and permits the `authorization`
request header, so no proxy is needed. `VITE_USE_DEV_PROXY=true` together with
`VITE_API_BASE_URL=/kb-api` switches to a dev-server proxy if that ever
changes — the wiring is already in [`vite.config.ts`](../vite.config.ts).

`.env` files are gitignored; [`.env.example`](../.env.example) is the committed
template.

## Styling and design tokens

Tailwind v4 is configured in CSS, not JavaScript. All tokens live in an
`@theme` block in [`src/index.css`](../src/index.css), which means Tailwind
generates utilities for them automatically — `bg-surface`, `text-muted`,
`border-line`, `rounded-card` all work with no config file.

| Token group | Names |
| ----------- | ----- |
| Surfaces | `canvas`, `surface`, `surface-2`, `line` |
| Text | `ink`, `muted`, `faint` |
| Accent | `accent`, `accent-ink` |
| Semantic | `positive`, `negative`, `warning` |
| Shape | `radius-card`, `shadow-raise` |

Colours are authored in `oklch` so lightness steps are perceptually even. The
palette is a dark slate base with a lime accent; `color-scheme: dark` is set
on `:root`.

Two things worth knowing:

- **Animations are keyframes, not transitions.** Radix toggles a `data-state`
  attribute, and a CSS transition cannot animate an element that mounts
  already-open. The `--animate-*` tokens and their `@keyframes` are defined in
  the same `@theme` block, used as `data-[state=open]:animate-slide-in-left`.
- **`prefers-reduced-motion` is honoured globally** by collapsing all
  animation and transition durations.

Custom utilities: `nums` (tabular figures for money and points),
`no-scrollbar`, `pt-safe` and `pb-safe` (notch insets, paired with
`viewport-fit=cover` in [`index.html`](../index.html)).

## Mobile specifics

- Every interactive control is at least 44px tall.
- Inputs use a 16px font, which is what stops iOS Safari zooming on focus.
- `min-h-dvh` rather than `min-h-screen`, so mobile browser chrome is handled.
- `overscroll-behavior-y: none` on `body` prevents rubber-band scroll from
  exposing the page background.
- Drawer content sets `overscroll-contain` so scrolling it does not chain to
  the page behind.

## Build output

`npm run build` runs `tsc -b` first, then Vite. Vendor code is split into
stable chunks via `rolldownOptions.output.advancedChunks`, so an app deploy
only invalidates the small chunks:

```
react    ~190 kB   react, react-dom, scheduler
router    ~92 kB   react-router
radix     ~87 kB   @radix-ui/*
vendor    ~84 kB   axios, lucide, clsx, tailwind-merge
query     ~33 kB   @tanstack/*
index     ~31 kB   application code
```

Each page is a separate lazy chunk (1–3 kB), loaded on first navigation.

The React Query devtools badge is **not mounted** — it floats over the UI on
every screen. `@tanstack/react-query-devtools` is still a devDependency, so
restoring it is a lazy import plus one dev-only element in
[`App.tsx`](../src/App.tsx).

Packaging `dist/` into an nginx image, and the cache headers that make the
chunk split pay off, are in [Building and deploying](deployment.md).

## Tooling and scripts

| Script | Does |
| ------ | ---- |
| `npm run dev` | Dev server with HMR |
| `npm run dev:host` | Same, exposed on the local network |
| `npm run dev:live` | Same, but **inside a matchday** — see [Development profiles](#development-profiles) |
| `npm run dev:live:host` | The live profile, exposed on the local network |
| `npm run build` | Typecheck, then production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | `tsc -b` only |
| `npm run lint` | oxlint |
| `npm run lint:fix` | oxlint with autofix |
| `npm run format` | Prettier write |
| `npm run format:check` | Prettier check |
| `npm run check` | typecheck + lint + format check |

`@/*` resolves to `src/*`, aliased in both `vite.config.ts` and
`tsconfig.app.json`.

## Development profiles

Two, and the normal one is unchanged:

| Profile | Command | Time | Data |
| ------- | ------- | ---- | ---- |
| **normal** | `npm run dev` | the real clock | exactly what Kickbase returns |
| **live** | `npm run dev:live` | inside a matchday | Kickbase's, with one flag and one number bent |

The live profile exists because the app's most interesting screens — the squad
page's [Live tab](pages/squad.md#live-tab), a running
[duel](pages/duel-detail.md), every *Läuft* / *Offen* state — only appear for a
few hours a week. It makes the **most recently played matchday** behave as if
it were being played right now, so those screens can be built on a Tuesday
morning with real players and real points on them.

`dev:live` is nothing but `vite --mode live`, which the app reads back as
`import.meta.env.MODE`. No `.env` file is needed or committed — every `.env*`
is gitignored here as a secret, and a shared dev profile should not be a file
each of us has to recreate. `loadEnv` still picks up a personal
`.env.live.local`, and any of these can be set inline:

| Variable | Default | Means |
| -------- | ------- | ----- |
| `VITE_SIMULATE_MATCHDAY` | the last played matchday (`day - 1`) | which matchday to replay |
| `VITE_SIMULATE_MINUTE` | `60` | how far past its first kick-off to start |
| `VITE_NOW` | — | put the clock at an exact instant: `2026-08-29T15:45:00Z`, or an offset like `+36h` / `-90m` |

```bash
npm run dev:live                                    # last played matchday, an hour in
VITE_SIMULATE_MATCHDAY=1 VITE_SIMULATE_MINUTE=200 npm run dev:live
VITE_NOW=2026-08-30T16:20:00Z npm run dev:live      # that matchday, at that moment
VITE_NOW=+36h npm run dev                           # clock only, no payload rewrite
```

**`VITE_NOW` wins.** An exact instant is a more specific instruction than "an
hour into the matchday", so the two compose rather than fight: the simulation
still makes its matchday live, and `VITE_NOW` decides where inside it you are
standing — `VITE_SIMULATE_MINUTE` is then ignored. That is how you reach a
particular state on purpose:

| `VITE_NOW` | What you get |
| ---------- | ------------ |
| 30 min before the first kick-off | the matchday reads `upcoming`, the Live tab is correctly **absent** |
| an hour after it | early matches *running*, later ones *offen*, points arriving |
| Sunday afternoon | Friday and Saturday **finished** with real scores, the late match *running* |
| after the last final whistle | every fixture finished, so the matchday is over and the tab disappears |

The badge and the console line report the **measured** minute relative to the
first kick-off, not the configured one, so they stay honest when the clock is
pinned (and go negative before kick-off).

### How it works, and why it is not just a clock

Two pieces, both dev-gated:

- **[`clock.ts`](../src/lib/clock.ts)** owns *now*. The four predicates that
  ask what time it is — `matchdayState`, `liveMatchday`, `fixtureState`,
  `duelPlayerStatus` in [`models.ts`](../src/api/models.ts) — read `nowMs()`
  instead of `Date.now()`, and each still takes `now` as a parameter. The
  offset is **added** to the real clock rather than freezing it, so a simulated
  matchday progresses while you watch it.
- **[`simulation.ts`](../src/dev/simulation.ts)** owns the payload.
  `simulateMatchdays()` wraps the response in `useMatchdaysQuery`'s `queryFn` —
  the single place the fixture list enters the app, before mapping and before
  the cache, so every consumer sees one consistent answer.

The clock alone is not enough, and it looks like it should be. Whether a
matchday is over is **not** a comparison against time:
`SeasonMatchday.isFinished` comes from every fixture reporting `st === 2`, a
flag the server sets. So shifting the clock *forward* into next week's matchday
does go live — but `ph` holds no points for a matchday nobody has played, so
every row reads `–`; and shifting it *back* into a played matchday leaves every
fixture saying finished, so nothing is live at all, with the real points
sitting unreachable in `ph`. The profile therefore does both: the clock moves,
**and** the chosen matchday's fixtures have `st` recomputed from that clock
(finished once a match would be over at 110 minutes, upcoming otherwise, with
goals stripped from anything that has not kicked off yet).

Everything downstream is then real: real fixtures, real per-player points out of
`ph`, real standings for that `dayNumber`. Nothing is mocked — one flag and one
number are bent, which is why adding a screen needs no work here. The lookup
inside `ph` is anchored on the *player* payload's own `day`, which the profile
does not touch, so a replayed matchday reads its own points rather than
following the bent number.

### What it does not fake

- **Auth time.** Session expiry and token refresh keep reading `Date.now()`
  deliberately: a clock a week in the past makes a good token look expired, and
  one in the future fires the refresh timer immediately.
- **Nothing about the squad, any more.** A replayed matchday shows the players
  who were actually fielded, from the
  [matchday snapshot](pages/duel-detail.md#the-squad-it-shows-is-the-matchdays)
  — so fixtures, lineups, players and points are all real and the clock is the
  only fiction left.
- **Match progress between refetches.** `st` is computed when the fixture list
  is fetched (cached an hour), so a match crosses its final whistle on the next
  refetch rather than to the second. The clock itself always ticks.
- **Market countdowns and the player page's fixture list**, which come from
  their own endpoints with their own server-side notion of now.

A **warning chip in the header** ([`SimulationBadge`](../src/dev/SimulationBadge.tsx))
shows the simulated matchday and the app's clock, ticking, whenever either is
faked. The profile is convincing enough to be mistaken for a real result an
hour later, so the app says so while it is doing it.

**None of `src/dev/` reaches a production build.** Both call sites — the
`queryFn` and the header — are guarded by the `import.meta.env.DEV` literal
rather than by `env.isDev`, which is what lets the bundler fold the branch and
drop the modules instead of shipping them switched off; verified by grepping
`dist/`. `clock.ts` does ship, because `nowMs()` is what production reads too —
with the offset nailed to zero, since `env.devProfile` is `undefined` there.

## Error containment

Two independent layers:

- **[`RouteErrorBoundary`](../src/components/RouteErrorBoundary.tsx)** wraps the
  outlet inside the app shell. A page that throws during render is replaced by
  an error panel with a reset button, while the header and navigation stay
  usable. It is a class component because `componentDidCatch` has no hook
  equivalent.
- **[`ApiError`](../src/api/errors.ts)** normalises every network failure so
  components never branch on `axios.isAxiosError`. See
  [API layer](api-layer.md#error-normalisation).

## Not yet done

- **No tests.** `npm run check` is the current safety net.
- Only Login, the League gate and Dashboard have been confirmed rendering in a
  browser. Everything else passes typecheck, lint and build but has not been
  exercised at runtime.
