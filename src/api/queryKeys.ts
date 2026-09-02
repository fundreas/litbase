/**
 * Central query-key factory.
 *
 * Keys are hierarchical so invalidation can be coarse or precise:
 *   queryClient.invalidateQueries({ queryKey: qk.league(leagueId) })  // all of one league
 *   queryClient.invalidateQueries({ queryKey: qk.squad(leagueId) })   // just the squad
 *
 * Every league-scoped key starts with `['league', leagueId]`, which is what
 * lets the app drop a whole league's cache when the user switches leagues.
 */
export const qk = {
  user: {
    all: ['user'] as const,
    settings: () => [...qk.user.all, 'settings'] as const,
  },

  leagues: {
    all: ['leagues'] as const,
    selection: () => [...qk.leagues.all, 'selection'] as const,
  },

  /** Joinable-league browsing. Separate from `leagues`, which is membership. */
  joinable: {
    all: ['joinable'] as const,
    recommended: () => [...qk.joinable.all, 'recommended'] as const,
    /** Filters are part of the key, so each combination caches separately. */
    list: (filters: {
      query?: string
      competitionId?: string
      gameMode?: number
    }) =>
      [
        ...qk.joinable.all,
        'list',
        filters.query ?? '',
        filters.competitionId ?? '',
        filters.gameMode ?? '',
      ] as const,
  },

  competitions: {
    all: ['competitions'] as const,
    list: () => [...qk.competitions.all, 'list'] as const,
  },

  league: (leagueId: string) => ['league', leagueId] as const,
  leagueMe: (leagueId: string) => [...qk.league(leagueId), 'me'] as const,
  leagueOverview: (leagueId: string) =>
    [...qk.league(leagueId), 'overview'] as const,
  ranking: (leagueId: string) => [...qk.league(leagueId), 'ranking'] as const,
  squad: (leagueId: string) => [...qk.league(leagueId), 'squad'] as const,
  market: (leagueId: string) => [...qk.league(leagueId), 'market'] as const,

  competition: (competitionId: string) =>
    ['competition', competitionId] as const,
  competitionPlayers: (competitionId: string) =>
    [...qk.competition(competitionId), 'players'] as const,
  competitionTable: (competitionId: string) =>
    [...qk.competition(competitionId), 'table'] as const,
  competitionMatchdays: (competitionId: string) =>
    [...qk.competition(competitionId), 'matchdays'] as const,
} as const
