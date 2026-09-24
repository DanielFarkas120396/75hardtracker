/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Icons are generated from public/mascot.svg by `npm run generate-pwa-assets` (pwa-assets.config.ts).
      includeAssets: ['favicon.ico', 'mascot.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/',
        name: '75 Hard Companion',
        short_name: '75 Hard',
        description: 'Track your 75 Hard challenge — workouts, diet, water, reading and progress photos.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#3dd16f',
        background_color: '#fbfbf8',
        categories: ['health', 'fitness', 'lifestyle'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Icons are precached via includeAssets and the manifest. Only the latin font subsets in
        // woff2 are precached: the others are for scripts the app doesn't use, and every browser
        // that can install a PWA reads woff2.
        globPatterns: ['**/*.{js,css,html}', '**/nunito-latin-*.woff2', '**/nunito-latin-ext-*.woff2'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // The IndexedDB tests do real (in-memory) IO; leave headroom for a busy machine.
    testTimeout: 15_000,
  },
})
