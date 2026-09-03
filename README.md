# litbase

A mobile-first single-page app on top of the Kickbase v4 API. React 19,
TypeScript, react-router, TanStack Query, axios, Tailwind CSS v4 and Radix
primitives. No backend of its own — the browser talks to `api.kickbase.com`
directly.

## Getting started

```bash
nvm use          # Node 22, pinned in .nvmrc
npm install
npm run dev      # http://localhost:3011
npm run dev:host # same, reachable from your phone on the same Wi-Fi
```

| Script                 | What it does                                |
| ---------------------- | ------------------------------------------- |
| `npm run dev`          | Vite dev server with HMR                    |
| `npm run dev:host`     | Dev server exposed on the local network     |
| `npm run build`        | Typecheck, then production build to `dist/` |
| `npm run preview`      | Serve the production build locally          |
| `npm run typecheck`    | `tsc -b` only                               |
| `npm run lint`         | oxlint                                      |
| `npm run format`       | Prettier (sorts Tailwind classes)           |
| `npm run check`        | typecheck + lint + format check             |

Configuration is optional — see [.env.example](.env.example). The defaults point
at the live API and CDN.

## Building and running the image

```bash
npm run build                                 # → dist/, typechecked first

docker build -t litbase:latest .              # multi-stage: node build → nginx
docker run --rm -p 8080:8080 litbase:latest   # http://localhost:8080
```

The image is `dist/` behind nginx and nothing else — no Node at runtime, no
source, ~63 MB. It runs as the unprivileged `nginx` user on port 8080, serves
hashed assets pre-compressed and cached forever, never caches `index.html`,
falls back to it for client-side routes, and answers `/healthz`.

Vite inlines `import.meta.env` at build time, so pointing the app at another
API is a build argument rather than a runtime variable — one image, one target:

```bash
docker build --build-arg VITE_API_BASE_URL=https://api.example.com -t litbase:staging .
```

[docs/deployment.md](docs/deployment.md) has the rest: the nginx config, the
allowlist [.dockerignore](.dockerignore) that keeps `.env` and
`kickbase-api.md` out of image layers, and what to expect when hosting it.

## Documentation

**[docs/](docs/README.md)** is the index: infrastructure, the API layer,
routing and layout, authentication, deployment, and a dedicated page per
screen. The sections below are a summary of it.

## Architecture

```
src/
├── api/                 everything that talks to Kickbase
│   ├── client.ts        the one axios instance + auth/403 interceptors
│   ├── endpoints.ts     every API path, in one place
│   ├── types.ts         raw wire DTOs (the abbreviated keys, documented)
│   ├── models.ts        readable domain models the UI actually uses
│   ├── queryKeys.ts     hierarchical query-key factory
│   ├── queryClient.ts   cache/retry defaults
│   ├── errors.ts        ApiError — normalised failures
│   ├── cdn.ts           image path → URL
│   └── hooks/           one useQuery hook per resource
├── auth/                session, persistence, silent renewal, route guard
├── league/              the active league (from the URL) on context
├── components/
│   ├── layout/          AppShell, Header, NavDrawer, NavSidebar, …
│   └── ui/              Button, Input, Avatar, Drawer, DropdownMenu, …
├── pages/               one file per screen
├── routes/              route table + lazy page imports
└── lib/                 cn, formatters, env, safe localStorage
```

### Routing

```
/login                       public
/register                    public
/                            → redirects to the last used league
/leagues                     → first league, else "no leagues"
/join                        browse and join leagues
/leagues/:leagueId/dashboard
/leagues/:leagueId/squad
/leagues/:leagueId/lineup
/leagues/:leagueId/market
/leagues/:leagueId/ranking
/leagues/:leagueId/duels        ?day=N — duel leagues only
/leagues/:leagueId/duels/:duelId         both elevens + combined ranking
/leagues/:leagueId/duels/:duelId/ranking
/leagues/:leagueId/table
/leagues/:leagueId/players
/leagues/:leagueId/players/:playerId              one player — Details
/leagues/:leagueId/players/:playerId/performance  every season, every match
/leagues/:leagueId/players/:playerId/market       a year of market values
```

The league id lives **in the path**, so a refresh, a bookmark or a link shared
between managers all resolve to the same league. `LeagueProvider` validates the
id against the user's memberships and puts the league on context; the last one
used is remembered so `/` can restore it.

### Auth, and the missing refresh token

Kickbase v4 has **no refresh token and no refresh endpoint** —
`/v4/user/refresh`, `/v4/user/refreshtoken` and `/v4/user/token` all 404. Login
returns one bearer token (`tkn`) plus an expiry (`tknex`, about 7 days out). The
only way to get a new token is to post the credentials again.

So persistence has two parts, both always on:

1. **Token + expiry** in `localStorage`. Close and reopen the page and the
   session is still there, for up to ~7 days.
2. **Credentials**, which let the app silently re-login before the token
   expires. That means a password in `localStorage` — a real trade-off, taken
   because the alternative is a session that stops working after a week with no
   way to renew it. Both forms state what is stored rather than offering a
   toggle, and signing out deletes it.

Renewal fires from four places: a timer 12h before expiry, on tab focus, on
reconnect, and reactively from any authenticated request that comes back 403
— the status Kickbase uses for a dead token, not 401 (one renewal, one retry,
concurrent failures de-duplicated). See the long comment in
[src/auth/authStorage.ts](src/auth/authStorage.ts).

Signing out clears the token, credentials, remembered league **and** the whole
query cache.

## Adding a page

1. Create `src/pages/MyPage.tsx`.
2. Lazy-export it from [src/routes/lazyPages.tsx](src/routes/lazyPages.tsx).
3. Add a child route in [src/routes/router.tsx](src/routes/router.tsx).
4. Add an entry to
   [src/components/layout/navigation.ts](src/components/layout/navigation.ts) —
   that alone puts it in the drawer.

Inside a page:

```tsx
export function MyPage() {
  const { leagueId, competitionId } = useActiveLeague()
  const { data, isPending, isError, error, refetch } = useSquad(leagueId)

  if (isPending) return <SkeletonList />
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />
  return <PageHeading title="…" />
}
```

A page can also be **conditional on the league**: `duels` only exists in
leagues played head-to-head, so its nav entry declares `requiresDuelMode` and
the page redirects to the dashboard elsewhere — the route table itself is built
before any league is known. See [docs/pages/duels.md](docs/pages/duels.md).

[DashboardPage](src/pages/DashboardPage.tsx),
[RankingPage](src/pages/RankingPage.tsx) and
[SquadPage](src/pages/SquadPage.tsx) are worked examples.
`market`, `table` and `players` are still
[PagePlaceholder](src/components/PagePlaceholder.tsx) stubs — each already runs
its real query and shows how many rows came back, so you can see the endpoint
works before you build the UI.

## Adding an endpoint

1. Add the path to [src/api/endpoints.ts](src/api/endpoints.ts).
2. Add the raw DTO to [src/api/types.ts](src/api/types.ts), keeping the wire key
   names and documenting what each one means.
3. Add a readable model to [src/api/models.ts](src/api/models.ts).
4. Add a key to [src/api/queryKeys.ts](src/api/queryKeys.ts) — league-scoped
   keys start with `['league', leagueId]` so switching leagues can drop them
   wholesale.
5. Write a hook in `src/api/hooks/` that fetches and maps.

Components should never see abbreviated keys like `mvt` or `spl`.

## Mobile notes

- Hamburger drawer as the single navigation surface on a phone — no *global*
  bottom tab bar, so full-height pages like the lineup get that row back. The
  one exception is the [player detail
  page](docs/pages/player-detail.md#why-this-page-has-a-bottom-bar), where a
  docked bar switches between three views of the same player rather than
  between pages, and only exists while that page is open. From `lg`
  (64rem) up the same nav is a permanent sidebar and the hamburger disappears;
  the header spans the full width above both. The switch is CSS, so there is no
  flash and no resize handler in the layout path.
- All controls are at least 44px tall; inputs are 16px so iOS Safari does not
  zoom on focus.
- `viewport-fit=cover` plus `pt-safe` / `pb-safe` utilities handle notches.
- Radix Dialog backs the drawer, so focus trapping, scroll locking and Escape
  all behave.
- Queries refetch on window focus and on reconnect — the app is backgrounded
  constantly on a phone.

## Known gaps

- The API's abbreviated fields are documented from live responses; a few
  (`mppu`, `pes`, `vr`) are still guesses, marked as such in `types.ts`.
- **Squads are only ever served as they stand now.** Duel detail on a past
  matchday therefore shows today's lineup with that matchday's points, and says
  so in the UI. See
  [docs/pages/duel-detail.md](docs/pages/duel-detail.md#what-a-past-matchday-shows).
- **`Ausgewechselt` is never reported.** No observed field distinguishes a
  substituted player, because every probe ran between matchdays. One function
  to change once a live matchday settles it.
- **`/v4/competitions/{id}/players` returns 25 rows, not every player** — the
  matchday's top performers, where `p` is *matchday* points. `useCompetition.ts`
  still describes and maps it as the full season list; the players page is a
  stub, so nothing renders the mistake yet.
- `chttkn` (the Firebase chat token, ~1h lifetime, refreshable via
  `/v4/chat/refreshtoken`) is parsed but unused — nothing needs chat yet.
- No tests yet. `npm run check` is the current safety net.
