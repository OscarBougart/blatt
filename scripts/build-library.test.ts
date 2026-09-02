/**
 * Build the starter library: npm run library
 *
 * Writes public/library/<slug>.json, one per text, plus a shared dict.json and
 * an index.json the Library page lists. Everything expensive happens here —
 * the German is fetched, the English is translated paragraph by paragraph,
 * every surface form is lemmatised and every lemma looked up — so that adding
 * a text in the app is a database write and nothing else.
 *
 * The dictionary is shared across the whole library rather than inlined per
 * text. Definitions and lemma entries are ~90% of a built text's bytes and
 * every tale reuses `sein`, `haben`, `König`; a dozen private copies would be
 * a dozen times the download for almost the same words.
 *
 * Run by hand, never in CI. It costs money (the translation) and Wikimedia's
 * patience (everything else). Both caches are on disk, so a re-run only pays
 * for what changed — and a text already built is skipped entirely.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { lemmatize } from '@/lib/lemma/cascade';
import { tokenize, uniqueTokens } from '@/lib/lemma/tokenize';
import type { LemmaCandidate } from '@/lib/lemma/types';
import { fetchDefinitions } from '@/lib/dict';
import { FLUSH_EVERY, diskCache, diskResolver, fetchPage, politeFetch, pool } from './lib/harvest';
import { translateParagraphs } from './lib/translate-de';
import { TEXTS, THEME, type LibraryText } from './library-source';

const CACHE_DIR = 'scripts/.library-cache';
const OUT_DIR = 'public/library';

interface BuiltText {
  slug: string;
  title: string;
  theme: string;
  source: string;
  pairs: { de: string; en: string }[];
  lemmaMap: Record<string, LemmaCandidate[]>;
}

const cache = diskCache(CACHE_DIR);

/** The German, then the English, then both cached against the next run. */
async function pairsFor(text: LibraryText): Promise<{ de: string; en: string }[]> {
  const german = await fetchPage('de.wikisource.org', text.source, `${text.slug}.de.json`, cache);
  if (german.length === 0) throw new Error(`${text.slug}: no German paragraphs`);

  const already = cache.read<string[] | null>(`${text.slug}.en.json`, null);
  const english =
    already ??
    (await translateParagraphs(german, ({ done, total }) => {
      if (done % 5 === 0 || done === total) console.log(`  ${text.slug}: english ${done}/${total}`);
    }));

  // Cached only once it is whole. A half-translated text on disk would be
  // silently reused by the next run and shipped with English missing.
  if (english.length !== german.length) {
    throw new Error(`${text.slug}: ${german.length} German, ${english.length} English`);
  }
  if (!already) cache.write(`${text.slug}.en.json`, english);

  return german.map((de, index) => ({ de, en: english[index] }));
}

/** Lemmatise exactly as the app does at import. */
async function lemmaMapFor(german: string[]): Promise<Record<string, LemmaCandidate[]>> {
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

  await pool(tokens, async (surface) => {
    lemmaMap[surface] = await lemmatize(surface, {
      sentence: firstSentence.get(surface) ?? '',
      resolveForm: resolve,
    });
  });
  save();

  return lemmaMap;
}

/** Every first-choice lemma in a built text. */
function lemmasOf(built: BuiltText): string[] {
  return [
    ...new Set(
      Object.values(built.lemmaMap)
        .map((candidates) => candidates[0]?.lemma)
        .filter((lemma): lemma is string => Boolean(lemma)),
    ),
  ];
}

it('builds public/library', async () => {
  const restore = politeFetch();
  mkdirSync(OUT_DIR, { recursive: true });

  try {
    const built: BuiltText[] = [];
    const skipped: string[] = [];

    for (const text of TEXTS) {
      const out = `${OUT_DIR}/${text.slug}.json`;
      if (existsSync(out)) {
        // Already built and committed. Delete the file to rebuild one text.
        built.push(JSON.parse(readFileSync(out, 'utf8')) as BuiltText);
        console.log(`${text.slug}: already built, skipping`);
        continue;
      }

      // The English may have been made outside this script and dropped into
      // the cache — see npm run library:german. Without it, and without
      // credentials to make it here, the text is skipped rather than failing
      // the build: a library of four finished tales is worth shipping.
      const translated = existsSync(`${CACHE_DIR}/${text.slug}.en.json`);
      if (!translated && !process.env.ANTHROPIC_API_KEY) {
        console.log(`${text.slug}: no English cached and no API key, skipping`);
        skipped.push(text.slug);
        continue;
      }

      console.log(`${text.slug}: building`);
      const pairs = await pairsFor(text);
      const lemmaMap = await lemmaMapFor(pairs.map((pair) => pair.de));

      const one: BuiltText = {
        slug: text.slug,
        title: text.title,
        theme: THEME,
        source: text.source,
        pairs,
        lemmaMap,
      };
      writeFileSync(out, JSON.stringify(one), 'utf8');
      built.push(one);
      console.log(`${text.slug}: ${pairs.length} paragraphs, ${Object.keys(lemmaMap).length} forms`);
    }

    // One dictionary for the whole library, built from every lemma in it.
    const lemmas = [...new Set(built.flatMap(lemmasOf))].sort();
    const defs = cache.read<Record<string, string[]>>('definitions.json', {});
    let fetched = 0;
    let failed = 0;

    try {
      await pool(lemmas, async (lemma) => {
        if (lemma in defs) return;
        try {
          // A failure is never cached. An empty result is: Wiktionary having
          // no gloss for a word is an answer, and a fixed one.
          defs[lemma] = await fetchDefinitions(lemma);
        } catch {
          failed++;
        }
        if (++fetched % FLUSH_EVERY === 0) {
          cache.write('definitions.json', defs);
          console.log(`definitions ${fetched}/${lemmas.length}`);
        }
      });
    } finally {
      cache.write('definitions.json', defs);
    }
    if (failed > 0) console.log(`${failed} definitions could not be fetched; re-run to retry`);

    const dict = lemmas
      .filter((lemma) => (defs[lemma]?.length ?? 0) > 0)
      .map((lemma) => ({ lemma, definitions: defs[lemma] }));
    writeFileSync(`${OUT_DIR}/dict.json`, JSON.stringify(dict), 'utf8');

    // The index is what the Library page lists, and the only library file
    // fetched before a reader asks for a text. It stays small.
    const index = built.map((one) => ({
      slug: one.slug,
      title: one.title,
      theme: one.theme,
      source: one.source,
      paragraphs: one.pairs.length,
      words: one.pairs.reduce((sum, pair) => sum + pair.de.split(/\s+/).length, 0),
    }));
    writeFileSync(`${OUT_DIR}/index.json`, JSON.stringify(index), 'utf8');

    if (skipped.length > 0) console.log(`not built: ${skipped.join(', ')}`);

    const kb = (path: string) => Math.round(readFileSync(path).length / 1024);
    const texts = index.reduce((sum, one) => sum + kb(`${OUT_DIR}/${one.slug}.json`), 0);
    console.log(
      `${OUT_DIR}: ${built.length} texts (${texts} KB), ` +
        `${dict.length}/${lemmas.length} definitions (${kb(`${OUT_DIR}/dict.json`)} KB)`,
    );
  } finally {
    restore();
  }
});
