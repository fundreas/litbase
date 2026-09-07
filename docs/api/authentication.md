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

## Login methods the official app offers

litbase only ever does email + password. The Kickbase app does more: its login
screen is a **provider chooser**, and *Mit E-Mail fortfahren* ("continue with
email") is one button among several — the help centre's own reset walkthrough
starts by telling you to tap it.

| Method | Status | Evidence |
| ------ | ------ | -------- |
| Email + password | Current, both platforms | `POST /v4/user/login`, above |
| **Google** | Current — button present on Android | Seen in the app, 2026-09-07 |
| **Facebook** | Current — button present on Android | Seen in the app, 2026-09-07 |
| **Apple ID** ("Sign in with Apple") | Current — **iOS, presumed iOS-only** | Three live help-centre articles; see below |

Four methods, not one. Google and Facebook are confirmed by looking at the
Android app; Apple ID by Kickbase's own documentation —
[unlinking your Apple ID](https://help.kickbase.com/help/wie-kann-ich-die-verknupfung-meiner-apple-id-bei-kickbase-aufheben),
[switching your login from Apple ID to an email address](https://help.kickbase.com/help/wie-kann-ich-meinen-login-von-apple-id-auf-eine-e-mail-adresse-andern),
and a section of
[Login-Probleme](https://help.kickbase.com/help/passwortvergessen) reading
"Wenn du dich ursprünglich über deine Apple ID angemeldet hast, wurde
automatisch ein eigener Account erstellt."

**Why Apple ID is almost certainly on iOS and not Android.** iOS has no choice
about it: [App Store Review Guideline 4.8](https://developer.apple.com/app-store/review/guidelines/#login-services)
requires that an app using Google or Facebook login for the primary account
*also* offer a login service that limits data collection to name and email and
allows the address to be hidden — Sign in with Apple is how apps satisfy it.
Kickbase offers Google and Facebook, so the iOS build must carry Apple too.
Nothing imposes the reverse on Android: Sign in with Apple there means driving
`appleid.apple.com/auth/authorize` through a web view by hand, real work for a
provider almost no Android user asks for. The unlinking article reinforces it —
every step is in *iPhone* Settings, and it ends by telling you to log in with
an email address afterwards. **Not verified**, though: it would take a look at
the Android login screen, or the app binary, to close.

If that presumption holds, an account created with Apple ID **cannot be reached
from Android at all** — which is one plausible reading of the complaints behind
["suddenly in a different league"](https://help.kickbase.com/help/ich-habe-mich-eingeloggt-und-bin-auf-einmal-in-einer-ganz-anderen-liga):
a user who cannot use their original method registers again and lands in a
fresh, empty account.

### Why litbase cannot offer any of them

**There is no endpoint to call — and no way to find one from outside.** Neither
published spec documents a social login: the
[apidog doc](https://share.apidog.com/bca1f84a-99d7-4f8f-96a5-5e084ee24fe3/)
(149 paths) and
[kevinskyba/kickbase-api-doc](https://github.com/kevinskyba/kickbase-api-doc)
(147 paths, "all currently known endpoints") list exactly five under
`/v4/user/` that touch credentials: `login`, `register`, `forgotpassword`,
`password`, `refreshtokens`.

Probing found nothing either. Around fifty SSO-shaped paths under `/v4/user/`
return `404` — `loginapple`, `applelogin`, `login/apple`, `signinwithapple`,
`siwa`, `appleauth`, and the same spellings for Google and Facebook — as do the
`/v1`, `/v2`, `/v3`, `/api` and `/api/v1` prefixes even for plain `user/login`,
so **`/v4` is the only version live**.

> **Both specs and the help centre are silent on three login methods that
> exist.** Both specs are derived from captured email-login traffic, so they
> only ever describe email login; the help centre documents Apple ID and
> nothing else. Whatever the three providers post to, it is either
> `/v4/user/login` with fields nobody has captured or a path no wordlist
> guesses. Treat "it isn't in the spec" and "the help centre doesn't mention
> it" as saying nothing whatsoever about the app's behaviour — the only
> reliable source for this question is the app itself.

### The consequence for litbase

An account created with Google, Facebook or Apple ID **has no password**, so
litbase's login form cannot work for it at all — the API will answer
`401 AccessDenied` forever, no matter what the user types. Those users have two
routes, both outside litbase: set a password in the official app's
*Einstellungen → Dein Account → Passwort-Einstellungen*, or ask
`help@kickbase.com` to move the login onto an email address. Worth saying
plainly on the [Login page](../pages/login.md) if anyone ever reports "my
password is right and it still fails".

### Not a login method: `auth.kickbase.com`

`https://auth.kickbase.com` is a live [authentik](https://goauthentik.io/)
instance, and its authentication flow does advertise a `google-login` OAuth
source. It is **KKSTR's internal staff SSO**, not the game's — `app.kickbase.com`
on the same domain answers with the bare string `KKSTR`, the company behind
Kickbase. Nothing about player accounts goes through it. Noted here only so the
next person who finds it doesn't mistake it for a Google login on the game.

---

## Token lifetime

There is **no refresh token** — not one litbase can reach. `POST
/v4/user/refreshtokens` exists in the published spec and the route is live
(an empty body gets `401 AccessDenied`, not `404`), and
[kevinskyba's spec](https://github.com/kevinskyba/kickbase-api-doc) documents
its body as `{ "rtkn": "…" }`. But **no login response observed here carries an
`rtkn`**, so there is nothing to send it; presumably a newer or different client
gets one. Renewal is therefore a second login with the stored credentials, which the axios interceptor performs once on a `403` before
re-issuing the failed request. See
[`client.ts`](../../src/api/client.ts) and [Authentication](../authentication.md).

Remember that **`403`, not `401`, is the expired-token status** — see
[Errors](README.md#errors).
