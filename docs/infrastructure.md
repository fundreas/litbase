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
│   ├── layout/          AppShell, Header, NavDrawer, BottomNav, …
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

Each page is a separate lazy chunk (1–3 kB), loaded on first navigation. The
React Query devtools are dev-only and lazy; in a production build the package
resolves to a no-op shim.

Packaging `dist/` into an nginx image, and the cache headers that make the
chunk split pay off, are in [Building and deploying](deployment.md).

## Tooling and scripts

| Script | Does |
| ------ | ---- |
| `npm run dev` | Dev server with HMR |
| `npm run dev:host` | Same, exposed on the local network |
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
