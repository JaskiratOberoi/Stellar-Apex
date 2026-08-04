import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Proxy /api to the local backend container so the browser talks to a
    // single origin. The dev stack was retired — the prod stack (apex_php_prod,
    // host port 8090) is the local backend now. CAUTION: dev writes hit the
    // production DB; use VITE_API_PROXY to point elsewhere if needed.
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://localhost:8090',
        changeOrigin: true,
      },
    },
  },
})
