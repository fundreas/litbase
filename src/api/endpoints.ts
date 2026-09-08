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
     * **Any** manager's whole history in the league — one entry per season,
     * each with its final placement, total and matchday wins, and every
     * matchday nested inside with its points. The only endpoint that reaches
     * past the current season, and the only per-manager source of
     * **points per matchday**: the standings' `lp` is the lineup.
     *
     * Probed 2026-09-08: the running season lists every matchday to day 34,
     * with `mdp` absent on the unplayed ones and `pl: 0` for every manager.
     */
    managerPerformance: (leagueId: string, userId: string) =>
      `/v4/leagues/${leagueId}/managers/${userId}/performance`,
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
     * answers 500 `NotFound`, and so does a player somebody else owns.
     *
     * **A second `POST` re-prices the standing listing** rather than being
     * refused, which is why the price dialog has no separate "change price"
     * call. Answers `{}` either way.
     *
     * `prc` is bounded only by the wire: `0 … 2_147_483_647` are all taken,
     * and anything negative or past that answers 500 `InvalidMarketValue`
     * (`err: 5020`). **The bid rules do not apply here** — the 90 % floor and
     * the 33 % ceiling govern what may be *offered*, not what may be *asked*.
     *
     * The rest of the surface was read off the `Allow` header an `OPTIONS`
     * request returns: a wrong verb answers 405 and names the right one. See
     * [docs/pages/market.md](../../docs/pages/market.md).
     */
    market: (leagueId: string) => `/v4/leagues/${leagueId}/market`,
    /**
     * One listing. `DELETE` only — withdraws your own, and **is idempotent**:
     * a second one answers `200 {}` again rather than 404. Probed 2026-09-08.
     */
    marketListing: (leagueId: string, playerId: string) =>
      `/v4/leagues/${leagueId}/market/${playerId}`,
    /**
     * **Sell one of your players to Kickbase outright**, at his market value —
     * the "Sofort verkaufen" the [squad](../../docs/pages/squad.md#selling)
     * calculator fires.
     *
     * `POST`, and `POST` only: an `OPTIONS` here answers `405` with
     * `allow: POST`, which is how the verb was established. The two public v4
     * collections disagree about this path — one documents a `DELETE` named
     * *Accept Kickbase Offer*, the other a `POST` that *lists* the player —
     * and neither matches what the server allows.
     *
     * **The request body is not known and is sent empty.** Selling cannot be
     * undone, so it was never fired against a player the account owns. What
     * *was* established: with no body and with `{}`, a player the account does
     * not own answers `500 NotFound` — the ownership check, not a validation
     * error — so an empty body at least reaches it. Anything more precise
     * costs a real player.
     */
    marketSell: (leagueId: string, playerId: string) =>
      `/v4/leagues/${leagueId}/market/${playerId}/sell`,
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
     * **Accept a bid on your own listing** — the sale goes through at the
     * offered price and the player changes hands.
     *
     * `POST`, and only `POST`: `OPTIONS` answers `405 allow: POST`, as does
     * `GET`. A `/decline` sibling exists on exactly the same terms and is not
     * used — declining is the same outcome as leaving the offer standing until
     * the listing is withdrawn.
     *
     * **Never fired against a real offer** (**?**): producing one costs a
     * second account bidding on this one, and accepting cannot be undone. An
     * offer id that does not exist answers 500 `NotFound`, which is the
     * ownership/existence check — the same wall {@link marketSell} stops at,
     * and the reason the dialog behind this is a two-second hold.
     */
    marketOfferAccept: (leagueId: string, playerId: string, offerId: string) =>
      `/v4/leagues/${leagueId}/market/${playerId}/offers/${offerId}/accept`,
    /**
     * One player, in the context of a league.
     *
     * Carries two things nothing else does:
     *
     *  - **`ph`, points per matchday.** Dense but **newest first**: `ph[0]` is
     *    the payload's own `day`, and the index counts back from there — see
     *    [`matchdayEntry`](./hooks/useMatchdayPoints.ts). It is the source of a
     *    **settled** per-matchday score and carries nothing at all while a
     *    match is being played — `{hp: false}`, no `p`, for a player on the
     *    pitch — which is what {@link playerCenter} is for.
     *  - **`prob`, the lineup-probability tier** (1..5, lower is likelier),
     *    plus `stxt` for the reason behind an injury. Rendered on both squad
     *    tabs. Note `plpim` alongside it is the *team's* poster, not a
     *    per-player icon — see
     *    [docs/pages/squad.md](../../docs/pages/squad.md#lineup-probability-prob).
     */
    player: (leagueId: string, playerId: string) =>
      `/v4/leagues/${leagueId}/players/${playerId}`,
    /**
     * One player in **one matchday's match** — and the only source of a score
     * **while that match is being played**.
     *
     * `?dayNumber=` selects the matchday and the response describes that one
     * fixture: `mi` names it, `mst` says where it stands, `st` is the player's
     * involvement, and `p` is his points **as they stand right now**. `events`
     * breaks that figure down per scoring action (`eti` on the
     * `/v4/live/eventtypes` scale, with the points each was worth).
     *
     * Probed live 2026-09-05, matchday 2, during the 15:30 block:
     *
     *  - Quansah, on the pitch: `p` climbed 23 → 105 → 110 across three reads
     *    minutes apart, while his `ph[0]` for the same matchday stayed
     *    `{hp: false}` with no `p` at all.
     *  - Reachable for **any** player, owned or not — the scorer of the match
     *    (nobody's player in this league) answered `p: 180`.
     *  - `?dayNumber=1`, a settled matchday: `p: 50`, agreeing exactly with
     *    that matchday's entry in `ph`.
     *
     * **It is a running tally, not the settled score.** A player whose match had
     * already finished read `-8` here and `-14` in `ph`, `tp` and
     * `/performance` — so this is the right source *during* a match and the
     * wrong one after it. The precedence that follows from that lives in
     * [`useMatchdayPoints`](./hooks/useMatchdayPoints.ts).
     *
     * `p` is **absent, not `0`**, for a player who has not accrued anything —
     * including one sitting on his club's bench in a match that is under way.
     */
    playerCenter: (leagueId: string, playerId: string) =>
      `/v4/leagues/${leagueId}/playercenter/${playerId}`,
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
     * Each entry is one ownership event, not a purchase: `t` says which (see
     * `TRANSFER_TYPE`), and a **sale back to Kickbase carries the full price
     * with no `u`** — the type alone does not give the direction.
     *
     * A player handed out when a manager joined has `trp: 0`, which is why the
     * *current owner's* purchase price comes from the market-value response's
     * `trp` instead — see {@link PlayerMarketValueResponse.trp}. This is the
     * only source for every deal before that one.
     *
     * The spec's `start` is a page index rather than an offset — `start=1` is
     * already empty for a three-entry history — so the app omits it and takes
     * the whole chain.
     */
    playerTransfers: (leagueId: string, playerId: string) =>
      `/v4/leagues/${leagueId}/players/${playerId}/transferHistory`,
    /**
     * **The player's market state, including the viewer's own bid on him** —
     * note the spelling, `transfers` and not {@link playerTransfers}'s
     * `transferHistory`. Different endpoint, different answer.
     *
     * The only place a bid can be read back per player: `uop` is what the
     * viewer offered, `uoid` the offer id, and `ofs[]` the offers this account
     * may see (`{ u, uoid, uop, st }`). Established 2026-09-07 by placing an
     * offer on the test account and withdrawing it again — with no bid it
     * answers `ofs: []` and no `uop` at all, and with one both appear.
     *
     * **Whether a *losing* bid survives the sale is unverified** (**?**): every
     * completed transfer probed answered `ofs: []`, but the account had bid on
     * none of them, and a bid that loses takes a listing's full run to
     * produce. So the [activity feed](../../docs/pages/events.md#aktivitäten)
     * asks and renders the answer when there is one.
     */
    playerOffers: (leagueId: string, playerId: string) =>
      `/v4/leagues/${leagueId}/players/${playerId}/transfers`,
    /**
     * **One club, and every player it has** — market values, lineup
     * probabilities, and who in this league owns each of them.
     *
     * The only bulk source of a club's squad, found 2026-09-05 after the club
     * page's Kader rendered empty for seventeen clubs out of eighteen. What it
     * replaced was a fan-out of one request per player; what had been used
     * before that, `/v4/competitions/{id}/players`, **is not a competition's
     * players at all** — see {@link TeamProfileResponse}.
     *
     * **Note the scope.** The competition-scoped twin,
     * `/v4/competitions/{competitionId}/teams/{teamId}/teamprofile`, answers
     * the same body minus `oui`, `onm`, `lo` and a real `mvgl` — so this
     * spelling is the one to use whenever ownership matters, exactly as with
     * {@link player}.
     *
     * Neighbouring spellings all 404: `/teams`, `/teams/{tid}`,
     * `/teams/{tid}/players`, `/teams/{tid}/squad`. Only `teamprofile`
     * resolves.
     */
    teamProfile: (leagueId: string, teamId: string) =>
      `/v4/leagues/${leagueId}/teams/${teamId}/teamprofile`,
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

    /**
     * The league's event log — what the app calls *Aktivitäten*: listings,
     * completed transfers, managers joining and leaving, matchday results and
     * the viewer's achievements. **Newest first.**
     *
     * Probed 2026-09-07 against two leagues; see
     * [docs/api/leagues.md](../../docs/api/leagues.md#get-v4leaguesleagueidactivitiesfeed).
     *
     *  - **`start`** is a zero-based offset and **`max`** the page size
     *    (default 25). No cap was found — `max=500` answered all 489 entries a
     *    league had.
     *  - **`filter`** is the **only working filter**, and it filters on the
     *    event type `t`: a single code or a comma-separated list
     *    (`filter=15,26`). Repeating the parameter keeps only the first; an
     *    unknown string is ignored and returns the unfiltered feed; a number
     *    that matches no type returns an empty list.
     *  - **There is no manager filter and no date filter.** `userId`,
     *    `managerId`, `from`, `to`, `since`, `until`, `dayNumber` and a dozen
     *    other spellings all answer `200` with the unfiltered feed.
     *
     * The feed is **personalised**: the matchday-result entry carries the
     * viewer's own placement and the achievement entries are the viewer's own.
     */
    activitiesFeed: (leagueId: string) =>
      `/v4/leagues/${leagueId}/activitiesFeed`,
    /**
     * One feed entry with the **fuller payload** the list omits — the whole
     * matchday table on a result, the buyer as an object on a transfer, the
     * player's stats on a listing. Achievement (`26`), founding (`28`) and
     * type-`16` entries answer `500 NotFound` here. Unused so far.
     */
    activity: (leagueId: string, activityId: string) =>
      `/v4/leagues/${leagueId}/activitiesFeed/${activityId}`,
    /**
     * **The chat thread hanging off one feed entry.** `GET` reads it, `POST`
     * adds to it, body `{ comm }`.
     *
     * `GET` answers `{ coc, it }` — the count and the comments — and takes
     * `start` and `max`, which the published spec marks required and the live
     * endpoint does not: without either it answers the whole thread.
     *
     * **What is inside `it[]` is not established.** Nobody in either probed
     * league has ever commented — `coc` is `0` on every entry of both feeds —
     * and the spec leaves the item schema empty, so there is no source for the
     * field names. [`useActivityComments`](./hooks/useActivityComments.ts)
     * reads the plausible spellings and says so.
     *
     * **The `POST` body is the spec's, not a measurement.** `{ comm: string }`
     * is what Kickbase documents; it has deliberately not been fired, because
     * a comment lands in a real league in front of real people and **there is
     * no `DELETE`** — the surface here is `GET` and `POST` and nothing else.
     */
    activityComments: (leagueId: string, activityId: string) =>
      `/v4/leagues/${leagueId}/activitiesFeed/${activityId}/comments`,
    /**
     * **The viewer's** achievements in this league — all 46 Kickbase knows,
     * each with whether it is earned (`ise`) and how often (`ac`). Names are
     * localised by `Accept-Language`. Unused; {@link achievement} is what the
     * feed reads.
     */
    achievements: (leagueId: string) =>
      `/v4/leagues/${leagueId}/user/achievements`,
    /**
     * One achievement in detail: the description, **the reward in €** (`er`),
     * when it was earned and how often. The type codes are those of `t` on
     * `/user/achievements` and on a type-`26` feed entry — see
     * [docs/api/codes.md](../../docs/api/codes.md#achievement-type). Answers
     * for unearned types too, minus `ac` and `dt`.
     */
    achievement: (leagueId: string, type: number) =>
      `/v4/leagues/${leagueId}/user/achievements/${String(type)}`,

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
    /**
     * **The twenty-five best players**, points descending — not "all players
     * in a competition", which is what the published documentation calls it.
     * See [`useCompetitionPlayers`](./hooks/useCompetition.ts).
     *
     * It takes exactly **two** parameters, and they are the two the spec
     * declares. Everything else is swallowed in silence, `dayNumber` and its
     * eight other spellings included, so a `200` here is no evidence that a
     * parameter was understood — see
     * [docs/api/competitions.md](../../docs/api/competitions.md#get-v4competitionscompetitionidplayers).
     *
     *  - **`position`**, one of the [`PLAYER_POSITION`](./types.ts) codes.
     *    Answers that position's own top 25, so the four together reach 93
     *    players where the unfiltered call reaches 25. The twenty-sixth
     *    striker is out of reach either way: the cap applies per list and
     *    cannot be raised (`max`, `limit`, `start`, `count`, `size`, `top`,
     *    `page`, `offset` and `n` were each probed and each answered the
     *    identical rows). Keepers come back **below** the cap — 18 on a
     *    nine-fixture matchday — because that is the whole population rather
     *    than a slice of it.
     *  - **`sorting=1`**, which switches the list from the current matchday
     *    to **season totals**. Verified: Kimmich's `p` of 557 is exactly the
     *    303 and 254 his `ph` holds for the two matchdays played. These rows
     *    **drop `mi` and `ot`** — there is no one fixture for a season total
     *    to point at.
     *
     * The two compose, so `{ position: 1, sorting: 1 }` is the season's best
     * keepers.
     *
     * **Nothing sends `sorting` today.** A season leaderboard was built onto
     * the Rangliste and taken off again: that screen is about one matchday at
     * a time, and a second scope on it answered a question it was not asking.
     * The parameter stays because what it does is *known* — re-probing it
     * would cost more than the branch does.
     */
    players: (
      competitionId: string,
      { position, sorting }: { position?: number; sorting?: number } = {},
    ) => {
      const query = new URLSearchParams()
      if (position !== undefined) query.set('position', String(position))
      if (sorting !== undefined) query.set('sorting', String(sorting))
      const suffix = query.toString()
      return (
        `/v4/competitions/${competitionId}/players` +
        (suffix === '' ? '' : `?${suffix}`)
      )
    },
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
