import { db } from '@/db/db';
import type { DictEntry } from '@/db/types';
import { fetchDefinitions } from './dictApi';

export { fetchDefinitions };

/**
 * Definition for a lemma, cache first, always.
 *
 * The cache is permanent and never evicted: a definition does not go stale,
 * and a word looked up once should never cost the network again.
 *
 * Returns null when the lookup failed — which is deliberately different from
 * an empty array, meaning "Wiktionary genuinely has nothing". A failure is
 * never cached, so it will be retried; an empty result is cached, so it is not.
 */
export async function lookupDefinition(lemma: string): Promise<DictEntry | null> {
  const entry = await lookupExact(lemma);
  if (!entry || entry.definitions.length > 0) return entry;

  // A sentence-initial `Dann` can reach here capitalised: documents imported
  // before the lemma pass learned which casing matched still carry it. Its
  // lowercase is where Wiktionary keeps the meaning.
  const lower = lemma.charAt(0).toLowerCase() + lemma.slice(1);
  if (lower === lemma) return entry;
  const fallback = await lookupExact(lower);
  return fallback && fallback.definitions.length > 0 ? fallback : entry;
}

async function lookupExact(lemma: string): Promise<DictEntry | null> {
  const cached = await db.dict.get(lemma);
  if (cached) return cached;

  let definitions: string[];
  try {
    definitions = await fetchDefinitions(lemma);
  } catch {
    return null;
  }

  const entry: DictEntry = {
    lemma,
    definitions,
    fetchedAt: Date.now(),
    source: 'wiktionary',
  };
  await db.dict.put(entry);
  return entry;
}

/** True when this lemma already has a cached definition. */
export async function isCached(lemma: string): Promise<boolean> {
  return (await db.dict.get(lemma)) !== undefined;
}
