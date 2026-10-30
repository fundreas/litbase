/**
 * The Cloudflare Worker: a same-origin bridge to the Kickbase API.
 *
 * Kickbase stopped sending CORS headers in autumn 2026, so a browser may no
 * longer call `api.kickbase.com` from a page it did not serve. This Worker
 * sits on the app's own origin and forwards everything under `/kb-api/` to
 * Kickbase — the browser talks to itself, and CORS never enters into it.
 *
 * It holds no state and no secret. The bearer token travels in the
 * `Authorization` header exactly as it did when the browser called Kickbase
 * directly; the Worker only passes it on. Every other path is served from the
 * static assets configured in `wrangler.jsonc`, and never reaches this code.
 */

const UPSTREAM = 'https://api.kickbase.com'
const PREFIX = '/kb-api'

/**
 * The only request headers that go upstream. An allowlist, not a denylist:
 * cookies, Cloudflare's own `cf-*` headers and whatever a browser adds
 * tomorrow stay on this side. `accept-language` matters — Kickbase localises
 * the prose it serves (the injury reasons above all), and the app asks for
 * German; see the axios instance in `src/api/client.ts`.
 */
const FORWARDED_REQUEST_HEADERS = [
  'authorization',
  'content-type',
  'accept',
  'accept-language',
] as const

const USER_AGENT = 'litbase/1.0 (+https://github.com/fundreas/litbase)'

const BODYLESS_METHODS = new Set(['GET', 'HEAD'])

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // `run_worker_first` only routes the prefix here, so anything else is a
    // misconfiguration rather than a page — say so instead of falling through.
    if (url.pathname !== PREFIX && !url.pathname.startsWith(`${PREFIX}/`)) {
      return new Response('Not found', { status: 404 })
    }

    // A browser sends `Origin` on every cross-site request and on every
    // same-site request that is not a plain GET. One that names a different
    // site is a page somewhere else using this proxy as its own, which is the
    // one abuse a free relay to Kickbase invites and the one this check can
    // stop. A request with no `Origin` at all (curl, a same-origin GET) is
    // deliberately let through — the app itself sends those.
    const origin = request.headers.get('origin')
    if (origin !== null && origin !== url.origin) {
      return new Response('Forbidden', { status: 403 })
    }

    const target = new URL(
      url.pathname.slice(PREFIX.length) + url.search,
      UPSTREAM,
    )

    const headers = new Headers()
    for (const name of FORWARDED_REQUEST_HEADERS) {
      const value = request.headers.get(name)
      if (value !== null) headers.set(name, value)
    }
    headers.set('user-agent', USER_AGENT)

    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: BODYLESS_METHODS.has(request.method) ? undefined : request.body,
      redirect: 'manual',
    })

    // Status and body pass through untouched — the app's error handling reads
    // Kickbase's own codes (403 for a dead token, 401 for bad credentials) and
    // must keep seeing them. Response headers are rebuilt rather than copied:
    // `content-type` is the one the app needs, and `no-store` keeps a bearer-
    // scoped answer out of every cache between here and the phone.
    const responseHeaders = new Headers({ 'cache-control': 'no-store' })
    const contentType = upstream.headers.get('content-type')
    if (contentType !== null) responseHeaders.set('content-type', contentType)

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    })
  },
} satisfies ExportedHandler
