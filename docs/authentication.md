# Authentication

[← Back to index](README.md)

## The constraint that shapes everything

Kickbase v4 issues **one bearer token and no refresh token**.

`POST /v4/user/login` returns:

| Field | Meaning |
| ----- | ------- |
| `tkn` | The bearer token |
| `tknex` | Its expiry, ISO 8601 — roughly 7 days out |
| `chttkn` | A separate Firebase chat token, ~1 h lifetime |
| `u` | The user (id, name, email, avatar) |
| `srvl` | The user's leagues |

There is no refresh endpoint. All three plausible paths were probed and return
**404**:

```
/v4/user/refresh        404
/v4/user/refreshtoken   404
/v4/user/token          404
```

(`/v4/chat/refreshtoken` *does* return 200, but it only refreshes `chttkn`,
the chat token — not the bearer token the API is authenticated with.)

So "refreshing" can only mean **re-posting the credentials to
`/v4/user/login`**. Everything below follows from that single fact.

## Two tiers of persistence

| Tier | Stored | Enabled | Covers |
| ---- | ------ | ------- | ------ |
| 1 | Token + expiry | Always | Closing and reopening the page, for ~7 days |
| 2 | Credentials | Opt-in on login, **always on register** | Silent renewal past the 7-day expiry |

Tier 1 is the safe default and handles the common case entirely. Tier 2 means
**a password sits in `localStorage`**, so on the login form it is a choice —
the "Angemeldet bleiben" checkbox, off by default, with the trade-off spelled
out in the form itself rather than buried.

Registration is the exception: it always enables tier 2, because an account
created today that could not renew itself would simply stop working in a week.
See [Sign-up](#sign-up).

The obfuscation applied to the stored password (a byte-wise XOR, then base64,
in [`authStorage.ts`](../src/auth/authStorage.ts)) is deliberately **not**
called encryption. A browser can keep no secret from script running on its own
origin. It only stops the password being readable at a glance in devtools.

## Sign-in

[`authApi.ts`](../src/auth/authApi.ts) posts:

```json
{ "em": "…", "pass": "…", "loy": false, "rep": {} }
```

marked `anonymousRequest` so the interceptor **skips** the `Authorization`
header — a stale token on the login call makes Kickbase reject it.

The response is flattened to a `StoredSession`:

```ts
{
  token: data.tkn,
  expiresAt: Date.parse(data.tknex),  // NaN → now + 6 days
  user: { id, name, email, avatar: data.u.profile ?? data.u.uim },
}
```

The `NaN` fallback matters: an unparseable expiry would otherwise be treated
as `0` and lock the user out immediately.

## Sign-up

`POST /v4/user/register` **creates the account outright — there is no
confirmation email to click.** This was established by probing, not assumed;
the published documentation is silent on it. See
[Register](pages/register.md#what-the-api-actually-does) for the evidence.

**The register response already carries a usable `tkn` and `tknex`** — same
~7-day expiry as login. So registration is a single request: `signUp` adopts
that token directly, no follow-up login, and the user goes straight to
`/leagues` without the login form ever appearing.

`signUp` differs from `signIn` in one way: it has **no `remember` flag and
always stores the credentials**. A brand-new account that could not renew
itself would just stop working after seven days, which is a poor first
experience, so the register form states what happens instead of offering a
toggle. The trade-off is the same one described above — a password in
`localStorage`, obfuscated but not encrypted — and *Abmelden* clears it.

`register()` keeps a fallback to `login()` for an empty `tkn`. It does not run
today; it exists so a future API change degrades into an extra round trip
rather than a session holding an empty token.

Two extra details, both handled: the register response has **no `srvl`**, and
signing up **clears any remembered league id**, so a new account cannot
inherit a previous user's league. `adoptSession` does the same whenever the
signed-in user id changes.

## How the token reaches requests

[`AuthProvider`](../src/auth/AuthProvider.tsx) pushes two functions into the
axios module at mount, keeping [`client.ts`](../src/api/client.ts) free of
React:

```ts
setTokenProvider(() => tokenRef.current)
setReauthHandler(renewSession)
```

The token is read from a **ref, not from state**. The request interceptor runs
outside React's render cycle, so a closure over state would go stale. Every
path that changes the session (`applySession`, `signOut`) writes the ref
*before* calling `setSession`, which is why the ref never needs re-syncing
during render.

## Hydration

The session is read from storage in the `useState` initializer — synchronously,
during the first render. A returning user therefore never sees a login flash,
and `RequireAuth` needs no "checking…" state.

One decision at hydration: a token that is *already* expired is only kept if
credentials exist to replace it. Otherwise the session is cleared on the spot.

## Renewal, two paths

### Proactive

A timer fires **12 hours before expiry** (`REFRESH_LEAD_MS`). If the token is
already inside that window at mount, renewal runs immediately instead of
scheduling.

The same check re-runs on `visibilitychange` and `online`, which is what
matters on a phone — the tab sits backgrounded for days, and a timer that was
never going to fire is useless.

This path only arms itself when credentials are stored; without them there is
nothing to renew with.

### Reactive

**Kickbase answers `403` — not `401` — for a missing, invalid or expired
token.** `401` is used only for rejected login credentials. This was verified
directly: no header, a malformed token, an empty bearer and an expired-shaped
JWT all return `403`, while a valid token returns `200`.

That distinction matters, because a renewal path listening for `401` would
never fire.

```
403 (or 401) ─┬─ already retried?          → throw ApiError
              ├─ request carried no token? → throw ApiError
              └─ reauthHandler()
                   ├─ fresh token → stamp retriedAfterReauth, retry request
                   └─ null        → throw ApiError
```

A genuine permission `403` — a resource the account may not see — costs one
wasted renewal. That is an accepted trade-off: the retry is capped at one and
concurrent renewals are de-duplicated, so the worst case is a single extra
login call.

Two guards:

- **`retriedAfterReauth`** is stamped onto the request config, so a request
  retries at most once. No infinite loop if the new token is also rejected.
- **`renewalInFlight`** holds the in-flight promise in `AuthProvider`, so ten
  queries failing simultaneously produce **one** login call, not ten.

`isExpired()` also applies a 60 s skew, treating a token as dead slightly
early rather than racing the server clock.

## When the user gets signed out

| Situation | Result |
| --------- | ------ |
| 403 on an authenticated request, no stored credentials | Immediate `signOut()` |
| Renewal rejected 4xx (password changed, account disabled) | `signOut()` — it will never start working |
| Renewal fails on network or 5xx | Session **kept**; a Kickbase outage should not cost the session |
| Tab refocused with a dead token and no credentials | `signOut()` |
| User picks *Abmelden* | `signOut()` |

`signOut()` clears the token, the credentials, the remembered league, **and**
calls `queryClient.clear()` — so one account's cached data can never be shown
under the next.

## Storage

Four keys, all written through
[`lib/storage.ts`](../src/lib/storage.ts), a `localStorage` wrapper that never
throws. Safari in private mode and storage-blocking browser settings both
throw on plain access, which would otherwise kill the app at startup. Every
read returns `null` on failure; a `storageAvailable` flag lets the login form
warn about it.

| Key | Contents | Written | Cleared on sign-out |
| --- | -------- | ------- | ------------------- |
| `litbase.session.v1` | token, `expiresAt`, user | Always | Yes |
| `litbase.credentials.v1` | email + obfuscated password | Only when opted in | Yes |
| `litbase.lastLeagueId.v1` | Active league, for `/` | On every league mount | Yes |
| `litbase.lastEmail.v1` | Email only, no password | On sign-in and sign-up | **No** |

Sign-up always writes `credentials` (no opt-in); sign-in writes it only when
"Angemeldet bleiben" is ticked.

`lastEmail` deliberately survives sign-out — its whole purpose is to pre-fill
the login form on the *next* sign-in, so clearing it would defeat the point. It
holds no secret.

Session shape is validated on read; anything malformed is discarded rather
than trusted.

## Context surface

```ts
const {
  user,             // StoredUser | null
  isAuthenticated,
  isBusy,           // a sign-in or renewal is in flight
  expiresAt,        // epoch ms, or null
  isRemembered,     // credentials are stored
  signIn,           // ({ email, password, remember }) => Promise<void>
  signUp,           // ({ email, username, password }) => Promise<void>
  signOut,
} = useAuth()
```

[`useAuth()`](../src/auth/useAuth.ts) throws outside the provider. The context
object, the provider and the hook live in three separate files so Fast Refresh
stays happy.

`AuthProvider` **must** render inside `QueryClientProvider`, because signing
out clears the cache.

## Known gaps

**A failed renewal is not retried on a schedule.** If renewal fails with a 5xx
while online, the timer effect's dependencies have not changed, so no new timer
is armed. Recovery happens on the next focus or `online` event — fine in
practice on mobile, but a continuously-open desktop tab could sit unrenewed
until a request 403s and the reactive path takes over.

**Without "remember me", expiry is discovered lazily.** The proactive timer
does not arm, so a token expiring while the tab stays visible surfaces as a
failed request rather than a clean redirect. Refocusing the tab does catch it
and signs the user out properly.

**The password is recoverable from `localStorage`** whenever tier 2 is
enabled. See the note on obfuscation above. If this is unacceptable for a
deployment, the fix is to drop tier 2 and accept a login prompt every 7 days.

**`isBusy` is shared** between interactive sign-in and background renewal. It
currently only drives the login button's spinner, where no background renewal
can be running, so there is no visible conflict — but a future consumer should
not assume it means "the user is signing in".

**`chttkn` is parsed but unused.** Nothing needs chat.
