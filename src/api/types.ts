/**
 * Raw Kickbase API DTOs.
 *
 * The API uses heavily abbreviated keys. These types mirror the wire format
 * verbatim — every field name is exactly what the server sends. Where the
 * meaning was confirmed against live responses it is documented; anything
 * still unclear is marked `?`. Map these into readable shapes at the edge of
 * the app (see the `map*` helpers next to each query hook) rather than
 * spreading `p.mvt` through your components.
 */

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

export interface LoginRequest {
  /** Email address. */
  em: string
  /** Password. */
  pass: string
  /** "Loyalty" / stay-signed-in flag. The app sends false. */
  loy: boolean
  /** Device reporting payload. An empty object is accepted. */
  rep: Record<string, never>
}

export interface LoginResponse {
  /** Bearer token. */
  tkn: string
  /** Token expiry, ISO 8601. Roughly 7 days out. */
  tknex: string
  /** Firebase chat token — separate lifetime (~1h), only needed for chat. */
  chttkn: string
  /** Chat token expiry, ISO 8601. */
  chtknex: string
  /** Verified email. */
  emve: string
  u: LoginUser
  /** Leagues the user is a member of ("server list"). */
  srvl: LoginLeague[]
}

export interface RegisterRequest {
  /** Email address. Must be unique and well-formed. */
  em: string
  /** Desired username. Optional in practice — the server generates one
   *  (`KickbaseUser####`) when this is empty. */
  unm: string
  /** Password. Rejected as `PasswordTooWeak` if it does not meet the policy. */
  pass: string
  /** Invite/registration token. Empty for open registration. */
  tkn: string
  /** Terms and privacy accepted. */
  rek: boolean
  /** Opt-in to marketing/push notifications. */
  rept: boolean
  /** Device reporting payload. An empty object is accepted. */
  rep: Record<string, never>
}

/**
 * Registration response.
 *
 * Confirmed against a real registration: it carries a **usable bearer token**
 * and its expiry, so the new account is signed in without a second round trip.
 *
 * Differences from {@link LoginResponse}:
 *  - No `srvl` — a fresh account belongs to no leagues.
 *  - No `emve` or chat token.
 *  - `u` has no `profile`/`uim`, so the avatar falls back to initials.
 */
export interface RegisterResponse {
  u: LoginUser
  /** Bearer token, ready to use. */
  tkn: string
  /** Token expiry, ISO 8601 — same ~7 days as login. */
  tknex: string
  /** Is a new user. `true` on registration. */
  isnu?: boolean
}

export interface LoginUser {
  id: string
  name: string
  email: string
  /** Absolute avatar URL. */
  profile?: string
  /** Avatar path relative to the CDN root, e.g. `user/abc.png`. */
  uim?: string
  perms?: number[]
  proExpiry?: string
}

export interface LoginLeague {
  id: string
  name: string
  /** Competition id — "1" is Bundesliga. */
  cpi: string
  /** League avatar path, relative to the CDN root. */
  uim?: string
  creator?: string
  creatorId?: string
  creation?: string
  /** Member count. */
  mu?: number
  /** Max players per lineup. */
  pl?: number
}

/* -------------------------------------------------------------------------- */
/* Leagues                                                                    */
/* -------------------------------------------------------------------------- */

export interface LeagueSelectionResponse {
  it: LeagueSelectionItem[]
  /** Number of open leagues available to join. */
  anol?: number
  anopl?: number
}

export interface LeagueSelectionItem {
  /** League id. */
  i: string
  /** League name. */
  n: string
  /** Competition id. */
  cpi: string
  /** Budget, in €. Can be negative. */
  b: number
  /** Unread notifications. */
  un?: number
  /** Own placement in the league. */
  pl?: number
  /** Team value, in €. */
  tv?: number
  /** Competition image path, relative to the CDN root. */
  cpim?: string
  /** Total member count. */
  bs?: number
  vr?: number
  adm?: boolean
}

/* --- Joining a league ----------------------------------------------------- */

/**
 * `GET /v4/leagues/recommended`.
 *
 * Note the item shape differs from {@link LeagueListItem}: the id is `i` (not
 * `li`), the competition arrives as a **name** (`cpn`) rather than an id, and
 * there is no game mode or member cap. Both are mapped into the same
 * `JoinableLeague` model.
 */
export interface RecommendedLeaguesResponse {
  it: RecommendedLeagueItem[]
}

export interface RecommendedLeagueItem {
  /** League id. */
  i: string
  /** League name. */
  lnm: string
  /** Competition name, already resolved, e.g. "Bundesliga". */
  cpn?: string
  /** Manager count. */
  mgc?: number
  /** League image path, relative to the CDN root. */
  lim?: string
  /** Member ids. */
  mid?: string[]
  /** Members (thin — id plus avatar path). */
  m?: Array<{ ui: string; uim?: string }>
  /** Is verified / featured. */
  isvf?: boolean
  /** Verification tier. */
  vft?: number
}

/** `GET /v4/leagues/list`, optionally filtered. */
export interface LeagueListResponse {
  /** The result list. */
  it: LeagueListItem[]
  /** Recommended leagues, returned alongside every query. */
  rml?: LeagueListItem[]
}

export interface LeagueListItem {
  /** League id. */
  li: string
  /** League name. */
  lnm: string
  /** Competition id. */
  cpi?: string
  /** Competition image path, relative to the CDN root. */
  cpim?: string
  /** League image path, relative to the CDN root. */
  lim?: string
  /** Manager count. */
  mgc?: number
  /** Maximum managers. */
  mgm?: number
  /** Meaning unconfirmed — `true` on arena-mode leagues. */
  hum?: boolean
  /** Is verified / featured. */
  isvf?: boolean
  /** Verification tier. */
  vft?: number
  /** Game mode, see GAME_PLAY_MODE. */
  gpm?: number
}

/**
 * Game modes, from the values `gamePlayMode` actually filters on.
 *
 * `3` returns nothing and `5` is ignored (it yields the unfiltered list), so
 * only these four are real. The labels are **inferred from the league names
 * each filter returns**, not supplied by the API — nothing in `/v4/config`
 * names them.
 */
export const GAME_PLAY_MODE = {
  /** Beginner — "liga Anfänger". */
  BEGINNER: 0,
  /** Classic — the default Kickbase mode. */
  CLASSIC: 1,
  /** High management — "High-Management". */
  HIGH_MANAGEMENT: 2,
  /** Arena — large open leagues. */
  ARENA: 4,
} as const

/** `GET /v4/competitions`. */
export interface CompetitionsResponse {
  it: CompetitionItem[]
}

export interface CompetitionItem {
  /** Competition id. `"1"` is Bundesliga. */
  i: string
  /** Display name. */
  n: string
  /** Competition icon path, relative to the CDN root. */
  cpim?: string
  /** Full-bleed background image path. */
  fb?: string
  /** Available feature ids. */
  fts?: number[]
}

export interface LeagueMeResponse {
  /** Budget, in €. */
  b: number
  /** Squad size. */
  bs?: number
  /** Max players per matchday? */
  mppu?: number
  /** Unread notifications. */
  un?: number
  /** Competition id. */
  cpi: string
  /** League name. */
  lnm: string
  adm?: boolean
  /** Per-team player counts in the squad. */
  tpc?: Array<{ tid: string; npt: number; tim?: string }>
}

export interface LeagueOverviewResponse {
  /** League id. */
  i: string
  /** League name. */
  lnm: string
  /** Competition id. */
  cpi: string
  /** Competition name, e.g. "Bundesliga". */
  cpn: string
  /** Created at, ISO 8601. */
  dt: string
  /** Member ids. */
  mid?: string[]
  /** Members (thin — id plus avatar path). */
  m?: Array<{ ui: string; uim?: string }>
  /** Matchday count? */
  mgc?: number
  isr?: boolean
}

export interface RankingResponse {
  /** League name. */
  ti: string
  cpi: string
  /**
   * Users — **not** in placement order. The API returns them in some other
   * order entirely (a real response led with a manager sitting 6th), so the
   * client must sort. See `useRanking`.
   */
  us: RankingUser[]
  /** Game play mode, see GAME_PLAY_MODE. */
  gpm?: number
  /**
   * The matchday this response describes — it echoes back `?dayNumber=` when
   * one was passed, including nonsense values.
   *
   * Without the parameter it is the **last scored** matchday, which is *not*
   * the competition's current one: with matchday 1 played and matchday 2 not
   * yet kicked off, this reads `1` while `/competitions/{id}/matchdays`
   * reports `2`. Anything that means "the matchday being played now" has to
   * come from the competition, not from here.
   */
  day?: number
  /** Season label, e.g. "26/27". */
  sn?: string
  /** Number of matchdays in the season. */
  nd?: number
  /** Last finished matchday. */
  lfmd?: number
  ish?: boolean
}

export interface RankingUser {
  /** User id. */
  i: string
  /** Display name. */
  n: string
  /** Avatar path, relative to the CDN root. */
  uim?: string
  /** Season points. */
  sp: number
  /** Season placement. */
  spl: number
  /**
   * Points for the matchday this response describes — live while it is being
   * played. `0` for a matchday that has not kicked off yet.
   */
  mdp: number
  /** Placement on that matchday. `0` before it has been played. */
  mdpl: number
  /** Team value, in €. */
  tv: number
  /** Points per matchday, oldest first. `null` = did not play. */
  lp?: Array<number | null>
  /** Is admin. */
  adm?: boolean
  /** Placement change vs. previous matchday. */
  ppc?: number

  /* --- Duel ("Duell") mode ------------------------------------------- */

  /**
   * Head-to-head **season** points — the running duel total.
   *
   * Named after the same convention as `sp`/`mdp`: `hh` + `sp` season, `hh` +
   * `mp` matchday. Present as `0` in leagues without duels.
   */
  hhsp?: number
  /**
   * Head-to-head **matchday** points — the duel result for this matchday.
   *
   * The scale is **confirmed against live data**: across all five duels of a
   * played matchday the manager with the higher `mdp` carried `3` and the
   * other `0`. A draw is presumably `1`; no drawn duel has been observed.
   *
   * Absent entirely for a matchday that has not been played yet.
   */
  hhmp?: number
  /**
   * Head-to-head placement — the duel table position.
   *
   * **Only present in duel leagues**, which is what the app uses to detect the
   * mode: a normal league carries no `hhpl` at all.
   */
  hhpl?: number
  /**
   * Opponent user id for the duel on **this response's matchday**.
   *
   * The pairing is per matchday and changes with `?dayNumber=`, which is what
   * makes the [Duels](../../docs/pages/duels.md) page possible. Verified
   * mutual: every `hhoui` points back at the manager naming it, and ten
   * managers resolve to exactly five duels with none left over.
   */
  hhoui?: string
  hll?: boolean
}

/* -------------------------------------------------------------------------- */
/* Players                                                                    */
/* -------------------------------------------------------------------------- */

/** Position codes used across every player payload. */
export const PLAYER_POSITION = {
  GOALKEEPER: 1,
  DEFENDER: 2,
  MIDFIELDER: 3,
  FORWARD: 4,
} as const

export type PlayerPosition =
  (typeof PLAYER_POSITION)[keyof typeof PLAYER_POSITION]

/** Market-value trend: 0 = flat, 1 = up, 2 = down. */
export const MARKET_VALUE_TREND = { FLAT: 0, UP: 1, DOWN: 2 } as const

export interface SquadResponse {
  it: SquadPlayer[]
}

/**
 * `POST /v4/leagues/{leagueId}/lineup` — replaces the lineup wholesale.
 *
 * The published docs show only `{ "type": "4-4-2", "players": ["1235"] }` and
 * say nothing about the rules. These were established against the live API:
 *
 *  - **`players` must have exactly 11 entries.** Fewer →
 *    `LineupNotEnoughPlayers` (err 4020, served as HTTP 500).
 *  - **It is positional.** The array index *is* the slot that comes back as
 *    `lo`. `type` defines the layout: slot 0 keeper, then `def` defender
 *    slots, then `mid`, then `fwd`.
 *  - **`type` must be one of the ten real formations.** `"5-3-1"`, `"2-1-0"`
 *    and `""` are all rejected, so even a partial lineup has to be declared
 *    inside a legal formation that can hold it.
 *  - **`""` marks an empty slot** — a gap at index *n* leaves slot *n* empty.
 *    `null` and `"NULL"` also work; `"0"` and `"-1"` are rejected as invalid
 *    player ids.
 *  - **A player in a slot of the wrong position is silently dropped** — HTTP
 *    200, but he is not in the lineup afterwards. Grouping by position is
 *    therefore mandatory, not stylistic.
 *  - **An all-empty array is a no-op**, not a clear; use `/lineup/clear`.
 */
export interface SaveLineupRequest {
  /** Formation label, e.g. `"4-4-2"`. */
  type: string
  /** Player ids in the starting eleven. */
  players: string[]
}

export interface SquadPlayer {
  /** Player id. */
  i: string
  /** Last name. */
  n: string
  /** First name. */
  fn?: string
  /** Team id. */
  tid: string
  /** Position, see PLAYER_POSITION. */
  pos: number
  /** Market value, in €. */
  mv: number
  /** Market-value trend, see MARKET_VALUE_TREND. */
  mvt: number
  /** Market-value gain/loss since purchase, in €. */
  mvgl?: number
  /** Total points this season. */
  p: number
  /** Average points. */
  ap: number
  /** Status: 0 = fit, others = injured/suspended/away. */
  st: number
  /** Additional status list. */
  stl?: number[]
  /** Lineup order slot. */
  lo?: number
  /** Player image path, relative to the CDN root. */
  pim?: string
  /** Start probability, 1..5 (5 = very likely). */
  prob?: number
  /**
   * Lineup-probability icon, CDN-relative (`content/file/<hash>.png`).
   *
   * **Not documented on this endpoint** and probably absent: the community
   * docs list `plpim` only on player detail and on the market, and `lo` here
   * is the lineup slot, not a probability. Declared so a consumer can prefer
   * it when it *is* present and skip the per-player detail request. See
   * {@link PlayerDetailResponse}.
   */
  plpim?: string
  /** Offer count. */
  ofc?: number
  /** Is player of the match. */
  iotm?: boolean
}

export interface MarketResponse {
  it: MarketPlayer[]
}

export interface MarketPlayer {
  i: string
  n: string
  fn?: string
  tid: string
  pos: number
  /** Market value, in €. */
  mv: number
  mvt: number
  /** Asking price, in €. */
  prc: number
  /** Seconds until the listing expires. */
  exs: number
  /** Listed at, ISO 8601. */
  dt?: string
  /** Status. */
  st: number
  /** Offer count. */
  ofc?: number
  /** Is listed by a user (vs. the computer-run market). */
  isn?: boolean
  /** Seller, absent for computer listings. */
  u?: { i: string; n: string; uim?: string }
  pim?: string
  prob?: number
  /** Lineup-probability icon, CDN-relative. See {@link PlayerDetailResponse}. */
  plpim?: string
  /** Last update of the lineup-probability assessment, ISO 8601. */
  ts?: string
}

/**
 * `GET /v4/leagues/{leagueId}/players/{playerId}`. **Nothing fetches this
 * yet** — it is declared for the availability fields below, which no other
 * endpoint exposes.
 *
 * Only those fields are declared; the real response is much larger
 * (market-value history, per-matchday performance, the next fixture).
 *
 * This is where the **Startelf-Wahrscheinlichkeit** lives, and two things
 * about it shape whatever ends up consuming it:
 *
 *  - **There is no numeric probability.** The assessment arrives as one of
 *    exactly five static icons and `plpim` points at whichever one applies, so
 *    naming a tier means recognising *which* icon it is — see
 *    [docs/pages/squad.md](../../docs/pages/squad.md#lineup-probability-plpim).
 *  - **It is a Membership feature**, supplied by Ligainsider (`plpt`) rather
 *    than by Kickbase. An account without Membership, the off-season, or a
 *    player nobody has assessed yet all produce no `plpim` at all, so every
 *    consumer has to treat it as optional.
 */
export interface PlayerDetailResponse {
  /** Player id. */
  i: string
  /**
   * Last name.
   *
   * Note this endpoint spells it **`ln`**, not `n` as everywhere else. It was
   * declared as `n` while nothing fetched it, which no compiler could catch;
   * a real response has `fn`/`ln` and no `n` at all.
   */
  ln: string
  /** First name. */
  fn?: string
  /** Team id. */
  tid?: string
  /** Team name, spelled out. */
  tn?: string
  /** Owning manager's user id — absent when nobody owns the player. */
  oui?: string
  /** The matchday this response is "current" for. */
  day?: number
  /**
   * Points per matchday, oldest first.
   *
   * **Dense**: there is an entry for every matchday played so far, and a
   * player who missed one gets `{ hp: false }` with no `p` rather than being
   * skipped. That is what makes `ph[day - 1]` a valid lookup. Entries stop at
   * the current matchday, so a future one reads `undefined`.
   */
  ph?: PlayerMatchdayPoints[]
  /** Position, see PLAYER_POSITION. */
  pos?: number
  /**
   * Lineup-probability icon, CDN-relative (`content/file/<hash>.png`).
   *
   * One of five static images; the same URL repeats across every player
   * sharing a tier, which is what makes a hash → tier lookup possible.
   */
  plpim?: string
  /** Who assessed it — `"Ligainsider"` in practice. */
  plpt?: string
  /** The provider's logo, CDN-relative. */
  plpurl?: string
  /** Status: 0 = fit, others = injured / suspended / away. */
  st?: number
  /** Additional status list. */
  stl?: number[]
  /** Status text, e.g. `"Wadenprobleme – verpasst BMG (H)"`. */
  stxt?: string
  /**
   * Last update of the assessment, ISO 8601. Ligainsider revises it several
   * times before kick-off, so anything caching a tier should keep it briefly.
   */
  ts?: string
}

/** One matchday's entry in {@link PlayerDetailResponse.ph}. */
export interface PlayerMatchdayPoints {
  /** Whether the player featured. `false` means `p` is absent, not zero. */
  hp: boolean
  /** Points scored — only present when `hp` is true. */
  p?: number
}

/**
 * `GET /v4/leagues/{leagueId}/managers/{userId}/squad` — another manager's
 * players. Same rows as the signed-in user's own squad, minus the fields that
 * only make sense for your own team (offers).
 */
export interface ManagerSquadResponse {
  /** Manager's user id. */
  u: string
  /** Manager's display name. */
  unm: string
  /** Manager's avatar, CDN-relative. */
  uim?: string
  /** Manager status. */
  st?: number
  /** Number of players in the squad. */
  nps?: number
  it: ManagerSquadPlayer[]
}

export interface ManagerSquadPlayer {
  /** Player id. */
  pi: string
  /** Last name. */
  pn: string
  /** Team id. */
  tid: string
  /**
   * Lineup slot, **0-based**, or absent when the player is benched.
   *
   * Confirmed on a real opponent: 11 of 15 players carried `lo` `0…10` and the
   * remaining 4 carried none. Because `0` is a valid slot, membership must be
   * tested with `lo !== undefined` — the same trap as `SquadMember`.
   */
  lo?: number
  /** Observed as `0` on every player so far; meaning unknown. */
  lst?: number
  /** Position, see PLAYER_POSITION. */
  pos: number
  /** Status: 0 = fit, others = injured / suspended / away. */
  st: number
  /** Additional status codes. */
  stl?: number[]
  /** **Season** total points — not this matchday's. */
  p?: number
  /** Average points per matchday. */
  ap?: number
  /** Market value, in €. */
  mv: number
  mvt?: number
  pim?: string
  iotm?: boolean
}

export interface CompetitionPlayersResponse {
  it: CompetitionPlayer[]
}

export interface CompetitionPlayer {
  /** Player id. */
  pi: string
  /** Last name. */
  n: string
  /** Team id. */
  tid: string
  /** Match id of the next/current fixture. */
  mi?: string
  /** Points. */
  p: number
  /** Position, see PLAYER_POSITION. */
  pos: number
  /** Is injured / listed out. */
  il?: boolean
  /** Status. */
  st: number
  /** Minutes played. */
  mt?: number
  /** Goals. */
  g?: number
  /** Assists. */
  a?: number
  /** Penalties scored? */
  pes?: number
  /** Clean sheets. */
  cs?: number
  pim?: string
  /** Opponent team of the next fixture. */
  ot?: { i: string; tim?: string }
}

/* -------------------------------------------------------------------------- */
/* Competition                                                               */
/* -------------------------------------------------------------------------- */

export interface CompetitionTableResponse {
  it: CompetitionTableRow[]
}

export interface CompetitionTableRow {
  /** Team id. */
  tid: string
  /** Team name. */
  tn: string
  /** Team image path, relative to the CDN root. */
  tim?: string
  /** Current points. */
  cp: number
  /** Current placement. */
  cpl: number
  /** Previous placement. */
  pcpl?: number
  /** Matches played. */
  mc: number
  /** Goal difference. */
  gd: number
  /** Kickbase points scored by the team. */
  sp?: number
  il?: boolean
}

/* -------------------------------------------------------------------------- */
/* Matchdays and fixtures                                                     */
/* -------------------------------------------------------------------------- */

/** `GET /v4/competitions/{competitionId}/matchdays`. */
export interface MatchdaysResponse {
  /** The **current** matchday number. */
  day: number
  /** Every matchday of the season. */
  it: MatchdayItem[]
}

export interface MatchdayItem {
  /** Matchday number. */
  day: number
  /** Display name, e.g. `"2 Match Day"`. */
  mdln?: string
  /** Fixtures. A team appears at most once per matchday. */
  it: FixtureItem[]
}

export interface FixtureItem {
  /** Match id. */
  mi: string
  day: number
  /** Kick-off, ISO 8601. */
  dt: string
  /** **Home** team id. */
  t1: string
  /** **Away** team id. */
  t2: string
  /** Home team short symbol, e.g. `"FCB"`. */
  t1sy?: string
  /** Away team short symbol. */
  t2sy?: string
  /** Home team crest, CDN-relative (an SVG). */
  t1im?: string
  /** Away team crest, CDN-relative. */
  t2im?: string
  /** Home goals — present once played. */
  t1g?: number
  /** Away goals. */
  t2g?: number
  /** Match status: 0 = upcoming, 2 = finished (others unconfirmed). */
  st?: number
  il?: boolean
}

/* -------------------------------------------------------------------------- */
/* User                                                                      */
/* -------------------------------------------------------------------------- */

export interface UserSettingsResponse {
  u: {
    /** User id. */
    i: string
    /** Email. */
    em: string
    /** Username. */
    unm: string
    /** Avatar path, relative to the CDN root. */
    uim?: string
  }
}
