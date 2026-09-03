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
     * (`lo`). This is the only way to see an opponent's lineup: there is no
     * opponent equivalent of `teamcenter/myeleven`, which serves the signed-in
     * user's eleven and nothing else — `userId`, `uid`, `u` and `dayNumber`
     * are all silently ignored, and 18 other path spellings answer 404.
     *
     * It has no matchday parameter either (`?dayNumber=` is ignored), so it is
     * always the lineup **as it stands now**. For a past matchday that is the
     * current lineup, not the one that was fielded then — see
     * [docs/pages/duel-detail.md](../../docs/pages/duel-detail.md#what-a-past-matchday-shows).
     */
    managerSquad: (leagueId: string, userId: string) =>
      `/v4/leagues/${leagueId}/managers/${userId}/squad`,
    /** Transfer market listings. */
    market: (leagueId: string) => `/v4/leagues/${leagueId}/market`,
    /**
     * One player, in the context of a league.
     *
     * Carries two things nothing else does:
     *
     *  - **`ph`, points per matchday.** Dense — one entry per matchday played
     *    so far, `{ hp: false }` with no `p` for a matchday the player missed
     *    — so `ph[day - 1]` is a safe index. This is the *only* source of a
     *    per-player, per-matchday score; there is no bulk equivalent
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
