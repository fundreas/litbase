# litbase documentation

A mobile-first single-page app on top of the Kickbase v4 API. These pages
explain how it is put together and what each screen does.

Start with [Infrastructure](infrastructure.md) for the shape of the codebase,
or jump straight to a screen in the [Pages](#pages) table.

## Foundations

| Page | What it covers |
| ---- | -------------- |
| [Infrastructure](infrastructure.md) | Stack, project layout, styling and design tokens, build output, tooling and scripts |
| [API layer](api-layer.md) | The axios instance, endpoint registry, wire DTOs → domain models, query keys and caching policy |
| [Kickbase API reference](api/README.md) | Every endpoint the app calls, by resource: parameters, response fields, and what is still guesswork |
| [Routing and layout](routing-and-layout.md) | Route table, auth and league guards, the app shell, header and drawer |
| [Authentication](authentication.md) | Login, token persistence, silent renewal, and why there is no refresh token |
| [Building and deploying](deployment.md) | `npm run build`, the Docker image, and how nginx serves the SPA |

## Pages

| Route | Page | Status |
| ----- | ---- | ------ |
| `/login` | [Login](pages/login.md) | Implemented |
| `/register` | [Register](pages/register.md) | Implemented |
| `/leagues` | [League gate](pages/league-gate.md) | Implemented |
| `/join` | [Join a league](pages/join-league.md) | Implemented |
| `/leagues/:leagueId/dashboard` | [Dashboard](pages/dashboard.md) | Implemented |
| `/leagues/:leagueId/squad` | [Squad](pages/squad.md) | Implemented |
| `/leagues/:leagueId/squad/lineup` | [Squad — lineup tab](pages/squad.md#lineup-tab) | Implemented |
| `/leagues/:leagueId/squad/live` | [Squad — live tab](pages/squad.md#live-tab) | Implemented — only while a matchday runs |
| `/leagues/:leagueId/ranking` | [Ranking](pages/ranking.md) | Implemented |
| `/leagues/:leagueId/duels` | [Duels](pages/duels.md) | Implemented — duel leagues only |
| `/leagues/:leagueId/duels/:duelId` | [Duel detail](pages/duel-detail.md) | Implemented — duel leagues only |
| `/leagues/:leagueId/matchday` | [Matchday](pages/matchday.md) | Implemented |
| `/leagues/:leagueId/matchday/:matchId` | [Match detail](pages/match-detail.md) | Implemented |
| `/leagues/:leagueId/market` | [Market](pages/market.md) | Implemented |
| `/leagues/:leagueId/players` | [All players](pages/players.md) | Stub |
| `/leagues/:leagueId/players/:playerId` | [Player detail](pages/player-detail.md) | Implemented |
| `/leagues/:leagueId/teams` | [Teams](pages/teams.md) | Implemented |
| `/leagues/:leagueId/table` | → redirects to [Teams](pages/teams.md) | Implemented |
| `/leagues/:leagueId/teams/:teamId` | [Club](pages/team.md) | Implemented |
| `/leagues/:leagueId/teams/:teamId/squad` | [Club — Kader](pages/team.md#kader) | Implemented |
| `/leagues/:leagueId/teams/:teamId/matches` | [Club — Spiele](pages/team.md#spiele) | Implemented |
| `/leagues/:leagueId/teams/:teamId/live` | [Club — Live](pages/team.md#live) | Implemented — only while that club plays |
| `*` | [Not found](pages/not-found.md) | Implemented |

A **stub** page already calls its real query hook and reports how many rows
came back — the API binding is proven, only the UI is missing. Stubs are
**not listed in the nav drawer**; their routes work, so they are reachable by
URL until the screen exists. See
[Navigation](routing-and-layout.md#navigation).

Neither are the two **detail** pages, and for a different reason: a player and
a club have no single subject a drawer entry could name. They are reached by
tapping the thing that names them — a squad row for a player, a **crest** for a
club, on the player header and on either side of a match's scoreline, or a row
on [Teams](pages/teams.md). The club page does now light an entry, since
*Teams* is its parent route and the drawer's match is a prefix one; the player
page still borrows *Mannschaft*.

## Conventions used throughout

- **UI copy is German.** Kickbase is a German product and the API returns
  German names, so the interface matches. Formatting helpers in
  [`src/lib/format.ts`](../src/lib/format.ts) are all `de-DE`.
- **Components never see wire keys.** The API sends abbreviated fields
  (`mv`, `mvt`, `spl`, `mvgl`). Query hooks map these into spelled-out models
  before anything renders. See [API layer](api-layer.md).
- **The URL is the source of truth for the active league.** Context is derived
  from it, never the other way round.
- **Football time comes from `nowMs()`**, not `Date.now()` — the one seam that
  lets [`npm run dev:live`](infrastructure.md#development-profiles) put the app
  inside a matchday. Auth time is deliberately exempt.
- **No global state library.** Server state lives in TanStack Query; the two
  pieces of client state that outlive a route (session, active league) are
  plain React contexts.

## Quick reference

```bash
nvm use          # Node 22, pinned in .nvmrc
npm install
npm run dev      # http://localhost:3011
npm run dev:host # reachable from a phone on the same Wi-Fi
npm run check    # typecheck + lint + format check
npm run build    # production build to dist/

docker build -t litbase:latest .              # image: nginx + the bundle
docker run --rm -p 8080:8080 litbase:latest   # http://localhost:8080
```

Adding a page or an endpoint is a short checklist — see
[Routing and layout](routing-and-layout.md#adding-a-page) and
[API layer](api-layer.md#adding-an-endpoint).
