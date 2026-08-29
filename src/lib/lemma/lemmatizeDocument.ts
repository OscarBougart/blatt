import { db } from '@/db/db';
import type { Pair } from '@/db/types';
import { lemmatize, type FormResolver } from './cascade';
import { uniqueTokens } from './tokenize';
import type { LemmaCandidate } from './types';
import { lookupForm } from './wiktionary';

/** How many lookups are in flight at once. Polite, not slow. */
const CONCURRENCY = 6;

export type LemmaMap = Record<string, LemmaCandidate[]>;

export interface Progress {
  done: number;
  total: number;
}

/**
 * A resolver backed by the permanent Dexie cache.
 *
 * The cache is the lemma table: it costs one request per distinct word ever
 * read, and never expires. A second document about the same subject is mostly
 * free.
 */
export function cachedResolver(): FormResolver {
  return async (surface) => {
    const cached = await db.forms.get(surface);
    if (cached) return { lemma: cached.lemma, isLemma: cached.isLemma };

    const looked = await lookupForm(surface);
    await db.forms.put({
      surface,
      lemma: looked?.lemma ?? null,
      isLemma: looked?.isLemma ?? false,
      fetchedAt: Date.now(),
    });
    return looked;
  };
}

/** The sentence a surface form first appears in, for separable-prefix context. */
function firstSentences(paragraphs: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const paragraph of paragraphs) {
    for (const sentence of paragraph.split(/(?<=[.!?])\s+/)) {
      for (const token of sentence.match(/[A-Za-zÄÖÜäöüßẞ]+/g) ?? []) {
        if (!out.has(token)) out.set(token, sentence);
      }
    }
  }
  return out;
}

/**
 * Lemmatise a whole document once, at import.
 *
 * Every distinct surface form is resolved and stored, so tapping a word while
 * reading is a map lookup and never a network call.
 */
export async function lemmatizeDocument(
  pairs: Pair[],
  options: { resolveForm?: FormResolver | null; onProgress?: (p: Progress) => void } = {},
): Promise<LemmaMap> {
  const { resolveForm = cachedResolver(), onProgress } = options;

  const german = pairs.map((p) => p.de);
  const tokens = uniqueTokens(german);
  const sentences = firstSentences(german);

  const map: LemmaMap = {};
  let done = 0;
  let next = 0;

  async function worker() {
    while (next < tokens.length) {
      const surface = tokens[next++];
      map[surface] = await lemmatize(surface, {
        sentence: sentences.get(surface) ?? '',
        resolveForm: resolveForm ?? undefined,
      });
      onProgress?.({ done: ++done, total: tokens.length });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, tokens.length) }, () => worker()),
  );

  return map;
}
