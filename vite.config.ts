import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  // The Kickbase API reflects CORS headers for any origin, so the browser can
  // talk to it directly. The proxy is a fallback for the day that changes:
  // set VITE_USE_DEV_PROXY=true and VITE_API_BASE_URL=/kb-api.
  const useDevProxy = env.VITE_USE_DEV_PROXY === 'true'

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
