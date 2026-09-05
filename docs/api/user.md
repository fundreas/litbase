# User

[← API index](README.md)

The signed-in account, outside any league. Both endpoints are **declared in
[`endpoints.ts`](../../src/api/endpoints.ts) but not called** — the app takes
everything it needs about the user from the login response and keeps it in the
session. They are documented because they are the only way to re-read the
account without logging in again, which is what a profile screen would need.

| Method | Path | Auth | Used |
| ------ | ---- | ---- | ---- |
| `GET` | [`/v4/user/me`](#get-v4userme) | Bearer | no |
| `GET` | [`/v4/user/settings`](#get-v4usersettings) | Bearer | no |

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
