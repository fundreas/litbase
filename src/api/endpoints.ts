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
    /** Standings of all managers in the league. */
    ranking: (leagueId: string) => `/v4/leagues/${leagueId}/ranking`,
    /** The signed-in manager's players. */
    squad: (leagueId: string) => `/v4/leagues/${leagueId}/squad`,
    /** Transfer market listings. */
    market: (leagueId: string) => `/v4/leagues/${leagueId}/market`,
    /**
     * The manager's lineup. `GET` reads it, `POST` replaces it wholesale
     * (`PUT` answers 405). The POST body is `{ type, players }` — see
     * `SaveLineupRequest`.
     */
    lineup: (leagueId: string) => `/v4/leagues/${leagueId}/lineup`,

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
  },
} as const
