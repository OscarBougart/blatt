import { defineConfig } from 'vite';
import path from 'node:path';

/**
 * The content script, as one self-contained IIFE.
 *
 * `chrome.scripting.executeScript({ files })` runs a classic script, not a
 * module, so this cannot be code-split and cannot use imports at runtime.
 */
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: path.resolve(import.meta.dirname, 'src/content.ts'),
      formats: ['iife'],
      name: 'BlattCapture',
      fileName: () => 'content.js',
    },
  },
  resolve: {
    alias: {
      '@app': path.resolve(import.meta.dirname, '../src'),
      // The shared modules import each other through the app's own alias.
      '@': path.resolve(import.meta.dirname, '../src'),
    },
  },
});
