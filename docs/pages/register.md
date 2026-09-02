# Register

[← Back to index](../README.md) · Route `/register` ·
[`src/pages/RegisterPage.tsx`](../../src/pages/RegisterPage.tsx)

Account creation against `POST /v4/user/register`. Public, and wrapped in
`RedirectIfAuthenticated` so a signed-in user cannot reach it.

## What the API actually does

The published documentation says nothing about the registration flow — no
mention of confirmation emails, token returns, or post-registration status. So
it was determined by probing the live endpoint.

**The account is created outright. There is no confirmation link to click, and
the new account can authenticate immediately.**

Evidence, in two parts. The register response itself returns `tkn` and
`tknex` — a working bearer token with the usual ~7-day expiry (see
[Response](#response)). And logging in separately with the same credentials
also succeeds immediately. A fresh account reports:

| Field | Value on a fresh account | Meaning |
| ----- | ------------------------ | ------- |
| `emv` | `false` | Email **not** verified |
| `emvr` | `false` on register, `true` after login | Verification pending |
| `isnu` | `true` | Is a new user |
| `srvl` | absent on register, `[]` on login | No leagues yet |
| `trialExpiry` | ~2 weeks out | Pro trial |

`emv: false` does **not** gate access — the token works and API calls succeed.
Email verification is a background nicety, not a gate.

A brand-new account has **zero leagues**, which lands exactly on the
[League gate](league-gate.md) empty state. That path is not hypothetical for
this page; it is the normal first experience after registering.

### Validation order and status codes

Probed by submitting deliberately failing bodies:

| Submitted | Response | HTTP |
| --------- | -------- | ---- |
| Malformed email | `{"err":2030,"errMsg":"InvalidEMailAddress"}` | **500** |
| Weak or empty password | `{"err":2020,"errMsg":"PasswordTooWeak"}` | **500** |
| Email already registered | `{"err":2000,"errMsg":"EMailAddressAlreadyTaken"}` | 400 |

The order is **email format → password strength → email uniqueness → create**.

Note the 500s: these are *validation* errors, not server faults. This is why
[`ApiError.isPermanent`](../api-layer.md#error-normalisation) checks `errMsg`
before falling back to a status comparison — otherwise a weak password would
be retried as though Kickbase were down, and shown as "Kickbase has a problem".

### Username is optional

Submitting an empty `unm` succeeds; the server generates a name of the form
`KickbaseUser####`. The form reflects this — the field is marked *Optional*
with a hint saying Kickbase will pick one.

Whether `rek: false` (declining terms) is rejected is **unconfirmed**: every
probe that reached that stage was short-circuited by the uniqueness check
first, and confirming it would require creating another account. The form
always sends `rek: true`, as specified.

## Request

Fixed flags, per spec:

```json
{
  "em": "…",
  "unm": "…",
  "pass": "…",
  "tkn": "",
  "rek": true,
  "rept": false,
  "rep": {}
}
```

Sent `anonymousRequest`, so no `Authorization` header.

## Response

Confirmed against a real registration:

```json
{
  "u": { "id": "4477454", "name": "yo-yo", "email": "…", "emv": false,
         "emvr": false, "trialExpiry": "2026-09-16T17:36:40Z" },
  "tkn": "eyJhbGciOiJIUzI1NiIs…",
  "tknex": "2026-09-09T17:36:40Z",
  "isnu": true
}
```

Three differences from the login response worth knowing:

- **No `srvl`.** A fresh account belongs to no leagues, so the array is absent
  rather than empty.
- **No `profile` or `uim` on `u`.** There is no avatar yet, so `Avatar` falls
  back to initials — which it already handles.
- **No chat token.** `chttkn` is login-only.

## Flow

```
submit → signUp()
           └─ register()  POST /v4/user/register
                └─ response carries tkn + tknex → session, no second request
           └─ persist token, credentials, and the email
      → navigate('/leagues', { replace: true })
      → LeagueGate → "Keine Liga gefunden"
```

**One request.** The register response contains a usable bearer token with the
same ~7-day expiry as login, so there is no follow-up login call and the login
form is never involved.

`register()` keeps a fallback to `login()` for the case where `tkn` comes back
empty. It does not run today; it exists so a future API change degrades into
an extra round trip rather than a session holding an empty token.

Navigation goes to `/leagues` directly rather than `/`. A new account has no
remembered league for `HomeRedirect` to restore, and `replace` keeps the
registration form out of the back-button history now that the session is
live.

## Layout

Same centred column as [Login](login.md), no app chrome.

```
        lit·base
   Neues Kickbase-Konto anlegen

  E-MAIL       [ du@example.com     ]
  BENUTZERNAME [ Optional           ]
               Leer lassen, und Kickbase vergibt einen Namen.
  PASSWORT     [ Mindestens 8 Zeichen  👁 ]
               Zahlen und Groß-/Kleinschreibung mischen.

  Du wirst direkt angemeldet und bleibst es …

  [     Konto erstellen     ]

  Schon ein Konto? Anmelden
```

`autoComplete="new-password"` on the password field, so password managers offer
to generate rather than fill.

## What gets stored

On success, three things are written:

| Key | Contents |
| --- | -------- |
| `litbase.session.v1` | The token from the register response, plus its expiry and the user |
| `litbase.credentials.v1` | Email and obfuscated password |
| `litbase.lastEmail.v1` | Email only |

**Credentials are always stored**, exactly as on [Login](login.md) — neither
form offers a toggle. The reasoning is in
[Authentication](../authentication.md#two-tiers-of-persistence).

The trade-off is the one described in
[Authentication](../authentication.md#two-tiers-of-persistence): a password in
`localStorage`, obfuscated but not encrypted.

`lastEmail` is deliberately **not** cleared on sign-out — it holds no secret,
and its only job is to pre-fill the [Login](login.md) form next time.

## States

| State | Rendering |
| ----- | --------- |
| Submitting | Button spinner, `aria-busy` |
| Password under 8 chars | Client-side, before any request |
| API rejection | `role="alert"` panel with the mapped German message |
| Storage blocked | Amber warning — the account is still created and the session still works, but only for this tab |

The client-side length check is a courtesy to save a round trip. The server
remains the authority: Kickbase's actual password policy is not documented, so
`PasswordTooWeak` can still come back for a password longer than 8 characters.

## Not verified in a browser

The endpoint behaviour above is established from direct probing and from a real
registration response, but the page itself has only passed typecheck, lint and
build — it has not been submitted from a browser, because doing so would create
another real Kickbase account.

## Possible extensions

- Surface `isnu` to show a first-run onboarding hint after registering, given
  a new account has no leagues.
- A "resend verification email" action, if an endpoint for it exists — not yet
  probed.
- Real password-strength feedback, once Kickbase's policy is known.
