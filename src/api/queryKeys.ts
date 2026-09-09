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
  /**
   * One battle's standings, by type code.
   *
   * A sibling of {@link ranking} rather than a child of it: the two are
   * different endpoints ranking the same managers by different figures, and
   * dropping the league table should not drop seven battle tables with it.
   * Each type is its own entry — one request per battle, there is no call
   * that answers for all of them.
   */
  battle: (leagueId: string, type: number) =>
    [...qk.league(leagueId), 'battle', type] as const,
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
   * One manager's every season in the league. Under the same `manager` prefix
   * as their squad, so dropping a manager drops their history too.
   */
  managerPerformance: (leagueId: string, userId: string) =>
    [...qk.league(leagueId), 'manager', userId, 'performance'] as const,
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
  /**
   * The player's market state and the viewer's bid on him — a **different**
   * endpoint to {@link playerTransfers}, despite the neighbouring paths.
   */
  playerOffers: (leagueId: string, playerId: string) =>
    [...qk.playerDetail(leagueId, playerId), 'offers'] as const,
  /**
   * One player in **one matchday's** match — the live score and its breakdown.
   *
   * Keyed by the matchday *and the season*, unlike {@link playerDetail}: this
   * response describes a single fixture, and `?dayNumber=` with `?seasonId=`
   * is what chooses which, so the entries cannot be shared across either.
   * `seasonId` is omitted for the running season, which is what the endpoint
   * defaults to — so the key it produces is the one the live pages already use.
   */
  playerCenter: (
    leagueId: string,
    playerId: string,
    day: number,
    seasonId?: string,
  ) =>
    [
      ...qk.playerDetail(leagueId, playerId),
      'center',
      day,
      seasonId ?? 'current',
    ] as const,
  /** The scoring-event catalogue. Global — not scoped to a league or season. */
  eventTypes: () => ['eventTypes'] as const,
  market: (leagueId: string) => [...qk.league(leagueId), 'market'] as const,
  /**
   * The league's event log, as an infinite query — one entry holds every page
   * fetched so far. Not keyed by page: the pages are the entry's own
   * structure, and `?start=` is the page parameter.
   */
  activities: (leagueId: string) =>
    [...qk.league(leagueId), 'activities'] as const,
  /**
   * One feed entry's comment thread. Hung under {@link activities}, so
   * invalidating the feed drops every thread read from it — which is what
   * posting a comment wants, since the entry's own count moves with it.
   */
  activityComments: (leagueId: string, activityId: string) =>
    [...qk.activities(leagueId), activityId, 'comments'] as const,
  /** One of the viewer's achievements in this league, by type code. */
  achievement: (leagueId: string, type: number) =>
    [...qk.league(leagueId), 'achievement', type] as const,
  /**
   * One club's squad, in the context of a league.
   *
   * League-scoped rather than competition-scoped because the response carries
   * `oui` — who owns each player *here* — so two leagues watching the same club
   * must not share it. The competition-scoped twin exists and is deliberately
   * not used; see {@link endpoints.leagues.teamProfile}.
   */
  teamProfile: (leagueId: string, teamId: string) =>
    [...qk.league(leagueId), 'team', teamId] as const,

  /**
   * One match's live detail. **Not league-scoped** — a match belongs to the
   * competition, and two managers in different leagues watching the same
   * fixture should share the one cache entry and the one poll.
   */
  match: (matchId: string) => ['match', matchId] as const,
  matchDetails: (matchId: string) => [...qk.match(matchId), 'details'] as const,

  competition: (competitionId: string) =>
    ['competition', competitionId] as const,
  /**
   * The scope and the position are part of the key, not a `select`: each
   * combination is a separate request answering a separate top-25, so ten
   * entries is exactly right — going back to one already looked at is instant
   * and costs nothing.
   */
  competitionPlayers: (
    competitionId: string,
    scope: string,
    position: string = 'all',
  ) => [...qk.competition(competitionId), 'players', scope, position] as const,
  /**
   * One archived matchday-ranking file. Not keyed by position: the file holds
   * every player who scored that day, so the position lists are slices of one
   * fetch rather than five.
   */
  competitionRankingArchive: (competitionId: string, day: number) =>
    [...qk.competition(competitionId), 'rankingArchive', day] as const,
  /**
   * One player's market-value forecast, from the
   * [foresight API](./hooks/usePlayerForecast.ts) rather than Kickbase.
   *
   * Keyed by competition and **not** by league: the file is a property of the
   * competition, so every league of the same competition reads one entry and
   * switching leagues does not re-fetch it.
   */
  playerForecast: (competitionId: string, playerId: string) =>
    [...qk.competition(competitionId), 'playerForecast', playerId] as const,
  competitionTable: (competitionId: string) =>
    [...qk.competition(competitionId), 'table'] as const,
  competitionMatchdays: (competitionId: string) =>
    [...qk.competition(competitionId), 'matchdays'] as const,
} as const
