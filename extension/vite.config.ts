import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

/**
 * The popup: an ordinary HTML entry, ES modules. The content script is built
 * separately (vite.content.config.ts) because an injected script cannot be a
 * module.
 */
export default defineConfig({
  // The popup restates none of the palette: it imports the app's stylesheet,
  // which is a Tailwind theme block, so Tailwind has to process it here too.
  plugins: [tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(import.meta.dirname, 'index.html'),
    },
  },
  resolve: {
    // The lemma cascade and the dictionary come from the app rather than being
    // copied here — a second copy would drift.
    alias: {
      '@app': path.resolve(import.meta.dirname, '../src'),
      // The shared modules import each other through the app's own alias.
      '@': path.resolve(import.meta.dirname, '../src'),
    },
  },
});
