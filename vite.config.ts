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
      includeAssets: ['favicon.svg'],
      manifest: {
        name: '75 Hard Companion',
        short_name: '75 Hard',
        description: 'Track your 75 Hard challenge — workouts, diet, water, reading and progress photos.',
        theme_color: '#3dd16f',
        background_color: '#fbfbf8',
        display: 'standalone',
        icons: [
          { src: '/manifest-icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/manifest-icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/manifest-icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,png}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
})
