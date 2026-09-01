import { defineConfig } from 'vitest/config';
import path from 'node:path';

/** Run by hand: npm run library. Hits Wikisource, Wiktionary and the Claude API. */
export default defineConfig({
  test: {
    include: ['scripts/build-library.test.ts'],
    testTimeout: 6 * 60 * 60 * 1000,
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
});
