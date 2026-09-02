# Building and deploying

litbase has no backend of its own — the browser talks to `api.kickbase.com`
directly — so a deployment is a folder of static files plus something that
serves them. That something is nginx, packaged by the
[`Dockerfile`](../Dockerfile) at the repo root.

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
- **No API proxying is needed.** Kickbase reflects `Access-Control-Allow-Origin`
  for any origin, so the browser calls it directly from whatever host serves
  the app. There is no server-side hop to configure and no secret in the image.
- **The app must be served from the domain root.** No `base` is set in
  [`vite.config.ts`](../vite.config.ts), so hosting it under a sub-path would
  need that plus a matching nginx `root`.
- `HEALTHCHECK` polls `/healthz` every 30s; orchestrators that do their own
  probing can point liveness and readiness at the same path.
