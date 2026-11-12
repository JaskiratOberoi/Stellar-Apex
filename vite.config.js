import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Proxy /api to the local backend container so the browser talks to a
    // single origin. Targets the DEV stack (docker-compose.yml, host port 8080,
    // started with `docker compose -p stellar-apex-dev up -d`). The prod stack
    // listens on 8090: never point dev at it. VITE_API_PROXY overrides.
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
