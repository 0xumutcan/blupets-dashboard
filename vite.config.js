import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { priceColors } from './server/price.mjs'

// Server-side price endpoint (keeps the OpenSea key off the client).
function priceApi() {
  return {
    name: 'price-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url.startsWith('/api/price/colors')) return next()
        priceColors()
          .then((data) => {
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify(data))
          })
          .catch((e) => {
            res.statusCode = 502
            res.end(JSON.stringify({ error: String(e?.message || e) }))
          })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), priceApi()],
  server: {
    // Proxy BluKit API through the dev server to avoid any CORS issues.
    proxy: {
      '/api/blukit': {
        target: 'https://blupix.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
