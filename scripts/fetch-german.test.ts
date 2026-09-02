/**
 * Fetch the German side of every library text: npm run library:german
 *
 * Splits the first half of the library build off from the rest, so the
 * paragraphs can be translated by something other than the API — by hand, or
 * in a Claude Code session — and dropped into the same cache the build reads.
 *
 * Writes scripts/.library-cache/<slug>.de.json. Write the matching
 * <slug>.en.json yourself, with exactly as many entries in exactly the same
 * order, and `npm run library` will use it and never call the model.
 */
import { it } from 'vitest';
import { DIALOGUE_MIN, diskCache, fetchPage, politeFetch } from './lib/harvest';
import { TEXTS } from './library-source';

const CACHE_DIR = 'scripts/.library-cache';

it('fetches the German side of every library text', async () => {
  const restore = politeFetch();
  const cache = diskCache(CACHE_DIR);

  try {
    let total = 0;
    for (const text of TEXTS) {
      const paragraphs = await fetchPage(
        'de.wikisource.org',
        text.source,
        `${text.slug}.de.json`,
        cache,
        // Dialogue, not just narration: a one-line answer is the turning
        // point of more than one of these tales.
        DIALOGUE_MIN,
      );
      if (paragraphs.length === 0) throw new Error(`${text.slug}: no paragraphs`);
      total += paragraphs.length;

      const words = paragraphs.reduce((sum, p) => sum + p.split(/\s+/).length, 0);
      console.log(`${text.slug}\t${paragraphs.length} paragraphs\t${words} words`);
    }
    console.log(`${TEXTS.length} texts, ${total} paragraphs`);
  } finally {
    restore();
  }
});
