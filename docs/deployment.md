# Building and deploying

litbase is a folder of static files plus **one** server-side hop: a
pass-through proxy that forwards `/kb-api/*` to `api.kickbase.com`. The hop
exists because Kickbase stopped sending CORS headers in autumn 2026, so a
browser may no longer call the API from a page it did not serve. Nothing in it
is litbase's — no database, no session, no secret; the bearer token travels in
the `Authorization` header as before and the proxy only passes it on.

Two deployments are described here:

- **[Cloudflare Workers](#cloudflare-workers)** — the live one. The built
  bundle as static assets, the proxy as a Worker on the same origin.
- **[The nginx image](#build-the-image)** — the earlier container, kept
  intact. It serves the bundle but **does not proxy**, so until it gains a
  `proxy_pass` for `/kb-api` an image built from it cannot reach Kickbase.

## Build it

```bash
npm run build        # → dist/, typechecked first
npm run preview      # serve that build locally on http://localhost:4173
```

`npm run build` is `tsc -b && vite build`: the typecheck runs first and fails
the build, so a type error can never reach an image.

## Build the image

```bash
docker build -t litbase:latest .
docker run --rm -p 8080:8080 litbase:latest   # → http://localhost:8080
```

Nothing needs to be configured — the defaults in
[`src/lib/env.ts`](../src/lib/env.ts) point at the live Kickbase API and CDN.

Pointing it somewhere else is a **build** argument, not a runtime variable.
Vite inlines `import.meta.env` into the bundle, so the value is baked in when
the image is built and one image serves exactly one API target:

```bash
docker build \
  --build-arg VITE_API_BASE_URL=https://api.example.com \
  --build-arg VITE_CDN_BASE_URL=https://cdn.example.com \
  -t litbase:staging .
```

| Build arg | Default when empty |
| --------- | ------------------ |
| `VITE_API_BASE_URL` | `https://api.kickbase.com` |
| `VITE_CDN_BASE_URL` | `https://kickbase.b-cdn.net` |
| `VITE_FORECAST_BASE_URL` | `https://fundreas.github.io/litbase-foresight` |
| `VITE_POINTCAST_BASE_URL` | `https://fundreas.github.io/litbase-pointcast` |

`VITE_USE_DEV_PROXY` is deliberately not wired up: it only affects the Vite dev
server, which is not part of the image. See
[Configuration](infrastructure.md#configuration).

## What the image is

Two stages, ~63 MB in the end:

| Stage | Base | Does |
| ----- | ---- | ---- |
| `build` | `node:22-alpine` | `npm ci`, `npm run build`, then gzips the output |
| `runtime` | `nginx:1.29-alpine` | Serves `dist/` — no Node, no source, no `node_modules` |

Two details worth knowing:

- **Assets are pre-compressed at build time.** The build stage writes `.gz`
  siblings and nginx serves them with `gzip_static`, so no CPU is spent
  compressing the same immutable file on every request. The originals stay for
  clients that do not send `Accept-Encoding: gzip`.
- **The container runs as the unprivileged `nginx` user on port 8080.**
  [`nginx.conf`](../nginx.conf) keeps the pid file and every temp path under
  `/tmp` so nothing needs a writable `/var`. Map it wherever you like:
  `-p 80:8080`.

## What nginx does

[`nginx.conf`](../nginx.conf) replaces the stock config wholesale — one server
block, no `conf.d` include.

| Request | Response |
| ------- | -------- |
| `/assets/*` | The file, `Cache-Control: public, max-age=31536000, immutable` |
| `/assets/*` (missing) | `404` — a miss there is a broken build, not a route |
| `/favicon.svg` and other unhashed static files | The file, cached one week |
| `/index.html` | `Cache-Control: no-cache` |
| Any other path | `/index.html`, also `no-cache` |
| `/healthz` | `200 ok`, unlogged — and the image's `HEALTHCHECK` |

The last two rows are what makes client-side routing work: a hard refresh on
`/leagues/42/squad` has no file to match, so nginx hands back the app shell and
[the router](routing-and-layout.md) resolves the path in the browser.

The caching split is the point of the whole config. Vite writes a content hash
into every filename under `/assets/`, so those files can be cached forever and
never revalidated; `index.html` is the one file whose name is stable, and
caching it would hide a deploy until browsers gave up on their copy.

Cache-Control is set from a single `map` on `$uri` rather than per-location
`add_header` directives, because an `add_header` inside a `location` silently
drops every header inherited from the server block — the security headers
(`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) included.

Access logs go to stdout, errors to stderr, which is what `docker logs` and
every log collector expect.

## The build context

[`.dockerignore`](../.dockerignore) is an **allowlist**: it ignores `*` and then
names the handful of paths the build needs. The repo holds files that must
never enter an image layer — `.env`, `apf.env`, `kickbase-api.md` with its live
bearer tokens — and those are only gitignored, so they do sit on disk next to
everything else. Denylisting them would work until someone adds a new one and
forgets. Allowlisting fails safe instead.

Adding a file the build needs — a new config at the repo root, say — means
adding a `!` line for it.

## Running it somewhere

- **TLS belongs upstream** (ingress, reverse proxy, load balancer). The image
  speaks plain HTTP on 8080 and does not redirect.
- **API proxying is needed, and this image does not do it.** Kickbase sends
  no CORS headers, so the browser cannot call it directly from a page served
  here. The bundle would have to be built with `VITE_API_BASE_URL=/kb-api` and
  nginx would need a `location /kb-api/ { proxy_pass https://api.kickbase.com/; }`
  mirroring [`worker/index.ts`](../worker/index.ts). Neither is wired up yet.
- **The app must be served from the domain root.** No `base` is set in
  [`vite.config.ts`](../vite.config.ts), so hosting it under a sub-path would
  need that plus a matching nginx `root`.
- `HEALTHCHECK` polls `/healthz` every 30s; orchestrators that do their own
  probing can point liveness and readiness at the same path.

## Cloudflare Workers

The live deployment. One Cloudflare project holds both halves — the static
bundle and the proxy — and the browser sees a single origin, so CORS never
comes up. It costs nothing: static-asset requests are unmetered, Worker
invocations are free to a hundred thousand a day, and a Worker has no cold
start to speak of.

### The pieces

| File | Does |
| ---- | ---- |
| [`worker/index.ts`](../worker/index.ts) | The proxy: forwards `/kb-api/*` to `https://api.kickbase.com/*`, status and body untouched |
| [`wrangler.jsonc`](../wrangler.jsonc) | Names the Worker, points the asset layer at `dist/`, routes the prefix to the Worker first |
| [`public/_headers`](../public/_headers) | Cache and security headers for the asset layer — the same policy as [`nginx.conf`](../nginx.conf) |
| [`tsconfig.worker.json`](../tsconfig.worker.json) | Typechecks the Worker against the Workers runtime instead of the DOM; referenced from `tsconfig.json`, so `npm run check` covers it |
| [`.github/workflows/deploy-cloudflare.yml`](../.github/workflows/deploy-cloudflare.yml) | Builds and deploys on every push to the `cloudflare` branch |

### How a request travels

1. The bundle is built with `VITE_API_BASE_URL=/kb-api` (`npm run build:cf`),
   so the axios instance in [`src/api/client.ts`](../src/api/client.ts) has a
   **relative** base URL. Nothing else in the app changes; see
   [Configuration](infrastructure.md#configuration).
2. The browser requests `/kb-api/v4/leagues/…` from its own origin. The asset
   layer would normally answer first, but `run_worker_first` in
   `wrangler.jsonc` hands that prefix to the Worker.
3. The Worker strips the prefix, forwards the method, the body and exactly
   four request headers — `authorization`, `content-type`, `accept`,
   `accept-language` — and sets its own `user-agent`. An allowlist, so cookies
   and Cloudflare's own headers never go upstream. `accept-language` is on it
   because Kickbase localises prose by it (the injury reasons).
4. Kickbase's status and body come back as they are — the app's 403-means-
   dead-token handling depends on seeing the real code — under a rebuilt
   header set: `content-type` from upstream plus `cache-control: no-store`.

Every other path is a static file or, when no file matches, `index.html`
with a real **200** (`not_found_handling: single-page-application`). That
retires the GitHub Pages trick of copying the shell to `404.html`.

### What keeps it from being a free proxy for everyone

Not much, deliberately — the alternative is a login of litbase's own, which
would be a backend. Two things:

- The upstream host is a constant. The Worker reaches `api.kickbase.com` and
  nothing else.
- A request carrying an `Origin` header that is not the Worker's own origin
  is answered **403**. Browsers send `Origin` on every cross-site request, so
  another website cannot embed this proxy as its own. A request with no
  `Origin` — curl, or the app's own same-origin GETs — passes. So a script
  can still call Kickbase through it; what it gets is exactly what it would
  get calling Kickbase directly, with a bearer token it already has.

The one thing to keep an eye on: Kickbase sits behind Cloudflare too, and
the proxy moves traffic from residential browser IPs to Cloudflare's own
egress. If Kickbase ever challenges non-browser traffic, this is where it
would show, as proxied calls failing while the official app works.

### Build and run it locally

```bash
npm run build:cf     # dist/, with /kb-api as the API base
npm run cf:dev       # the Worker + dist/ on http://localhost:8787, no login needed
```

`cf:dev` runs the real Workers runtime locally and needs no Cloudflare
account, so the whole deployment can be exercised before one exists:

```bash
curl -i http://localhost:8787/kb-api/v4/competitions                       # 200, JSON from Kickbase
curl -i -H 'Origin: https://evil.example' http://localhost:8787/kb-api/v4/competitions   # 403
curl -i http://localhost:8787/leagues/1/squad                              # 200, index.html
```

Day-to-day development does not go through the Worker. `npm run dev` uses
the Vite dev server's proxy for the same prefix — set
`VITE_USE_DEV_PROXY=true` and `VITE_API_BASE_URL=/kb-api` in `.env.local` —
which is the same hop in Node instead of workerd. Wrangler requires Node 22;
`nvm use` picks it from [`.nvmrc`](../.nvmrc).

### Deploying

By hand, once `npx wrangler login` has been run on the machine:

```bash
npm run cf:deploy    # build:cf, then wrangler deploy
```

Or from GitHub: the workflow runs on every push to the `cloudflare` branch
(and from the Actions tab) once two repository secrets exist. The comment
header in [`deploy-cloudflare.yml`](../.github/workflows/deploy-cloudflare.yml)
says where each comes from:

| Secret | What it is |
| ------ | ---------- |
| `CLOUDFLARE_API_TOKEN` | An API token with *Workers Scripts: Edit* and *Account Settings: Read* |
| `CLOUDFLARE_ACCOUNT_ID` | The account id from the dashboard |

The deploy prints the `*.workers.dev` URL. A custom domain is attached in
the dashboard under the Worker's settings and needs no change here — the app
is served at the root either way, so no `--base` flag is involved, unlike
the Pages deploy.
