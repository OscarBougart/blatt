import { defineConfig } from 'vitest/config';
import path from 'node:path';

/** Run by hand: npm run library:german. Hits Wikisource only. */
export default defineConfig({
  test: {
    include: ['scripts/fetch-german.test.ts'],
    testTimeout: 60 * 60 * 1000,
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
});
