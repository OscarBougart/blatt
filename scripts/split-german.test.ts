/**
 * Cut the cached German into flip-sized paragraphs: npm run library:split
 *
 * Run once, after `npm run library:german` and before anything is translated.
 * Rewrites scripts/.library-cache/<slug>.de.json in place, and refuses to run
 * on a text whose English already exists — re-splitting after translation
 * would leave the two sides with different lengths, which is the one failure
 * this whole pipeline is built to prevent.
 */
import { existsSync } from 'node:fs';
import { it, expect } from 'vitest';
import { diskCache } from './lib/harvest';
import { splitParagraphs } from './lib/split-paragraphs';
import { TEXTS } from './library-source';

const CACHE_DIR = 'scripts/.library-cache';

it('splits the cached German into flip-sized paragraphs', () => {
  const cache = diskCache(CACHE_DIR);
  let before = 0;
  let after = 0;

  for (const text of TEXTS) {
    const paragraphs = cache.read<string[] | null>(`${text.slug}.de.json`, null);
    if (!paragraphs) throw new Error(`${text.slug}: run npm run library:german first`);

    if (existsSync(`${CACHE_DIR}/${text.slug}.en.json`)) {
      console.log(`${text.slug}: already translated, left alone`);
      before += paragraphs.length;
      after += paragraphs.length;
      continue;
    }

    const split = splitParagraphs(paragraphs);
    // Nothing may be lost or reordered by a cut.
    expect(split.join(' ')).toBe(paragraphs.join(' '));

    cache.write(`${text.slug}.de.json`, split);
    before += paragraphs.length;
    after += split.length;
    console.log(`${text.slug}\t${paragraphs.length} -> ${split.length}`);
  }

  console.log(`${before} -> ${after} paragraphs`);
});
