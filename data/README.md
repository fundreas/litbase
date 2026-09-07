# `data/` — the app's own data set

Everything here is **generated, committed, and served as static JSON** at
`/data/…`. It is not part of the bundle: [`vite.config.ts`](../vite.config.ts)
serves the folder in dev and copies it into `dist/data/` on build, so the URLs
stay literal and a file added tonight is reachable by a bundle built last week.

It lives at the repo root rather than in `public/` on purpose. `public/` is for
things the app is *made of* — the icon, the manifest — copied in without anyone
thinking about them. This has its own build step, its own refresh cadence and
its own size, and all three deserve to be visible.

## `rankings/{competitionId}/matchday-{day}.json`

**The matchday's ranking, computed here rather than fetched.**

Kickbase serves exactly one player ranking,
[`/v4/competitions/{id}/players`](../docs/api/competitions.md#get-v4competitionscompetitionidplayers),
and it is always the **current** matchday's — every matchday parameter it was
offered is swallowed in silence. So everything before the current matchday is
assembled from the one place those numbers survive: each player's own
performance history, one request per player, folded back into a table.

| Field | What |
| ----- | ---- |
| `competitionId` | The competition the file is for, `"1"` for Bundesliga |
| `seasonId` · `season` | Kickbase's season id and label, e.g. `"42"` / `"2026/2027"` |
| `day` | The matchday |
| `generatedAt` | When the script ran, ISO 8601 |
| `playerCount` | `players.length`, so a reader need not count |
| `players[]` | **Every player who scored that matchday**, points descending |

One row: `id`, `name`, `team`, `pos` (`gk` · `def` · `mid` · `fwd`), `points`,
`minutes`, `goals`, `assists`, `matchId`, `image`.

**The list is not capped.** The 100 rows the UI shows are a slice taken at
render, which is what makes the per-position rankings real top-100s — *ABW* is
the hundred best defenders, not the defenders among the hundred best players —
and what lets the cap be raised later without re-seeding.

**Only settled matchdays get a file.** The current one is deliberately absent:
it is still moving and the app has the live endpoint for it. Which of the two
answers is decided in
[`useMatchdayRanking`](../src/api/hooks/useMatchdayRanking.ts), the only place
in the app that knows there are two sources.

### Rebuilding

After a matchday finishes:

```sh
KB_TOKEN=<bearer> npm run data:rankings
```

or, since tokens expire in about a week and this runs every matchday, put
`KB_EMAIL` and `KB_PASSWORD` in a gitignored `.env.local` and let the script
sign in for itself:

```sh
node --env-file=.env.local scripts/build-matchday-rankings.mjs
```

The sweep rebuilds **every** settled matchday of the season, not just the last
one — each player's history answers the whole season in one response, so there
is no incremental state to get wrong and re-running is idempotent. Options and
the reasoning are in
[`scripts/build-matchday-rankings.mjs`](../scripts/build-matchday-rankings.mjs).
