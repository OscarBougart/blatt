/**
 * Build the demo document: npm run seed
 *
 * Writes public/seed.json, which the app installs on first run. Everything the
 * demo needs is precomputed here — paragraphs aligned, every surface form
 * lemmatised, every definition inlined, six words already saved and due — so
 * that a first launch makes no network calls at all. A stranger opening the
 * link on a phone in a tunnel gets the whole product.
 *
 * Run by hand, not in CI. Both caches are on disk, so a re-run costs Wikimedia
 * nothing for anything it has already asked about.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { lemmatize } from '@/lib/lemma/cascade';
import { tokenize, uniqueTokens } from '@/lib/lemma/tokenize';
import type { LemmaCandidate } from '@/lib/lemma/types';
import { fetchDefinitions } from '@/lib/dict';
import { locate } from '@/lib/segment';
import { FLUSH_EVERY, diskCache, diskResolver, fetchPage, politeFetch, pool } from './lib/harvest';
import {
  ALIGNMENT,
  DE_TITLE,
  EN_TITLE,
  SEED_WORD_COUNT,
  SPLITS,
  THEME,
  TITLE,
} from './seed-source';

const CACHE_DIR = 'scripts/.seed-cache';
const OUT = 'public/seed.json';

const cache = diskCache(CACHE_DIR);

/** Cut Hunt's long paragraphs where the German breaks. */
function applySplits(paragraphs: string[]): string[] {
  const out = paragraphs.slice();
  // Back to front, so an earlier split does not move a later index.
  for (const { paragraph, at } of [...SPLITS].sort((a, b) => b.paragraph - a.paragraph)) {
    const text = out[paragraph];
    const index = text?.indexOf(at) ?? -1;
    if (index < 0) throw new Error(`split marker not found in paragraph ${paragraph}: "${at}"`);
    out.splice(paragraph, 1, text.slice(0, index).trim(), text.slice(index).trim());
  }
  return out;
}

/**
 * Six words the demo arrives with, so the review screen is never empty.
 *
 * Picked by rule rather than by hand so a regenerated seed picks the same
 * ones: the longest word in each paragraph that has a definition and has not
 * been taken already. Long words are the ones a B2 reader actually stops on,
 * and one per paragraph spreads the cards across the story.
 *
 * The deduplication is the part that matters. Without it this tale hands you
 * "Königstochter" four times out of six — it is the longest word in most
 * paragraphs — and a review session of one repeated card teaches a visitor
 * nothing about what the app does.
 */
function pickSeedWords(
  pairs: { de: string }[],
  lemmaMap: Record<string, LemmaCandidate[]>,
  definitions: Map<string, string[]>,
) {
  const words = [];
  const taken = new Set<string>();

  for (let index = 0; index < pairs.length && words.length < SEED_WORD_COUNT; index++) {
    const paragraph = pairs[index].de;

    const candidates = tokenize(paragraph)
      .filter((surface) => surface.length >= 7)
      .map((surface) => ({ surface, lemma: lemmaMap[surface]?.[0]?.lemma ?? surface }))
      .filter(({ lemma }) => (definitions.get(lemma)?.length ?? 0) > 0)
      .filter(({ lemma }) => !taken.has(lemma))
      .sort((a, b) => b.surface.length - a.surface.length || a.surface.localeCompare(b.surface));

    const chosen = candidates[0];
    if (!chosen) continue;
    taken.add(chosen.lemma);

    const offset = paragraph.indexOf(chosen.surface);
    const { sentence, charOffset } = locate(paragraph, offset);

    words.push({
      surface: chosen.surface,
      lemma: chosen.lemma,
      definition: definitions.get(chosen.lemma)?.[0] ?? '',
      sentence,
      charOffset,
      paragraphIndex: index,
    });
  }

  return words;
}

it('builds public/seed.json', async () => {
  politeFetch();

  const de = await fetchPage('de.wikisource.org', DE_TITLE, 'de.json', cache);
  const en = applySplits(await fetchPage('en.wikisource.org', EN_TITLE, 'en.json', cache));
  console.log(`source paragraphs: ${de.length} German, ${en.length} English after splits`);

  const pairs = ALIGNMENT.map(({ de: dei, en: eni }) => {
    for (const i of dei) if (!de[i]) throw new Error(`no German paragraph ${i}`);
    for (const i of eni) if (!en[i]) throw new Error(`no English paragraph ${i}`);
    return { de: dei.map((i) => de[i]).join(' '), en: eni.map((i) => en[i]).join(' ') };
  });

  // Lemmatise exactly as the app does at import, so the shipped map is the map
  // the reader would have built themselves.
  const german = pairs.map((p) => p.de);
  const tokens = uniqueTokens(german);
  const firstSentence = new Map<string, string>();
  for (const paragraph of german) {
    for (const sentence of paragraph.split(/(?<=[.!?])\s+/)) {
      for (const token of tokenize(sentence)) {
        if (!firstSentence.has(token)) firstSentence.set(token, sentence);
      }
    }
  }

  const { resolve, save } = diskResolver(cache);
  const lemmaMap: Record<string, LemmaCandidate[]> = {};
  let done = 0;

  await pool(tokens, async (surface) => {
    lemmaMap[surface] = await lemmatize(surface, {
      sentence: firstSentence.get(surface) ?? '',
      resolveForm: resolve,
    });
    if (++done % 50 === 0) console.log(`lemmas ${done}/${tokens.length}`);
  });
  save();

  const lemmas = [
    ...new Set(
      Object.values(lemmaMap)
        .map((candidates) => candidates[0]?.lemma)
        .filter((lemma): lemma is string => Boolean(lemma)),
    ),
  ];

  const defCache = cache.read<Record<string, string[]>>('definitions.json', {});
  let fetched = 0;
  let failed = 0;

  try {
    await pool(lemmas, async (lemma) => {
      if (lemma in defCache) return;
      try {
        // A failure is never cached. An empty result is: Wiktionary having no
        // German gloss for a word is an answer, and a fixed one. Caching the
        // two the same way is what made the first seed ship almost empty.
        defCache[lemma] = await fetchDefinitions(lemma);
      } catch {
        // One word the rate limiter would not give up is not worth losing the
        // build over. It stays uncached, so the next run asks again.
        failed++;
      }
      if (++fetched % FLUSH_EVERY === 0) {
        cache.write('definitions.json', defCache);
        console.log(`definitions ${fetched}/${lemmas.length}`);
      }
    });
  } finally {
    cache.write('definitions.json', defCache);
  }
  if (failed > 0) console.log(`${failed} definitions could not be fetched; re-run to retry`);

  const definitions = new Map(lemmas.map((lemma) => [lemma, defCache[lemma] ?? []]));
  const withDefinitions = [...definitions.values()].filter((d) => d.length > 0).length;

  const seed = {
    title: TITLE,
    theme: THEME,
    source: { de: DE_TITLE, en: EN_TITLE },
    pairs,
    lemmaMap,
    dict: [...definitions.entries()]
      .filter(([, defs]) => defs.length > 0)
      .map(([lemma, defs]) => ({ lemma, definitions: defs })),
    words: pickSeedWords(pairs, lemmaMap, definitions),
  };

  writeFileSync(OUT, JSON.stringify(seed), 'utf8');

  const size = Math.round(readFileSync(OUT).length / 1024);
  console.log(
    `${OUT}: ${pairs.length} paragraphs, ${tokens.length} forms, ` +
      `${withDefinitions}/${lemmas.length} definitions, ${seed.words.length} seed words, ${size} KB`,
  );
});
