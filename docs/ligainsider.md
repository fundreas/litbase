# ligainsider — the link out

[ligainsider.de](https://www.ligainsider.de/) writes up what Kickbase does not:
injuries, line-up hints, transfer talk, one page per player and a news page per
club. The player and club pages of this app each end in a row that links there.

```
https://www.ligainsider.de/michael-olise_37170/            ← a player's page, news included
https://www.ligainsider.de/fc-bayern-muenchen/1/verein/news/  ← a club's news
```

| | |
| --- | --- |
| Table | [`public/ligainsider.json`](../public/ligainsider.json), shipped with the app |
| Built by | `npm run ligainsider` — [`scripts/ligainsider/build.mjs`](../scripts/ligainsider/build.mjs) |
| Read by | [`useLigainsider`](../src/api/hooks/useLigainsider.ts), rendered by [`LigainsiderLink`](../src/components/LigainsiderLink.tsx) |
| Refresh | By hand, after a transfer window — see [Keeping it current](#keeping-it-current) |

## Why a link, and not the news

The news itself was the first idea: fetch the player's page, take the titles,
show them in a tab. It cannot be done from this app, and the reason is worth
writing down so it is not tried again.

**ligainsider sends no CORS headers.** A browser on `fundreas.github.io` may
*send* a request to `ligainsider.de`, but it hands the response to the page
only if that response carries `Access-Control-Allow-Origin` — and only the
answering server can put it there. ligainsider does not (its pages, its CDN and
its internal `apiesi` endpoints were all probed), so the browser discards the
HTML before any script sees it. Nothing on the Pages side can change that: the
header has to come from the site being read. Kickbase's API works directly for
exactly this reason — it reflects any origin.

So reading ligainsider needs something that is not a browser between the two:
a scheduled scrape in CI writing a JSON next to the app (stale by an hour), a
Worker of one's own (live, but the project's first piece of infrastructure), or
a public CORS proxy (somebody else's server, somebody else's uptime). None of
that is worth a tab of headlines when a tap on a link lands the reader on the
very page the headlines are on. The link is the cut that keeps everything in
this repository.

## The table

```json
{
  "generatedAt": "2026-10-09T16:40:00.000Z",
  "baseUrl": "https://www.ligainsider.de",
  "teams":   { "2":    { "id": "1",     "path": "fc-bayern-muenchen/1", "name": "FC Bayern München" } },
  "players": { "8329": { "id": "37170", "path": "michael-olise_37170" } }
}
```

Keys are **Kickbase ids**; `path` is what hangs off `baseUrl`. The hook turns
each entry into one absolute URL — a player's page as it is, a club's with
`verein/news/` appended, because a player's news is on his own page and a
club's is one page further in. Everything else in the file is for reading the
file, not for the app.

The row renders only for an id the table knows. A player the script could not
place, or a league in a competition ligainsider does not cover, gets no row at
all rather than a row saying so.

## How it is built

Neither site knows the other's ids, so the script joins them by **name within
club**.

1. **Kickbase's side** is the pointcast player index,
   [`/v1/players/index.json`](https://fundreas.github.io/litbase-pointcast/v1/players/index.json):
   every Bundesliga player's id, last name and club id, with no token and no
   league. (It lists the players the model predicts for, which is every one
   with a market value — a youth keeper on his first day may be missing.)
2. **ligainsider's side** is the eighteen squad pages. The Bayern page is a
   fixed seed; the other seventeen are discovered from the club navigation on
   it, so a promoted club turns up by itself.
3. **Clubs are paired** by how many last names their squads share, greedily
   from the largest overlap down, each ligainsider club taken once. A pairing
   under eight shared names fails the run rather than being guessed. In
   practice every club pairs on 21 to 29 of its names.
4. **Within a pair**, the Kickbase last name is matched against the *end* of
   the ligainsider full name, both folded to plain ASCII (`Pavlović` →
   `pavlovic`, `Đurić` → `duric`). `diaz` fits `luisdiaz`; `kim` does not fit
   `joshuakimmich`. A name that fits nobody is tried once more as a whole
   *word* anywhere in the name, which is what places `Minjae` on `Minjae Kim`
   and `Amaimouni` on `A. Amaimouni-Echghouyab`.
5. **What is left** is printed, and settled by hand in
   [`overrides.json`](../scripts/ligainsider/overrides.json): a Kickbase id
   to a ligainsider id. Two brothers at one club (`El Mala`), two players of
   one surname (`Becker` at Schalke, `Friedrich` at Union), and the few spelt
   differently on the two sites (`Konoplia` / `Konoplya`, `Castello Jr.` /
   `Castello Lukeba`).

**Not the `<title>`.** The squad pages' `<title>`, `og:title` and canonical
link name the *wrong club* on most of them — eight came back as "VfL
Wolfsburg", the Augsburg page is titled "Eintracht Frankfurt" — presumably a
server-side cache keyed on something other than the club. The body is right,
so the club's name is read from the heading in it, and the players from their
links.

The script fetches with half a second between squad pages and a user agent
that names this repository. `robots.txt` disallows nothing.

## Keeping it current

The table goes stale at the two transfer windows and whenever a youth player is
promoted. Re-run it, read the lines it prints, add overrides for anything it
could not place, and commit the file:

```
npm run ligainsider
```

A run that finds the markup changed — a squad page with fewer than fifteen
players, a navigation with other than eighteen clubs, a club that pairs badly —
exits non-zero and writes nothing, so a broken run cannot replace a good file
with an empty one.
