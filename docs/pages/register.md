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

Evidence: after a successful register, `POST /v4/user/login` with the same
credentials returns a full session — a bearer token with the usual ~7-day
expiry — and the account reports:

| Field | Value on a fresh account | Meaning |
| ----- | ------------------------ | ------- |
| `emv` | `false` | Email **not** verified |
| `emvr` | `true` | Verification pending |
| `isnu` | `true` | Is a new user |
| `srvl` | `[]` | No leagues yet |
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

## Flow

```
submit → signUp()
           └─ register()  POST /v4/user/register
                ├─ token in response? → adopt it
                └─ no token?          → login() with the same credentials
           └─ persist session, credentials (if opted in), and the email
      → navigate('/', { replace: true })
      → HomeRedirect → /leagues → LeagueGate → "Keine Liga gefunden"
```

The token-or-login branch exists because the register response's exact shape is
**unconfirmed** — the observed response led with `u`, and confirming whether it
also carries `tkn` would mean creating another account. Both branches end in a
session, so the ambiguity is handled rather than guessed at.

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

  ☐ Angemeldet bleiben

  [     Konto erstellen     ]

  Schon ein Konto? Anmelden
```

`autoComplete="new-password"` on the password field, so password managers offer
to generate rather than fill.

## Email is remembered

On success the address is written to `litbase.lastEmail.v1` and the
[Login](login.md) page pre-fills from it. Stored on sign-in too, and
deliberately **not** cleared on sign-out — it holds no secret and its only job
is to save typing next time.

## States

| State | Rendering |
| ----- | --------- |
| Submitting | Button spinner, `aria-busy` |
| Password under 8 chars | Client-side, before any request |
| API rejection | `role="alert"` panel with the mapped German message |
| Storage blocked | Amber warning — registration works, session is tab-only |

The client-side length check is a courtesy to save a round trip. The server
remains the authority: Kickbase's actual password policy is not documented, so
`PasswordTooWeak` can still come back for a password longer than 8 characters.

## Not verified in a browser

The endpoint behaviour above is established from direct probing, but the page
itself has only passed typecheck, lint and build — it has not been submitted
from a browser, because doing so would create another real Kickbase account.

## Possible extensions

- Surface `isnu` to show a first-run onboarding hint after registering, given
  a new account has no leagues.
- A "resend verification email" action, if an endpoint for it exists — not yet
  probed.
- Real password-strength feedback, once Kickbase's policy is known.
