/**
 * Every Kickbase path the app touches, in one place.
 *
 * Keep this the single source of truth — query hooks reference these helpers
 * so a path change never has to be hunted across the codebase.
 */
export const endpoints = {
  auth: {
    login: '/v4/user/login',
    /** Creates the account outright — no email confirmation step. */
    register: '/v4/user/register',
  },
  user: {
    settings: '/v4/user/settings',
    me: '/v4/user/me',
  },
  leagues: {
    /** Leagues the signed-in user belongs to, with budget/placement. */
    selection: '/v4/leagues/selection',
    /** The signed-in manager inside one league (budget, squad size, …). */
    me: (leagueId: string) => `/v4/leagues/${leagueId}/me`,
    /** League metadata and member list. */
    overview: (leagueId: string) => `/v4/leagues/${leagueId}/overview`,
    /**
     * Standings of all managers in the league.
     *
     * Takes an optional **`?dayNumber=`** query parameter (camelCase, like the
     * `/leagues/list` filters) that scopes the response to one matchday. That
     * is the only known source of duel pairings for a matchday other than the
     * current one: `hhoui` names a *different* opponent for each `dayNumber`,
     * verified across days 1 and 2 of a live league.
     *
     * Out-of-range values do **not** error — `dayNumber=0`, `35` and `99` all
     * answer 200 with the managers stripped of their per-matchday fields, so
     * the caller has to clamp to `1…nd` itself.
     */
    ranking: (leagueId: string) => `/v4/leagues/${leagueId}/ranking`,
    /** The signed-in manager's players. */
    squad: (leagueId: string) => `/v4/leagues/${leagueId}/squad`,
    /**
     * **Another** manager's players, including which of them are fielded
     * (`lo`) and what they are worth.
     *
     * It takes **no matchday parameter** — `?dayNumber=` is accepted and
     * silently ignored — so it is always the squad **as it stands now**. For a
     * past matchday that is today's players, not the ones fielded then.
     *
     * For a matchday snapshot use {@link managerTeamcenter} instead. This
     * comment claimed until 2026-09-04 that no such thing existed; it does,
     * and the mistake was probing the wrong spelling.
     */
    managerSquad: (leagueId: string, userId: string) =>
      `/v4/leagues/${leagueId}/managers/${userId}/squad`,
    /**
     * One manager's squad **as it stood on a given matchday** — the historical
     * snapshot, including who was actually fielded.
     *
     * `?dayNumber=` is **required and honoured** (verified 2026-09-04 against
     * a league with played matchdays): the player set and the lineup come back
     * as they were that matchday, not as they are today. Works for **any**
     * manager in the league, not just the signed-in one — asking for another
     * manager's id returns that manager's team, which
     * `teamcenter/myeleven` cannot do.
     *
     * Two fields carry the split: **`lp`** is the fielded eleven and **`nlp`**
     * everyone else, the same pair `teamcenter/myeleven` uses. Out-of-range
     * days (`0`, `99`) and matchdays before the league existed answer 200 with
     * both lists empty rather than erroring, so the caller has to treat empty
     * as "nothing to show".
     *
     * **Note the spelling**: `users/{userId}/teamcenter`, not
     * `managers/{userId}/…`. Both segments differ from the neighbouring
     * endpoints, which is why an earlier round of probing concluded — wrongly,
     * for two months — that no historical lineup existed anywhere in the API.
     * `users/{userId}/squad` really is a 404; only this spelling resolves.
     */
    managerTeamcenter: (leagueId: string, userId: string) =>
      `/v4/leagues/${leagueId}/users/${userId}/teamcenter`,
    /**
     * Transfer market listings. `GET` reads them; `POST` puts one of your own
     * players up, body `{ pi, prc }` — wire-style names, `{ playerId, price }`
     * answers 500 `NotFound`.
     *
     * The rest of the surface was read off the `Allow` header an `OPTIONS`
     * request returns: a wrong verb answers 405 and names the right one. See
     * [docs/pages/market.md](../../docs/pages/market.md).
     */
    market: (leagueId: string) => `/v4/leagues/${leagueId}/market`,
    /** One listing. `DELETE` only — withdraws your own. */
    marketListing: (leagueId: string, playerId: string) =>
      `/v4/leagues/${leagueId}/market/${playerId}`,
    /**
     * Offers on one listing. `POST` bids, body `{ price }` — note the *plain*
     * name, where listing a player takes the abbreviated `prc`. It answers
     * `{ ofi }`, the offer id, which for one's own offer is the user id.
     */
    marketOffers: (leagueId: string, playerId: string) =>
      `/v4/leagues/${leagueId}/market/${playerId}/offers`,
    /** One offer. `DELETE` withdraws it; the id is `uoid` on the listing. */
    marketOffer: (leagueId: string, playerId: string, offerId: string) =>
      `/v4/leagues/${leagueId}/market/${playerId}/offers/${offerId}`,
    /**
     * One player, in the context of a league.
     *
     * Carries two things nothing else does:
     *
     *  - **`ph`, points per matchday.** Dense but **newest first**: `ph[0]` is
     *    the payload's own `day`, and the index counts back from there — see
     *    [`matchdayEntry`](./hooks/useMatchdayPoints.ts). This is the *only*
     *    source of a per-player, per-matchday score; there is no bulk equivalent
     *    (`/leagues/{id}/players`, `?ids=` → 404), which is why
     *    [Duel detail](../../docs/pages/duel-detail.md#points-cost-one-request-per-player)
     *    fans out one request per player.
     *  - **`prob`, the lineup-probability tier** (1..5, lower is likelier),
     *    plus `stxt` for the reason behind an injury. Rendered on both squad
     *    tabs. Note `plpim` alongside it is the *team's* poster, not a
     *    per-player icon — see
     *    [docs/pages/squad.md](../../docs/pages/squad.md#lineup-probability-prob).
     */
    player: (leagueId: string, playerId: string) =>
      `/v4/leagues/${leagueId}/players/${playerId}`,
    /**
     * Every season the player has appeared in, each with **one entry per
     * fixture of their club's season** — played or not.
     *
     * The only source of per-match detail: minutes (`mp`), the events that
     * happened (`k`), and whether they started, came on or sat out (`st`).
     * Identical byte-for-byte to the competition-scoped
     * `/v4/competitions/{id}/players/{id}/performance`; the league-scoped
     * spelling is used so the whole page caches under one league key.
     */
    playerPerformance: (leagueId: string, playerId: string) =>
      `/v4/leagues/${leagueId}/players/${playerId}/performance`,
    /**
     * Daily market values, plus what the owning manager paid for the player.
     *
     * **`days` is not a free parameter — only `365` returns anything.** Every
     * other value probed (1, 7, 30, 90, 180, 366, 1000, and 0…6 as an enum)
     * answers 200 with an empty `it` and zeroed metadata, which is easy to
     * mistake for "this player has no history". The shorter windows the UI
     * offers are therefore sliced client-side out of the one response — see
     * {@link MarketValueWindow}.
     */
    playerMarketValue: (leagueId: string, playerId: string, days: number) =>
      `/v4/leagues/${leagueId}/players/${playerId}/marketvalue/${String(days)}`,
    /**
     * Who has owned the player in this league, oldest first.
     *
     * Each entry is one ownership event, not a purchase: `t` says which
     * (see `TRANSFER_TYPE`), and only a real buy carries a non-zero `trp`.
     * A player handed out when a manager joined has `trp: 0`, which is why
     * the purchase price the UI shows comes from the market-value response's
     * `trp` instead — see {@link PlayerMarketValueResponse.trp}.
     */
    playerTransfers: (leagueId: string, playerId: string) =>
      `/v4/leagues/${leagueId}/players/${playerId}/transferHistory`,
    /**
     * The manager's lineup. `GET` reads it, `POST` replaces it wholesale
     * (`PUT` answers 405). The POST body is `{ type, players }` — see
     * `SaveLineupRequest`.
     */
    lineup: (leagueId: string) => `/v4/leagues/${leagueId}/lineup`,
    /** Empties the lineup. No request body. */
    lineupClear: (leagueId: string) => `/v4/leagues/${leagueId}/lineup/clear`,
    /**
     * Auto-fills the lineup. Body is `{ lud, pls }` — note the *different*
     * field names to `POST /lineup`'s `{ type, players }`. Unused so far.
     */
    lineupFill: (leagueId: string) => `/v4/leagues/${leagueId}/lineup/fill`,
    /** The lineup with slot assignments (`lp[]` with `lo`, `lst`). Unused. */
    lineupOverview: (leagueId: string) =>
      `/v4/leagues/${leagueId}/lineup/overview`,

    /* --- Joining ------------------------------------------------------- */

    /** Leagues Kickbase suggests. Different item shape to `list` — see types. */
    recommended: '/v4/leagues/recommended',
    /**
     * Browsable/searchable joinable leagues.
     *
     * Query parameters are **camelCase** and were confirmed by probing:
     * `query`, `competitionId`, `gamePlayMode`. The wire-style spellings
     * (`cpi`, `gpm`, `gameMode`) are silently ignored — they return the
     * unfiltered list rather than an error, which is easy to mistake for a
     * working filter.
     */
    list: '/v4/leagues/list',
    /** Join a league. No request body required. */
    join: (leagueId: string) => `/v4/leagues/${leagueId}/join`,
  },
  matches: {
    /**
     * One match, live: the score, the **minute** (`mt`), the status (`mst`),
     * the real-world starting elevens (`t1lp`/`t2lp`) and a full `events`
     * feed.
     *
     * The only source of any of it. `/competitions/{id}/matchdays` carries a
     * score too, but that payload is the whole season and is cached for an
     * hour, so it is no use to a page watching a match.
     *
     * **It does not echo its own id** — no `mi` on the response — so a caller
     * fanning out over several matches has to keep track of which answer
     * belongs to which request.
     *
     * `events` entries carry `ke`, on the **same code scale** as `k` on the
     * player-performance endpoint: verified against a finished 5:1 where the
     * feed held five `1`s and a `2` (five goals and an own goal), four `4`s
     * for the yellow cards, and ten `8`s for the substitutions.
     *
     * **Match-level entries use `pi: "0"`** — kick-off, half-time, the
     * whistle — and their `ke` codes are *not* on the player scale and have
     * not been identified. They are dropped, and the
     * [match timeline](../../docs/pages/match-detail.md#the-structural-markers)
     * derives those three moments from the fixture's own state instead. One
     * probe reading the `ke` of a `pi: "0"` entry would settle it.
     */
    details: (matchId: string) => `/v4/matches/${matchId}/details`,
  },
  live: {
    /**
     * Names for every scoring event Kickbase knows — 621 of them, from
     * *Fernschusstor (Bonus)* to *Pass des Todes*.
     *
     * **A different, much larger scale than the `ke` codes** on a match's
     * `events` feed: these ids run into the thousands and repeat per game
     * mode (classic, PlusOne, 3 Play). Unused so far; it is what a
     * points-breakdown view would need, not what a live score needs.
     */
    eventTypes: '/v4/live/eventtypes',
  },
  competitions: {
    /** All competitions (Bundesliga, La Liga, MLS, …). */
    all: '/v4/competitions',
    /** All players in a competition ("1" = Bundesliga). */
    players: (competitionId: string) =>
      `/v4/competitions/${competitionId}/players`,
    /** Real-world league table. */
    table: (competitionId: string) => `/v4/competitions/${competitionId}/table`,
    /**
     * Every matchday with its fixtures. The top-level `day` is the *current*
     * matchday; each fixture names the home team as `t1` and the away team as
     * `t2`. Within one matchday a team appears exactly once, so it doubles as
     * a team → next-fixture lookup.
     */
    matchdays: (competitionId: string) =>
      `/v4/competitions/${competitionId}/matchdays`,
  },
} as const
