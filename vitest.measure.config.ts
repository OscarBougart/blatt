import { defineConfig } from 'vitest/config';

/** Run by hand: npm run measure. Hits the live Wiktionary API. */
export default defineConfig({
  test: {
    include: ['scripts/**/*.test.ts'],
    testTimeout: 30 * 60 * 1000,
  },
});
