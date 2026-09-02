# Login

[← Back to index](../README.md) · Route `/login` ·
[`src/pages/LoginPage.tsx`](../../src/pages/LoginPage.tsx)

The only public route. Everything else sits behind `RequireAuth`.

## What happens

1. The user submits email and password.
2. `signIn({ email, password, remember })` posts to `/v4/user/login` — see
   [Authentication](../authentication.md#sign-in).
3. On success the session is persisted and the user is navigated to
   `location.state.from` (where `RequireAuth` bounced them from) or `/`.
4. `/` then resolves to a league — see
   [Routing](../routing-and-layout.md#landing-without-a-league).

The route is wrapped in `RedirectIfAuthenticated`, so a signed-in user
visiting `/login` is sent to `/` instead of seeing the form.

The email field is **pre-filled** from `litbase.lastEmail.v1`, written on the
last successful sign-in or [registration](register.md), so a returning user
only types a password. A *Registrieren* link at the bottom leads to
[Register](register.md).

## Layout

Centred single column, `max-w-sm`, no app chrome — no header, drawer or
bottom bar, because there is no league context yet.

```
        lit·base
  Mit deinem Kickbase-Konto anmelden

  E-MAIL
  [ du@example.com              ]

  PASSWORT
  [ ••••••••                 👁 ]

  ☐ Angemeldet bleiben
    Kickbase gibt kein Refresh-Token aus …

  [        Anmelden           ]

  Deine Zugangsdaten gehen direkt an
  api.kickbase.com. litbase hat keinen
  eigenen Server.
```

## Fields

**Email** — `type="email"`, `inputMode="email"`, `autoComplete="email"`,
`autoCapitalize="none"`, `autoCorrect="off"`. The last two matter on phones,
where autocapitalising the first letter of an address is a common annoyance.

**Password** — `autoComplete="current-password"` so password managers fill it,
with a trailing eye button toggling `type` between `password` and `text`. The
toggle is a real `<button>` with an `aria-label` that flips between
*Passwort anzeigen* and *Passwort verbergen*.

Both use [`Input`](../../src/components/ui/Input.tsx), whose 16px font size is
what stops iOS Safari zooming the viewport on focus.

**"Angemeldet bleiben"** — the tier-2 opt-in. Its helper text states plainly
that Kickbase issues no refresh token, that without the option the session
ends when the token expires (~7 days), and that with it the credentials are
stored in the browser. This is the one place in the app where a security
trade-off is exposed to the user, so it is spelled out rather than hidden
behind a tooltip.

## States

| State | Rendering |
| ----- | --------- |
| Submitting | `Button` shows a spinner and goes `aria-busy`, driven by `isBusy` from `useAuth()` |
| Wrong credentials (401) | `role="alert"` panel: *E-Mail oder Passwort ist falsch.* |
| Other failure | Same panel with the `ApiError` message — e.g. the network-failure copy |
| Storage blocked | Amber warning: login works but only for this tab |

The 401 case is special-cased to a friendly message rather than passing
through the server's wording, since that is the one failure users will
actually hit.

The storage warning reads `storageAvailable` from
[`lib/storage.ts`](../../src/lib/storage.ts) — true when a write-then-read
probe against `localStorage` succeeded at module load.

## Notes

- `noValidate` on the form: the browser's native bubble UI is inconsistent
  across mobile browsers, and the inline error panel is the single place errors
  appear.
- The footer line is there on purpose. Users are being asked to type third-party
  credentials into something that is not the Kickbase app, so it says where
  they go and that there is no intermediary server.
- The form is uncontrolled by nothing — all four fields are React state. No
  form library.

## Possible extensions

- Surface the *"keep me signed in"* state after login (currently only visible
  as a footnote in the avatar menu).
- Handle Kickbase's MFA fields (`mfacp` appears in the login response but is
  empty for accounts without it — untested).
- Rate-limit feedback: a 429 currently shows the generic
  *"Too many requests"* copy.
