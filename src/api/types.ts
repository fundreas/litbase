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
  /**
   * Change over the **last 24 hours**, in €, signed — see
   * {@link PlayerDetailResponse.tfhmvt}, the same measure on the player
   * endpoint.
   *
   * Not in the published docs for this endpoint, so it is optional and the
   * squad row degrades to `–` if it ever stops arriving.
   */
  tfhmvt?: number
  /** The same measure over **seven days**, in €, signed. Unused. */
  sdmvt?: number
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
  /**
   * Lineup probability, **1..5, lower means more likely** — see
   * {@link PlayerDetailResponse.prob} for the tier meanings.
   *
   * Not documented on this endpoint. Declared so a consumer can prefer it and
   * skip the per-player detail request when it *is* present.
   */
  prob?: number
  /**
   * The player's team's probable-lineup poster, CDN-relative.
   *
   * **Not a per-player value** — see {@link PlayerDetailResponse.plpim}. Use
   * {@link prob} for anything per-player.
   */
  plpim?: string
  /** Offer count. */
  ofc?: number
  /** Is player of the match. */
  iotm?: boolean
}

export interface MarketResponse {
  it: MarketPlayer[]
  /** Players in the signed-in manager's squad. */
  nps?: number
  /** The manager's team value, in €. */
  tv?: number
  /** When market values are next recalculated, ISO 8601 — nightly, 20:00 UTC. */
  mvud?: string
  /** The next matchday's deadline, ISO 8601. */
  dt?: string
  /** Current matchday. */
  day?: number
  /** Season, e.g. `"26/27"`. */
  sn?: string
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
  /**
   * Seconds until the listing expires — a real countdown, decrementing one per
   * second between polls.
   *
   * **Only computer listings carry it.** A listing put up by a manager ({@link
   * u} present) has no `exs` at all: it stands until the seller withdraws it
   * or accepts an offer.
   */
  exs?: number
  /** Listed at, ISO 8601. */
  dt?: string
  /** Status. */
  st: number
  /**
   * Offers standing on the listing — but **only the ones this account may
   * see**, which on a computer listing means its own and nothing else. A
   * listing showing `0` up to expiry was then bought by another manager over
   * the asking price, so `0` means "you have not bid", not "nobody has".
   */
  ofc?: number
  /**
   * **New to the market today**, i.e. `dt` after the most recent 00:00 UTC.
   * Not "listed by a user" — the marker for that is {@link u}.
   */
  isn?: boolean
  /** Seller. Absent for computer listings, which is what identifies them. */
  u?: { i: string; n: string; uim?: string; isvf?: boolean; vft?: number }
  /** This account's own offer, in € — present only while one stands. */
  uop?: number
  /** Id of this account's own offer, needed to withdraw it. Equals the uid. */
  uoid?: string
  /** The offers this account may see. Same visibility rule as {@link ofc}. */
  ofs?: MarketOffer[]
  /** Season points and average. Absent for a player yet to appear. */
  p?: number
  ap?: number
  /** Position locked. `false` on every listing observed. */
  iposl?: boolean
  pim?: string
  prob?: number
  /** Lineup-probability icon, CDN-relative. See {@link PlayerDetailResponse}. */
  plpim?: string
  /** Last update of the lineup-probability assessment, ISO 8601. */
  ts?: string
}

export interface MarketOffer {
  /** Bidding manager's user id. */
  u: string
  /** Bidding manager's display name. */
  unm: string
  /** Offer id — for one's own offer this is the user id again. */
  uoid: string
  /** Offer price, in €. */
  uop: number
  /** Offer status. `0` on every offer observed. */
  st: number
}

/**
 * `POST /v4/leagues/{leagueId}/market/{playerId}/offers`.
 *
 * Spelled out, unlike almost everything else on the wire — the abbreviated
 * `{ prc }` is rejected with 400 `InvalidData`. Listing a player takes the
 * opposite convention; see {@link endpoints.leagues.market}.
 */
export interface PlaceOfferRequest {
  /** Offer price, in €. */
  price: number
}

export interface PlaceOfferResponse {
  /** The new offer's id. For one's own offer this is the user id. */
  ofi?: string
}

/**
 * Availability, as `st` on any player payload and as the entries of `stl`.
 *
 * Probed live across all 18 Bundesliga squads (467 players) and confirmed
 * against the German `stxt` each one carries:
 *
 * | `st` | `stxt` seen on it |
 * | ---- | ----------------- |
 * | 0 | *(none — fit)* |
 * | 1 | "Schulterverletzung – fällt 2-3 Wochen aus" |
 * | 2 | "Nach muskulären Problemen – verpasst M05 (H)" |
 * | 4 | "Nach Fußverletzung – absolviert erste Laufeinheit" |
 * | 8 | *(none)* — the two players carrying it had both been sent off in
 *       their club's last fixture (`k` contained a red card), so it is a
 *       **suspension** |
 *
 * `stl` is the same information as a list, and every player observed had at
 * most one entry in it. Codes above 8 exist in the wire format but none has
 * been seen, so anything unrecognised falls back to `stxt`, which the API
 * always supplies for a player who is not fit.
 */
export const PLAYER_AVAILABILITY = {
  FIT: 0,
  INJURED: 1,
  /** Knock — training individually, likely to miss the next match. */
  DOUBTFUL: 2,
  /** Working back to fitness after an injury. */
  BUILDING_UP: 4,
  /** Inferred from a red card in the preceding fixture; carries no `stxt`. */
  SUSPENDED: 8,
} as const

/**
 * `GET /v4/leagues/{leagueId}/players/{playerId}` — one player, in full.
 *
 * Everything the [player detail page](../../docs/pages/player-detail.md)
 * renders on its first tab. The competition-scoped
 * `/v4/competitions/{id}/players/{id}` returns the same body **minus `oui`**,
 * so the league-scoped spelling is the one to use whenever ownership matters.
 *
 * **Zeroed counters are omitted, not sent as `0`.** A player who has not
 * featured this season carries no `tp`, `ap`, `sec`, `g`, `a`, `y`, `r` or
 * `cs` at all, while one who has played carries all of them, `0` included.
 * Every counter below is therefore optional and every consumer defaults it.
 *
 * This is also where the **Startelf-Wahrscheinlichkeit** lives, as two separate
 * fields that are easy to confuse:
 *
 *  - **{@link prob} is the per-player tier**, an integer 1..5. This block used
 *    to claim there was no numeric probability and that `plpim` pointed at one
 *    of five static icons. Both halves were wrong — see the two fields below.
 *  - **{@link plpim} is the whole team's projected XI as one poster**, the same
 *    image for all 25 players at a club.
 *  - **It is a Membership feature**, supplied by Ligainsider (`plpt`) rather
 *    than by Kickbase. An account without Membership, the off-season, or a
 *    player nobody has assessed yet all produce neither field, so every
 *    consumer has to treat both as optional.
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
  /** Squad number. */
  shn?: number
  /** Team id. */
  tid?: string
  /** Team name, spelled out. */
  tn?: string
  /** Team crest, CDN-relative (an SVG). */
  tim?: string
  /** Player photo, CDN-relative. */
  pim?: string
  /**
   * Owning manager's user id. **`"0"` when nobody owns the player** — it is
   * not omitted, so an emptiness test has to check the string, not presence.
   */
  oui?: string
  /** The matchday this response is "current" for. */
  day?: number

  /* --- Season totals. Omitted entirely when the player has not featured. --- */

  /** Total points this season. */
  tp?: number
  /** Average points per appearance. */
  ap?: number
  /** **Seconds** played this season — not minutes. */
  sec?: number
  /** Goals. */
  g?: number
  /** Assists. */
  a?: number
  /** Yellow cards. */
  y?: number
  /** Red cards — straight reds and second yellows together. */
  r?: number
  /** Clean sheets. */
  cs?: number
  /**
   * Penalties, but **which side of one is unresolved**: it sits beside `cs`
   * in the goalkeeper group, which argues for "saved", while the name argues
   * for "scored". Every player probed had `0` (the season was one matchday
   * old), so nothing could separate the two. Deliberately not rendered — the
   * per-match event for a saved penalty (`MATCH_EVENT.PENALTY_SAVED`) covers
   * the case that is confirmed.
   */
  pes?: number

  /* --- Market value ------------------------------------------------------ */

  /** Market value, in €. */
  mv?: number
  /** Market-value trend, see MARKET_VALUE_TREND. */
  mvt?: number
  /**
   * Change over the **last 24 hours**, in €, signed.
   *
   * Named for "twenty-four-hour market-value trend", and the reading is
   * confirmed arithmetically: it is the difference between the last two daily
   * points of `/marketvalue/365`. Its sibling `sdmvt` on the squad payload is
   * the same measure over seven days.
   */
  tfhmvt?: number
  /**
   * A rounded market value — `59.800.000` against an `mv` of `59.866.450`.
   * What Kickbase rounds it *for* is unknown, and it is never the figure to
   * show; `mv` is. Declared only so it is not mistaken for something else.
   */
  cv?: number

  /**
   * The club's fixtures either side of the current matchday — three in
   * practice: the one just played and the next two. Ordered by matchday.
   */
  mdsum?: PlayerFixtureSummary[]
  /**
   * Points per matchday, **newest first** — `ph[0]` is {@link day}, the
   * matchday this response is current for.
   *
   * **Dense**: one entry per matchday from the first up to {@link day}, so the
   * array is `day` long. A player who missed a matchday gets `{ hp: false }`
   * with no `p` rather than being skipped, and so does one whose club has not
   * kicked off yet — an entry exists for the current matchday from the moment
   * it becomes current.
   *
   * The order was documented as oldest-first until 2026-09-05 and is not: see
   * [`matchdayEntry`](./hooks/useMatchdayPoints.ts) for the measurement and for
   * the index that follows from it.
   */
  ph?: PlayerMatchdayPoints[]
  /** Position, see PLAYER_POSITION. */
  pos?: number
  /**
   * **The player's team's probable-lineup poster**, CDN-relative
   * (`content/file/<hash>.png`).
   *
   * Not a per-player icon, despite the name and despite what the community
   * docs suggest. Probed live 2026-09-03: it is a 1280×1809 Ligainsider
   * graphic of the whole projected XI, **identical for every player on the
   * same team** — `GET /v4/base/predictions/teams/{competitionId}` serves the
   * very same hashes keyed by `tid`. Rendering it per player shows the same
   * picture 25 times. Use {@link prob} instead.
   */
  plpim?: string
  /**
   * Lineup probability as a **per-player tier, 1..5. Lower is more likely.**
   *
   * Undocumented, and the one field that actually varies per player. Verified
   * against the badges drawn inside the {@link plpim} poster:
   *
   * | `prob` | Poster badge | Meaning |
   * | ------ | ------------ | ------- |
   * | 1 | blue star | Sicher dabei |
   * | 2 | green check | Wahrscheinlich |
   * | 3 | orange ? | Fraglich |
   * | 4 | red ! | Unrealistisch |
   * | 5 | black ✕ | Ausgeschlossen |
   *
   * Absent for an account without Membership, in the off-season, and for a
   * player nobody has assessed — all indistinguishable on the wire, and all
   * the normal case rather than an error.
   */
  prob?: number
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

/** One fixture in {@link PlayerDetailResponse.mdsum}. */
export interface PlayerFixtureSummary {
  /** Matchday number. */
  day: number
  /** Kick-off, ISO 8601. */
  md: string
  /** **Home** team id. */
  t1: string
  /** **Away** team id. */
  t2: string
  /** Home goals. `0` before kick-off, so `mdst` is what says whether it counts. */
  t1g?: number
  /** Away goals. */
  t2g?: number
  /** Home crest, CDN-relative. */
  t1im?: string
  /** Away crest, CDN-relative. */
  t2im?: string
  /** Matchday status: 0 = not played, 2 = finished. Same scale as `st` on a fixture. */
  mdst?: number
  /** True on the competition's current matchday. */
  cur?: boolean
  /** Display name, e.g. `"2 Match Day"`. */
  mdln?: string
}

/* --- Per-match performance ------------------------------------------------ */

/**
 * What happened to a player in one match, as the entries of
 * {@link PlayerPerformanceMatch.k}.
 *
 * **Decoded by correlation, not from documentation.** Season counters on
 * `/players/{id}` (`g`, `a`, `y`, `r`, `cs`) were compared against the number
 * of times each code appears across the same season for 60 players; the four
 * marked *exact* matched on every single player with no exceptions. The
 * others were pinned individually:
 *
 * | Code | How it was established |
 * | ---- | ---------------------- |
 * | 1 `GOAL` | exact match with `g` |
 * | 2 `OWN_GOAL` | **inferred** — 8 occurrences, all defenders; no counter exposes own goals, so nothing could confirm it |
 * | 3 `ASSIST` | exact match with `a` |
 * | 4 `YELLOW_CARD` | exact match with `y` |
 * | 5 `SECOND_YELLOW` | never appears without a `4` beside it |
 * | 6 `RED_CARD` | heavily negative points, player off early, and both players carrying `PLAYER_AVAILABILITY.SUSPENDED` had one in their last match |
 * | 7 `PENALTY_SAVED` | only ever on goalkeepers |
 * | 8 `SUBSTITUTED_IN` | present on all 266 matches with `st: 3` and on no other; median 29 minutes played against 72 without it |
 * | 9 `SUBSTITUTED_OFF` | only ever alongside `8` or a start, never on a non-appearance |
 * | 25 `CLEAN_SHEET` | exact match with `cs` |
 */
/**
 * Event codes, as `k` on {@link PlayerPerformanceMatch} — **and as `ke` on a
 * match's live `events` feed**, which turned out to use the identical scale
 * (verified on a finished 5:1: five `1`s and one `2`, four `4`s, ten `8`s).
 * One decode serves the player page and the live rows.
 */
export const MATCH_EVENT = {
  GOAL: 1,
  /** Inferred — see the table above. */
  OWN_GOAL: 2,
  ASSIST: 3,
  YELLOW_CARD: 4,
  /** Always accompanied by a {@link MATCH_EVENT.YELLOW_CARD} in the same match. */
  SECOND_YELLOW: 5,
  RED_CARD: 6,
  PENALTY_SAVED: 7,
  SUBSTITUTED_IN: 8,
  SUBSTITUTED_OFF: 9,
  CLEAN_SHEET: 25,
} as const

/**
 * A player's involvement in one match, as `st` on
 * {@link PlayerPerformanceMatch}.
 *
 * **A different scale to {@link PLAYER_AVAILABILITY}**, despite the shared
 * key name. Established from the payload's own internal agreement:
 *
 *  - `0` carries no `mp` and no `p` at all — the fixture is in the future.
 *  - `5` is a start: `MATCH_EVENT.SUBSTITUTED_IN` never appears on it, and
 *    it is the only value whose minutes routinely reach 90+.
 *  - `3` is an appearance off the bench: all 266 observed carry
 *    `SUBSTITUTED_IN`, and the median is 29 minutes.
 *  - `1` and `4` both mean **did not play** — `0'` and no points. They are
 *    separated by availability at the time: every currently-injured player
 *    probed (an ACL tear, a shoulder injury) carries `1` for the matchday
 *    they missed, while players who were merely rested, doubtful or left out
 *    carry `4`. So `1` is "out injured" and `4` is everything else.
 *
 * The one thing `4` deliberately does *not* claim is a place on the bench.
 * Counting a full squad's statuses per matchday put `3 + 4` at up to eleven
 * players on a matchday, which is more than a bench holds — so `4` covers the
 * unused substitute and the player left out of the squad alike, and the two
 * are not distinguishable here.
 */
export const PLAYER_MATCH_STATUS = {
  /** Fixture has not been played. */
  UPCOMING: 0,
  /** Missed the match through injury. */
  INJURED: 1,
  /** Came on as a substitute. */
  SUBSTITUTE: 3,
  /** Did not play — bench or not in the squad; the two are indistinguishable. */
  DID_NOT_PLAY: 4,
  /** Started. */
  STARTED: 5,
} as const

/** `GET /v4/leagues/{leagueId}/players/{playerId}/performance`. */
export interface PlayerPerformanceResponse {
  /** Seasons, **oldest first**, one per competition season played. */
  it: PlayerPerformanceSeason[]
}

export interface PlayerPerformanceSeason {
  /** Season id, e.g. `"42"`. Unique, and what a picker should key on. */
  sid: string
  /** Season label, e.g. `"2026/2027"`. */
  ti: string
  /** Competition name, e.g. `"Bundesliga"`. */
  n: string
  /**
   * Every fixture of the player's club that season, ascending by matchday —
   * including the ones they took no part in.
   *
   * The club is **the club they were at that season**, so a player who moved
   * has another Bundesliga side's fixtures in the earlier entries. `pt` names
   * which of `t1`/`t2` they were on, but only for matches they played.
   */
  ph: PlayerPerformanceMatch[]
}

export interface PlayerPerformanceMatch {
  /** Match id. */
  mi: string
  /** Matchday number. */
  day: number
  /** Kick-off, ISO 8601. */
  md: string
  /** **Home** team id. */
  t1: string
  /** **Away** team id. */
  t2: string
  /** Home goals — absent until the match is played. */
  t1g?: number
  /** Away goals. */
  t2g?: number
  /** Home crest, CDN-relative. */
  t1im?: string
  /** Away crest, CDN-relative. */
  t2im?: string
  /**
   * The player's own team id for this match — `t1` or `t2`.
   *
   * **Only present when they played.** For a match they sat out, which side
   * they were on has to be inferred from the season's other entries.
   */
  pt?: string
  /**
   * Points scored. Absent — not `0` — for any match the player did not
   * appear in, which is what separates "played and scored nothing" from
   * "did not play".
   */
  p?: number
  /**
   * Minutes played, as a string with a trailing apostrophe: `"96'"`. Reaches
   * past 90 because stoppage time counts. `"0'"` for a non-appearance, and
   * absent entirely for a fixture still to come.
   */
  mp?: string
  /** Events, see {@link MATCH_EVENT}. Repeats — two assists arrive as `[3, 3]`. */
  k?: number[]
  /** The player's involvement, see {@link PLAYER_MATCH_STATUS}. */
  st?: number
  /** Matchday status: 0 = not played, 2 = finished. */
  mdst?: number
  /** True on the competition's current matchday. */
  cur?: boolean
  /** Season points **to date**, i.e. after this match. */
  tp?: number
  /** Season average **to date**. */
  ap?: number
  /** Season seconds played **to date**. */
  asp?: number
  /** Short matchday label, e.g. `"#1"` for the current one. */
  mdsn?: string
}

/* --- Market value --------------------------------------------------------- */

/**
 * `GET /v4/leagues/{leagueId}/players/{playerId}/marketvalue/365`.
 *
 * One entry per day for the last year, plus what the current owner paid.
 */
export interface PlayerMarketValueResponse {
  /** Daily values, oldest first, no gaps. Empty for any window but 365. */
  it: MarketValuePoint[]
  /**
   * What the **current owner** paid, in €. `0` when nobody owns the player.
   *
   * Confirmed against two real purchases in a live league: a player bought
   * for 80.000.000 € reports exactly that, and `mv - trp` reproduces `prlo`
   * here and `mvgl` on the squad row to the euro.
   *
   * For a player *handed out* at league start (see {@link idp}) it is not a
   * price anybody paid — Kickbase books the basis at the market value of the
   * day instead, and `prlo` stays `0`. The UI has to say "Startkader" rather
   * than quote it as a purchase.
   */
  trp: number
  /** Profit or loss for the owner, in €. Exactly `mv - trp`. */
  prlo: number
  /**
   * Lowest value in the returned window, in €.
   *
   * **Can be `0`, and often is**: days before the player entered the
   * competition are still returned, carrying `mv: 0`, and this is the plain
   * minimum over all of them. A meaningful low has to ignore those — see
   * `marketValueExtremes` in `models.ts`.
   */
  lmv: number
  /** Highest value in the returned window, in €. */
  hmv: number
  /** True when the signed-in user is the owner. Absent when nobody owns them. */
  iso?: boolean
  /**
   * "Is default player" — handed out when a manager joined rather than
   * bought. Inferred, and it lines up on every player checked: it is true for
   * exactly those whose transfer history is a single `TRANSFER_TYPE.GRANTED`
   * entry, and false for both real purchases and unowned players.
   */
  idp?: boolean
}

export interface MarketValuePoint {
  /**
   * **Days since the Unix epoch**, not a timestamp — `20698` is 2026-09-02.
   * Whole days in UTC, so a plain `dt * 86_400_000` reconstructs the date.
   */
  dt: number
  /** Market value that day, in €. `0` before the player entered the league. */
  mv: number
}

/* --- Transfer history ----------------------------------------------------- */

/**
 * What kind of ownership event a {@link PlayerTransferItem} describes.
 *
 * Only these three have been observed. `1` and anything above `3` presumably
 * exist — a sale back to the market is the obvious gap — so unknown values
 * are rendered as a neutral "Wechsel" rather than guessed at.
 */
export const TRANSFER_TYPE = {
  /** Handed to a manager without a fee — the squad dealt at league start. */
  GRANTED: 0,
  /** Bought. The only type observed with a non-zero `trp`. */
  BOUGHT: 2,
  /** Released back to the market; carries no `u`, because nobody received them. */
  RELEASED: 3,
} as const

/** `GET /v4/leagues/{leagueId}/players/{playerId}/transferHistory`. */
export interface PlayerTransferHistoryResponse {
  /** Ownership events, **oldest first**. Empty for an unowned player. */
  it: PlayerTransferItem[]
}

export interface PlayerTransferItem {
  /** Manager's user id. Absent on a `TRANSFER_TYPE.RELEASED` entry. */
  u?: string
  /** Manager's display name. */
  unm?: string
  /** Manager's avatar, CDN-relative. */
  uim?: string
  /** When it happened, ISO 8601. */
  dt: string
  /** Fee paid, in €. `0` for anything but a `TRANSFER_TYPE.BOUGHT` entry. */
  trp: number
  /** See {@link TRANSFER_TYPE}. */
  t: number
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
/* One match, live                                                            */
/* -------------------------------------------------------------------------- */

/**
 * `GET /v4/matches/{matchId}/details` — the live state of one match.
 *
 * Verified against a finished Bundesliga fixture. **There is no `mi`**: the
 * response does not name the match it describes, so a caller fanning out over
 * a matchday has to remember which request each answer belongs to.
 */
export interface MatchDetailsResponse {
  /** Home team id. */
  t1: string
  /** Away team id. */
  t2: string
  /** Home team name, and its short symbol. */
  t1n?: string
  t1sy?: string
  t2n?: string
  t2sy?: string
  /** Goals. Present from kick-off, `0` before either side scores. */
  t1g?: number
  t2g?: number
  /** Crests, CDN-relative. */
  t1im?: string
  t2im?: string
  /**
   * The **minute**, as the API counts it — observed `95` on a finished match
   * whose `mtd` read `"90"`, so this runs past 90 with stoppage time.
   */
  mt: number
  /** Kick-off, ISO 8601. */
  md?: string
  /** Match status. `2` is played to the end, as `st` is elsewhere. */
  mst?: number
  /** Minute as a display string, e.g. `"90"`. */
  mtd?: string
  /**
   * The lineups are **official** rather than predicted.
   *
   * `false` on a match played weeks ago, so it is not "the lineup is known"
   * so much as a flag the app sets around kick-off — treat with care.
   */
  il?: boolean
  /** Home starting eleven, and the rest of the squad. */
  t1lp?: MatchLineupPlayer[]
  t1nlp?: MatchLineupPlayer[]
  t2lp?: MatchLineupPlayer[]
  t2nlp?: MatchLineupPlayer[]
  /** Formation strings, e.g. `"4-2-3-1"`. */
  ts1?: string
  ts2?: string
  /** Everything that happened, newest first. */
  events?: MatchEventItem[]
}

/** One player in a match's real-world lineup. Carries **no points**. */
export interface MatchLineupPlayer {
  /** Player id — a **number** here, unlike everywhere else. */
  i: number
  /** Last name. */
  n: string
  /** Position code, see {@link PLAYER_POSITION}. */
  pos?: number
  /** Portrait, CDN-relative. */
  pim?: string
}

/** One thing that happened in a match. */
export interface MatchEventItem {
  /** Player id, or `"0"` for a match-level event (kick-off, half-time, …). */
  pi?: string
  /** Player name. Absent on match-level events. */
  pn?: string
  /** Team id. */
  tid?: string
  /**
   * Event kind, on the **same scale as `k`** on the player-performance
   * endpoint — see {@link MATCH_EVENT}. Verified on a 5:1: five `1`s and one
   * `2`, four `4`s, ten `8`s.
   */
  ke: number
  /** Minute it happened. */
  mt: number
  /**
   * A related event, e.g. the assist folded into a goal.
   *
   * **Its `pi` is `"0"` even though `pn` names somebody**, so the related
   * player cannot be identified by id. Unused for that reason.
   */
  rev?: MatchEventItem
  /** Portrait, CDN-relative. */
  pim?: string
}

/** `GET /v4/live/eventtypes` — names for every scoring event. */
export interface LiveEventTypesResponse {
  /** Last updated, ISO 8601. */
  lcud?: string
  it: Array<{ i: number; ti: string }>
}

/* -------------------------------------------------------------------------- */
/* Team center — one manager's squad on one matchday                          */
/* -------------------------------------------------------------------------- */

/**
 * `GET /v4/leagues/{leagueId}/users/{userId}/teamcenter?dayNumber={n}` — the
 * **matchday snapshot**: a manager's squad and lineup as they stood then.
 *
 * The only historical source in the API, and the only way to see *any*
 * manager's lineup for a matchday other than the current one. See
 * {@link endpoints.leagues.managerTeamcenter} for the spelling trap that hid
 * it, and [duel detail](../../docs/pages/duel-detail.md#the-squad-it-shows-is-the-matchdays)
 * for what it fixes.
 *
 * **`dayNumber` is required.** Omitted, out of range (`0`, `99`), or naming a
 * matchday from before the league existed, it answers 200 with both player
 * lists empty rather than erroring — so "empty" has to be read as "nothing to
 * show", never as "no players".
 */
export interface TeamcenterResponse {
  /** The requested manager's display name. */
  n?: string
  /** Fielded players — the eleven that was in the lineup that matchday. */
  lp?: TeamcenterPlayer[]
  /** Everyone else in the squad that matchday. */
  nlp?: TeamcenterPlayer[]
  /**
   * Every manager in the league, each with the players they have fielded.
   *
   * **It ignores `dayNumber`.** It looks like the one bulk source of historical
   * ownership in the API and it is not: whatever matchday is asked for, the
   * lineups come back as they stand **today**. It was used for the
   * [match lineup](../../docs/pages/match-detail.md#it-is-the-matchdays-lineup-not-todays-squad)'s
   * ownership badges for exactly one round, and a past matchday duly showed the
   * current elevens.
   *
   * Only the addressed manager's own {@link lp}/{@link nlp} honour the
   * parameter, which is why `useMatchdayLineups` fans out one request per
   * manager instead of reading this. **Unused.**
   *
   * Fielded players only either way: there is no `nlp` per manager here.
   */
  us?: TeamcenterUser[]
  /** Count of the current lineup, observed as `11`. */
  clpc?: number
  /** Meaning unknown; observed as `0`. */
  ppc?: number
}

/** One league member as the team center lists them. */
export interface TeamcenterUser {
  /** User id. */
  i: string
  /** Display name. */
  unm: string
  /** Meaning unconfirmed; observed as `true` for every member. */
  pa?: boolean
  /** That manager's fielded players. Observed empty before kick-off. */
  lp?: TeamcenterPlayer[]
  /** Player images for {@link lp}. Observed empty before kick-off. */
  lpi?: string[]
}

/**
 * One player in a team-center list.
 *
 * Verified on a real response for an upcoming matchday: `i`, `n`, `tid`, `st`,
 * `mi`, `md`, `mst`, `pim`. Everything below beyond those is marked optional
 * because a **played** matchday has not been mapped field-by-field yet — the
 * account available for probing had no played matchday in its league. That is
 * also why the app does not read points from here: `ph` on the player endpoint
 * is the proven source, and `p` below is a candidate to switch to once seen.
 */
export interface TeamcenterPlayer {
  /** Player id. */
  i: string
  /** Last name. */
  n: string
  /** Team id. */
  tid: string | number
  /** Availability (`0` fit), as elsewhere. */
  st?: number
  /**
   * Position code, as {@link PLAYER_POSITION}.
   *
   * Present on `teamcenter/myeleven`'s `lp` entries, **absent** from the
   * day-scoped variant's `nlp` entries. Treated as optional and back-filled
   * from the squad the caller already holds — see `useMatchdaySquad`.
   */
  pos?: number
  /** The player's club fixture that matchday. */
  mi?: string | number
  /** Kick-off of that fixture, ISO 8601. */
  md?: string
  /** Per-player match status. Observed `0` before kick-off; scale unconfirmed. */
  mst?: number
  /** Portrait, CDN-relative. */
  pim?: string
  /** Points that matchday — **unconfirmed**, see the note above. */
  p?: number
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
