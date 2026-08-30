import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';


export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // The shell, the fonts and the seed document. Newsreader is the whole
        // typographic argument of the app: falling back to a system serif
        // offline would be a different product. The seed is precached because
        // a cold offline launch has to land on something readable.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        // A standalone PWA opened at any route must not get a 404 from the
        // network it does not have.
        navigateFallback: 'index.html',
        // The seed and the font files are comfortably over the 2 MiB default.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
      manifest: {
        name: 'Blatt',
        short_name: 'Blatt',
        description: 'Read German. Peek at English only when you mean to.',
        theme_color: '#1A1714',
        background_color: '#FAF8F4',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  // The measurement script in scripts/ hits the live network. It is run by
  // hand, not as part of `npm test`.
  test: {
    // The capture extension shares the app's lemma engine and its export
    // format, so its tests belong to the same run: a change here that breaks
    // the handoff should fail `npm test`, not be discovered in Chrome.
    include: ['src/**/*.test.ts', 'extension/src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@app': path.resolve(import.meta.dirname, 'src'),
    },
  },
});
