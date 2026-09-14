# User

[← API index](README.md)

The signed-in account, outside any league. None of these is called: the app
takes everything it needs about the user from the login response and keeps it
in the session. The first two are **declared in
[`endpoints.ts`](../../src/api/endpoints.ts)** and documented because they are
the only way to re-read the account without logging in again, which is what a
profile screen would need. The third is the **daily login bonus**, which the
app does not implement at all.

| Method | Path | Auth | Used |
| ------ | ---- | ---- | ---- |
| `GET` | [`/v4/user/me`](#get-v4userme) | Bearer | no |
| `GET` | [`/v4/user/settings`](#get-v4usersettings) | Bearer | no |
| `GET` | [`/v4/bonus/collect`](#get-v4bonuscollect) | Bearer | no |

---

## `GET /v4/user/me`

The full account, in the same shape login returns under `u`.

**Auth** Bearer. No parameters.

### Response `200`

One key, `u`:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `id` | string | User id |
| `name` | string | Display name |
| `email` | string | Email address |
| `vemail` | string | Verified email address. Differs from `email` while a change is pending (**?**) |
| `profile` | string | **Absolute** avatar URL |
| `uim` | string | The same avatar, CDN-relative |
| `cover` | string | **?** Profile cover image, CDN-relative |
| `proExpiry` | string | Membership expiry, ISO 8601 |
| `perms` | number[] | **✗** Permission ids |
| `notifications` | number | **✗** Bitfield, not a count |
| `flags` | number | **✗** Bitfield |
| `mfacp` | array | **?** Multi-factor auth configuration; empty on every account observed |
| `hums` | boolean | **✗** Only appears here, not on the login response |

Whether `profile` and `uim` can disagree — a cached absolute URL against a
freshly uploaded path — has not been tested. [`cdnUrl`](../../src/api/cdn.ts)
handles either, and the app prefers `profile`.

---

## `GET /v4/user/settings`

A four-field summary. Different keys again: `i`/`em`/`unm` where `/me` uses
`id`/`email`/`name`.

**Auth** Bearer. No parameters.

### Response `200`

One key, `u`:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `i` | string | User id |
| `em` | string | Email address |
| `unm` | string | Username |
| `uim` | string | Avatar, CDN-relative |

The spec also lists `PUT /v4/user/settings` and `POST /v4/user/settings/image`
for writing these back; neither has been probed.

---

## `GET /v4/bonus/collect`

The **daily login bonus** (*Auflaufprämie*): money for opening the app, paid
into **every league you are in at once**. The app pays €10.000 on the first
day and another €10.000 for each consecutive day, capping at €100.000 — so the
`day` counter below is the whole mechanic, and it resets when a day is missed.
The rate and the cap are Andreas' account, watched day by day; the spec says
nothing about either.

**It is a write dressed as a `GET`.** Calling it *is* collecting — there is no
companion endpoint that reads the pending state, so nothing can show "your
bonus is waiting" without taking it. Nothing in
[`/v4/user/me`](#get-v4userme), [`/v4/leagues/{id}/me`](leagues.md#get-v4leaguesleagueidme)
or `/overview` carries a streak, a day counter or a claimed-today flag.

**Auth** Bearer. No parameters; `Accept: application/json` is declared required
and every other endpoint gets away without it.

### Response `200`

One entry in `it` **per league**, followed by seven fields that are a house ad
and have nothing to do with the bonus.

| Field | Type | Description |
| ----- | ---- | ----------- |
| `it` | array | The credits, one per league — below |
| `it[].li` | string | League id |
| `it[].lnm` | string | League name |
| `it[].v` | number | **What was just paid**, in € — `10000` on day 1 |
| `it[].day` | number | **The streak day**, counting from `1` |
| `it[].b` | number | Budget **after** the credit, in € — the same figure [`/leagues/{id}/me`](leagues.md#get-v4leaguesleagueidme) answers with `b` |
| `it[].lim` | string | League avatar, CDN-relative |
| `fb` | string | **?** CDN-relative image, the ad's background |
| `lf` | string | **?** CDN-relative image, the ad's logo |
| `url` | string | **?** Where the ad's button goes — a `go.kickbase.com` short link |
| `btt` | string | **?** The ad's button text — *"Jetzt Startbonus sichern!"* |
| `dtc` · `bstc` · `btc` | string | **?** Hex colours for the ad — `#fcfcfc`, `#fcfcfc`, `#26ebcf` |

What an already-collected day answers — an empty `it`, a `4xx`, or the same
payload again — is **unknown**, and it cannot be established without spending a
day's bonus to find out.

### The feed remembers it

Each credit also lands in the [activity feed](leagues.md#get-v4leaguesleagueidactivitiesfeed)
as type `22` with `{ bn, day }` — see [Codes](codes.md#activity-type-t). That
is the only *readable* record of the bonus, and the only way to reconstruct a
streak after the fact. The test account has never collected one, which is why
type `22` is still marked unobserved.

### Used by

Nothing. The [events page](../pages/events.md#the-rows) renders a *Login bonus*
row from the spec's shape alone, and has never had one to draw.
