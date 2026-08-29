import type { Pair } from '@/db/types';
import { lookupDefinition, isCached } from './dict';
import { lemmatizeDocument, type LemmaMap } from './lemma/lemmatizeDocument';

/** Definition fetches in flight at once. */
const CONCURRENCY = 4;

export interface ImportProgress {
  done: number;
  total: number;
  phase: 'lemmas' | 'definitions';
}

/** The lemma a document will actually use for a surface form: the best one. */
export function bestLemmas(map: LemmaMap): string[] {
  const out = new Set<string>();
  for (const candidates of Object.values(map)) {
    if (candidates.length > 0) out.add(candidates[0].lemma);
  }
  return [...out];
}

/**
 * Import a document: lemmatise it, then prefetch every definition it needs.
 *
 * Both passes report into one continuous count, because a document is either
 * ready to read offline or still importing. There is no third state to
 * explain to the reader, so there is no third state in the progress either.
 *
 * The total grows once, at the phase boundary — the number of lemmas to fetch
 * is not knowable until the lemma pass has finished.
 */
export async function importDocument(
  pairs: Pair[],
  onProgress?: (progress: ImportProgress) => void,
): Promise<LemmaMap> {
  const lemmaMap = await lemmatizeDocument(pairs, {
    onProgress: ({ done, total }) => onProgress?.({ done, total, phase: 'lemmas' }),
  });

  const lemmaPassTotal = Object.keys(lemmaMap).length;

  // Only fetch what is not already cached. A second story by the same author
  // is mostly free.
  const lemmas = bestLemmas(lemmaMap);
  const missing: string[] = [];
  for (const lemma of lemmas) {
    if (!(await isCached(lemma))) missing.push(lemma);
  }

  const total = lemmaPassTotal + missing.length;
  let done = lemmaPassTotal;
  onProgress?.({ done, total, phase: 'definitions' });

  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, missing.length) }, async () => {
      while (next < missing.length) {
        // A failed definition is not fatal: the word still saves, and the
        // lookup is retried later. Import must not fail over a dictionary miss.
        await lookupDefinition(missing[next++]);
        onProgress?.({ done: ++done, total, phase: 'definitions' });
      }
    }),
  );

  return lemmaMap;
}
