# Einstellungen

[← Back to index](../README.md)

```
/leagues/:leagueId/preferences
```

[`PreferencesPage`](../../src/pages/PreferencesPage.tsx) — the two things the
reader gets to decide about the app itself: **where the menu shortcut sits**,
and **which palette is painted**. It is the first page in litbase that is
about the reader rather than about the league, and the list is expected to
grow.

## Getting there

The **avatar in the header**, top right, above *Neu laden* and *Abmelden*. That
menu is everything about the account and the person; the drawer, the sidebar
and the dots sheet are lists of the league's pages, and a settings row among
them would be one more entry between a thumb and *Mannschaft* — exactly the
reach the dots exist to shorten.

So this page has **no entry in `NAV_ITEMS`** and lights none, like
[Liga](league.md) and [Was wäre wenn](whatif.md). Its way in is the thing that
names it: a face in the corner.

## Why the URL carries a league id

Nothing on this page is league-scoped, and `/leagues/:leagueId/preferences`
says otherwise. The alternative was a route beside `/join`, outside
[`LeagueProvider`](../../src/league/LeagueProvider.tsx) — and everything that
makes a screen part of this app is built from a league: the header's
switcher, the drawer, the dots sheet, the way back. A settings page there
would be a page with no chrome at all.

[Liga](league.md) sits in the same place for the same reason. The cost is an
id in a URL nobody types, which resolves correctly from whichever league you
happen to be in. The cost of the other choice is a page that looks like it
fell out of the app.

## The settings

| Setting | Values | Default |
| ------- | ------ | ------- |
| **Menü-Kürzel** | `left` · `right` · `hide` | `right` |
| **Erscheinungsbild** | `light` · `dark` · `system` | `dark` |

Each is a [`PreferenceChoice`](../../src/components/preferences/PreferenceChoice.tsx):
one row of segments with every answer visible, a real `radiogroup` with arrow
keys and `aria-checked`, and **one line of explanation under the chosen
segment only** — three-word answers do not need three permanent captions, and
the line doubles as confirmation that the tap landed.

There is **no save button**. Each choice changes the app under the reader's
finger — the theme repaints, the dots move — and that is the confirmation an
*Übernehmen* would be asking for a second tap to provide.

### Menü-Kürzel

One setting for both shapes the [dots menu](../routing-and-layout.md#the-dots-in-the-corner)
takes: the cell at the end of a page's own `BottomTabBar`, and the floating
button on the pages that dock no bar. They are one thing to the reader, and a
preference that moved only one of them would put the shortcut in a different
corner depending on which page you were on — the exact inconsistency the
shortcut was built to remove.

`left` mirrors the cell as well as moving it: the divider that fences the dots
off from the page's own tabs swaps sides, so the dots stay against the edge of
the screen, and the sheet grows out of the left corner (`origin-bottom-left`)
instead of the right.

`hide` renders neither. It is not a way of losing the navigation — the drawer
behind the header's hamburger is the complete surface and always was — it is a
way of giving the corner back, which is worth something on the pages that
claim the window's leftover height for a pitch. The hint under the segment
says so, because a hidden navigation shortcut has to name where navigation
went.

### Erscheinungsbild

`light` and `dark` override; `system` follows the OS and says which way it is
currently leaning, because that is the one option whose result is not written
on its own button.

How the palettes are built, and why the theme is resolved in script rather
than by a media query in CSS, is
[Two palettes](../infrastructure.md#two-palettes) in Infrastructure.

## Where the settings live

`localStorage`, one object under `litbase.preferences.v1`, through the
non-throwing wrapper in [`lib/storage.ts`](../../src/lib/storage.ts) — so a
browser with storage blocked still runs, it simply forgets. The page says so
in a warning when `storageAvailable` is false, the same way the login form
does.

Nothing reaches the network: Kickbase has no notion of a litbase preference,
so a second device starts on the defaults. The footnote under the cards says
that plainly rather than leaving it to be discovered on the second device.

Reading is deliberately **forgiving**: each field is validated on its own and
falls back to its default, so a value written by another build costs that one
setting rather than all of them, and a field added later reads as its default
in a browser that has never seen it. That is what keeps the `v1` in the key
from turning over every time the list grows — it only has to change if a
field's *meaning* does.

## Adding one

1. A field on `Preferences` in
   [`preferences.ts`](../../src/preferences/preferences.ts), with its allowed
   values as a `const` tuple and an entry in `DEFAULT_PREFERENCES`.
2. Read it in `loadPreferences` through `oneOf`, so an unknown value falls
   back rather than reaching the app.
3. A `<PreferenceChoice>` on this page, wired to
   `setPreference('yourField', …)`.
4. Read it wherever it applies with `usePreferences()`.

Nothing else — no context method, no new storage key, no migration.

## Related

- [Routing and layout](../routing-and-layout.md#the-dots-in-the-corner) — the
  shortcut this page moves.
- [Infrastructure](../infrastructure.md#two-palettes) — the palettes, the
  tokens and the pre-paint boot script.
