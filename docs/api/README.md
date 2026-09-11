# The Kickbase v4 API

Every endpoint litbase talks to, resource by resource: what it does, whether
it needs a token, what goes in, and what every field of the answer means.

This is a **reference for the wire format**. How the app wraps it — the axios
instance, the query hooks, the domain models — is
[API layer](../api-layer.md). What each screen does with it is
[Pages](../README.md#pages).

## Resources

| Resource | Endpoints | Covers |
| -------- | --------- | ------ |
| [Authentication](authentication.md) | 2 | Sign in, register, the bearer token |
| [User](user.md) | 2 | The signed-in account |
| [Leagues](leagues.md) | 9 | Membership, metadata, standings, joining, the activity feed |
| [Squad and lineup](squad-and-lineup.md) | 9 | Who you own, who you field, historical snapshots |
| [Transfer market](market.md) | 6 | Listings, bids, selling — both sides of a deal |
| [Players](players.md) | 4 | One player: detail, history, market value, owners |
| [Competitions](competitions.md) | 6 | Bundesliga & co: table, fixtures, player search, one club's whole squad |
| [Matches](matches.md) | 2 | One match live, and the scoring-event catalogue |
| [Codes and enums](codes.md) | — | Every numeric code the payloads use, in one place |

## Every endpoint at a glance

`✔` = the app calls it. Everything takes `Authorization: Bearer <token>` except
the two marked *none*.

| Method | Path | | Page |
| ------ | ---- | - | ---- |
| `POST` | `/v4/user/login` *(auth: none)* | ✔ | [Authentication](authentication.md#post-v4userlogin) |
| `POST` | `/v4/user/register` *(auth: none)* | ✔ | [Authentication](authentication.md#post-v4userregister) |
| `GET` | `/v4/user/me` | | [User](user.md#get-v4userme) |
| `GET` | `/v4/user/settings` | | [User](user.md#get-v4usersettings) |
| `GET` | `/v4/leagues/selection` | ✔ | [Leagues](leagues.md#get-v4leaguesselection) |
| `GET` | `/v4/leagues/recommended` | ✔ | [Leagues](leagues.md#get-v4leaguesrecommended) |
| `GET` | `/v4/leagues/list` | ✔ | [Leagues](leagues.md#get-v4leagueslist) |
| `POST` | `/v4/leagues/{leagueId}/join` | ✔ | [Leagues](leagues.md#post-v4leaguesleagueidjoin) |
| `GET` | `/v4/leagues/{leagueId}/me` | ✔ | [Leagues](leagues.md#get-v4leaguesleagueidme) |
| `GET` | `/v4/leagues/{leagueId}/overview` | ✔ | [Leagues](leagues.md#get-v4leaguesleagueidoverview) |
| `GET` | `/v4/leagues/{leagueId}/ranking` | ✔ | [Leagues](leagues.md#get-v4leaguesleagueidranking) |
| `GET` | `/v4/leagues/{leagueId}/battles/{type}/users` | ✔ | [Leagues](leagues.md#get-v4leaguesleagueidbattlestypeusers) |
| `GET` | `/v4/leagues/{leagueId}/managers/{managerId}/performance` | | [Leagues](leagues.md#get-v4leaguesleagueidmanagersmanageridperformance) |
| `GET` | `/v4/leagues/{leagueId}/managers/{managerId}/dashboard` | | [Leagues](leagues.md#get-v4leaguesleagueidmanagersmanageriddashboard) |
| `GET` | `/v4/leagues/{leagueId}/activitiesFeed` | ✔ | [Leagues](leagues.md#get-v4leaguesleagueidactivitiesfeed) |
| `GET` | `/v4/leagues/{leagueId}/activitiesFeed/{activityId}` | | [Leagues](leagues.md#get-v4leaguesleagueidactivitiesfeedactivityid) |
| `GET` | `/v4/leagues/{leagueId}/user/achievements/{type}` | ✔ | [Codes](codes.md#achievement-type) |
| `GET` | `/v4/leagues/{leagueId}/players/{playerId}/transfers` | ✔ | [Leagues](leagues.md#where-a-bid-of-your-own-can-be-read-back) |
| `GET` | `/v4/leagues/{leagueId}/squad` | ✔ | [Squad](squad-and-lineup.md#get-v4leaguesleagueidsquad) |
| `GET` | `/v4/leagues/{leagueId}/managers/{userId}/squad` | ✔ | [Squad](squad-and-lineup.md#get-v4leaguesleagueidmanagersuseridsquad) |
| `GET` | `/v4/leagues/{leagueId}/users/{userId}/teamcenter` | ✔ | [Squad](squad-and-lineup.md#get-v4leaguesleagueidusersuseridteamcenter) |
| `GET` | `/v4/leagues/{leagueId}/teamcenter/myeleven` | | [Squad](squad-and-lineup.md#get-v4leaguesleagueidteamcentermyeleven) |
| `GET` | `/v4/leagues/{leagueId}/lineup` | | [Lineup](squad-and-lineup.md#get-v4leaguesleagueidlineup) |
| `POST` | `/v4/leagues/{leagueId}/lineup` | ✔ | [Lineup](squad-and-lineup.md#post-v4leaguesleagueidlineup) |
| `POST` | `/v4/leagues/{leagueId}/lineup/clear` | ✔ | [Lineup](squad-and-lineup.md#post-v4leaguesleagueidlineupclear) |
| `POST` | `/v4/leagues/{leagueId}/lineup/fill` | | [Lineup](squad-and-lineup.md#post-v4leaguesleagueidlineupfill) |
| `GET` | `/v4/leagues/{leagueId}/lineup/overview` | | [Lineup](squad-and-lineup.md#get-v4leaguesleagueidlineupoverview) |
| `GET` | `/v4/leagues/{leagueId}/market` | ✔ | [Market](market.md#get-v4leaguesleagueidmarket) |
| `POST` | `/v4/leagues/{leagueId}/market` | ✔ | [Market](market.md#post-v4leaguesleagueidmarket) |
| `DELETE` | `/v4/leagues/{leagueId}/market/{playerId}` | ✔ | [Market](market.md#delete-v4leaguesleagueidmarketplayerid) |
| `POST` | `/v4/leagues/{leagueId}/market/{playerId}/offers` | ✔ | [Market](market.md#post-v4leaguesleagueidmarketplayeridoffers) |
| `DELETE` | `/v4/leagues/{leagueId}/market/{playerId}/offers/{offerId}` | ✔ | [Market](market.md#delete-v4leaguesleagueidmarketplayeridoffersofferid) |
| `POST` | `/v4/leagues/{leagueId}/market/{playerId}/offers/{offerId}/accept` | ✔ | [Market](market.md#post-v4leaguesleagueidmarketplayeridoffersofferidaccept) |
| `GET` | `/v4/leagues/{leagueId}/players/{playerId}` | ✔ | [Players](players.md#get-v4leaguesleagueidplayersplayerid) |
| `GET` | `/v4/leagues/{leagueId}/players/{playerId}/performance` | ✔ | [Players](players.md#get-v4leaguesleagueidplayersplayeridperformance) |
| `GET` | `/v4/leagues/{leagueId}/players/{playerId}/marketvalue/{timeframe}` | ✔ | [Players](players.md#get-v4leaguesleagueidplayersplayeridmarketvaluetimeframe) |
| `GET` | `/v4/leagues/{leagueId}/players/{playerId}/transferHistory` | ✔ | [Players](players.md#get-v4leaguesleagueidplayersplayeridtransferhistory) |
| `GET` | `/v4/competitions` | ✔ | [Competitions](competitions.md#get-v4competitions) |
| `GET` | `/v4/competitions/{competitionId}/players` | ✔ | [Competitions](competitions.md#get-v4competitionscompetitionidplayers) |
| `GET` | `/v4/competitions/{competitionId}/players/search` | ✔ | [Competitions](competitions.md#get-v4competitionscompetitionidplayerssearch) |
| `GET` | `/v4/competitions/{competitionId}/table` | ✔ | [Competitions](competitions.md#get-v4competitionscompetitionidtable) |
| `GET` | `/v4/leagues/{leagueId}/teams/{teamId}/teamprofile` | ✔ | [Competitions](competitions.md#get-v4competitionscompetitionidteamsteamidteamprofile) |
| `GET` | `/v4/competitions/{competitionId}/matchdays` | ✔ | [Competitions](competitions.md#get-v4competitionscompetitionidmatchdays) |
| `GET` | `/v4/matches/{matchId}/details` | ✔ | [Matches](matches.md#get-v4matchesmatchiddetails) |
| `GET` | `/v4/live/eventtypes` | | [Matches](matches.md#get-v4liveeventtypes) |

## Where the data comes from

Two sources, and they disagree often enough that this documentation says which
is speaking:

1. **A published Postman-derived spec**, mirrored at
   [share.apidog.com](https://share.apidog.com/bca1f84a-99d7-4f8f-96a5-5e084ee24fe3/).
   It has the canonical path spellings, the declared parameters and real
   captured response examples. Its prose is auto-generated and its schemas are
   shallow (arrays come back as `array`, with no item shape), so it names
   fields without explaining them, and it is occasionally stale.
2. **Live probing against the real API**, recorded in
   [`src/api/types.ts`](../../src/api/types.ts) and in the page docs. This is
   where the meanings come from — including several the spec has wrong.

Where they conflict, the note says so and the probed reading wins.

## Confidence

Kickbase publishes no field documentation. Every description below carries one
of three markers:

| Marker | Means |
| ------ | ----- |
| *(none)* | **Confirmed** — verified against live responses, or arithmetically derived from other confirmed fields |
| **?** | **Assumption** — a plausible reading that nothing has contradicted, but nothing has proven either |
| **✗** | **Unknown** — the field arrives, and what it is for has not been established |

A field marked **?** is safe to render only where being wrong is cheap. A
field marked **✗** should not be rendered at all.

## The basics

**Base URL** `https://api.kickbase.com`, overridable with `VITE_API_BASE_URL`
(see [`src/lib/env.ts`](../../src/lib/env.ts)). Every path below is relative to
it, and every one begins `/v4/`.

**CORS** The API reflects `Access-Control-Allow-Origin` for any origin, so a
browser can call it directly with no proxy. The Vite dev proxy exists only as a
fallback for the day that changes — see
[vite.config.ts](../../vite.config.ts).

**Images** are not URLs. Payloads carry CDN-relative paths
(`content/file/<hash>.png`, `user/<hash>.jpeg`, `league/<hash>.png`), which
resolve against `https://kickbase.b-cdn.net`. The one exception is `profile` on
the login user, which is already absolute. [`cdnUrl`](../../src/api/cdn.ts)
handles both.

### Headers

| Header | Value | Why |
| ------ | ----- | --- |
| `Authorization` | `Bearer <token>` | Every endpoint except login and register |
| `Accept` | `application/json` | Declared required by the spec on every endpoint |
| `Content-Type` | `application/json` | On every request that carries a body |
| `Accept-Language` | `de-DE,de;q=0.9` | **Changes the response.** Kickbase localises the prose it serves — injury reasons (`stxt`) above all. Without it they arrive in English in the middle of a German UI |

### Authentication

One bearer token, obtained from [`POST /v4/user/login`](authentication.md#post-v4userlogin)
or [`POST /v4/user/register`](authentication.md#post-v4userregister), valid
about **seven days**, sent as `Authorization: Bearer <tkn>`.

**There is no refresh token.** `POST /v4/user/refreshtokens` exists in the
spec but the app has no use for it: renewal means logging in again with the
stored credentials. See [Authentication](../authentication.md) for how the app
handles that silently.

Every endpoint in this reference **requires the token** unless its page says
otherwise. Only login and register are anonymous, and login must be sent
*without* the header — a stale token on the login call makes Kickbase reject
it.

### Errors

Failures come back as an envelope:

```json
{ "err": 5080, "errMsg": "UnderpayNotAllowed", "svcs": [] }
```

`errMsg` is the trustworthy signal. **The HTTP status is not**, and this is the
single most important thing to know about this API:

| Status | What it actually means |
| ------ | ---------------------- |
| `400` | Semantic rejection — `InvalidData`, `EMailAddressAlreadyTaken` |
| `401` | **Only** wrong credentials on `/v4/user/login` |
| `403` | Missing, malformed or expired token. This — not 401 — is "re-authenticate" |
| `404` | Route does not exist |
| `429` | Rate limited |
| `500` | Often a *permanent validation error*: `PasswordTooWeak`, `NotFound`, and all three bid refusals. Retrying will not help |

Error names seen so far, all mapped to German copy in
[`errors.ts`](../../src/api/errors.ts):

| `errMsg` | `err` | Served as | Meaning |
| -------- | ----- | --------- | ------- |
| `AccessDenied` | 1 | 401 | Wrong email or password |
| `InvalidEMailAddress` | — | 500 | Malformed email on register |
| `PasswordTooWeak` | — | 500 | Password fails the policy |
| `EMailAddressAlreadyTaken` | — | 400 | Account exists |
| `UserNameAlreadyTaken` | — | 400 | Username taken |
| `NotFound` | — | 500 | League gone (on join), or a resource this account may not see |
| `InvalidData` | — | 400 | Body rejected — wrong field name, or a value out of range |
| `LineupNotEnoughPlayers` | 4020 | 500 | Fewer than eleven players in a lineup write |
| `UnderpayNotAllowed` | 5080 | 500 | Bid below market value in a league that forbids it |
| `NinetyPercentRuleExceeded` | 5060 | 500 | Bid below 90 % of market value |
| `InvalidMarketValue` | 5020 | 500 | Asking price outside `0 … 2³¹−1`, on `POST /market` |
| `ThirtyThreePercentRuleExceeded` | 5050 | 500 | Standing bids exceed budget + 33 % of team value |

## Reading the payloads

Kickbase abbreviates everything. Four habits explain most of it:

- **`it` is always "the list"** — the array a collection endpoint returns.
- **A leading letter names the thing, the rest names the attribute.** `t1`/`t2`
  are the two teams of a fixture (`t1g` their goals, `t1im` their crest),
  `mv` is market value (`mvt` its trend, `mvgl` its gain/loss), `md` is
  matchday, `pl` is placement, `u`/`ui` a user.
- **`t1` is always home, `t2` always away.** Nothing in the payloads says so;
  it holds on every fixture checked.
- **Zeroed counters are omitted, not sent as `0`.** A player who has not
  featured this season carries no `tp`, `g`, `a`, `cs` at all. So an absent
  numeric field means "nothing to report", and every consumer defaults it.

Money is in **euros as an integer**. Dates are **ISO 8601 with a `Z`**, except
`dt` on a market-value point, which is *days since the Unix epoch*.

## What the app does not use

The published spec lists **149 paths**. This reference documents **41** — the
29 the app actually calls, plus twelve neighbours that are declared, adjacent or
too useful to leave undescribed (each is marked *Used: no* on its page). The
rest are whole
product areas the app does not implement — `/v4/challenges/*` (Kickbase's
solo/ladder mode, ~40 paths), `/v4/onboarding/*`, `/v4/products/*` and
`/v4/promotion` (purchases), `/v4/chat/*`,
`/v4/leagues/{id}/activitiesFeed/{id}/comments` (the feed's comment threads),
`/v4/leagues/{id}/scoutedplayers`, `/v4/leagues/{id}/settings` (admin only),
`/v4/base/news/*` — plus a few that would fit and are
simply unbuilt:

| Path | Why it is interesting |
| ---- | --------------------- |
| `GET /v4/base/predictions/teams/{competitionId}` | The lineup-probability posters keyed by team — the bulk source behind `plpim`. See [Codes](codes.md#lineup-probability-prob) |
| `GET /v4/leagues/{id}/managers/{id}/performance` | **Used** since 2026-09-08 by `useManagerPerformance` for the [manager page](../pages/manager-detail.md#details)'s matchday list — the only per-manager source of **points per matchday** (`/ranking`'s `lp` is the lineup, not points). [Documented](leagues.md#get-v4leaguesleagueidmanagersmanageridperformance). Briefly the source of the title stars too, until `swc` on `/ranking` turned out to carry **how often a manager has won the league** directly |
| `POST /v4/leagues/{id}/market/{playerId}/offers/{offerId}/accept` · `/decline` | Selling — accepting a bid on your own listing |
| `POST /v4/leagues/{id}/market/{playerId}/sell` | Selling straight back to Kickbase |
| `GET /v4/leagues/{id}/me/budget` | Budget on its own, without the rest of `/me` |
| `GET /v4/leagues/{id}/user/achievements` | The viewer's 46 achievements with earned flags — the list behind the `/{type}` detail the events page reads. Type codes in [Codes](codes.md#achievement-type). Type `2001` *Meister* makes its `ac` the viewer's **league-title count**, the one figure `/managers/{id}/performance` can only be decoded into |
| `GET /v4/leagues/{id}/managers/{id}/transfer` | A manager's completed deals, `tty` 1 bought / 2 sold. Not their bids — see [Leagues](leagues.md#where-a-bid-of-your-own-can-be-read-back) |
| `GET /v4/bonus/collect` | Claims the daily login bonus (*Auflaufprämie*) for every league at once — a **write dressed as a `GET`**, so it was read from the spec and never called |
| `GET /v4/config` | Client configuration. Probed once — it names no game modes, which is why [`GAME_PLAY_MODE`](codes.md#game-modes-gpm) had to be inferred |

## Adding an endpoint here

Document it where its resource lives, in the same shape as its neighbours:
purpose · auth · request · response · notes · who calls it. Mark every field
you cannot prove with **?** or **✗** — an honest gap is worth more than a
confident guess, and the next person to probe it will thank you. If you
*resolve* one, delete the marker and say how you established it.
