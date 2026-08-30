import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

/**
 * The popup: an ordinary HTML entry, ES modules, nothing special.
 *
 * The content script is built separately (vite.content.config.ts) because a
 * script injected into a page cannot be a module.
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
    // The lemma cascade and the dictionary are the app's, imported rather than
    // copied: a second copy would drift, and the whole point is that a captured
    // document is lemmatised exactly as an imported one.
    alias: {
      '@app': path.resolve(import.meta.dirname, '../src'),
      // The shared modules import each other through the app's own alias.
      '@': path.resolve(import.meta.dirname, '../src'),
    },
  },
});
