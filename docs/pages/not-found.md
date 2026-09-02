# Not found

[← Back to index](../README.md) · Route `*` ·
[`src/pages/NotFoundPage.tsx`](../../src/pages/NotFoundPage.tsx)

The catch-all for unmatched URLs.

## Layout

```
        404
  Diese Seite gibt es nicht.

    [ Zur Startseite ]
```

Full-height centred column. The link goes to `/`, which resolves to the user's
league — see
[Routing](../routing-and-layout.md#landing-without-a-league).

## Why it renders outside the app shell

The `*` route is declared at the **top level** of the route table, as a
sibling of `RequireAuth` rather than a child of it. Two consequences:

- **No auth guard.** A signed-out user hitting a bad URL sees the 404, not a
  redirect to `/login`. That is the honest answer: the URL is wrong regardless
  of who is asking, and bouncing them to a login form for a typo would be
  misleading.
- **No header or drawer.** There is no `:leagueId` in the URL, so
  there is no league context to populate them with.

Note this only catches URLs that match nothing. A *valid* shape with a bad
league id — `/leagues/999999/dashboard` — is handled by
[`LeagueProvider`](../../src/league/LeagueProvider.tsx) instead, which
redirects to `/leagues` and forwards on to a real league. Users effectively
never reach this page from a stale league bookmark.

## Implementation note

The action is a styled react-router `<Link>`, not a `<Button>` wrapping one.
[`Button`](../../src/components/ui/Button.tsx) renders a real `<button>` and
has no `asChild` polymorphism, so nesting a link inside it would produce
invalid markup and a control that is a button to assistive technology but
navigates like a link.

If more places need button-styled links, the fix is to add Radix's `Slot` to
`Button` for an `asChild` prop — not to nest the elements.

## Possible extensions

- Adopt react-router's `errorElement` so thrown route errors land here too,
  rather than only unmatched paths. Today, render-time crashes inside a page
  are caught by
  [`RouteErrorBoundary`](../../src/components/RouteErrorBoundary.tsx) within
  the shell, which is the better place for them — this would only cover errors
  thrown outside it.
