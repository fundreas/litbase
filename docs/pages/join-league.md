# Join a league

[← Back to index](../README.md) · Route `/join` ·
[`src/pages/JoinLeaguePage.tsx`](../../src/pages/JoinLeaguePage.tsx)

Browse, filter and search leagues, then join one through a confirmation
dialog.

## Why `/join` and not `/leagues/join`

Two reasons:

- **Joining is not league-scoped.** A user with no leagues has to reach it,
  so it cannot live under `LeagueProvider`, which requires a valid
  `:leagueId`.
- **`/leagues/join` would sit next to `/leagues/:leagueId`.** React-router
  ranks static segments above dynamic ones so it would in fact resolve, but
  relying on that when a collision-free path exists is a needless trap.

It renders outside `AppShell` — full-screen, with its own back button — since
there is no league context to fill a header with.

## How it is reached

| From | Affordance |
| ---- | ---------- |
| [League gate](league-gate.md) | Primary **Liga beitreten** button on the "no leagues" state |
| Nav drawer | **Liga beitreten** entry below the separator |

The drawer entry matters: a user who already has a league never sees
`/leagues`, so the gate's button alone would leave the page unreachable for
everyone except brand-new accounts. It is declared directly in
[`NavDrawer`](../../src/components/layout/NavDrawer.tsx) rather than in
[`navigation.ts`](../../src/components/layout/navigation.ts), because every
entry there is built from the `/leagues/:leagueId/...` pattern that this route
deliberately does not follow.

## Tabs

Radix Tabs, so arrow-key navigation and the ARIA wiring come for free.

| Tab | Source | Behaviour |
| --- | ------ | --------- |
| **Empfohlen** | `GET /v4/leagues/recommended` | Loads on open |
| **Alle** | `GET /v4/leagues/list` | Loads on open; competition and game-mode chips refine it |
| **Suche** | `GET /v4/leagues/list?query=…` | Idle until submitted |

The search tab keeps a `draft` and a `submitted` term separately, and the
query is `enabled` only once something has been submitted — so typing costs no
requests, matching the "on submit load the leagues" requirement.

## The two response shapes

This is the one genuinely awkward part of the API, and the reason
`JoinableLeague` exists.

| | `/recommended` | `/list` |
| --- | --- | --- |
| League id | `i` | `li` |
| Competition | `cpn` — the **name** | `cpi` — the **id** |
| Game mode | absent | `gpm` |
| Manager cap | absent | `mgm` |
| Members | `m[]` with avatars | absent |
| Competition icon | absent | `cpim` |

Both map into one `JoinableLeague` with optional fields. Because `/list` gives
only an id, the page resolves competition names against
[`useCompetitions()`](../../src/api/hooks/useJoinableLeagues.ts) at render
time; `/recommended` needs no lookup.

## Filters

**Confirmed by probing.** The parameters are **camelCase**:

| Parameter | Effect |
| --------- | ------ |
| `query` | Name search |
| `competitionId` | Restrict to one competition |
| `gamePlayMode` | Restrict to one game mode |

All three combine. The trap worth knowing: the wire-style spellings — `cpi`,
`gpm`, `gameMode` — are **silently ignored**, returning the unfiltered list
rather than an error. A typo here does not fail; it just quietly stops
filtering.

Competition chips come from `GET /v4/competitions` (Bundesliga, 2. Bundesliga,
La Liga, GP Frauen-Bundesliga, DFB-Pokal, MLS).

Game-mode chips are hardcoded, because **nothing in the API names them**.
Probing `gamePlayMode` showed four values that return results — `3` is empty
and `5` is ignored — and the labels are inferred from the league names each
one returns:

| Value | Label | Inferred from |
| ----- | ----- | ------------- |
| `1` | Klassisch | The default Kickbase mode |
| `4` | Arena | "KickbaseKis Arena" etc. |
| `2` | High-Management | "High-Management" |
| `0` | Anfänger | "liga Anfänger" |

Treat these labels as a best guess, not documented fact.

Chips are single-select with a toggle-off: tapping the active chip clears that
filter, and an explicit **Alle** chip does the same. They scroll horizontally
inside their own `overflow-x-auto` container, so a dozen competitions never
make the page scroll sideways.

## Result rows

Each row shows what the response actually gives:

- League image (`lim`), falling back to initials.
- Name, with a check badge when `isvf` is set.
- Competition name and game mode, joined by `·`, omitting whatever is absent.
- Manager count, and `/ limit` when `mgm` is present.
- Up to three member avatars, overlapping — `/recommended` only.

Rows are `<button>` elements, not divs with click handlers, so they are
keyboard- and screen-reader-operable for free.

## Joining

Tapping a row opens
[`ConfirmDialog`](../../src/components/ui/ConfirmDialog.tsx) — bottom sheet on
phones, centred from `sm` up. Confirming issues:

```
POST /v4/leagues/{leagueId}/join      (no request body)
```

On success the mutation invalidates `qk.leagues.all` (membership changed) and
`qk.joinable.all` (the browsable lists now contain a league the user is in),
then the page navigates to `/leagues/{id}/dashboard` with `replace`.

Errors render inside the dialog rather than replacing the page, so the user
keeps their place in the list. A league that has vanished comes back as
`{"err":2,"errMsg":"NotFound"}` — **as HTTP 500**, like Kickbase's other
semantic errors — and is mapped to *"Diese Liga gibt es nicht mehr."* See
[API layer](../api-layer.md#error-normalisation).

## Verified, and not

**Verified against the live API:** both list endpoints and their shapes, the
competitions list, every filter combination the UI can produce (each one
narrows correctly), and the join endpoint's CORS preflight and its error
response for a nonexistent league.

**Not verified:** a *successful* join. Confirming it would mean actually
joining a real league with a real account. The code is written not to depend
on the success body — the response is discarded, and only the fact that it
resolved is used — so the unknown is contained. But the happy path has not
been executed.

Also unconfirmed: `hum` on list items (true on arena leagues, meaning unknown)
and `vft`, the verification tier. Neither is rendered.

## Possible extensions

- Pagination. `/list` returns ~20–25 items with no visible cursor parameter;
  none was found, so the list is currently whatever the server returns.
- Debounced live search instead of submit-to-search, now that the endpoint is
  known to be cheap.
- Surface `hum` and `vft` once their meaning is established.
- A "leave league" counterpart — endpoint not yet probed.
