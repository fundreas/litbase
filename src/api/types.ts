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
  /** Users, already ordered by placement. */
  us: RankingUser[]
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
  /** Current matchday points. */
  mdp: number
  /** Current matchday placement. */
  mdpl: number
  /** Team value, in €. */
  tv: number
  /** Points per matchday, oldest first. `null` = did not play. */
  lp?: Array<number | null>
  /** Is admin. */
  adm?: boolean
  /** Placement change vs. previous matchday. */
  ppc?: number
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
