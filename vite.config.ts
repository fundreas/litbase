import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  // Kickbase stopped sending CORS headers in autumn 2026, so the browser can
  // no longer talk to the API from a page it did not serve. In production the
  // Cloudflare Worker in `worker/index.ts` bridges `/kb-api` to it; this is
  // the dev-server equivalent of that hop. Set VITE_USE_DEV_PROXY=true and
  // VITE_API_BASE_URL=/kb-api in `.env.local` and `npm run dev` goes through
  // it — same prefix, same upstream, so the two never disagree.
  const useDevProxy = env.VITE_USE_DEV_PROXY === 'true'

  // `npm run dev:live` is nothing more than `--mode live`, which the app reads
  // back as `import.meta.env.MODE` to switch the matchday simulation on — see
  // `src/dev/simulation.ts`. The mode is carried rather than a variable set so
  // that the profile needs no `.env` file: every `.env*` here is gitignored as
  // a secret, and a shared dev profile should not be a file each of us has to
  // recreate. `loadEnv` above still picks up a personal `.env.live.local` for
  // anyone who wants to pin a particular matchday.

  return {
    plugins: [react(), tailwindcss()],
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
