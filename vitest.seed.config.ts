import { defineConfig } from 'vitest/config';
import path from 'node:path';

/** Run by hand: npm run seed. Hits Wikisource and Wiktionary. */
export default defineConfig({
  test: {
    include: ['scripts/build-seed.test.ts'],
    testTimeout: 60 * 60 * 1000,
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
});
