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
  /**
   * The same endpoint scoped to one matchday (`?dayNumber=`). Kept as a child
   * of `ranking` so invalidating the standings drops every matchday with it.
   */
  rankingDay: (leagueId: string, day: number) =>
    [...qk.ranking(leagueId), 'day', day] as const,
  squad: (leagueId: string) => [...qk.league(leagueId), 'squad'] as const,
  /** Another manager's squad, including which players they have fielded. */
  managerSquad: (leagueId: string, userId: string) =>
    [...qk.league(leagueId), 'manager', userId, 'squad'] as const,
  /**
   * One manager's squad **as it stood on one matchday**.
   *
   * Keyed by matchday, unlike {@link managerSquad} — this endpoint answers
   * differently per `dayNumber`, so each day is its own entry. Hung under the
   * same `manager` prefix, so invalidating a manager drops every matchday of
   * theirs with it.
   */
  matchdaySquad: (leagueId: string, userId: string, day: number) =>
    [...qk.managerSquad(leagueId, userId), 'day', day] as const,
  /**
   * One player's detail. **Not scoped to a matchday** — the response carries
   * every matchday's points in `ph`, so one cache entry serves them all.
   */
  playerDetail: (leagueId: string, playerId: string) =>
    [...qk.league(leagueId), 'player', playerId] as const,
  /**
   * Everything else about one player, hung under {@link playerDetail} so a
   * single `invalidateQueries` on that key drops the whole detail page.
   */
  playerPerformance: (leagueId: string, playerId: string) =>
    [...qk.playerDetail(leagueId, playerId), 'performance'] as const,
  /**
   * Market-value history. **Not keyed by window** — only `/365` returns data
   * and the shorter windows are slices of it, so all four share one entry.
   */
  playerMarketValue: (leagueId: string, playerId: string) =>
    [...qk.playerDetail(leagueId, playerId), 'marketValue'] as const,
  playerTransfers: (leagueId: string, playerId: string) =>
    [...qk.playerDetail(leagueId, playerId), 'transfers'] as const,
  market: (leagueId: string) => [...qk.league(leagueId), 'market'] as const,

  /**
   * One match's live detail. **Not league-scoped** — a match belongs to the
   * competition, and two managers in different leagues watching the same
   * fixture should share the one cache entry and the one poll.
   */
  match: (matchId: string) => ['match', matchId] as const,
  matchDetails: (matchId: string) => [...qk.match(matchId), 'details'] as const,

  competition: (competitionId: string) =>
    ['competition', competitionId] as const,
  competitionPlayers: (competitionId: string) =>
    [...qk.competition(competitionId), 'players'] as const,
  competitionTable: (competitionId: string) =>
    [...qk.competition(competitionId), 'table'] as const,
  competitionMatchdays: (competitionId: string) =>
    [...qk.competition(competitionId), 'matchdays'] as const,
} as const
