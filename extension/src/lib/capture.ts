import { lemmatize } from '@app/lib/lemma/cascade';
import { uniqueTokens } from '@app/lib/lemma/tokenize';
import type { LemmaCandidate } from '@app/lib/lemma/types';
import { lookupForm } from '@app/lib/lemma/wiktionary';
import { fetchDefinitions } from '@app/lib/dictApi';
import type { CapturedWord } from './bundle';

/**
 * Lemmatising and looking up a captured article, using the app's own cascade
 * rather than a copy of it. Otherwise tapping a word on the phone gives a
 * different answer depending on which door the text came through.
 */

/** Polite, and the same figure the app's import uses. */
const CONCURRENCY = 4;

/** Run `worker` over `items`, a few at a time. */
async function pool<T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) await worker(items[next++]);
    }),
  );
}

/** A resolver backed by the extension's own storage, so a re-capture is cheap. */
function cachedResolver() {
  const cache = new Map<string, { lemma: string | null; isLemma: boolean } | null>();

  return async (surface: string) => {
    if (cache.has(surface)) return cache.get(surface) ?? null;
    const looked = await lookupForm(surface);
    cache.set(surface, looked);
    return looked;
  };
}

export interface Progress {
  phase: 'lemmas' | 'definitions';
  done: number;
  total: number;
}

/** The first sentence each surface form appears in, for separable prefixes. */
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

export interface Analysed {
  lemmaMap: Record<string, LemmaCandidate[]>;
  definitions: { lemma: string; definitions: string[] }[];
}

/**
 * Lemmatise the German, then fetch every definition it needs, so the document
 * arrives on the phone fully readable offline. The laptop has the connection
 * and the patience for this; the phone has neither.
 */
export async function analyse(
  german: string[],
  onProgress?: (progress: Progress) => void,
): Promise<Analysed> {
  const tokens = uniqueTokens(german);
  const sentences = firstSentences(german);
  const resolve = cachedResolver();

  const lemmaMap: Record<string, LemmaCandidate[]> = {};
  let done = 0;

  await pool(tokens, async (surface) => {
    lemmaMap[surface] = await lemmatize(surface, {
      sentence: sentences.get(surface) ?? '',
      resolveForm: resolve,
    });
    onProgress?.({ phase: 'lemmas', done: ++done, total: tokens.length });
  });

  const lemmas = [
    ...new Set(
      Object.values(lemmaMap)
        .map((candidates) => candidates[0]?.lemma)
        .filter((lemma): lemma is string => Boolean(lemma)),
    ),
  ];

  const definitions: { lemma: string; definitions: string[] }[] = [];
  let fetched = 0;

  await pool(lemmas, async (lemma) => {
    try {
      definitions.push({ lemma, definitions: await fetchDefinitions(lemma) });
    } catch {
      // A missing definition is not fatal: the word still saves, and the app
      // retries the lookup when it next has a connection.
    }
    onProgress?.({ phase: 'definitions', done: ++fetched, total: lemmas.length });
  });

  return { lemmaMap, definitions };
}

/**
 * Fill in the lemma and definition of words saved by double-clicking. They are
 * stored bare in the page: a save should feel instant, and the content script
 * has neither the cascade nor a reason to wait on the network.
 */
export async function resolveWords(
  words: CapturedWord[],
  lemmaMap: Record<string, LemmaCandidate[]>,
  definitions: { lemma: string; definitions: string[] }[],
): Promise<CapturedWord[]> {
  const known = new Map(definitions.map((entry) => [entry.lemma, entry.definitions]));
  const resolve = cachedResolver();

  const out: CapturedWord[] = [];
  for (const word of words) {
    const fromDoc = lemmaMap[word.surface]?.[0]?.lemma;
    const lemma =
      fromDoc ??
      (await lemmatize(word.surface, { sentence: word.sentence, resolveForm: resolve }))[0]?.lemma ??
      word.surface;

    let gloss = known.get(lemma)?.[0] ?? '';
    if (!gloss) {
      try {
        gloss = (await fetchDefinitions(lemma))[0] ?? '';
      } catch {
        gloss = '';
      }
    }

    out.push({ ...word, lemma, definition: gloss });
  }
  return out;
}
