# API layer

[← Back to index](README.md)

Everything that speaks to Kickbase lives under [`src/api/`](../src/api/). The
layer has one job beyond fetching: **translate**. Kickbase's v4 API uses
heavily abbreviated field names, and none of them reach a component.

## The request path

```
component
   └─ useSquad(leagueId)                 api/hooks/useSquad.ts
        └─ get<SquadResponse>(...)       api/client.ts
             └─ request interceptor      attaches Bearer token
             └─ axios
             └─ response interceptor     403 → renew + retry once
                                         any error → ApiError
        └─ mapSquad(response)            SquadResponse → SquadMember[]
```

## The axios instance

[`client.ts`](../src/api/client.ts) exports exactly one `api` instance —
20 s timeout, JSON headers, base URL from `env`. It contains **no React**,
which is what lets the auth layer depend on it without a circular import.

It also sends **`Accept-Language: de-DE`**. Kickbase localises the prose it
serves from that header, and the one field it matters for is `stxt`, the reason
a player is unavailable: without it you get "Training deficit - misses
DFB-Pokal match" in the middle of an otherwise German UI, with it
"Trainingsrückstand - verpasst DFB-Pokal-Spiel". Everything else in the
payloads is codes and numbers, so that is the only thing the header changes.

The auth layer injects two functions at startup:

```ts
setTokenProvider(() => tokenRef.current)  // where to read the current token
setReauthHandler(renewSession)            // what to do about a dead token
```

Requests can opt out of the `Authorization` header by passing the exported
`anonymousRequest` config — only login does this, because a stale token on the
login call makes Kickbase reject it.

Per-request flags travel in a `meta` field, added to axios's own
`AxiosRequestConfig` via module augmentation:

```ts
interface RequestMeta {
  skipAuth?: boolean            // set by anonymousRequest
  retriedAfterReauth?: boolean  // set internally, caps the retry at one
}
```

`get<T>()` and `post<T>()` helpers unwrap `response.data`, so hooks never
touch the axios response envelope.

The recovery path is documented in full in
[Authentication](authentication.md#renewal-two-paths).

## Endpoint registry

[`endpoints.ts`](../src/api/endpoints.ts) is the single source of truth for
paths. Nothing else in the codebase contains a URL string.

```ts
endpoints.leagues.squad(leagueId)   // /v4/leagues/{id}/squad
endpoints.competitions.table(cid)   // /v4/competitions/{cid}/table
```

Grouped as `auth`, `user`, `leagues`, `competitions`. `"1"` is the
competition id for Bundesliga.

## Two type layers

This is the core convention of the whole app.

**[`types.ts`](../src/api/types.ts) mirrors the wire exactly.** Every field
name is what the server actually sends. Meanings were confirmed against live
responses and documented inline; the few still uncertain (`mppu`, `pes`, `vr`)
are marked as guesses.

```ts
export interface SquadPlayer {
  i: string      // player id
  n: string      // last name
  mv: number     // market value, in €
  mvt: number    // market-value trend: 0 flat, 1 up, 2 down
  mvgl?: number  // gain/loss since purchase, in €
  // …
}
```

**[`models.ts`](../src/api/models.ts) is what components consume.**

```ts
export interface SquadMember {
  id: string
  lastName: string
  marketValue: number
  marketValueTrend: MarketValueTrend  // 'up' | 'down' | 'flat'
  profitLoss: number
  // …
}
```

`models.ts` also holds the shared enum-ish conversions — `toPosition()` maps
the numeric position code to `'gk' | 'def' | 'mid' | 'fwd'`, `toTrend()` maps
the trend integer to a string union, and `POSITION_LABEL` supplies the German
abbreviations (TW / ABW / MF / ANG). Because `erasableSyntaxOnly` is on, these
are `as const` objects rather than TypeScript `enum`s.

Mapping happens inside each query hook's `queryFn`, so the cache stores
already-mapped data and no component ever re-derives it.

That is also the layer the [live development profile](infrastructure.md#development-profiles)
hooks into: `useMatchdaysQuery` passes the raw `MatchdaysResponse` through
`simulateMatchdays()` before mapping, so a matchday that has been played can be
made to report itself as running. One wrapper, at the one place that payload
enters the app, and it returns its input untouched outside `npm run dev:live`.
Time itself comes from `nowMs()` in [`clock.ts`](../src/lib/clock.ts) rather
than `Date.now()` for the same reason.

## Query hooks

One file per resource in [`api/hooks/`](../src/api/hooks/). Every hook takes a
possibly-undefined id and uses `enabled` to stay idle until it has one, which
is what makes them safe to call before context has resolved.

| Hook | Endpoint | staleTime |
| ---- | -------- | --------- |
| `useLeagues()` | `/leagues/selection` | 10 min |
| `useLeagueManager(id)` | `/leagues/{id}/me` | 2 min (default) |
| `useLeagueDetails(id)` | `/leagues/{id}/overview` | 10 min |
| `useRanking(id)` | `/leagues/{id}/ranking` | 2 min (default) |
| `useSquad(id)` | `/leagues/{id}/squad` | 2 min (default) |
| `useMarket(id)` | `/leagues/{id}/market` | 30 s |
| `useCompetitionTable(cid)` | `/competitions/{cid}/table` | 10 min |
| `useCompetitionPlayers(cid)` | `/competitions/{cid}/players` | 1 hour |
| `useRecommendedLeagues()` | `/leagues/recommended` | 5 min |
| `useJoinableLeagues(f)` | `/leagues/list` | 2 min |
| `useCompetitions()` | `/competitions` | 1 hour |
| `useCurrentMatchday(cid)` | `/competitions/{cid}/matchdays` | 1 hour |
| `useMatchdaySquad(…)` | `/leagues/{id}/users/{uid}/teamcenter?dayNumber=` | 5 min |
| `useMatchdayPoints(…)` | `/leagues/{id}/players/{pid}` × N | ∞ once settled, 0 + 1 min poll while playing |

`useMatchdaySquad` is the API's only **historical** source: a manager's squad
and lineup as they stood on a given matchday, for any manager in the league.
It is what makes the duel page honest for past matchdays and what the squad
page's live view reads — see
[duel detail](pages/duel-detail.md#a-settled-matchday-shows-what-was-actually-fielded).
Note its key includes the matchday, unlike `managerSquad`, because the endpoint
answers differently per `dayNumber`.

`useMatchdayPoints` is the one **fan-out** in the app: there is no bulk source
of per-player matchday points, so it issues one request per player — but only
for players whose match has actually kicked off, and it polls only the ones
still on the pitch. It backs both the [duel detail](pages/duel-detail.md) page
and the squad page's [live view](pages/squad.md#live-tab), and shares the
`qk.playerDetail` cache entry with `useStartProbabilities`, so a page showing
both pays for each player once.

Mutations:

| Hook | Endpoint | Invalidates |
| ---- | -------- | ----------- |
| `useJoinLeague()` | `POST /leagues/{id}/join` | `qk.leagues.all`, `qk.joinable.all` |
| `useSaveLineup(id)` | `POST /leagues/{id}/lineup` or `…/lineup/clear` | `qk.squad(id)` |

See [Join a league](pages/join-league.md) and
[Squad](pages/squad.md#persistence).

The market is the shortest because prices and expiry countdowns are the most
time-sensitive data in the app. The competition player list is the longest
because it is a large payload that barely changes within a matchday.

## Query keys

[`queryKeys.ts`](../src/api/queryKeys.ts) builds hierarchical keys so
invalidation can be coarse or precise:

```ts
qk.squad(leagueId)        // ['league', '4127831', 'squad']
qk.league(leagueId)       // ['league', '4127831']  → the whole league
```

Every league-scoped key starts with `['league', leagueId]`. That prefix is
what lets `LeagueProvider` drop one league's entire cache when the user
switches away from it:

```ts
queryClient.removeQueries({ queryKey: ['league', leagueId] })
```

So a stale squad can never flash under a different league's name.

## Cache and retry policy

[`queryClient.ts`](../src/api/queryClient.ts):

- `staleTime` 2 min, `gcTime` 30 min by default.
- `refetchOnWindowFocus` and `refetchOnReconnect` both **on** — on a phone the
  app is backgrounded constantly, and refetching on return is what makes it
  feel live.
- Retries are selective: an **auth failure never retries** (the auth layer owns that
  recovery), and neither does any other 4xx, since it will not fix itself.
  Transient failures retry twice with exponential backoff capped at 8 s.
- Mutations do not retry.

The client is created inside `useState` in [`App.tsx`](../src/App.tsx) rather
than at module scope, so Fast Refresh cannot hand a stale client to a fresh
tree.

## Error normalisation

[`errors.ts`](../src/api/errors.ts) converts anything thrown into an
`ApiError` carrying `status`, `code`, `apiCode`, `apiError`, `isNetwork`,
`isUnauthenticated` and `isPermanent`, plus a message that is safe to render.

**Kickbase's HTTP status is not a reliable signal**, which is why this layer
exists in the shape it does. Observed behaviour:

| Status | Means |
| ------ | ----- |
| `403` | Missing, malformed or expired token — **the "re-authenticate" status** |
| `401` | Wrong email or password, on `/v4/user/login` only |
| `500` | Includes *validation* errors such as `PasswordTooWeak` and `InvalidEMailAddress` |
| `400` | Other semantic errors, e.g. `EMailAddressAlreadyTaken` |

The body is `{ err: <number>, errMsg: <string>, svcs: [] }`. Note `err` is a
**number** (`2020`), not a message — rendering it directly would put "2020" in
front of the user. `errMsg` is the trustworthy field, and known names are
mapped to German copy in `MESSAGE_BY_API_ERROR`.

`isPermanent` therefore checks `apiError` *before* falling back to
`status < 500`, so a validation error served as 500 is correctly treated as
final and not retried.

This is also why [`ErrorState`](../src/components/ui/States.tsx) can show a
wifi-off icon for a network failure and a warning triangle otherwise, without
any component importing axios.

## Images

Kickbase is inconsistent: the login user's `profile` is an absolute URL, while
almost everything else (`pim`, `uim`, `tim`, `cpim`) is a CDN-relative path
like `content/file/abc.png`. [`cdn.ts`](../src/api/cdn.ts) handles both and
returns `undefined` for empty values, so `Avatar` can fall back to initials.

## Adding an endpoint

1. Add the path to [`endpoints.ts`](../src/api/endpoints.ts).
2. Add the raw DTO to [`types.ts`](../src/api/types.ts), keeping the wire key
   names and documenting what each means.
3. Add a readable model to [`models.ts`](../src/api/models.ts).
4. Add a key to [`queryKeys.ts`](../src/api/queryKeys.ts) — league-scoped keys
   must start with `qk.league(leagueId)`.
5. Write a hook in [`api/hooks/`](../src/api/hooks/) that fetches and maps.

Components should never see `mvt` or `spl`.

## Endpoints probed but unused

- `/v4/user/settings` and `/v4/user/me` — both 200, redundant with the login
  response for now.
- `/v4/competitions/{cid}/players/{pid}` — the **league-free** twin of
  `/v4/leagues/{id}/players/{pid}`, carrying the same `prob`/`plpim`/`stxt`
  fields. Unused by the app, but it is how the lineup probability was probed
  from an account belonging to no league. `/v4/competitions/{cid}/teams/{tid}/teamprofile`
  pairs with it to enumerate a club's roster. See
  [Squad](pages/squad.md#lineup-probability-prob).
- `/v4/chat/refreshtoken` — 200. Refreshes the Firebase chat token
  (`chttkn`, ~1 h). Nothing needs chat yet.
- `/v4/user/refresh`, `/v4/user/refreshtoken`, `/v4/user/token` — all **404**.
  This is why [Authentication](authentication.md) works the way it does.
- `/v4/leagues/{id}/duels`, `/duels/{day}`, `/ranking/{day}`,
  `/matchdays/{day}`, `/battles`, `/h2h`, `/ranking/duels` — all **404**.
  There is no duel endpoint; `?dayNumber=` on the standings is the only source
  of per-matchday pairings. See [Duels](pages/duels.md#data).
- `/v4/leagues/{id}/live`, `/livepitch`, `/ranking/live`, `/v4/live/leagues/{id}`
  — all **404**. Live matchday points come from `mdp` on the standings, which
  updates during a matchday; nothing richer is exposed.
- **No opponent eleven.** `/v4/leagues/{id}/teamcenter/myeleven` is 200 and
  carries per-player match state plus a `mu` block naming both duel managers,
  but only ever for the signed-in user — `userId`, `uid`, `u` and `dayNumber`
  are ignored, and `opponenteleven`, `theireleven`, `oppeleven`,
  `teamcenter/{uid}`, `managers/{uid}/eleven` and a dozen more answer 404.
  Another manager's lineup comes from `/managers/{uid}/squad` instead.
- **No bulk player detail.** `/v4/leagues/{id}/players`,
  `/leagues/{id}/players?ids=` and `/competitions/{id}/players?ids=` are 404 or
  ignore the filter, so per-player matchday points are one request each. See
  [Duel detail](pages/duel-detail.md#points-cost-one-request-per-player).
- `/v4/matches/{matchId}` — 200, and the only source of goal-by-goal highlights
  (`hl`) and the match clock (`mt`, `mph`). Nothing uses it yet.
- `/v4/leagues/{id}/managers/{uid}/dashboard` and `/performance` — both 200.
  `performance` carries a manager's points for every matchday of every season
  they have played; `dashboard` has duel counts (`hhw`, `hhl`) and a points
  history. Neither is fetched — the standings already answer what the duel
  pages ask.

## Query parameters that answer 200 for nonsense

Two endpoints take filters that fail **silently** rather than erroring, which
is easy to mistake for a working filter:

- `/v4/leagues/list` ignores wire-style spellings (`cpi`, `gpm`, `gameMode`)
  and returns the unfiltered list. The working names are `query`,
  `competitionId`, `gamePlayMode`.
- `/v4/leagues/{id}/ranking?dayNumber=` accepts `0`, `35` and `99` with a 200,
  echoing the value back as `day` and stripping every per-matchday field from
  the managers. Callers must validate the day against the real schedule — see
  [Duels](pages/duels.md#the-matchday-lives-in-the-url).
