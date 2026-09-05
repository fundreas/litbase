# Authentication

[← API index](README.md)

The two endpoints that mint a bearer token. **Both are anonymous** — and login
must be sent *without* an `Authorization` header, because a stale token on the
login call makes Kickbase reject it. The app marks them with
[`anonymousRequest`](../../src/api/client.ts).

How the token is stored, renewed and cleared is
[Authentication](../authentication.md); this page is only the wire format.

| Method | Path | Auth |
| ------ | ---- | ---- |
| `POST` | [`/v4/user/login`](#post-v4userlogin) | none |
| `POST` | [`/v4/user/register`](#post-v4userregister) | none |

---

## `POST /v4/user/login`

Exchange email and password for a bearer token.

**Auth** none.

### Request body

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `em` | string | yes | Email address |
| `pass` | string | yes | Password |
| `loy` | boolean | no | **?** "Loyalty" / stay-signed-in. The app sends `false`; nothing observable changes either way |
| `rep` | object | no | Device reporting payload. **An empty object is accepted** |

The published spec declares only `em` and `pass` as required. `loy` and `rep`
are what the official client sends, and are kept for symmetry with register.

```json
{ "em": "name@example.com", "pass": "…", "loy": false, "rep": {} }
```

### Response `200`

| Field | Type | Description |
| ----- | ---- | ----------- |
| `tkn` | string | **The bearer token.** Send as `Authorization: Bearer <tkn>` |
| `tknex` | string | Token expiry, ISO 8601. Roughly seven days out |
| `chttkn` | string | Firebase chat token — a **separate, ~1 h lifetime**, only needed for chat. Unused |
| `chtknex` | string | Chat-token expiry, ISO 8601 |
| `emve` | string | Verified email address. Spelled `vemail` inside `u` |
| `isnu` | boolean | **?** Is a new user. `false` on a normal login |
| `isnr` | boolean | **✗** Present in the spec's example; meaning unestablished |
| `u` | object | The account — see below |
| `srvl` | array | **"Server list"** — the leagues this account belongs to, see below |

#### `u` — the account

| Field | Type | Description |
| ----- | ---- | ----------- |
| `id` | string | User id |
| `name` | string | Display name |
| `email` | string | Email address |
| `vemail` | string | Verified email address |
| `profile` | string | **Absolute** avatar URL — the one payload in the API that is not CDN-relative |
| `uim` | string | The same avatar as a CDN-relative path (`user/<hash>.png`) |
| `cover` | string | **?** Profile cover image, CDN-relative |
| `proExpiry` | string | Membership expiry, ISO 8601. `"1970-00-00T00:00:00Z"` for an account without one |
| `perms` | number[] | **✗** Permission ids, e.g. `[3001, 15]` |
| `notifications` | number | **✗** A bitfield, not a count — observed `17407` |
| `flags` | number | **✗** A bitfield — observed `32` |
| `mfacp` | array | **?** Multi-factor auth configuration. Empty on every account observed |
| `hums` | boolean | **✗** Only on `/v4/user/me` |

#### `srvl[]` — one league membership

The same leagues [`/v4/leagues/selection`](leagues.md#get-v4leaguesselection)
returns, in a **different shape with different keys** — `id`/`name` here where
selection uses `i`/`n`. The app ignores `srvl` and calls `/selection`, so only
the fields it names are documented; everything else is from the spec's example
and unverified.

| Field | Type | Description |
| ----- | ---- | ----------- |
| `id` | string | League id |
| `name` | string | League name |
| `cpi` | string | Competition id — `"1"` is Bundesliga |
| `creator` | string | Creator's display name |
| `creatorId` | string | Creator's user id |
| `creation` | string | Created at, ISO 8601 |
| `mu` | number | **?** Member count ("managers, used") |
| `pl` | number | **?** Max players per lineup |
| `lim` | string | League avatar, CDN-relative |
| `uim` | string | **?** The signed-in user's avatar inside this league |
| `ci` | string | **?** League avatar again, absolute |
| `adm` | boolean | Whether this account administers the league |
| `mpst` | number | **?** Max players from one real club |
| `amd` | boolean | **✗** |
| `ai`, `t`, `au`, `ap`, `gm`, `vr` | number | **✗** |
| `pub`, `mpl` | boolean | **✗** `pub` presumably "is public" |

### Errors

| Status | `errMsg` | Cause |
| ------ | -------- | ----- |
| `401` | `AccessDenied` | Wrong email or password, or no such account. **The only endpoint that uses 401** |

### Used by

[`login()`](../../src/auth/authApi.ts) → [Login page](../pages/login.md).

---

## `POST /v4/user/register`

Create an account. **There is no email-confirmation step** — the account exists
immediately and the response already carries a usable token, so registering
signs the user in directly with no second round trip.

**Auth** none.

### Request body

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `em` | string | yes | Email address. Must be unique and well-formed |
| `unm` | string | yes | Desired username. **May be empty** — the server then generates `KickbaseUser####` |
| `pass` | string | yes | Password. Rejected as `PasswordTooWeak` if it fails the policy |
| `tkn` | string | yes | Invite/registration token. **`""` for open registration** |
| `rek` | boolean | yes | Terms and privacy accepted. The app sends `true` |
| `rept` | boolean | yes | Opt-in to marketing/push. The app sends `false` |
| `rep` | object | yes | Device reporting payload. An empty object is accepted |

```json
{
  "em": "name@example.com", "unm": "username", "pass": "…",
  "tkn": "", "rek": true, "rept": false, "rep": {}
}
```

### Response `200`

Like the login response, minus what a fresh account cannot have:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `tkn` | string | Bearer token, ready to use |
| `tknex` | string | Token expiry, ISO 8601 — the same ~7 days |
| `isnu` | boolean | Is a new user. `true` here |
| `u` | object | The account. **No `profile`/`uim`**, so an avatar falls back to initials |

**No `srvl`** — a fresh account belongs to no leagues. **No `emve`** and **no
chat token**.

### Errors

| Status | `errMsg` | Cause |
| ------ | -------- | ----- |
| `500` | `InvalidEMailAddress` | Malformed email — note the 5xx on a validation error |
| `500` | `PasswordTooWeak` | Password fails the policy |
| `400` | `EMailAddressAlreadyTaken` | Account exists |
| `400` | `UserNameAlreadyTaken` | Username taken |

### Used by

[`register()`](../../src/auth/authApi.ts) → [Register page](../pages/register.md).

The app falls back to `login()` if `tkn` is ever missing, so a future API change
degrades into one extra request rather than a broken session.

---

## Token lifetime

There is **no refresh token**. `POST /v4/user/refreshtokens` exists in the
published spec, and the app does not use it: renewal is a second login with the
stored credentials, which the axios interceptor performs once on a `403` before
re-issuing the failed request. See
[`client.ts`](../../src/api/client.ts) and [Authentication](../authentication.md).

Remember that **`403`, not `401`, is the expired-token status** — see
[Errors](README.md#errors).
