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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import type { FormLookup, FormResolver } from '@/lib/lemma/cascade';
import { lemmatize } from '@/lib/lemma/cascade';
import { tokenize, uniqueTokens } from '@/lib/lemma/tokenize';
import type { LemmaCandidate } from '@/lib/lemma/types';
import { lookupForm } from '@/lib/lemma/wiktionary';
import { fetchDefinitions } from '@/lib/dict';
import { locate } from '@/lib/segment';
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
const UA = 'Blatt/0.1 (local-first German reading app; personal project)';

/** Wikimedia rate-limits this hard enough to matter. Be patient, not clever. */
const CONCURRENCY = 4;

/**
 * Minimum gap between requests to Wikimedia.
 *
 * Generous on purpose. The definition endpoint tolerates a short burst and
 * then starts refusing for minutes at a time, so the whole run is paced to
 * what it will sustain rather than to what it will briefly allow.
 */
const GAP_MS = 250;

/** How often the on-disk caches are flushed, in items. */
const FLUSH_EVERY = 25;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Every request out of this script goes through here.
 *
 * Two things the browser gives the app for free and Node does not. First a
 * real `User-Agent`: Wikimedia answers 429 to anything without one, which the
 * app code reads as "no such word" and quietly degrades — the first run of
 * this script produced a seed with five definitions in it before that was
 * understood. Second, one request at a time with a gap, and a real backoff
 * when the rate limiter does object.
 *
 * Patching the global keeps the app's own fetch calls untouched: the lemma
 * cascade and the dictionary here are exactly the code that runs in the
 * browser, which is the point — the shipped map must be the map a reader
 * would have built themselves.
 */
function politeFetch() {
  const real = globalThis.fetch;
  let queue: Promise<unknown> = Promise.resolve();

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const run = async () => {
      for (let attempt = 0; attempt < 9; attempt++) {
        const response = await real(input, {
          ...init,
          headers: { ...(init?.headers as Record<string, string>), 'User-Agent': UA },
        });
        if (response.status !== 429 && response.status !== 503) return response;

        // Believe the server if it says how long to wait. Its number is the
        // real one; ours is a guess that has already been wrong once.
        const retryAfter = Number(response.headers.get('retry-after'));
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : Math.min(120_000, 1000 * 2 ** attempt);
        console.log(`rate limited, waiting ${Math.round(backoff / 1000)}s`);
        await sleep(backoff);
      }
      throw new Error('rate-limited after nine attempts');
    };

    const result = queue.then(run);
    queue = result.then(() => sleep(GAP_MS), () => sleep(GAP_MS));
    return result;
  }) as typeof fetch;
}

function cached<T>(name: string, fallback: T): T {
  const path = `${CACHE_DIR}/${name}`;
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function writeCache(name: string, value: unknown) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(`${CACHE_DIR}/${name}`, JSON.stringify(value), 'utf8');
}

/** Strip a Wikisource HTML page down to its prose paragraphs. */
function paragraphsFrom(html: string): string[] {
  const body = html
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<sup[\s\S]*?<\/sup>/g, '')
    .replace(/<table[\s\S]*?<\/table>/g, '')
    .replace(/<h[1-6][\s\S]*?<\/h[1-6]>/g, '');

  return [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
    .map(([, inner]) =>
      inner
        .replace(/<[^>]+>/g, '')
        .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&nbsp;/g, ' ')
        // Wikisource carries soft hyphens and page-join zero-width spaces.
        .replace(/[­​]/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((p) => p.length > 40);
}

async function fetchPage(host: string, title: string, cacheName: string): Promise<string[]> {
  const hit = cached<string[] | null>(cacheName, null);
  if (hit) return hit;

  const url = `https://${host}/api/rest_v1/page/html/${encodeURIComponent(title)}`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(url, { headers: { 'User-Agent': UA } });
    if (response.status === 429) {
      await sleep(4000 * (attempt + 1));
      continue;
    }
    if (!response.ok) throw new Error(`${host} ${response.status}`);
    const paragraphs = paragraphsFrom(await response.text());
    writeCache(cacheName, paragraphs);
    return paragraphs;
  }
  throw new Error(`${host} rate-limited`);
}

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

/** A resolver backed by a disk cache, standing in for the app's Dexie one. */
function diskResolver(): { resolve: FormResolver; save: () => void } {
  const cache = cached<Record<string, FormLookup | null>>('forms.json', {});
  let since = 0;
  const save = () => writeCache('forms.json', cache);

  return {
    resolve: async (surface) => {
      if (surface in cache) return cache[surface];
      const looked = await lookupForm(surface);
      cache[surface] = looked;
      // Flushed as it goes. A run that dies an hour in must not throw away an
      // hour of Wikimedia's time along with its own.
      if (++since >= FLUSH_EVERY) {
        since = 0;
        save();
      }
      return looked;
    },
    save,
  };
}

/** Run `worker` over `items`, a few at a time. */
async function pool<T>(items: T[], worker: (item: T, index: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        await worker(items[index], index);
      }
    }),
  );
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

  const de = await fetchPage('de.wikisource.org', DE_TITLE, 'de.json');
  const en = applySplits(await fetchPage('en.wikisource.org', EN_TITLE, 'en.json'));
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

  const { resolve, save } = diskResolver();
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

  const defCache = cached<Record<string, string[]>>('definitions.json', {});
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
        writeCache('definitions.json', defCache);
        console.log(`definitions ${fetched}/${lemmas.length}`);
      }
    });
  } finally {
    writeCache('definitions.json', defCache);
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
