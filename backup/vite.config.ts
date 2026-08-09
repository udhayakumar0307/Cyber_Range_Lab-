import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// OPTIMIZATION 2: Bundle splitting — vendor libraries separated from app code.
// Each vendor chunk is independently cacheable by the browser.
// App code changes do NOT bust the react-vendor or router-vendor cache.
export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    host: true,         // Listen on all network interfaces (0.0.0.0)
    allowedHosts: true, // Allow ngrok host headers
    watch: {
      ignored: [
        '**/workspaces/**',
        '**/backend/**',
        '**/*.db*',
        '**/*.log',
        '**/scratch/**',
        '**/.system_generated/**'
      ]
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        ws: true, // Enable WebSocket proxying for terminal connections
      },
      // Proxy /static to FastAPI so xterm.js and xterm-addon-fit.js load correctly.
      '/static': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      // Proxy /uploads to FastAPI to serve uploaded assets (certificates, profile photos) correctly
      '/uploads': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },


  build: {
    // Warn when a single chunk exceeds 500 kB (down from Vite default 500 kB)
    chunkSizeWarningLimit: 500,

    // No sourcemaps in production build (saves ~40% bundle transfer)
    sourcemap: false,

    rollupOptions: {
      output: {
        /**
         * manualChunks — deterministic vendor splitting strategy.
         *
         * Groups:
         *   react-vendor  → react, react-dom, scheduler
         *   router-vendor → react-router-dom, react-router
         *   icons-vendor  → lucide-react (large icon library)
         *
         * All page chunks remain auto-split by Vite via React.lazy()
         * defined in App.tsx (Optimization 1).
         */
        manualChunks(id: string) {
          // React core runtime — changes almost never
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }

          // React Router — changes infrequently
          if (
            id.includes('node_modules/react-router-dom/') ||
            id.includes('node_modules/react-router/')
          ) {
            return 'router-vendor';
          }

          // Lucide icon library — large, rarely changes
          if (id.includes('node_modules/lucide-react/')) {
            return 'icons-vendor';
          }
        },
      },
    },
  },
})

