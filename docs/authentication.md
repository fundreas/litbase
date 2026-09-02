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
| 2 | Credentials | Opt-in checkbox | Silent renewal past the 7-day expiry |

Tier 1 is the safe default and handles the common case entirely. Tier 2 is
what the "Angemeldet bleiben" checkbox on the login form controls, and it
means **a password sits in `localStorage`** — so it is off by default and the
trade-off is spelled out in the form itself, not buried.

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

Any 401 hits the response interceptor:

```
401 ─┬─ already retried?        → throw ApiError
     ├─ was a skipAuth request? → throw ApiError
     └─ reauthHandler()
          ├─ fresh token → stamp retriedAfterReauth, retry the same request
          └─ null        → throw ApiError
```

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
| 401, no stored credentials | Immediate `signOut()` |
| Renewal rejected 4xx (password changed, account disabled) | `signOut()` — it will never start working |
| Renewal fails on network or 5xx | Session **kept**; a Kickbase outage should not cost the session |
| Tab refocused with a dead token and no credentials | `signOut()` |
| User picks *Abmelden* | `signOut()` |

`signOut()` clears the token, the credentials, the remembered league, **and**
calls `queryClient.clear()` — so one account's cached data can never be shown
under the next.

## Storage

Three keys, all written through
[`lib/storage.ts`](../src/lib/storage.ts), a `localStorage` wrapper that never
throws. Safari in private mode and storage-blocking browser settings both
throw on plain access, which would otherwise kill the app at startup. Every
read returns `null` on failure; a `storageAvailable` flag lets the login form
warn about it.

| Key | Contents | Written |
| --- | -------- | ------- |
| `litbase.session.v1` | token, `expiresAt`, user | Always |
| `litbase.credentials.v1` | email + obfuscated password | Only when opted in |
| `litbase.lastLeagueId.v1` | Active league, for `/` | On every league mount |

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
until a request 401s and the reactive path takes over.

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
