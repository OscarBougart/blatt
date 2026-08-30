import { db } from '@/db/db';
import type { Doc } from '@/db/types';
import { tokenize } from '@/lib/lemma/tokenize';

/**
 * Recording which lemmas the reader has read past.
 *
 * This fires every time a paragraph meets the dwell threshold, which is
 * constantly, on the same event that already drives `paragraphsViewed`. So it
 * is one batched write per paragraph rather than one per word, and it is
 * fire-and-forget: nothing here is allowed to make reading wait.
 */

/** The distinct lemmas of one paragraph, via the document's own map. */
export function lemmasOf(paragraph: string, lemmaMap: Doc['lemmaMap']): string[] {
  const lemmas = new Set<string>();
  for (const surface of tokenize(paragraph)) {
    lemmas.add(lemmaMap?.[surface]?.[0]?.lemma ?? surface);
  }
  return [...lemmas];
}

/**
 * Count one sighting for each lemma, in a single transaction.
 *
 * Once per paragraph, not once per occurrence: a paragraph that says "Frosch"
 * four times is one act of reading, and counting it four times would let a
 * single repetitive sentence declare a word known.
 */
export async function recordSightings(lemmas: string[], now: number): Promise<void> {
  if (lemmas.length === 0) return;

  await db.transaction('rw', db.sightings, async () => {
    const existing = await db.sightings.bulkGet(lemmas);
    await db.sightings.bulkPut(
      lemmas.map((lemma, i) => ({
        lemma,
        count: (existing[i]?.count ?? 0) + 1,
        lastSeenAt: now,
      })),
    );
  });
}
