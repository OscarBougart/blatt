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
      includeAssets: ['favicon.svg'],
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
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  // The measurement script in scripts/ hits the live network. It is run by
  // hand, not as part of `npm test`.
  test: {
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
});
