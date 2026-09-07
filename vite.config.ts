import { createReadStream } from 'node:fs'
import { cp, stat } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * Serve and ship the repo's `data/` folder at `/data/`.
 *
 * These are the **matchday-ranking files** — the app's own rankings for every
 * matchday but the current one, since Kickbase serves only the current one.
 * They are written by `scripts/build-matchday-rankings.mjs`, committed, and
 * read back over `fetch` at runtime.
 *
 * Not `public/`, deliberately. `public/` is for things the *app* is made of —
 * the icon, the manifest — copied in without anyone thinking about them. This
 * is a data set with its own build step, its own refresh cadence and its own
 * size, and burying it in `public/data/` would hide all three. A dozen lines
 * here is the price of `data/` being a folder somebody can find.
 *
 * Copying in `closeBundle` rather than emitting rollup assets keeps the URLs
 * literal: no content hash, no manifest, so the app can build the path for a
 * matchday it has never seen. That is the whole point — a file added by
 * tonight's run has to be reachable by a bundle built last week.
 */
function dataFolder(): Plugin {
  let dataDir = ''
  let outDir = ''

  return {
    name: 'litbase:data-folder',

    configResolved(config) {
      dataDir = resolve(config.root, 'data')
      outDir = resolve(config.root, config.build.outDir)
    },

    configureServer(server) {
      // Mounted on the prefix, so connect hands the handler a path already
      // stripped of it — `/rankings/1/matchday-1.json`.
      server.middlewares.use('/data', (request, response, next) => {
        const path = (request.url ?? '/').split('?')[0]
        const file = resolve(dataDir, `.${path}`)

        // A `..` in the URL must not walk out of the folder. Everything under
        // `data/` is public by construction; everything else is not ours to
        // serve.
        if (!file.startsWith(dataDir + sep)) {
          next()
          return
        }

        stat(file)
          .then((stats) => {
            if (!stats.isFile()) {
              next()
              return
            }
            response.setHeader(
              'Content-Type',
              'application/json; charset=utf-8',
            )
            createReadStream(file).pipe(response)
          })
          .catch(() => {
            next()
          })
      })
    },

    async closeBundle() {
      // A checkout with no rankings yet still builds — the app treats a
      // missing file as "not seeded", which is the same thing it has to
      // handle for a matchday nobody has run the script for.
      try {
        await cp(dataDir, join(outDir, 'data'), { recursive: true })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  // The Kickbase API reflects CORS headers for any origin, so the browser can
  // talk to it directly. The proxy is a fallback for the day that changes:
  // set VITE_USE_DEV_PROXY=true and VITE_API_BASE_URL=/kb-api.
  const useDevProxy = env.VITE_USE_DEV_PROXY === 'true'

  // `npm run dev:live` is nothing more than `--mode live`, which the app reads
  // back as `import.meta.env.MODE` to switch the matchday simulation on — see
  // `src/dev/simulation.ts`. The mode is carried rather than a variable set so
  // that the profile needs no `.env` file: every `.env*` here is gitignored as
  // a secret, and a shared dev profile should not be a file each of us has to
  // recreate. `loadEnv` above still picks up a personal `.env.live.local` for
  // anyone who wants to pin a particular matchday.

  return {
    plugins: [react(), tailwindcss(), dataFolder()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      // Split the dependencies that never change away from app code, so a
      // deploy only invalidates the small chunks.
      rolldownOptions: {
        output: {
          advancedChunks: {
            groups: [
              {
                name: 'react',
                test: /node_modules\/(react|react-dom|scheduler)\//,
              },
              { name: 'router', test: /node_modules\/react-router/ },
              { name: 'query', test: /node_modules\/@tanstack/ },
              { name: 'radix', test: /node_modules\/@radix-ui/ },
              { name: 'vendor', test: /node_modules/ },
            ],
          },
        },
      },
    },
    server: {
      // Reachable from a phone on the same network: `npm run dev:host`. Only
      // the interface changes there — the port below applies to both scripts.
      port: 3011,
      // Fail rather than hunt for a free port. Vite's default is to step to
      // 3012, 3013, … on a collision, which quietly hands out a URL nobody is
      // expecting when an earlier `npm run dev` is still running.
      strictPort: true,
      proxy: useDevProxy
        ? {
            '/kb-api': {
              target: 'https://api.kickbase.com',
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/kb-api/, ''),
            },
          }
        : undefined,
    },
  }
})
